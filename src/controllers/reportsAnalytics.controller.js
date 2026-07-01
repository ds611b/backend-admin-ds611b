import { Op } from 'sequelize';
import {
    RegistroHoras,
    ProyectosInstitucion,
    GrupoEstudiantes,
    PerfilUsuario,
    Usuarios,
    Instituciones,
    AplicacionesEstudiantes,
    GrupoCarrera,
    Carreras,
    Grupos, // ← IMPORTANTE: Agregar Grupos
} from '../models/index.js';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

function findChromeExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/headless-chromium',
    '/snap/bin/chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ].filter(Boolean);

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch (e) {
      // ignore
    }
  }
  return null;
}

async function launchPuppeteer(options = {}) {
  try {
    return await puppeteer.launch(options);
  } catch (err) {
    // If Chromium binary not found, try common locations or CHROME_PATH
    if (err && (err.code === 'ENOENT' || /spawn .* ENOENT/.test(String(err.message)))) {
      const exe = process.env.CHROME_PATH || findChromeExecutable();
      if (exe) {
        return await puppeteer.launch({ ...options, executablePath: exe });
      }
    }
    throw err;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function safeNumber(v) { return v == null ? 0 : Number(v); }

function buildFullName(row, prefix = '') {
    const p = prefix ? `${prefix}.` : '';
    const fn = row[`${p}primer_nombre`] || '';
    const sn = row[`${p}segundo_nombre`] || '';
    const fa = row[`${p}primer_apellido`] || '';
    const sa = row[`${p}segundo_apellido`] || '';
    return `${fn} ${sn} ${fa} ${sa}`.replace(/\s+/g, ' ').trim() || 'Sin nombre';
}

function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-SV', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

const sequelize = () => RegistroHoras.sequelize;

// ─── Compute helpers (reusables para PDF y JSON) ────────────────────────────

async function computeOverviewData() {
    const totalHorasObj = await RegistroHoras.findOne({
        attributes: [[sequelize().fn('COALESCE', sequelize().fn('SUM', sequelize().col('horas_realizadas')), 0), 'total_horas']],
        where: { estado_validacion: 'Aprobado' },
        raw: true,
    });

    const totalHoras = safeNumber(totalHorasObj?.total_horas);
    const totalProyectos = await ProyectosInstitucion.count() || 0;
    const totalEstudiantes = await GrupoEstudiantes.count({ distinct: true, col: 'id_estudiante' }) || 0;
    const promedioHorasPorEstudiante = totalEstudiantes ? +(totalHoras / totalEstudiantes).toFixed(2) : 0;

    return { totalHoras, totalProyectos, totalEstudiantes, promedioHorasPorEstudiante };
}

async function computeHoursByProjectData() {
    const rows = await RegistroHoras.findAll({
        attributes: [
            'id_proyecto',
            [sequelize().fn('SUM', sequelize().col('horas_realizadas')), 'total_horas'],
        ],
        where: { estado_validacion: 'Aprobado' },
        include: [{ model: ProyectosInstitucion, as: 'proyecto', attributes: ['id', 'nombre', 'horas_requeridas', 'personas_requeridas'] }],
        group: ['id_proyecto', 'proyecto.id', 'proyecto.nombre', 'proyecto.horas_requeridas', 'proyecto.personas_requeridas'],
        order: [[sequelize().fn('SUM', sequelize().col('horas_realizadas')), 'DESC']],
        raw: true,
    });

    return rows.map(r => {
        const requiredPerProject = safeNumber(r['proyecto.horas_requeridas']);
        const peopleRequired = safeNumber(r['proyecto.personas_requeridas']);
        const requiredHours = peopleRequired > 0 ? requiredPerProject * peopleRequired : requiredPerProject;
        const completionPercent = requiredHours > 0 ? Math.min(Math.round((safeNumber(r.total_horas) / requiredHours) * 100), 100) : 0;

        return {
            proyecto_id: r.id_proyecto,
            proyecto_nombre: r['proyecto.nombre'] || 'Sin proyecto',
            total_horas: safeNumber(r.total_horas),
            horas_requeridas: requiredPerProject,
            personas_requeridas: peopleRequired,
            required_hours: requiredHours,
            completion_percent: completionPercent
        };
    });
}

async function computeHoursWeeklyData(from, to) {
    const rows = await RegistroHoras.findAll({
        attributes: [
            [sequelize().fn('DATE', sequelize().col('fecha')), 'dia'],
            [sequelize().fn('SUM', sequelize().col('horas_realizadas')), 'total_horas'],
        ],
        where: { fecha: { [Op.between]: [from, to] }, estado_validacion: 'Aprobado' },
        group: [sequelize().fn('DATE', sequelize().col('fecha'))],
        order: [[sequelize().fn('DATE', sequelize().col('fecha')), 'ASC']],
        raw: true,
    });

    const dataMap = new Map(rows.map(r => [r.dia, +r.total_horas]));
    const list = [];
    for (let d = new Date(from); d <= new Date(to); d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10);
        list.push({ dia: key, total_horas: dataMap.get(key) || 0 });
    }
    return list;
}

async function computeTopStudentsData(limit = 10) {
    const rows = await RegistroHoras.findAll({
        attributes: [
            [sequelize().col('grupo_estudiante.id_estudiante'), 'id_estudiante'],
            [sequelize().fn('SUM', sequelize().col('horas_realizadas')), 'total_horas'],
        ],
        where: { estado_validacion: 'Aprobado' },
        include: [{
            model: GrupoEstudiantes,
            as: 'grupo_estudiante',
            attributes: ['id_estudiante'],
            include: [{
                model: PerfilUsuario,
                as: 'perfil_estudiante',
                attributes: ['id', 'carnet'],
                include: [{ model: Usuarios, as: 'usuario', attributes: ['id', 'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido', 'email'] }],
            }],
        }],
        group: [
            'grupo_estudiante.id_estudiante',
            'grupo_estudiante.perfil_estudiante.id',
            'grupo_estudiante.perfil_estudiante.usuario.id',
            'grupo_estudiante.perfil_estudiante.usuario.primer_nombre',
        ],
        order: [[sequelize().fn('SUM', sequelize().col('horas_realizadas')), 'DESC']],
        limit,
        raw: true,
    });

    return rows.map(r => ({
        id_estudiante: r.id_estudiante,
        nombre: buildFullName(r, 'grupo_estudiante.perfil_estudiante.usuario'),
        carnet: r['grupo_estudiante.perfil_estudiante.carnet'],
        total_horas: safeNumber(r.total_horas),
    }));
}

// ─── Nuevos compute helpers ──────────────────────────────────────────────────

async function computeHoursByStatus() {
    const rows = await RegistroHoras.findAll({
        attributes: [
            'estado_validacion',
            [sequelize().fn('COUNT', sequelize().col('RegistroHoras.id')), 'total_registros'],
            [sequelize().fn('SUM', sequelize().col('horas_realizadas')), 'total_horas'],
        ],
        group: ['estado_validacion'],
        raw: true,
    });
    return rows.map(r => ({
        estado: r.estado_validacion,
        total_registros: safeNumber(r.total_registros),
        total_horas: safeNumber(r.total_horas),
    }));
}

async function computeInstitutionsSummary() {
    const rows = await RegistroHoras.findAll({
        attributes: [
            [sequelize().fn('SUM', sequelize().col('RegistroHoras.horas_realizadas')), 'total_horas'],
        ],
        where: { estado_validacion: 'Aprobado' },
        include: [{
            model: ProyectosInstitucion,
            as: 'proyecto',
            attributes: ['institucion_id'],
            include: [{ model: Instituciones, as: 'institucion', attributes: ['id', 'nombre'] }],
        }],
        group: [
            'proyecto.institucion_id',
            'proyecto.institucion.id',
            'proyecto.institucion.nombre',
        ],
        order: [[sequelize().fn('SUM', sequelize().col('RegistroHoras.horas_realizadas')), 'DESC']],
        raw: true,
    });

    const estudiantesRows = await RegistroHoras.findAll({
        attributes: [
            'proyecto.institucion_id',
            [sequelize().fn('COUNT', sequelize().fn('DISTINCT', sequelize().col('grupo_estudiante.id_estudiante'))), 'total_estudiantes'],
        ],
        where: { estado_validacion: 'Aprobado' },
        include: [
            {
                model: ProyectosInstitucion,
                as: 'proyecto',
                attributes: ['institucion_id'],
            },
            {
                model: GrupoEstudiantes,
                as: 'grupo_estudiante',
                attributes: ['id_estudiante'],
            },
        ],
        group: ['proyecto.institucion_id'],
        raw: true,
    });

    const estudiantesMap = new Map(
        estudiantesRows.map(r => [r['proyecto.institucion_id'], safeNumber(r.total_estudiantes)])
    );

    return rows.map(r => ({
        institucion_id: r['proyecto.institucion_id'],
        institucion_nombre: r['proyecto.institucion.nombre'] || 'Sin institución',
        total_horas: safeNumber(r.total_horas),
        total_estudiantes: estudiantesMap.get(r['proyecto.institucion_id']) || 0,
    }));
}

async function computeProjectApplicationStats() {
    const totalProjects = await ProyectosInstitucion.count();
    const completedProjects = await ProyectosInstitucion.count({ where: { estado: 'Finalizado' } });
    const totalApplicationsObj = await AplicacionesEstudiantes.findOne({
        attributes: [[sequelize().fn('COUNT', sequelize().col('AplicacionesEstudiantes.id')), 'total_applications']],
        raw: true,
    });
    const totalApplications = safeNumber(totalApplicationsObj?.total_applications);
    const averageApplicationsPerProject = totalProjects ? +(totalApplications / totalProjects).toFixed(2) : 0;

    const projectsByStatusRows = await ProyectosInstitucion.findAll({
        attributes: [
            'estado',
            [sequelize().fn('COUNT', sequelize().col('ProyectosInstitucion.id')), 'count'],
        ],
        group: ['estado'],
        raw: true,
    });

    return {
        totalProjects,
        completedProjects,
        totalApplications,
        averageApplicationsPerProject,
        projectsByStatus: projectsByStatusRows.map(r => ({
            estado: r.estado,
            count: safeNumber(r.count),
        })),
    };
}

async function computeCareerStatistics() {
    const rows = await RegistroHoras.findAll({
        attributes: [
            [sequelize().col('grupo_estudiante.perfil_estudiante.carrera.id'), 'carrera_id'],
            [sequelize().col('grupo_estudiante.perfil_estudiante.carrera.nombre'), 'carrera_nombre'],
            [sequelize().fn('COUNT', sequelize().fn('DISTINCT', sequelize().col('grupo_estudiante.id_estudiante'))), 'total_estudiantes'],
            [sequelize().fn('SUM', sequelize().col('horas_realizadas')), 'total_horas'],
        ],
        where: { estado_validacion: 'Aprobado' },
        include: [{
            model: GrupoEstudiantes,
            as: 'grupo_estudiante',
            attributes: [],
            include: [{
                model: PerfilUsuario,
                as: 'perfil_estudiante',
                attributes: [],
                include: [{
                    model: Carreras,
                    as: 'carrera',
                    attributes: ['id', 'nombre'],
                }],
            }],
        }],
        group: ['grupo_estudiante.perfil_estudiante.carrera.id', 'grupo_estudiante.perfil_estudiante.carrera.nombre'],
        order: [[sequelize().fn('SUM', sequelize().col('horas_realizadas')), 'DESC']],
        raw: true,
    });

    return rows.map(r => {
        const totalEstudiantes = safeNumber(r.total_estudiantes);
        const totalHoras = safeNumber(r.total_horas);
        return {
            carrera_id: r['grupo_estudiante.perfil_estudiante.carrera.id'],
            carrera_nombre: r['grupo_estudiante.perfil_estudiante.carrera.nombre'] || 'Sin carrera',
            total_estudiantes: totalEstudiantes,
            total_horas: totalHoras,
            promedio_horas: totalEstudiantes ? +(totalHoras / totalEstudiantes).toFixed(1) : 0,
        };
    });
}

async function computeInstitutionFrequencyStats() {
    const totalInstitutions = await Instituciones.count();
    const frequentRows = await ProyectosInstitucion.findAll({
        attributes: [
            'institucion_id',
            [sequelize().fn('COUNT', sequelize().col('ProyectosInstitucion.id')), 'proyecto_count'],
        ],
        include: [{
            model: Instituciones,
            as: 'institucion',
            attributes: ['id', 'nombre'],
        }],
        group: ['institucion_id', 'institucion.id', 'institucion.nombre'],
        having: sequelize().where(sequelize().fn('COUNT', sequelize().col('ProyectosInstitucion.id')), '>', 2),
        raw: true,
    });

    return {
        totalInstitutions,
        frequentInstitutionsCount: frequentRows.length,
        frequentInstitutions: frequentRows.map(r => ({
            institucion_id: r.institucion_id,
            institucion_nombre: r['institucion.nombre'] || 'Sin institución',
            proyecto_count: safeNumber(r.proyecto_count),
        })),
    };
}

async function computeCareerReportData(id_carrera) {
    const carrera = await Carreras.findByPk(id_carrera, { raw: true });
    if (!carrera) return null;

    const gruposCarrera = await GrupoCarrera.findAll({
        where: { id_carrera },
        include: [{ model: Grupos, as: 'grupo', attributes: ['id', 'nombre', 'codigo', 'horas_ambientales', 'horas_sociales'] }],
        raw: true,
        nest: true,
    });

    const groups = gruposCarrera
        .map(gc => gc.grupo)
        .filter(Boolean)
        .map(grupo => ({
            id: grupo.id,
            nombre: grupo.nombre || 'Sin grupo',
            codigo: grupo.codigo || '—',
            horas_ambientales: safeNumber(grupo.horas_ambientales) || 200,
            horas_sociales: safeNumber(grupo.horas_sociales) || 200,
        }));

    const groupIds = groups.map(g => g.id);
    if (groupIds.length === 0) {
        return {
            carrera_id: carrera.id,
            carrera_nombre: carrera.nombre || 'Sin carrera',
            total_estudiantes: 0,
            total_grupos: 0,
            total_horas_aprobadas: 0,
            total_meta_horas: 0,
            porcentaje_avance: 0,
            estado_estudiantes: { completado: 0, en_progreso: 0, sin_horas: 0 },
            grupos: [],
        };
    }

    const estudiantesPorGrupoRows = await GrupoEstudiantes.findAll({
        attributes: [
            'id_grupo',
            [sequelize().fn('COUNT', sequelize().col('id_estudiante')), 'total_estudiantes'],
        ],
        where: { id_grupo: groupIds, estado: 'Activo' },
        group: ['id_grupo'],
        raw: true,
    });
    const estudiantesPorGrupo = new Map(estudiantesPorGrupoRows.map(r => [r.id_grupo, safeNumber(r.total_estudiantes)]));

    const horasAprobadasPorGrupoRows = await RegistroHoras.findAll({
        attributes: [
            [sequelize().col('grupo_estudiante.id_grupo'), 'id_grupo'],
            [sequelize().fn('SUM', sequelize().col('horas_realizadas')), 'approved_hours'],
        ],
        where: { estado_validacion: 'Aprobado' },
        include: [{ model: GrupoEstudiantes, as: 'grupo_estudiante', attributes: [], where: { id_grupo: groupIds, estado: 'Activo' } }],
        group: ['grupo_estudiante.id_grupo'],
        raw: true,
    });
    const horasAprobadasPorGrupo = new Map(horasAprobadasPorGrupoRows.map(r => [r.id_grupo, safeNumber(r.approved_hours)]));

    const horasPorEstudianteRows = await RegistroHoras.findAll({
        attributes: [
            [sequelize().col('grupo_estudiante.id_estudiante'), 'id_estudiante'],
            [sequelize().col('grupo_estudiante.id_grupo'), 'id_grupo'],
            [sequelize().fn('SUM', sequelize().col('horas_realizadas')), 'total_horas'],
        ],
        where: { estado_validacion: 'Aprobado' },
        include: [{ model: GrupoEstudiantes, as: 'grupo_estudiante', attributes: ['id_estudiante', 'id_grupo'], where: { id_grupo: groupIds, estado: 'Activo' } }],
        group: ['grupo_estudiante.id_estudiante', 'grupo_estudiante.id_grupo'],
        raw: true,
    });

    const totalEstudiantes = estudiantesPorGrupoRows.reduce((sum, row) => sum + safeNumber(row.total_estudiantes), 0);
    const totalHorasAprobadas = horasPorEstudianteRows.reduce((sum, row) => sum + safeNumber(row.total_horas), 0);

    const studentMetaByGroup = new Map(groups.map(g => [g.id, g.horas_ambientales + g.horas_sociales]));
    const studentsById = new Map();
    let completado = 0;
    let enProgreso = 0;

    for (const row of horasPorEstudianteRows) {
        const meta = studentMetaByGroup.get(row.id_grupo) || 400;
        const totalHoras = safeNumber(row.total_horas);
        const estado = totalHoras >= meta ? 'completado' : 'en_progreso';
        studentsById.set(row.id_estudiante, true);
        if (estado === 'completado') completado += 1;
        else enProgreso += 1;
    }

    const sinHoras = Math.max(totalEstudiantes - studentsById.size, 0);
    const totalMetaHoras = groups.reduce((sum, group) => {
        const groupStudents = estudiantesPorGrupo.get(group.id) || 0;
        return sum + (group.horas_ambientales + group.horas_sociales) * groupStudents;
    }, 0);
    const porcentajeAvance = totalMetaHoras > 0 ? Math.min(Math.round((totalHorasAprobadas / totalMetaHoras) * 100), 100) : 0;

    const grupos = groups.map(group => {
        const groupStudents = estudiantesPorGrupo.get(group.id) || 0;
        const approvedHours = horasAprobadasPorGrupo.get(group.id) || 0;
        const metaTotal = (group.horas_ambientales + group.horas_sociales) * groupStudents;
        const avance = metaTotal > 0 ? Math.min(Math.round((approvedHours / metaTotal) * 100), 100) : 0;
        return {
            grupo_id: group.id,
            grupo_nombre: group.nombre,
            grupo_codigo: group.codigo,
            total_estudiantes: groupStudents,
            horas_ambientales_meta: group.horas_ambientales,
            horas_sociales_meta: group.horas_sociales,
            total_horas_aprobadas: approvedHours,
            total_meta_horas: metaTotal,
            porcentaje_avance: avance,
        };
    });

    return {
        carrera_id: carrera.id,
        carrera_nombre: carrera.nombre || 'Sin carrera',
        total_estudiantes: totalEstudiantes,
        total_grupos: groups.length,
        total_horas_aprobadas: totalHorasAprobadas,
        total_meta_horas: totalMetaHoras,
        porcentaje_avance: porcentajeAvance,
        estado_estudiantes: {
            completado,
            en_progreso: enProgreso,
            sin_horas: sinHoras,
        },
        grupos,
    };
}

// ─── Nuevo helper para obtener meta del estudiante ──────────────────────────

async function getStudentGoals(id_estudiante) {

    const DEFAULT_AMBIENTALES = 200;
    const DEFAULT_SOCIALES = 200;

    try {

        const grupoEstudiante = await GrupoEstudiantes.findOne({
            where: {
                id_estudiante,
                estado: 'Activo'
            },
            include: [
                {
                    model: Grupos,
                    foreignKey: 'id_grupo',
                    attributes: [
                        'id',
                        'nombre',
                        'horas_ambientales',
                        'horas_sociales'
                    ]
                }
            ]
        });

        if (!grupoEstudiante) {
            return {
                horas_ambientales: DEFAULT_AMBIENTALES,
                horas_sociales: DEFAULT_SOCIALES,
                total_meta: DEFAULT_AMBIENTALES + DEFAULT_SOCIALES,
                grupo_nombre: 'Sin grupo',
                carrera_nombre: 'Sin carrera'
            };
        }

        const grupo = grupoEstudiante.Grupo || grupoEstudiante.grupo;

        if (!grupo) {
            return {
                horas_ambientales: DEFAULT_AMBIENTALES,
                horas_sociales: DEFAULT_SOCIALES,
                total_meta: DEFAULT_AMBIENTALES + DEFAULT_SOCIALES,
                grupo_nombre: 'Sin grupo',
                carrera_nombre: 'Sin carrera'
            };
        }

        const grupoCarrera = await GrupoCarrera.findOne({
            where: {
                id_grupo: grupo.id,
                activo: true
            },
            include: [
                {
                    model: Carreras,
                    as: 'carrera',
                    attributes: [
                        'id',
                        'nombre'
                    ]
                }
            ]
        });

        const horasAmbientales =
            Number(grupo.horas_ambientales) || DEFAULT_AMBIENTALES;

        const horasSociales =
            Number(grupo.horas_sociales) || DEFAULT_SOCIALES;

        return {

            horas_ambientales: horasAmbientales,

            horas_sociales: horasSociales,

            total_meta: horasAmbientales + horasSociales,

            grupo_nombre: grupo.nombre,

            carrera_nombre:
                grupoCarrera?.carrera?.nombre || 'Sin carrera'

        };

    } catch (error) {

        console.error(error);

        return {
            horas_ambientales: DEFAULT_AMBIENTALES,
            horas_sociales: DEFAULT_SOCIALES,
            total_meta: DEFAULT_AMBIENTALES + DEFAULT_SOCIALES,
            grupo_nombre: 'Sin grupo',
            carrera_nombre: 'Sin carrera'
        };

    }

}

async function computeStudentDetail(id_estudiante) {
    const goals = await getStudentGoals(id_estudiante);

    const perfil = await PerfilUsuario.findOne({
        where: { id: id_estudiante },
        include: [{
            model: Usuarios,
            as: 'usuario',
            attributes: ['primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido', 'email']
        }],
        raw: true,
    });

    console.log('Perfil del estudiante:', JSON.stringify(perfil, null, 2));

    const registros = await RegistroHoras.findAll({
        where: { estado_validacion: ['Aprobado', 'Pendiente', 'Rechazado'] },
        include: [{
            model: GrupoEstudiantes,
            as: 'grupo_estudiante',
            where: { id_estudiante },
            attributes: ['id_estudiante'],
        }, {
            model: ProyectosInstitucion,
            as: 'proyecto',
            attributes: ['id', 'nombre', 'tipo_proyecto'],
        }],
        order: [['fecha', 'DESC']],
        raw: true,
    });

    let totalHoras = 0;
    let totalPendientes = 0;
    let totalRechazadas = 0;

    const resumenPorProyecto = {};
    for (const r of registros) {
        const pid = r.id_proyecto;

        if (!resumenPorProyecto[pid]) {
            resumenPorProyecto[pid] = {
                proyecto_id: pid,
                proyecto_nombre: r['proyecto.nombre'] || 'Sin proyecto',
                tipo_hora:
                    r['proyecto.tipo_proyecto'] === 'A'
                        ? 'Ambiental'
                        : r['proyecto.tipo_proyecto']
                            ? 'Social'
                            : 'Sin definir',
                horas_aprobadas: 0,
                horas_pendientes: 0,
                horas_rechazadas: 0,
                total_registros: 0,
            };
        }
        resumenPorProyecto[pid].total_registros++;
        const h = safeNumber(r.horas_realizadas);

        if (r.estado_validacion === 'Aprobado') {
            resumenPorProyecto[pid].horas_aprobadas += h;
            totalHoras += h;
        } else if (r.estado_validacion === 'Pendiente') {
            resumenPorProyecto[pid].horas_pendientes += h;
            totalPendientes += h;
        } else if (r.estado_validacion === 'Rechazado') {
            resumenPorProyecto[pid].horas_rechazadas += h;
            totalRechazadas += h;
        }
    }

    const totalMeta = goals.horas_ambientales + goals.horas_sociales;
    const pctTotal = totalMeta > 0 ? Math.min((totalHoras / totalMeta) * 100, 100) : 0;

    // Distribución 50/50 si no hay tipo de hora
    const horasAmbientales = Math.round(totalHoras * 0.5);
    const horasSociales = totalHoras - horasAmbientales;

    const completado = totalHoras >= totalMeta;
    const enProgreso = totalHoras > 0;

    return {
        estudiante: {
            id: id_estudiante,
            nombre: perfil ? buildFullName(perfil, 'usuario') : 'Sin nombre',
            carnet: perfil?.carnet || '—',
            email: perfil?.['usuario.email'] || '—',
            grupo: goals.grupo_nombre,
            carrera: goals.carrera_nombre,
        },
        metas: {
            horas_ambientales: goals.horas_ambientales,
            horas_sociales: goals.horas_sociales,
            total_meta: goals.total_meta,
        },
        resumen: {
            total_horas_aprobadas: totalHoras,
            total_horas_pendientes: totalPendientes,
            total_horas_rechazadas: totalRechazadas,
            horas_ambientales_aprobadas: horasAmbientales,
            horas_sociales_aprobadas: horasSociales,
            total_registros: registros.length,
            porcentaje_ambiental: goals.horas_ambientales > 0
                ? Math.min((horasAmbientales / goals.horas_ambientales) * 100, 100)
                : 0,
            porcentaje_social: goals.horas_sociales > 0
                ? Math.min((horasSociales / goals.horas_sociales) * 100, 100)
                : 0,
            porcentaje_total: pctTotal,
            completado: completado,
            en_progreso: enProgreso,
        },
        proyectos: Object.values(resumenPorProyecto),
        historial: registros.map(r => ({
            id: r.id,
            fecha: r.fecha,
            horas: safeNumber(r.horas_realizadas),
            estado: r.estado_validacion,
            descripcion: r.descripcion || '',
            proyecto: r['proyecto.nombre'] || 'Sin proyecto',
            tipo_hora: 'social',
        })),
    };
}

async function computeProjectDetail(id_proyecto) {
    const proyecto = await ProyectosInstitucion.findByPk(id_proyecto, {
        include: [{ model: Instituciones, as: 'institucion', attributes: ['nombre'] }],
        raw: true,
    });

    const registros = await RegistroHoras.findAll({
        where: { id_proyecto },
        include: [{
            model: GrupoEstudiantes,
            as: 'grupo_estudiante',
            attributes: ['id_estudiante'],
            include: [{
                model: PerfilUsuario,
                as: 'perfil_estudiante',
                attributes: ['carnet'],
                include: [{ model: Usuarios, as: 'usuario', attributes: ['primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido'] }],
            }],
        }],
        raw: true,
    });

    const estudiantesMap = {};
    for (const r of registros) {
        const eid = r['grupo_estudiante.id_estudiante'];
        if (!estudiantesMap[eid]) {
            estudiantesMap[eid] = {
                id_estudiante: eid,
                nombre: buildFullName(r, 'grupo_estudiante.perfil_estudiante.usuario'),
                carnet: r['grupo_estudiante.perfil_estudiante.carnet'] || '—',
                horas_aprobadas: 0,
                horas_pendientes: 0,
                total_registros: 0,
            };
        }
        estudiantesMap[eid].total_registros++;
        const h = safeNumber(r.horas_realizadas);
        if (r.estado_validacion === 'Aprobado') estudiantesMap[eid].horas_aprobadas += h;
        else if (r.estado_validacion === 'Pendiente') estudiantesMap[eid].horas_pendientes += h;
    }

    const totalAprobadas = registros.filter(r => r.estado_validacion === 'Aprobado').reduce((s, r) => s + safeNumber(r.horas_realizadas), 0);
    const totalPendientes = registros.filter(r => r.estado_validacion === 'Pendiente').reduce((s, r) => s + safeNumber(r.horas_realizadas), 0);

    const projectHoursRequired = safeNumber(proyecto?.horas_requeridas);
    const projectPeopleRequired = safeNumber(proyecto?.personas_requeridas);
    const projectRequiredHours = projectPeopleRequired > 0 ? projectHoursRequired * projectPeopleRequired : projectHoursRequired;
    const projectCompletionPercent = projectRequiredHours > 0 ? Math.min(Math.round((totalAprobadas / projectRequiredHours) * 100), 100) : 0;

    return {
        proyecto: {
            id: id_proyecto,
            nombre: proyecto?.nombre || 'Sin nombre',
            institucion: proyecto?.['institucion.nombre'] || '—',
            horas_requeridas: projectHoursRequired,
            personas_requeridas: projectPeopleRequired,
            required_hours: projectRequiredHours,
            completion_percent: projectCompletionPercent,
        },
        resumen: {
            total_horas_aprobadas: totalAprobadas,
            total_horas_pendientes: totalPendientes,
            total_estudiantes: Object.keys(estudiantesMap).length,
            total_registros: registros.length,
            horas_requeridas: projectRequiredHours,
            porcentaje_completado: projectCompletionPercent,
        },
        estudiantes: Object.values(estudiantesMap).sort((a, b) => b.horas_aprobadas - a.horas_aprobadas),
    };
}

async function computeInactiveStudents(diasSinActividad = 30) {
    const cutoff = new Date(Date.now() - diasSinActividad * 24 * 3600 * 1000).toISOString().slice(0, 10);

    const activos = await RegistroHoras.findAll({
        attributes: [[sequelize().col('grupo_estudiante.id_estudiante'), 'id_estudiante']],
        where: { fecha: { [Op.gte]: cutoff } },
        include: [{ model: GrupoEstudiantes, as: 'grupo_estudiante', attributes: ['id_estudiante'] }],
        group: ['grupo_estudiante.id_estudiante'],
        raw: true,
    });
    const idsActivos = new Set(activos.map(r => r.id_estudiante));

    const ultimosRegistros = await RegistroHoras.findAll({
        attributes: [
            [sequelize().col('grupo_estudiante.id_estudiante'), 'id_estudiante'],
            [sequelize().fn('MAX', sequelize().col('fecha')), 'ultima_fecha'],
            [sequelize().fn('SUM', sequelize().col('horas_realizadas')), 'total_horas'],
        ],
        include: [{
            model: GrupoEstudiantes,
            as: 'grupo_estudiante',
            attributes: ['id_estudiante'],
            include: [{
                model: PerfilUsuario,
                as: 'perfil_estudiante',
                attributes: ['carnet'],
                include: [{ model: Usuarios, as: 'usuario', attributes: ['primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido', 'email'] }],
            }],
        }],
        group: [
            'grupo_estudiante.id_estudiante',
            'grupo_estudiante.perfil_estudiante.id',
            'grupo_estudiante.perfil_estudiante.carnet',
            'grupo_estudiante.perfil_estudiante.usuario.id',
            'grupo_estudiante.perfil_estudiante.usuario.primer_nombre',
            'grupo_estudiante.perfil_estudiante.usuario.segundo_nombre',
            'grupo_estudiante.perfil_estudiante.usuario.primer_apellido',
            'grupo_estudiante.perfil_estudiante.usuario.segundo_apellido',
            'grupo_estudiante.perfil_estudiante.usuario.email',
        ],
        raw: true,
    });

    return ultimosRegistros
        .filter(r => !idsActivos.has(r.id_estudiante))
        .map(r => ({
            id_estudiante: r.id_estudiante,
            nombre: buildFullName(r, 'grupo_estudiante.perfil_estudiante.usuario'),
            carnet: r['grupo_estudiante.perfil_estudiante.carnet'] || '—',
            email: r['grupo_estudiante.perfil_estudiante.usuario.email'] || '—',
            ultima_actividad: r.ultima_fecha || '—',
            total_horas_historicas: safeNumber(r.total_horas),
        }))
        .sort((a, b) => new Date(a.ultima_actividad) - new Date(b.ultima_actividad));
}

async function computeCompletionRate() {
    try {
        const estudiantesGrupos = await GrupoEstudiantes.findAll({
            attributes: ['id_estudiante'],
            where: { estado: 'Activo' },
            include: [{
                model: Grupos,
                as: 'Grupo',
                attributes: ['id', 'nombre', 'horas_ambientales', 'horas_sociales']
            }],
            raw: true,
            nest: true
        });

        const estudianteMap = {};
        for (const eg of estudiantesGrupos) {
            const id = eg.id_estudiante;
            if (!estudianteMap[id]) {
                estudianteMap[id] = {
                    id_estudiante: id,
                    grupos: []
                };
            }
            if (eg.grupo) {
                estudianteMap[id].grupos.push(eg.grupo);
            }
        }

        const resultados = [];
        for (const [id, info] of Object.entries(estudianteMap)) {
            const grupo = info.grupos[0] || { horas_ambientales: 200, horas_sociales: 200, nombre: 'Sin grupo' };

            const horas = await RegistroHoras.findAll({
                attributes: [
                    [sequelize().fn('SUM', sequelize().col('horas_realizadas')), 'total_horas'],
                ],
                where: { estado_validacion: 'Aprobado' },
                include: [{
                    model: GrupoEstudiantes,
                    as: 'grupo_estudiante',
                    where: { id_estudiante: Number(id), estado: 'Activo' },
                    attributes: ['id_estudiante'],
                }],
                raw: true,
            });

            const totalHoras = safeNumber(horas[0]?.total_horas || 0);
            const metaAmbiental = Number(grupo.horas_ambientales) || 200;
            const metaSocial = Number(grupo.horas_sociales) || 200;
            const metaTotal = metaAmbiental + metaSocial;

            const horasAmbientales = Math.round(totalHoras * 0.5);
            const horasSociales = totalHoras - horasAmbientales;

            const completado = totalHoras >= metaTotal;
            const pctCompletado = metaTotal > 0 ? (totalHoras / metaTotal) * 100 : 0;

            const perfil = await PerfilUsuario.findOne({
                where: { usuario_id: Number(id) },
                include: [{
                    model: Usuarios,
                    as: 'usuario',
                    attributes: ['primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido']
                }],
                raw: true,
            });

            resultados.push({
                id_estudiante: Number(id),
                nombre: perfil ? buildFullName(perfil, 'usuario') : 'Sin nombre',
                carnet: perfil?.carnet || '—',
                horas_ambientales: horasAmbientales,
                horas_sociales: horasSociales,
                horas_aprobadas: totalHoras,
                meta_ambiental: metaAmbiental,
                meta_social: metaSocial,
                meta_total: metaTotal,
                porcentaje_completado: Math.min(pctCompletado, 100),
                completado: completado,
                estado: completado ? 'Completado' : totalHoras > 0 ? 'En progreso' : 'Sin horas',
                grupo: grupo.nombre || 'Sin grupo',
            });
        }

        const completados = resultados.filter(r => r.completado);
        const enProgreso = resultados.filter(r => !r.completado && r.horas_aprobadas > 0);
        const sinHoras = resultados.filter(r => r.horas_aprobadas === 0);

        return {
            meta_ambiental_promedio: resultados.length > 0
                ? +(resultados.reduce((s, r) => s + r.meta_ambiental, 0) / resultados.length).toFixed(0)
                : 0,
            meta_social_promedio: resultados.length > 0
                ? +(resultados.reduce((s, r) => s + r.meta_social, 0) / resultados.length).toFixed(0)
                : 0,
            total_estudiantes: resultados.length,
            completados: completados.length,
            en_progreso: enProgreso.length,
            sin_horas: sinHoras.length,
            tasa_cumplimiento: resultados.length ? +((completados.length / resultados.length) * 100).toFixed(2) : 0,
            detalle: resultados.sort((a, b) => b.horas_aprobadas - a.horas_aprobadas),
        };
    } catch (error) {
        console.error('Error en computeCompletionRate:', error);
        throw error;
    }
}

// ─── Controladores ─────────────────────────────────────────────────────────────

export async function getOverview(request, reply) {
    try {
        return reply.send(await computeOverviewData());
    } catch (err) {
        request.log?.error?.(err);
        return reply.status(500).send({ success: false, error: { code: 'GET_OVERVIEW_ERROR', message: 'Error obteniendo resumen', details: String(err) } });
    }
}

export async function getHoursByProject(request, reply) {
    try {
        return reply.send(await computeHoursByProjectData());
    } catch (err) {
        request.log?.error?.(err);
        return reply.status(500).send({ success: false, error: { code: 'GET_HOURS_BY_PROJECT_ERROR', message: 'Error obteniendo horas por proyecto', details: String(err) } });
    }
}

export async function getHoursWeekly(request, reply) {
    try {
        const from = request.query.from || new Date(Date.now() - 13 * 24 * 3600 * 1000).toISOString().slice(0, 10);
        const to = request.query.to || new Date().toISOString().slice(0, 10);
        return reply.send(await computeHoursWeeklyData(from, to));
    } catch (err) {
        request.log?.error?.(err);
        return reply.status(500).send({ success: false, error: { code: 'GET_HOURS_WEEKLY_ERROR', message: 'Error obteniendo horas semanales', details: String(err) } });
    }
}

export async function getTopStudents(request, reply) {
    try {
        const limit = Number(request.query.limit) || 10;
        return reply.send(await computeTopStudentsData(limit));
    } catch (err) {
        request.log?.error?.(err);
        return reply.status(500).send({ success: false, error: { code: 'GET_TOP_STUDENTS_ERROR', message: 'Error obteniendo top estudiantes', details: String(err) } });
    }
}

export async function getHoursByStatus(request, reply) {
    try {
        return reply.send(await computeHoursByStatus());
    } catch (err) {
        request.log?.error?.(err);
        return reply.status(500).send({ success: false, error: { code: 'GET_HOURS_BY_STATUS_ERROR', message: 'Error obteniendo horas por estado', details: String(err) } });
    }
}

export async function getInstitutionsSummary(request, reply) {
    try {
        return reply.send(await computeInstitutionsSummary());
    } catch (err) {
        request.log?.error?.(err);
        return reply.status(500).send({ success: false, error: { code: 'GET_INSTITUTIONS_ERROR', message: 'Error obteniendo resumen por institución', details: String(err) } });
    }
}

export async function getCareerReport(request, reply) {
    try {
        const { id } = request.params;
        if (!id) {
            return reply.status(400).send({ success: false, error: { code: 'MISSING_ID', message: 'Se requiere id de la carrera' } });
        }
        const data = await computeCareerReportData(Number(id));
        if (!data) {
            return reply.status(404).send({ success: false, error: { code: 'CAREER_NOT_FOUND', message: 'Carrera no encontrada' } });
        }
        return reply.send(data);
    } catch (err) {
        request.log?.error?.(err);
        return reply.status(500).send({
            success: false,
            error: {
                code: 'GET_CAREER_REPORT_ERROR',
                message: 'Error obteniendo reporte de carrera',
                details: String(err),
            },
        });
    }
}

export async function exportCareerPDF(request, reply) {
    try {
        const { id } = request.params;
        if (!id) {
            return reply.status(400).send({ success: false, error: { code: 'MISSING_ID', message: 'Se requiere id de la carrera' } });
        }

        const report = await computeCareerReportData(Number(id));
        if (!report) {
            return reply.status(404).send({ success: false, error: { code: 'CAREER_NOT_FOUND', message: 'Carrera no encontrada' } });
        }

        const totalStudents = report.total_estudiantes;
        const completado = report.estado_estudiantes.completado;
        const enProgreso = report.estado_estudiantes.en_progreso;
        const sinHoras = report.estado_estudiantes.sin_horas;
        const completadoPct = totalStudents > 0 ? Math.round((completado / totalStudents) * 100) : 0;
        const enProgresoPct = totalStudents > 0 ? Math.round((enProgreso / totalStudents) * 100) : 0;
        const sinHorasPct = totalStudents > 0 ? Math.max(100 - completadoPct - enProgresoPct, 0) : 0;

        const rowsHtml = report.grupos.map(g => {
            const progreso = g.porcentaje_avance;
            const badge = progreso >= 80 ? 'b-green' : progreso >= 50 ? 'b-yellow' : 'b-red';
            return `<tr>
                <td style="font-weight:600;">${g.grupo_nombre}</td>
                <td>${g.grupo_codigo}</td>
                <td style="text-align:center;">${g.total_estudiantes}</td>
                <td style="text-align:center;">${safeNumber(g.total_horas_aprobadas)}</td>
                <td style="text-align:center;">${safeNumber(g.total_meta_horas)}</td>
                <td style="text-align:center;"><span class="badge ${badge}">${progreso}%</span></td>
            </tr>`;
        }).join('');

        const carreraPie = `conic-gradient(#28A745 0 ${report.porcentaje_avance}%, #be1622 ${report.porcentaje_avance}% 100%)`;
        const studentPie = `conic-gradient(#28A745 0 ${completadoPct}%, #F0A500 ${completadoPct}% ${completadoPct + enProgresoPct}%, #BE1622 ${completadoPct + enProgresoPct}% 100%)`;

        const fechaGen = new Date().toLocaleDateString('es-SV', { day: '2-digit', month: 'long', year: 'numeric' });
        const horaGen = new Date().toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' });

        const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Reporte de Carrera</title><style>${CSS_GROUP_REPORT}</style></head><body>
            <div class="header">
                <div class="header-left">
                    <div class="logo-box">IT</div>
                    <div class="header-title">
                        <h1>Reporte de Carrera</h1>
                        <p>Carrera: ${report.carrera_nombre}</p>
                    </div>
                </div>
                <div class="header-right">
                    <strong>${fechaGen}</strong>
                    ${horaGen} hrs
                </div>
            </div>
            <div class="gold-band">
                <span>Reporte de avance por carrera</span>
                <span>${new Date().getFullYear()} · ITCA-FEPADE</span>
            </div>
            <div class="body">
                <div class="kpi-grid">
                    <div class="kpi"><div class="kpi-val">${report.total_estudiantes}</div><div class="kpi-lbl">Estudiantes</div></div>
                    <div class="kpi gold"><div class="kpi-val">${report.total_grupos}</div><div class="kpi-lbl">Grupos</div></div>
                    <div class="kpi green"><div class="kpi-val">${report.porcentaje_avance}%</div><div class="kpi-lbl">Avance total</div></div>
                    <div class="kpi gold"><div class="kpi-val">${safeNumber(report.total_horas_aprobadas)}</div><div class="kpi-lbl">Horas aprobadas</div></div>
                </div>
                <div class="chart-container">
                    <div class="chart-title">📊 Avance de horas contra meta total</div>
                    <div class="pie-grid">
                        <div class="pie-card">
                            <div class="pie-title">Avance de carrera</div>
                            <div class="pie-chart" style="background:${carreraPie};"></div>
                            <div class="pie-value">${report.porcentaje_avance}%</div>
                            <div class="pie-values">
                                <div><span class="ambiental"></span> Horas aprobadas</div>
                                <div><span class="social"></span> Restante</div>
                            </div>
                        </div>
                        <div class="pie-card">
                            <div class="pie-title">Estado de estudiantes</div>
                            <div class="pie-chart" style="background:${studentPie};"></div>
                            <div class="pie-value">${completadoPct}%</div>
                            <div class="pie-values">
                                <div><span class="ambiental"></span> Completado: ${completado}</div>
                                <div><span class="gold"></span> En progreso: ${enProgreso}</div>
                                <div><span class="social"></span> Sin horas: ${sinHoras}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div style="background:#fff;border-radius:8px;padding:10px 14px;box-shadow:0 2px 10px rgba(0,0,0,0.05);border:1px solid rgba(190,22,34,0.05);">
                    <div class="section-title"><span>Resumen por grupos</span><small>${report.grupos.length} grupos · ${report.total_estudiantes} estudiantes</small></div>
                    <table>
                        <tr>
                            <th>Grupo</th>
                            <th>Código</th>
                            <th class="center">Estud.</th>
                            <th class="center">Horas apr.</th>
                            <th class="center">Meta h.</th>
                            <th class="center">Avance</th>
                        </tr>
                        ${rowsHtml}
                    </table>
                </div>
            </div>
            <div class="footer"><span>© ${new Date().getFullYear()} · ITCA-FEPADE</span><strong>Sistema de Horas Sociales y Ambientales</strong><span class="page-num">Pág. 1 / 1</span></div>
        </body></html>`;

        const browser = await launchPuppeteer({ args: ['--no-sandbox', '--disable-setuid-sandbox'], headless: 'new' });
        const page = await browser.newPage();
        await page.setViewport({ width: 794, height: 1123 });
        await page.setContent(html, { waitUntil: 'networkidle0' });
        await new Promise(r => setTimeout(r, 500));
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' }, displayHeaderFooter: false });
        await browser.close();

        reply.header('Content-Type', 'application/pdf');
        reply.header('Content-Disposition', `attachment; filename="reporte_carrera_${report.carrera_id}.pdf"`);
        return reply.send(pdfBuffer);
    } catch (err) {
        request.log?.error?.(err);
        return reply.status(500).send({
            success: false,
            error: {
                code: 'EXPORT_CAREER_PDF_ERROR',
                message: 'Error generando PDF de reporte de carrera',
                details: String(err),
            },
        });
    }
}

export async function getStudentDetail(request, reply) {
    try {
        const { id } = request.params;
        if (!id) {
            return reply.status(400).send({
                success: false,
                error: { code: 'MISSING_ID', message: 'Se requiere id del estudiante' }
            });
        }
        const data = await computeStudentDetail(id);
        return reply.send(data);
    } catch (err) {
        request.log?.error?.(err);
        return reply.status(500).send({
            success: false,
            error: {
                code: 'GET_STUDENT_DETAIL_ERROR',
                message: 'Error obteniendo detalle del estudiante',
                details: String(err)
            }
        });
    }
}

export async function getProjectDetail(request, reply) {
    try {
        const { id } = request.params;
        if (!id) return reply.status(400).send({ success: false, error: { code: 'MISSING_ID', message: 'Se requiere id del proyecto' } });
        const data = await computeProjectDetail(id);
        return reply.send(data);
    } catch (err) {
        request.log?.error?.(err);
        return reply.status(500).send({ success: false, error: { code: 'GET_PROJECT_DETAIL_ERROR', message: 'Error obteniendo detalle del proyecto', details: String(err) } });
    }
}

export async function getInactiveStudents(request, reply) {
    try {
        const dias = Number(request.query.dias) || 30;
        return reply.send(await computeInactiveStudents(dias));
    } catch (err) {
        request.log?.error?.(err);
        return reply.status(500).send({ success: false, error: { code: 'GET_INACTIVE_STUDENTS_ERROR', message: 'Error obteniendo estudiantes inactivos', details: String(err) } });
    }
}

export async function getCompletionRate(request, reply) {
    try {
        return reply.send(await computeCompletionRate());
    } catch (err) {
        request.log?.error?.(err);
        return reply.status(500).send({
            success: false,
            error: {
                code: 'GET_COMPLETION_RATE_ERROR',
                message: 'Error calculando tasa de cumplimiento',
                details: String(err)
            }
        });
    }
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const CSS_DASHBOARD = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
    background: #F5F5F5;
    color: #1A1A2E;
    width: 210mm;
    min-height: 297mm;
    font-size: 9.5px;
    line-height: 1.4;
  }
  .header {
    background: linear-gradient(135deg, #6B0000 0%, #8B0000 40%, #BE1622 100%);
    padding: 12px 24px 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 3px solid #F0A500;
    position: relative;
  }
  .header::after {
    content: '';
    position: absolute;
    bottom: -6px;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, #F0A500, #BE1622, #F0A500);
  }
  .header-left { display: flex; align-items: center; gap: 16px; }
  .logo-box {
    width: 48px; height: 48px;
    background: #F0A500;
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; font-weight: 900; color: #8B0000;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }
  .header-title h1 { font-size: 17px; font-weight: 900; color: #fff; letter-spacing: 0.5px; text-shadow: 0 1px 3px rgba(0,0,0,0.3); }
  .header-title p { font-size: 9px; color: rgba(255,255,255,0.8); margin-top: 2px; font-weight: 300; letter-spacing: 0.3px; }
  .header-right { text-align: right; color: rgba(255,255,255,0.9); font-size: 9px; line-height: 1.6; }
  .header-right strong { color: #F0A500; font-size: 11px; display: block; font-weight: 800; }
  .gold-band {
    background: #F0A500;
    padding: 4px 24px;
    font-size: 7.5px;
    font-weight: 700;
    color: #6B0000;
    letter-spacing: 2px;
    text-transform: uppercase;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .gold-band span:last-child { color: #8B0000; font-weight: 800; }
  .body { padding: 10px 18px 8px; }
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 10px;
  }
  .kpi {
    background: #fff;
    border-radius: 8px;
    padding: 10px 14px;
    border-left: 4px solid #BE1622;
    box-shadow: 0 2px 10px rgba(190,22,34,0.08);
  }
  .kpi.gold { border-left-color: #F0A500; }
  .kpi.green { border-left-color: #28A745; }
  .kpi .kpi-val { font-size: 24px; font-weight: 900; color: #BE1622; line-height: 1.1; }
  .kpi.gold .kpi-val { color: #B07800; }
  .kpi.green .kpi-val { color: #28A745; }
  .kpi .kpi-lbl { font-size: 8px; color: #888; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 4px; font-weight: 600; }
  .section-title {
    font-size: 9px;
    font-weight: 800;
    color: #BE1622;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    border-bottom: 2px solid #F0A500;
    padding-bottom: 4px;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .section-title small { font-weight: 400; color: #999; font-size: 7.5px; letter-spacing: 0.5px; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
  .three-col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 10px; }
  .panel {
    background: #fff;
    border-radius: 8px;
    padding: 10px 14px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
    border: 1px solid rgba(190,22,34,0.05);
  }
  table { width: 100%; border-collapse: collapse; }
  th {
    background: #BE1622;
    color: #fff;
    font-size: 7.5px;
    font-weight: 700;
    padding: 5px 8px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    text-align: left;
  }
  th.right { text-align: right; }
  th.center { text-align: center; }
  td { font-size: 9px; padding: 4px 8px; border-bottom: 1px solid #F0F0F0; color: #1A1A2E; }
  tr:last-child td { border-bottom: none; }
  tr:nth-child(even) td { background: #FAFAFA; }
  .badge {
    display: inline-block;
    padding: 1px 8px;
    border-radius: 4px;
    font-size: 7.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .b-green  { background: #D4EDDA; color: #155724; }
  .b-yellow { background: #FFF3CD; color: #856404; }
  .b-red    { background: #F8D7DA; color: #721C24; }
  .b-gray   { background: #E9ECEF; color: #495057; }
  .b-gold   { background: #FFF8E1; color: #B07800; }
  .prog-wrap { height: 10px; background: #E8E8E8; border-radius: 5px; overflow: hidden; }
  .prog-fill { height: 100%; border-radius: 5px; }
  .mini-bar { display: flex; align-items: center; gap: 6px; }
  .mini-bar .track { flex: 1; height: 6px; background: #E8E8E8; border-radius: 3px; overflow: hidden; }
  .mini-bar .track .fill { height: 100%; border-radius: 3px; }
  .mini-bar .value { font-size: 9px; font-weight: 700; color: #1A1A2E; min-width: 28px; text-align: right; }
  .footer {
    background: #1A1A2E;
    padding: 6px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 2px solid #F0A500;
  }
  .footer span { font-size: 7.5px; color: rgba(255,255,255,0.5); }
  .footer strong { color: #F0A500; font-size: 8px; font-weight: 700; letter-spacing: 0.5px; }
  .footer .page-num { color: rgba(255,255,255,0.4); font-size: 7.5px; }
  .status-cards {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 6px;
    margin-bottom: 8px;
  }
  .status-card {
    text-align: center;
    padding: 8px 6px;
    border-radius: 6px;
    background: #FAFAFA;
    border: 1px solid #F0F0F0;
  }
  .status-card .number { font-size: 18px; font-weight: 900; line-height: 1.2; }
  .status-card .label { font-size: 7px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
  .status-card.green .number { color: #28A745; }
  .status-card.gold .number { color: #B07800; }
  .status-card.red .number { color: #DC3545; }
  .status-card.green { background: #F0FFF4; border-color: #D4EDDA; }
  .status-card.gold { background: #FFFCF0; border-color: #FFF3CD; }
  .status-card.red { background: #FFF5F5; border-color: #F8D7DA; }
`;

const CSS_STUDENT = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
    background: #F5F5F5;
    color: #1A1A2E;
    width: 210mm;
    min-height: 297mm;
    font-size: 9.5px;
    line-height: 1.4;
  }
  .header {
    background: linear-gradient(135deg, #6B0000 0%, #8B0000 40%, #BE1622 100%);
    padding: 12px 24px 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 3px solid #F0A500;
    position: relative;
  }
  .header::after {
    content: '';
    position: absolute;
    bottom: -6px;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, #F0A500, #BE1622, #F0A500);
  }
  .header-left { display: flex; align-items: center; gap: 16px; }
  .logo-box {
    width: 48px; height: 48px;
    background: #F0A500;
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; font-weight: 900; color: #8B0000;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }
  .header-title h1 { font-size: 16px; font-weight: 900; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.3); }
  .header-title p { font-size: 8.5px; color: rgba(255,255,255,0.8); margin-top: 2px; font-weight: 300; }
  .header-right { text-align: right; color: rgba(255,255,255,0.9); font-size: 8.5px; line-height: 1.6; }
  .header-right strong { color: #F0A500; font-size: 10px; display: block; font-weight: 800; }
  .gold-band {
    background: #F0A500;
    padding: 4px 24px;
    font-size: 7.5px;
    font-weight: 700;
    color: #6B0000;
    letter-spacing: 2px;
    text-transform: uppercase;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .body { padding: 10px 18px 8px; }
  .student-info {
    background: #fff;
    border-radius: 8px;
    padding: 10px 16px;
    display: grid;
    grid-template-columns: 2fr 1fr 1.5fr 0.8fr;
    gap: 12px;
    margin-bottom: 10px;
    border-left: 4px solid #BE1622;
    box-shadow: 0 2px 10px rgba(190,22,34,0.08);
  }
  .si-item label { font-size: 7px; color: #999; text-transform: uppercase; letter-spacing: 0.8px; display: block; margin-bottom: 2px; font-weight: 600; }
  .si-item span { font-size: 10.5px; font-weight: 700; color: #1A1A2E; }
  .si-item .badge { font-size: 8px; padding: 2px 10px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin-bottom: 10px; }
  .kpi { background: #fff; border-radius: 8px; padding: 8px 12px; border-left: 4px solid #BE1622; box-shadow: 0 2px 10px rgba(190,22,34,0.08); }
  .kpi.gold { border-left-color: #F0A500; }
  .kpi.green { border-left-color: #28A745; }
  .kpi .kpi-val { font-size: 22px; font-weight: 900; color: #BE1622; line-height: 1.1; }
  .kpi.gold .kpi-val { color: #B07800; }
  .kpi.green .kpi-val { color: #28A745; }
  .kpi .kpi-lbl { font-size: 7.5px; color: #888; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 3px; font-weight: 600; }
  .prog-section { background: #fff; border-radius: 8px; padding: 10px 16px; margin-bottom: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); border: 1px solid rgba(190,22,34,0.05); }
  .prog-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .prog-title { font-size: 9px; font-weight: 800; color: #BE1622; text-transform: uppercase; letter-spacing: 1px; }
  .prog-wrap { height: 14px; background: #E8E8E8; border-radius: 7px; overflow: hidden; }
  .prog-fill { height: 100%; border-radius: 7px; }
  .prog-info { display: flex; justify-content: space-between; margin-top: 4px; font-size: 8px; color: #888; font-weight: 500; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px; margin-bottom: 10px; }
  .meta-card { background: #FAFAFA; border-radius: 6px; padding: 8px 12px; border: 1px solid #F0F0F0; }
  .meta-card .label { font-size: 7px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
  .meta-card .value { font-size: 16px; font-weight: 900; margin: 4px 0 2px; }
  .meta-card .value.ambiental { color: #28A745; }
  .meta-card .value.social { color: #BE1622; }
  .meta-card .sub { font-size: 8px; color: #888; }
  .dual-progress { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 6px; }
  .dual-progress .prog-item .prog-label { font-size: 7.5px; font-weight: 600; color: #666; display: flex; justify-content: space-between; margin-bottom: 2px; }
  .dual-progress .prog-item .prog-label .pct { color: #BE1622; font-weight: 800; }
  .dual-progress .prog-item .prog-label .pct.ambiental { color: #28A745; }
  .section-title {
    font-size: 9px;
    font-weight: 800;
    color: #BE1622;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    border-bottom: 2px solid #F0A500;
    padding-bottom: 4px;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .section-title small { font-weight: 400; color: #999; font-size: 7.5px; letter-spacing: 0.5px; }
  .panel { background: #fff; border-radius: 8px; padding: 10px 14px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); border: 1px solid rgba(190,22,34,0.05); margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #BE1622; color: #fff; font-size: 7px; font-weight: 700; padding: 4px 8px; text-transform: uppercase; letter-spacing: 0.8px; text-align: left; }
  th.center { text-align: center; }
  td { font-size: 8.5px; padding: 4px 8px; border-bottom: 1px solid #F0F0F0; }
  tr:last-child td { border-bottom: none; }
  tr:nth-child(even) td { background: #FAFAFA; }
  .badge {
    display: inline-block;
    padding: 1px 8px;
    border-radius: 4px;
    font-size: 7px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .b-green  { background: #D4EDDA; color: #155724; }
  .b-yellow { background: #FFF3CD; color: #856404; }
  .b-red    { background: #F8D7DA; color: #721C24; }
  .b-gold   { background: #FFF8E1; color: #B07800; }
  .mini-progress { display: flex; align-items: center; gap: 4px; }
  .mini-progress .track { flex: 1; height: 5px; background: #E8E8E8; border-radius: 3px; overflow: hidden; }
  .mini-progress .track .fill { height: 100%; border-radius: 3px; }
  .mini-progress .pct { font-size: 8px; color: #888; min-width: 30px; text-align: right; font-weight: 600; }
  .footer {
    background: #1A1A2E;
    padding: 6px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 2px solid #F0A500;
  }
  .footer span { font-size: 7.5px; color: rgba(255,255,255,0.5); }
  .footer strong { color: #F0A500; font-size: 8px; font-weight: 700; letter-spacing: 0.5px; }
  .footer .page-num { color: rgba(255,255,255,0.4); font-size: 7.5px; }
`;

// ─── Función helper para mini bar ──────────────────────────────────────────

function buildMiniBar(value, max, color = '#BE1622') {
    const w = Math.round((value / Math.max(max, 1)) * 100);
    return `<div class="mini-bar">
    <div class="track">
      <div class="fill" style="width:${w}%;background:${color};"></div>
    </div>
    <span class="value">${value}</span>
  </div>`;
}

// ─── PDF Dashboard ──────────────────────────────────────────────────────────

export async function exportDashboardPDF(request, reply) {
    try {
        const [overview, projects, weekly, top, byStatus, completion, insts] = await Promise.all([
            computeOverviewData(),
            computeHoursByProjectData(),
            computeHoursWeeklyData(
                new Date(Date.now() - 13 * 24 * 3600 * 1000).toISOString().slice(0, 10),
                new Date().toISOString().slice(0, 10)
            ),
            computeTopStudentsData(5),
            computeHoursByStatus(),
            computeCompletionRate(),
            computeInstitutionsSummary(),
        ]);

        const maxProj = Math.max(...projects.map(p => p.total_horas), 1);
        const maxTop = Math.max(...top.map(s => s.total_horas), 1);
        const maxInst = Math.max(...insts.map(i => i.total_horas), 1);
        const maxWeek = Math.max(...weekly.map(w => w.total_horas), 1);

        const topProjects = projects.slice(0, 4);
        const projRows = topProjects.map(p => `
      <tr>
        <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;">${p.proyecto_nombre}</td>
        <td>${buildMiniBar(p.total_horas, maxProj, '#BE1622')}</td>
      </tr>`).join('');

        const topRows = top.map((s, i) => `
      <tr>
        <td style="font-size:8.5px;">${i + 1}. ${s.nombre}</td>
        <td style="font-size:8px;color:#888;">${s.carnet || '—'}</td>
        <td>${buildMiniBar(s.total_horas, maxTop, '#F0A500')}</td>
      </tr>`).join('');

        const instRows = insts.slice(0, 4).map(ins => `
      <tr>
        <td style="max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;">${ins.institucion_nombre}</td>
        <td style="text-align:center;font-weight:700;color:#BE1622;">${ins.total_estudiantes}</td>
        <td>${buildMiniBar(ins.total_horas, maxInst, '#BE1622')}</td>
      </tr>`).join('');

        const statusRows = byStatus.map(s => {
            const badge = s.estado === 'Aprobado' ? 'b-green' : s.estado === 'Pendiente' ? 'b-yellow' : 'b-red';
            return `<tr>
        <td><span class="badge ${badge}">${s.estado}</span></td>
        <td style="text-align:center;font-weight:700;">${s.total_registros}</td>
        <td style="text-align:right;font-weight:700;color:#BE1622;">${s.total_horas}</td>
      </tr>`;
        }).join('');

        const last7 = weekly.slice(-7);
        const weekRows = last7.map(w => {
            const date = new Date(w.dia);
            const dayName = date.toLocaleDateString('es-SV', { weekday: 'short' });
            return `<tr>
        <td style="font-size:8px;color:#666;">${dayName} ${w.dia.slice(5)}</td>
        <td>${buildMiniBar(w.total_horas, maxWeek, '#BE1622')}</td>
      </tr>`;
        }).join('');

        const pctComp = completion.tasa_cumplimiento;
        const fillColor = pctComp >= 75 ? '#28A745' : pctComp >= 40 ? '#F0A500' : '#BE1622';

        const fechaGen = new Date().toLocaleDateString('es-SV', { day: '2-digit', month: 'long', year: 'numeric' });
        const horaGen = new Date().toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' });

        const html = `<!doctype html><html><head><meta charset="utf-8"/>
    <title>Reporte Ejecutivo — ITCA-FEPADE</title>
    <style>${CSS_DASHBOARD}</style>
    </head><body>
    <div class="header">
      <div class="header-left">
        <div class="logo-box">IT</div>
        <div class="header-title">
          <h1>Reporte Ejecutivo</h1>
          <p>Sistema de Registro de Horas Sociales y Ambientales · ITCA-FEPADE</p>
        </div>
      </div>
      <div class="header-right">
        <strong>${fechaGen}</strong>
        ${horaGen} hrs
      </div>
    </div>
    <div class="gold-band">
      <span>Informe de indicadores clave — Administración académica</span>
      <span>${new Date().getFullYear()} · ITCA-FEPADE</span>
    </div>
    <div class="body">
      <div class="kpi-grid">
        <div class="kpi">
          <div class="kpi-val">${overview.totalHoras}</div>
          <div class="kpi-lbl">Horas aprobadas</div>
        </div>
        <div class="kpi gold">
          <div class="kpi-val">${overview.totalProyectos}</div>
          <div class="kpi-lbl">Proyectos activos</div>
        </div>
        <div class="kpi green">
          <div class="kpi-val">${overview.totalEstudiantes}</div>
          <div class="kpi-lbl">Estudiantes registrados</div>
        </div>
        <div class="kpi gold">
          <div class="kpi-val">${overview.promedioHorasPorEstudiante}</div>
          <div class="kpi-lbl">Prom. horas / estudiante</div>
        </div>
      </div>
      <div class="three-col">
        <div class="panel">
          <div class="section-title">Estado de registros</div>
          <table>
            <tr><th>Estado</th><th class="center">Reg.</th><th class="right">Horas</th></tr>
            ${statusRows}
          </table>
        </div>
        <div class="panel">
          <div class="section-title">Cumplimiento <small>Meta personalizada</small></div>
          <div class="status-cards">
            <div class="status-card green">
              <div class="number">${completion.completados}</div>
              <div class="label">Completados</div>
            </div>
            <div class="status-card gold">
              <div class="number">${completion.en_progreso}</div>
              <div class="label">En progreso</div>
            </div>
            <div class="status-card red">
              <div class="number">${completion.sin_horas}</div>
              <div class="label">Sin horas</div>
            </div>
          </div>
          <div style="font-size:8px;color:#888;margin-bottom:4px;font-weight:600;">Tasa de cumplimiento global</div>
          <div class="prog-wrap">
            <div class="prog-fill" style="width:${pctComp}%;background:${fillColor};"></div>
          </div>
          <div style="text-align:right;font-size:13px;font-weight:900;color:${fillColor};margin-top:3px;">${pctComp}%</div>
        </div>
        <div class="panel">
          <div class="section-title">Actividad <small>Últimos 7 días</small></div>
          <table>
            <tr><th>Día</th><th>Horas aprobadas</th></tr>
            ${weekRows}
          </table>
        </div>
      </div>
      <div class="two-col">
        <div class="panel">
          <div class="section-title">Top 4 proyectos <small>Por horas aprobadas</small></div>
          <table>
            <tr><th>Proyecto</th><th>Horas</th></tr>
            ${projRows}
          </table>
        </div>
        <div class="panel">
          <div class="section-title">Top 5 estudiantes <small>Por horas aprobadas</small></div>
          <table>
            <tr><th>Estudiante</th><th>Carnet</th><th>Horas</th></tr>
            ${topRows}
          </table>
        </div>
      </div>
      <div class="panel" style="margin-bottom:6px;">
        <div class="section-title">Participación por institución <small>Horas aprobadas y estudiantes</small></div>
        <table>
          <tr><th>Institución</th><th class="center">Estudiantes</th><th>Horas aprobadas</th></tr>
          ${instRows}
        </table>
      </div>
    </div>
    <div class="footer">
      <span>© ${new Date().getFullYear()} · ITCA-FEPADE</span>
      <strong>Sistema de Horas Sociales y Ambientales</strong>
      <span class="page-num">Pág. 1 / 1</span>
    </div>
    </body></html>`;

        const browser = await launchPuppeteer({
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            headless: 'new'
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 794, height: 1123 });
        await page.setContent(html, { waitUntil: 'networkidle0' });
        await new Promise(r => setTimeout(r, 500));
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0', right: '0', bottom: '0', left: '0' },
            displayHeaderFooter: false,
        });
        await browser.close();

        reply.header('Content-Type', 'application/pdf');
        reply.header('Content-Disposition', 'attachment; filename="reporte_sistema.pdf"');
        return reply.send(pdfBuffer);
    } catch (err) {
        request.log?.error?.(err);
        return reply.status(500).send({ success: false, error: { code: 'EXPORT_DASHBOARD_PDF_ERROR', message: 'Error generando PDF', details: String(err) } });
    }
}

// ─── PDF Estudiante ──────────────────────────────────────────────────────────

export async function exportStudentPDF(request, reply) {
    try {
        const { id } = request.params;
        if (!id) return reply.status(400).send({
            success: false,
            error: { code: 'MISSING_ID', message: 'Se requiere id del estudiante' }
        });

        const data = await computeStudentDetail(id);
        const { estudiante, metas, resumen, proyectos, historial } = data;

        console.log(JSON.stringify(data, null, 2));

        const fechaGen = new Date().toLocaleDateString('es-SV', { day: '2-digit', month: 'long', year: 'numeric' });
        const horaGen = new Date().toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' });

        const completado = resumen.completado;
        const estadoGlobal = completado ? 'Completado' : resumen.en_progreso ? 'En progreso' : 'Sin actividad';
        const badgeEstado = completado ? 'b-green' : resumen.en_progreso ? 'b-yellow' : 'b-red';
        const fillColor = resumen.porcentaje_total >= 75 ? '#28A745' : resumen.porcentaje_total >= 40 ? '#F0A500' : '#BE1622';

        const projRows = proyectos.slice(0, 4).map(p => {
            const pct = metas.total_meta > 0 ? Math.round((p.horas_aprobadas / metas.total_meta) * 100) : 0;
            const tipoColor = p.tipo_hora === 'Ambiental' ? '#28A745' : '#BE1622';
            return `<tr>
        <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;">
          ${p.proyecto_nombre}
          <span style="font-size:7px;color:#999;font-weight:400;display:block;">${p.tipo_hora}</span>
        </td>
        <td style="text-align:center;font-weight:700;color:${tipoColor};">${p.horas_aprobadas}</td>
        <td style="text-align:center;color:#856404;">${p.horas_pendientes}</td>
        <td style="text-align:center;color:#DC3545;">${p.horas_rechazadas}</td>
        <td>
          <div class="mini-progress">
            <div class="track">
              <div class="fill" style="width:${Math.min(pct, 100)}%;background:${tipoColor};"></div>
            </div>
            <span class="pct">${pct}%</span>
          </div>
        </td>
      </tr>`;
        }).join('');

        const histRows = historial.slice(0, 10).map(h => {
            const badge = h.estado === 'Aprobado' ? 'b-green' : h.estado === 'Pendiente' ? 'b-yellow' : 'b-red';
            const tipoIcon = h.tipo_hora === 'ambiental' ? '🌱' : '🤝';
            return `<tr>
        <td style="white-space:nowrap;font-size:8px;">${fmtDate(h.fecha)}</td>
        <td style="max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;">${h.proyecto}</td>
        <td style="text-align:center;font-weight:700;">${h.horas}</td>
        <td><span class="badge ${badge}">${h.estado}</span></td>
        <td style="font-size:7px;color:#888;max-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${tipoIcon} ${h.tipo_hora}</td>
      </tr>`;
        }).join('');

        const html = `<!doctype html><html><head><meta charset="utf-8"/>
    <title>Reporte Estudiante — ${estudiante.nombre}</title>
    <style>${CSS_STUDENT}</style>
    </head><body>
    <div class="header">
      <div class="header-left">
        <div class="logo-box">IT</div>
        <div class="header-title">
          <h1>Reporte Individual de Estudiante</h1>
          <p>Sistema de Horas Sociales y Ambientales · ITCA-FEPADE</p>
        </div>
      </div>
      <div class="header-right">
        <strong>${fechaGen}</strong>
        ${horaGen} hrs
      </div>
    </div>
    <div class="gold-band">
      <span>Historial académico de servicio social y ambiental</span>
      <span class="badge ${badgeEstado}" style="font-size:8px;padding:2px 12px;">${estadoGlobal}</span>
    </div>
    <div class="body">
      <div class="student-info">
        <div class="si-item">
          <label>Nombre completo</label>
          <span>${estudiante.nombre}</span>
        </div>
        <div class="si-item">
          <label>Carnet</label>
          <span>${estudiante.carnet}</span>
        </div>
        <div class="si-item">
          <label>Correo electrónico</label>
          <span style="font-size:9px;">${estudiante.email}</span>
        </div>
        <div class="si-item">
          <label>Grupo / Carrera</label>
          <span style="font-size:9px;">${estudiante.grupo} / ${estudiante.carrera}</span>
        </div>
      </div>
      <div class="meta-grid">
        <div class="meta-card">
          <div class="label">🌱 Horas Ambientales</div>
          <div class="value ambiental">${resumen.horas_ambientales_aprobadas} / ${metas.horas_ambientales}</div>
          <div class="sub">${resumen.porcentaje_ambiental.toFixed(1)}% completado</div>
        </div>
        <div class="meta-card">
          <div class="label">🤝 Horas Sociales</div>
          <div class="value social">${resumen.horas_sociales_aprobadas} / ${metas.horas_sociales}</div>
          <div class="sub">${resumen.porcentaje_social.toFixed(1)}% completado</div>
        </div>
      </div>
      <div class="kpi-grid" style="margin-top:8px;">
        <div class="kpi green">
          <div class="kpi-val">${resumen.total_horas_aprobadas}</div>
          <div class="kpi-lbl">Total horas aprobadas</div>
        </div>
        <div class="kpi gold">
          <div class="kpi-val">${resumen.total_horas_pendientes}</div>
          <div class="kpi-lbl">Horas pendientes</div>
        </div>
        <div class="kpi">
          <div class="kpi-val">${resumen.total_horas_rechazadas}</div>
          <div class="kpi-lbl">Horas rechazadas</div>
        </div>
        <div class="kpi">
          <div class="kpi-val">${resumen.total_registros}</div>
          <div class="kpi-lbl">Registros totales</div>
        </div>
      </div>
      <div class="prog-section">
        <div class="prog-header">
          <span class="prog-title">Progreso total hacia la meta</span>
          <span style="font-size:15px;font-weight:900;color:${fillColor};">${resumen.porcentaje_total.toFixed(1)}%</span>
        </div>
        <div class="prog-wrap">
          <div class="prog-fill" style="width:${resumen.porcentaje_total.toFixed(1)}%;background:${fillColor};"></div>
        </div>
        <div class="dual-progress">
          <div class="prog-item">
            <div class="prog-label">
              <span>🌱 Ambientales</span>
              <span class="pct ambiental">${resumen.porcentaje_ambiental.toFixed(0)}%</span>
            </div>
            <div class="prog-wrap" style="height:6px;">
              <div class="prog-fill" style="width:${resumen.porcentaje_ambiental}%;background:#28A745;"></div>
            </div>
          </div>
          <div class="prog-item">
            <div class="prog-label">
              <span>🤝 Sociales</span>
              <span class="pct">${resumen.porcentaje_social.toFixed(0)}%</span>
            </div>
            <div class="prog-wrap" style="height:6px;">
              <div class="prog-fill" style="width:${resumen.porcentaje_social}%;background:#BE1622;"></div>
            </div>
          </div>
        </div>
        <div class="prog-info">
          <span>Meta total: <strong>${metas.total_meta}</strong> horas</span>
          <span>Completado: <strong>${resumen.total_horas_aprobadas}</strong> h</span>
          <span>Faltan: <strong>${Math.max(metas.total_meta - resumen.total_horas_aprobadas, 0)}</strong> h</span>
        </div>
      </div>
      <div class="panel">
        <div class="section-title">Desglose por proyecto <small>Horas aprobadas / pendientes / rechazadas</small></div>
        <table>
          <tr>
            <th>Proyecto / Tipo</th>
            <th class="center">Aprobadas</th>
            <th class="center">Pendientes</th>
            <th class="center">Rechazadas</th>
            <th>Avance</th>
          </tr>
          ${projRows}
        </table>
      </div>
      <div class="panel" style="margin-bottom:6px;">
        <div class="section-title">Últimos 10 registros <small>Actividad reciente</small></div>
        <table>
          <tr>
            <th>Fecha</th>
            <th>Proyecto</th>
            <th class="center">Horas</th>
            <th>Estado</th>
            <th>Tipo</th>
          </tr>
          ${histRows}
        </table>
      </div>
    </div>
    <div class="footer">
      <span>© ${new Date().getFullYear()} · ITCA-FEPADE</span>
      <strong>Sistema de Horas Sociales y Ambientales</strong>
      <span class="page-num">Pág. 1 / 1</span>
    </div>
    </body></html>`;

        const browser = await launchPuppeteer({
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            headless: 'new'
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 794, height: 1123 });
        await page.setContent(html, { waitUntil: 'networkidle0' });
        await new Promise(r => setTimeout(r, 500));
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0', right: '0', bottom: '0', left: '0' },
            displayHeaderFooter: false,
        });
        await browser.close();

        reply.header('Content-Type', 'application/pdf');
        reply.header('Content-Disposition', `attachment; filename="reporte_estudiante_${id}.pdf"`);
        return reply.send(pdfBuffer);
    } catch (err) {
        request.log?.error?.(err);
        return reply.status(500).send({
            success: false,
            error: {
                code: 'EXPORT_STUDENT_PDF_ERROR',
                message: 'Error generando PDF del estudiante',
                details: String(err)
            }
        });
    }
}


//-------------- nuevo

// ─── Nuevo helper para resumen por grupo ─────────────────────────────────────


async function computeGroupSummary() {
  try {
    // 1. Obtener grupos con carrera
    const gruposCarrera = await GrupoCarrera.findAll({
      include: [
        {
          model: Carreras,
          as: 'carrera',
          attributes: ['id', 'nombre']
        },
        {
          model: Grupos,
          as: 'grupo',
          attributes: ['id', 'nombre', 'codigo', 'horas_ambientales', 'horas_sociales']
        }
      ],
      raw: true,
      nest: true
    });

    const resultados = [];

    for (const gc of gruposCarrera) {
      if (!gc.grupo) continue;

      const grupoId = gc.grupo.id;

      const metaAmbiental = safeNumber(gc.grupo.horas_ambientales || 200);
      const metaSocial = safeNumber(gc.grupo.horas_sociales || 200);

      // 2. Obtener estudiantes del grupo
      const estudiantes = await GrupoEstudiantes.findAll({
        where: { id_grupo: grupoId, estado: 'Activo' },
        attributes: ['id_estudiante'],
        raw: true
      });

      const idsEstudiantes = estudiantes.map(e => e.id_estudiante);
      const totalEstudiantes = idsEstudiantes.length;

      if (totalEstudiantes === 0) {
        resultados.push({
          carrera: gc.carrera?.nombre || 'Sin carrera',
          grupo: gc.grupo.nombre || 'Sin nombre',
          codigo: gc.grupo.codigo || 'Sin código',
          total_estudiantes: 0,
          estudiantes_activos: 0,
          meta_ambiental: metaAmbiental,
          meta_social: metaSocial,
          total_horas_ambientales: 0,
          total_horas_sociales: 0,
          promedio_ambiental: 0,
          promedio_social: 0,
          avance_ambiental: 0,
          avance_social: 0,
          tipo: 'S/A'
        });
        continue;
      }

      // 3. 🔥 UNA SOLA QUERY PARA TODOS LOS ESTUDIANTES
      const horasTotales = await RegistroHoras.findAll({
        attributes: [
          'grupo_estudiante.id_estudiante',
          [sequelize().fn('SUM', sequelize().col('horas_realizadas')), 'total_horas']
        ],
        include: [
          {
            model: GrupoEstudiantes,
            as: 'grupo_estudiante',
            attributes: []
          }
        ],
        where: {
          estado_validacion: 'Aprobado',
          '$grupo_estudiante.id_estudiante$': idsEstudiantes
        },
        group: ['grupo_estudiante.id_estudiante'],
        raw: true
      });

      // 4. Procesar resultados en memoria
      let totalHorasAmbientales = 0;
      let totalHorasSociales = 0;
      let estudiantesConHoras = 0;

      for (const row of horasTotales) {
        const total = safeNumber(row.total_horas);

        const horasAmb = total * 0.5;
        const horasSoc = total * 0.5;

        totalHorasAmbientales += horasAmb;
        totalHorasSociales += horasSoc;

        if (total > 0) estudiantesConHoras++;
      }

      // 5. Cálculos finales
      const promedioAmbiental = +(totalHorasAmbientales / totalEstudiantes).toFixed(1);
      const promedioSocial = +(totalHorasSociales / totalEstudiantes).toFixed(1);

      const avanceAmbiental =
        metaAmbiental > 0
          ? Math.min((totalHorasAmbientales / (metaAmbiental * totalEstudiantes)) * 100, 100)
          : 0;

      const avanceSocial =
        metaSocial > 0
          ? Math.min((totalHorasSociales / (metaSocial * totalEstudiantes)) * 100, 100)
          : 0;

      resultados.push({
        carrera: gc.carrera?.nombre || 'Sin carrera',
        grupo: gc.grupo.nombre || 'Sin nombre',
        codigo: gc.grupo.codigo || 'Sin código',
        total_estudiantes: totalEstudiantes,
        estudiantes_activos: estudiantesConHoras,
        meta_ambiental: metaAmbiental,
        meta_social: metaSocial,
        total_horas_ambientales: totalHorasAmbientales,
        total_horas_sociales: totalHorasSociales,
        promedio_ambiental: promedioAmbiental,
        promedio_social: promedioSocial,
        avance_ambiental: +avanceAmbiental.toFixed(1),
        avance_social: +avanceSocial.toFixed(1),
        tipo: 'S/A'
      });
    }

    // 6. Ordenamiento
    resultados.sort((a, b) => {
      if (a.carrera !== b.carrera) return a.carrera.localeCompare(b.carrera);
      return a.grupo.localeCompare(b.grupo);
    });

    return resultados;
  } catch (error) {
    console.error('Error en computeGroupSummary:', error);
    throw error;
  }
}

// ─── Controller ──────────────────────────────────────
export async function getGroupSummary(request, reply) {
  try {
    const data = await computeGroupSummary();
    return reply.send(data);
  } catch (err) {
    request.log?.error?.(err);
    return reply.status(500).send({
      success: false,
      error: {
        code: 'GET_GROUP_SUMMARY_ERROR',
        message: 'Error obteniendo resumen por grupo',
        details: String(err)
      }
    });
  }
}

// ─── CSS para reporte de grupos ──────────────────────────────────────────────

const CSS_GROUP_REPORT = `
  @page { 
    size: A4; 
    margin: 0;
  }
  
  * { 
    box-sizing: border-box; 
    margin: 0; 
    padding: 0; 
  }
  
  body {
    font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
    background: #F5F5F5;
    color: #1A1A2E;
    width: 210mm;
    min-height: 297mm;
    font-size: 9.5px;
    line-height: 1.4;
  }

  /* ── HEADER ── */
  .header {
    background: linear-gradient(135deg, #6B0000 0%, #8B0000 40%, #BE1622 100%);
    padding: 12px 24px 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 3px solid #F0A500;
    position: relative;
  }
  
  .header::after {
    content: '';
    position: absolute;
    bottom: -6px;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, #F0A500, #BE1622, #F0A500);
  }
  
  .header-left { 
    display: flex; 
    align-items: center; 
    gap: 16px; 
  }
  
  .logo-box {
    width: 48px; 
    height: 48px;
    background: #F0A500;
    border-radius: 10px;
    display: flex; 
    align-items: center; 
    justify-content: center;
    font-size: 20px; 
    font-weight: 900; 
    color: #8B0000; 
    letter-spacing: -1px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }
  
  .header-title h1 { 
    font-size: 17px; 
    font-weight: 900; 
    color: #fff;
    letter-spacing: 0.5px;
    text-shadow: 0 1px 3px rgba(0,0,0,0.3);
  }
  
  .header-title p { 
    font-size: 9px; 
    color: rgba(255,255,255,0.8); 
    margin-top: 2px;
    font-weight: 300;
    letter-spacing: 0.3px;
  }
  
  .header-right { 
    text-align: right; 
    color: rgba(255,255,255,0.9); 
    font-size: 9px; 
    line-height: 1.6; 
  }
  
  .header-right strong { 
    color: #F0A500; 
    font-size: 11px; 
    display: block;
    font-weight: 800;
  }

  /* ── GOLD BAND ── */
  .gold-band {
    background: #F0A500;
    padding: 4px 24px;
    font-size: 7.5px;
    font-weight: 700;
    color: #6B0000;
    letter-spacing: 2px;
    text-transform: uppercase;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .gold-band span:last-child {
    color: #8B0000;
    font-weight: 800;
  }

  /* ── BODY ── */
  .body { 
    padding: 10px 18px 8px; 
  }

  /* ── KPI CARDS ── */
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 12px;
  }
  
  .kpi {
    background: #fff;
    border-radius: 8px;
    padding: 10px 14px;
    border-left: 4px solid #BE1622;
    box-shadow: 0 2px 10px rgba(190,22,34,0.08);
  }
  
  .kpi.gold { border-left-color: #F0A500; }
  .kpi.green { border-left-color: #28A745; }
  
  .kpi .kpi-val { 
    font-size: 24px; 
    font-weight: 900; 
    color: #BE1622; 
    line-height: 1.1;
  }
  
  .kpi.gold .kpi-val { color: #B07800; }
  .kpi.green .kpi-val { color: #28A745; }
  
  .kpi .kpi-lbl { 
    font-size: 8px; 
    color: #888; 
    text-transform: uppercase; 
    letter-spacing: 0.8px; 
    margin-top: 4px;
    font-weight: 600;
  }

  /* ── SECTION TITLE ── */
  .section-title {
    font-size: 11px;
    font-weight: 800;
    color: #BE1622;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    border-bottom: 3px solid #F0A500;
    padding-bottom: 5px;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  
  .section-title small {
    font-weight: 400;
    color: #999;
    font-size: 8px;
    letter-spacing: 0.5px;
  }

  /* ── TABLES ── */
  table { 
    width: 100%; 
    border-collapse: collapse; 
    margin-bottom: 10px;
  }
  
  th {
    background: #BE1622;
    color: #fff;
    font-size: 7.5px;
    font-weight: 700;
    padding: 6px 10px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    text-align: left;
  }
  
  th.center { text-align: center; }
  th.right { text-align: right; }
  
  td { 
    font-size: 9px; 
    padding: 6px 10px; 
    border-bottom: 1px solid #F0F0F0; 
    color: #1A1A2E; 
  }
  
  tr:last-child td { border-bottom: none; }
  tr:nth-child(even) td { background: #FAFAFA; }

  /* ── BADGES ── */
  .badge {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 4px;
    font-size: 7.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  
  .b-green  { background: #D4EDDA; color: #155724; }
  .b-yellow { background: #FFF3CD; color: #856404; }
  .b-red    { background: #F8D7DA; color: #721C24; }
  .b-gold   { background: #FFF8E1; color: #B07800; }

  /* ── PROGRESS BAR ── */
  .prog-wrap { 
    height: 12px; 
    background: #E8E8E8; 
    border-radius: 6px; 
    overflow: hidden; 
    position: relative;
  }
  
  .prog-fill { 
    height: 100%; 
    border-radius: 6px; 
    transition: width 0.3s;
  }
  
  .prog-label {
    position: absolute;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 7px;
    font-weight: 700;
    color: #1A1A2E;
    text-shadow: 0 0 4px rgba(255,255,255,0.8);
  }

  /* ── CHART ── */
  .chart-container {
    background: #fff;
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 12px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
    border: 1px solid rgba(190,22,34,0.05);
  }
  
  .chart-title {
    font-size: 10px;
    font-weight: 700;
    color: #BE1622;
    margin-bottom: 10px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }
  
  .chart-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  
  .chart-bar-group {
    margin-bottom: 8px;
  }
  
  .chart-bar-label {
    display: flex;
    justify-content: space-between;
    font-size: 8px;
    color: #666;
    margin-bottom: 2px;
  }
  
  .chart-bar-label .name {
    font-weight: 600;
    color: #1A1A2E;
  }
  
  .chart-bar-label .value {
    font-weight: 700;
  }
  
  .chart-bar-track {
    height: 18px;
    background: #F0F0F0;
    border-radius: 4px;
    overflow: hidden;
    position: relative;
  }
  
  .chart-bar-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.5s;
  }
  
  .chart-bar-fill.ambiental {
    background: linear-gradient(90deg, #28A745, #34CE57);
  }
  
  .chart-bar-fill.social {
    background: linear-gradient(90deg, #BE1622, #E01A2A);
  }
  
  .chart-bar-fill.mixed {
    background: linear-gradient(90deg, #BE1622 50%, #28A745 50%);
  }
  
  .chart-bar-pct {
    position: absolute;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 7px;
    font-weight: 700;
    color: #1A1A2E;
    text-shadow: 0 0 4px rgba(255,255,255,0.9);
  }

  /* ── LEGEND ── */
  .legend {
    display: flex;
    gap: 16px;
    margin-top: 8px;
    justify-content: center;
  }
  
  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 8px;
    color: #666;
  }
  
  .legend-color {
    width: 14px;
    height: 14px;
    border-radius: 3px;
  }
  
  .legend-color.ambiental { background: #28A745; }
  .legend-color.social { background: #BE1622; }
  .legend-color.gold { background: #F0A500; }

  .pie-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    align-items: start;
  }

  .pie-card {
    background: #fff;
    border-radius: 10px;
    padding: 14px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    border: 1px solid rgba(190,22,34,0.08);
    min-height: 250px;
  }

  .pie-title {
    font-size: 9.5px;
    font-weight: 700;
    color: #BE1622;
    margin-bottom: 10px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }

  .pie-chart {
    width: 180px;
    height: 180px;
    border-radius: 50%;
    margin: 0 auto 10px;
    background: #E8E8E8;
    position: relative;
  }

  .pie-value {
    font-size: 24px;
    font-weight: 900;
    text-align: center;
    color: #1A1A2E;
    margin-bottom: 10px;
  }

  .pie-values {
    display: grid;
    gap: 6px;
    font-size: 8px;
    color: #444;
  }

  .pie-values div {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .pie-values span {
    width: 12px;
    height: 12px;
    display: inline-block;
    border-radius: 3px;
  }

  .pie-values .ambiental { background: #28A745; }
  .pie-values .social { background: #BE1622; }
  .pie-values .gold { background: #F0A500; }

  /* ── FOOTER ── */
  .footer {
    background: #1A1A2E;
    padding: 6px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 2px solid #F0A500;
    margin-top: 10px;
  }
  
  .footer span { 
    font-size: 7.5px; 
    color: rgba(255,255,255,0.5); 
  }
  
  .footer strong { 
    color: #F0A500; 
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.5px;
  }
  
  .footer .page-num {
    color: rgba(255,255,255,0.4);
    font-size: 7.5px;
  }

  /* ── GROUP CARD ── */
  .group-card {
    background: #fff;
    border-radius: 8px;
    padding: 10px 14px;
    margin-bottom: 8px;
    border-left: 4px solid #BE1622;
    box-shadow: 0 2px 6px rgba(0,0,0,0.04);
  }
  
  .group-card .group-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }
  
  .group-card .group-name {
    font-weight: 700;
    font-size: 10px;
    color: #1A1A2E;
  }
  
  .group-card .group-carrera {
    font-size: 8px;
    color: #888;
  }
  
  .group-card .group-stats {
    display: flex;
    gap: 16px;
    font-size: 8px;
    color: #666;
  }
  
  .group-card .group-stats strong {
    color: #1A1A2E;
  }
  
  .group-card .group-bars {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 6px;
  }
`;

// ─── PDF Resumen por Grupo ────────────────────────────────────────────────────

export async function exportGroupPDF(request, reply) {
  try {
    const data = await computeGroupSummary();

    // Calcular estadísticas generales
    const totalGrupos = data.length;
    const totalEstudiantes = data.reduce((sum, g) => sum + g.total_estudiantes, 0);
    const promedioAvanceAmbiental = data.length > 0 
      ? +(data.reduce((sum, g) => sum + g.avance_ambiental, 0) / data.length).toFixed(1)
      : 0;
    const promedioAvanceSocial = data.length > 0
      ? +(data.reduce((sum, g) => sum + g.avance_social, 0) / data.length).toFixed(1)
      : 0;

    const fechaGen = new Date().toLocaleDateString('es-SV', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric' 
    });
    const horaGen = new Date().toLocaleTimeString('es-SV', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    // Generar filas de la tabla
    const tableRows = data.map(g => {
      const avgTotal = (g.promedio_ambiental + g.promedio_social) / 2;
      const avanceTotal = (g.avance_ambiental + g.avance_social) / 2;
      const badgeColor = avanceTotal >= 80 ? 'b-green' : avanceTotal >= 50 ? 'b-yellow' : 'b-red';
      
      return `<tr>
        <td style="font-weight:600;">${g.carrera}</td>
        <td><strong>${g.grupo}</strong><br><span style="font-size:7px;color:#888;">${g.codigo}</span></td>
        <td style="text-align:center;">
          <span class="badge ${badgeColor}">${avanceTotal.toFixed(0)}%</span>
        </td>
        <td style="text-align:center;font-weight:700;">${g.total_estudiantes}</td>
        <td style="text-align:center;">${g.estudiantes_activos}</td>
        <td style="text-align:center;color:#28A745;">${g.promedio_ambiental}</td>
        <td style="text-align:center;color:#BE1622;">${g.promedio_social}</td>
      </tr>`;
    }).join('');

    // Generar gráficas de barras (Top 10 por avance)
    const sortedByAvance = [...data].sort((a, b) => {
      const avgA = (a.avance_ambiental + a.avance_social) / 2;
      const avgB = (b.avance_ambiental + b.avance_social) / 2;
      return avgB - avgA;
    }).slice(0, 10);

    const chartBars = sortedByAvance.map(g => {
      const avgTotal = (g.avance_ambiental + g.avance_social) / 2;
      const label = g.grupo.length > 20 ? g.grupo.substring(0, 18) + '…' : g.grupo;
      
      return `<div class="chart-bar-group">
        <div class="chart-bar-label">
          <span class="name">${label}</span>
          <span class="value">${avgTotal.toFixed(0)}%</span>
        </div>
        <div class="chart-bar-track">
          <div class="chart-bar-fill mixed" style="width:${avgTotal}%;"></div>
          <span class="chart-bar-pct">${avgTotal.toFixed(0)}%</span>
        </div>
      </div>`;
    }).join('');

    // Generar gráficas de barras por tipo (Top 8)
    const topAmbiental = [...data].sort((a, b) => b.avance_ambiental - a.avance_ambiental).slice(0, 8);
    const topSocial = [...data].sort((a, b) => b.avance_social - a.avance_social).slice(0, 8);

    const ambientChart = topAmbiental.map(g => {
      const label = g.grupo.length > 15 ? g.grupo.substring(0, 13) + '…' : g.grupo;
      return `<div class="chart-bar-group">
        <div class="chart-bar-label">
          <span class="name">${label}</span>
          <span class="value">${g.avance_ambiental.toFixed(0)}%</span>
        </div>
        <div class="chart-bar-track">
          <div class="chart-bar-fill ambiental" style="width:${g.avance_ambiental}%;"></div>
          <span class="chart-bar-pct">${g.avance_ambiental.toFixed(0)}%</span>
        </div>
      </div>`;
    }).join('');

    const socialChart = topSocial.map(g => {
      const label = g.grupo.length > 15 ? g.grupo.substring(0, 13) + '…' : g.grupo;
      return `<div class="chart-bar-group">
        <div class="chart-bar-label">
          <span class="name">${label}</span>
          <span class="value">${g.avance_social.toFixed(0)}%</span>
        </div>
        <div class="chart-bar-track">
          <div class="chart-bar-fill social" style="width:${g.avance_social}%;"></div>
          <span class="chart-bar-pct">${g.avance_social.toFixed(0)}%</span>
        </div>
      </div>`;
    }).join('');

    const html = `<!doctype html><html><head><meta charset="utf-8"/>
    <title>Resumen por Grupo — ITCA-FEPADE</title>
    <style>${CSS_GROUP_REPORT}</style>
    </head><body>

    <!-- HEADER -->
    <div class="header">
      <div class="header-left">
        <div class="logo-box">IT</div>
        <div class="header-title">
          <h1>Resumen por Grupo</h1>
          <p>Sistema de Horas Sociales y Ambientales · ITCA-FEPADE</p>
        </div>
      </div>
      <div class="header-right">
        <strong>${fechaGen}</strong>
        ${horaGen} hrs
      </div>
    </div>
    <div class="gold-band">
      <span>Reporte de avance por grupo y carrera</span>
      <span>${new Date().getFullYear()} · ITCA-FEPADE</span>
    </div>

    <!-- BODY -->
    <div class="body">

      <!-- KPIs -->
      <div class="kpi-grid">
        <div class="kpi">
          <div class="kpi-val">${totalGrupos}</div>
          <div class="kpi-lbl">Grupos registrados</div>
        </div>
        <div class="kpi gold">
          <div class="kpi-val">${totalEstudiantes}</div>
          <div class="kpi-lbl">Total estudiantes</div>
        </div>
        <div class="kpi green">
          <div class="kpi-val">${promedioAvanceAmbiental}%</div>
          <div class="kpi-lbl">Prom. avance ambiental</div>
        </div>
        <div class="kpi gold">
          <div class="kpi-val">${promedioAvanceSocial}%</div>
          <div class="kpi-lbl">Prom. avance social</div>
        </div>
      </div>

      <!-- GRÁFICAS -->
      <div class="chart-container">
        <div class="chart-title">📊 Top 10 grupos por avance total</div>
        ${chartBars}
        <div class="legend">
          <div class="legend-item">
            <div class="legend-color mixed" style="background:linear-gradient(90deg,#BE1622 50%,#28A745 50%);"></div>
            <span>Promedio Sociales + Ambientales</span>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
        <div class="chart-container" style="margin-bottom:0;">
          <div class="chart-title" style="font-size:9px;">🌱 Top 8 avance ambiental</div>
          ${ambientChart}
        </div>
        <div class="chart-container" style="margin-bottom:0;">
          <div class="chart-title" style="font-size:9px;">🤝 Top 8 avance social</div>
          ${socialChart}
        </div>
      </div>

      <!-- TABLA DETALLADA -->
      <div style="background:#fff;border-radius:8px;padding:10px 14px;box-shadow:0 2px 10px rgba(0,0,0,0.05);border:1px solid rgba(190,22,34,0.05);">
        <div class="section-title">
          <span>Detalle por grupo</span>
          <small>${totalGrupos} grupos · ${totalEstudiantes} estudiantes</small>
        </div>
        <table>
          <tr>
            <th>Carrera</th>
            <th>Grupo</th>
            <th class="center">Avance</th>
            <th class="center">Total</th>
            <th class="center">Activos</th>
            <th class="center">Amb. (prom)</th>
            <th class="center">Soc. (prom)</th>
          </tr>
          ${tableRows}
        </table>
      </div>

    </div><!-- /body -->

    <!-- FOOTER -->
    <div class="footer">
      <span>© ${new Date().getFullYear()} · ITCA-FEPADE</span>
      <strong>Sistema de Horas Sociales y Ambientales</strong>
      <span class="page-num">Pág. 1 / 1</span>
    </div>

    </body></html>`;

    const browser = await launchPuppeteer({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: 'new'
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 500));
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      displayHeaderFooter: false,
    });
    await browser.close();

    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', 'attachment; filename="resumen_por_grupo.pdf"');
    return reply.send(pdfBuffer);
  } catch (err) {
    request.log?.error?.(err);
    return reply.status(500).send({ 
      success: false, 
      error: { 
        code: 'EXPORT_GROUP_PDF_ERROR', 
        message: 'Error generando PDF de resumen por grupo', 
        details: String(err) 
      } 
    });
  }
}





//------------------------- otra 

// ─── CSS para Reporte General de Gestión ─────────────────────────────────────

const CSS_GENERAL_REPORT = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
    background: #F5F5F5;
    color: #1A1A2E;
    width: 210mm;
    min-height: 297mm;
    font-size: 9.5px;
    line-height: 1.4;
  }
  .header {
    background: linear-gradient(135deg, #6B0000 0%, #8B0000 40%, #BE1622 100%);
    padding: 12px 24px 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 3px solid #F0A500;
    position: relative;
  }
  .header::after {
    content: '';
    position: absolute;
    bottom: -6px;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, #F0A500, #BE1622, #F0A500);
  }
  .header-left { display: flex; align-items: center; gap: 16px; }
  .logo-box {
    width: 48px; height: 48px;
    background: #F0A500;
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; font-weight: 900; color: #8B0000;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }
  .header-title h1 { font-size: 16px; font-weight: 900; color: #fff; letter-spacing: 0.5px; text-shadow: 0 1px 3px rgba(0,0,0,0.3); }
  .header-title p { font-size: 8.5px; color: rgba(255,255,255,0.8); margin-top: 2px; font-weight: 300; }
  .header-right { text-align: right; color: rgba(255,255,255,0.9); font-size: 8.5px; line-height: 1.6; }
  .header-right strong { color: #F0A500; font-size: 10px; display: block; font-weight: 800; }
  .gold-band {
    background: #F0A500;
    padding: 4px 24px;
    font-size: 7.5px;
    font-weight: 700;
    color: #6B0000;
    letter-spacing: 2px;
    text-transform: uppercase;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .gold-band span:last-child { color: #8B0000; font-weight: 800; }
  .body { padding: 10px 18px 8px; }
  
  .page-break { page-break-after: always; }
  
  .section-title {
    font-size: 11px;
    font-weight: 800;
    color: #BE1622;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    border-bottom: 3px solid #F0A500;
    padding-bottom: 5px;
    margin-bottom: 10px;
  }
  .section-title small { font-weight: 400; color: #999; font-size: 8px; letter-spacing: 0.5px; }
  
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 12px;
  }
  .kpi {
    background: #fff;
    border-radius: 8px;
    padding: 10px 14px;
    border-left: 4px solid #BE1622;
    box-shadow: 0 2px 10px rgba(190,22,34,0.08);
  }
  .kpi.gold { border-left-color: #F0A500; }
  .kpi.green { border-left-color: #28A745; }
  .kpi.purple { border-left-color: #6F42C1; }
  .kpi .kpi-val { font-size: 22px; font-weight: 900; color: #BE1622; line-height: 1.1; }
  .kpi.gold .kpi-val { color: #B07800; }
  .kpi.green .kpi-val { color: #28A745; }
  .kpi.purple .kpi-val { color: #6F42C1; }
  .kpi .kpi-lbl { font-size: 7.5px; color: #888; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 3px; font-weight: 600; }
  
  .chart-container {
    background: #fff;
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 12px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
    border: 1px solid rgba(190,22,34,0.05);
  }
  .chart-title {
    font-size: 10px;
    font-weight: 700;
    color: #BE1622;
    margin-bottom: 10px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }
  
  .bar-group { margin-bottom: 6px; }
  .bar-label {
    display: flex;
    justify-content: space-between;
    font-size: 8px;
    color: #666;
    margin-bottom: 2px;
  }
  .bar-label .name { font-weight: 600; color: #1A1A2E; }
  .bar-label .value { font-weight: 700; }
  .bar-track {
    height: 16px;
    background: #F0F0F0;
    border-radius: 4px;
    overflow: hidden;
    position: relative;
  }
  .bar-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.5s;
  }
  .bar-fill.red { background: linear-gradient(90deg, #BE1622, #E01A2A); }
  .bar-fill.green { background: linear-gradient(90deg, #28A745, #34CE57); }
  .bar-fill.gold { background: linear-gradient(90deg, #F0A500, #F5C842); }
  .bar-fill.purple { background: linear-gradient(90deg, #6F42C1, #9B59B6); }
  .bar-fill.blue { background: linear-gradient(90deg, #007BFF, #4DA6FF); }
  .pie-chart {
    display: flex;
    gap: 14px;
    align-items: center;
    margin-bottom: 10px;
  }
  .pie-circle {
    width: 134px;
    height: 134px;
    border-radius: 50%;
    position: relative;
    box-shadow: inset 0 0 0 12px #fff, 0 3px 18px rgba(0,0,0,0.08);
  }
  .pie-circle::before {
    content: '';
    position: absolute;
    inset: 20px;
    border-radius: 50%;
    background: #fff;
  }
  .pie-legend {
    display: grid;
    gap: 6px;
    font-size: 7.8px;
  }
  .pie-item {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #444;
  }
  .pie-key {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    display: inline-block;
  }
  .bar-pct {
    position: absolute;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 7px;
    font-weight: 700;
    color: #1A1A2E;
    text-shadow: 0 0 4px rgba(255,255,255,0.9);
  }
  
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .three-col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
  
  table { width: 100%; border-collapse: collapse; }
  th {
    background: #BE1622;
    color: #fff;
    font-size: 7px;
    font-weight: 700;
    padding: 5px 8px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    text-align: left;
  }
  th.center { text-align: center; }
  td { font-size: 8.5px; padding: 4px 8px; border-bottom: 1px solid #F0F0F0; }
  tr:last-child td { border-bottom: none; }
  tr:nth-child(even) td { background: #FAFAFA; }
  
  .badge {
    display: inline-block;
    padding: 1px 8px;
    border-radius: 4px;
    font-size: 7px;
    font-weight: 700;
    text-transform: uppercase;
  }
  .b-green { background: #D4EDDA; color: #155724; }
  .b-yellow { background: #FFF3CD; color: #856404; }
  .b-red { background: #F8D7DA; color: #721C24; }
  .b-gold { background: #FFF8E1; color: #B07800; }
  .b-blue { background: #D6EAF8; color: #1A5276; }
  
  .footer {
    background: #1A1A2E;
    padding: 6px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 2px solid #F0A500;
    margin-top: 10px;
  }
  .footer span { font-size: 7.5px; color: rgba(255,255,255,0.5); }
  .footer strong { color: #F0A500; font-size: 8px; font-weight: 700; letter-spacing: 0.5px; }
  .footer .page-num { color: rgba(255,255,255,0.4); font-size: 7.5px; }
  
  .insight-box {
    background: #FFF8E1;
    border-left: 4px solid #F0A500;
    padding: 8px 12px;
    margin-bottom: 10px;
    border-radius: 4px;
  }
  .insight-box strong { color: #6B0000; }
  .insight-box .icon { font-size: 14px; margin-right: 6px; }
`;

// ─── CSS para Reporte Individual ─────────────────────────────────────────────

const CSS_INDIVIDUAL_REPORT = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
    background: #F5F5F5;
    color: #1A1A2E;
    width: 210mm;
    min-height: 297mm;
    font-size: 9.5px;
    line-height: 1.4;
  }
  .header {
    background: linear-gradient(135deg, #6B0000 0%, #8B0000 40%, #BE1622 100%);
    padding: 12px 24px 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 3px solid #F0A500;
    position: relative;
  }
  .header::after {
    content: '';
    position: absolute;
    bottom: -6px;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, #F0A500, #BE1622, #F0A500);
  }
  .header-left { display: flex; align-items: center; gap: 16px; }
  .logo-box {
    width: 48px; height: 48px;
    background: #F0A500;
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; font-weight: 900; color: #8B0000;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }
  .header-title h1 { font-size: 16px; font-weight: 900; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.3); }
  .header-title p { font-size: 8.5px; color: rgba(255,255,255,0.8); margin-top: 2px; font-weight: 300; }
  .header-right { text-align: right; color: rgba(255,255,255,0.9); font-size: 8.5px; line-height: 1.6; }
  .header-right strong { color: #F0A500; font-size: 10px; display: block; font-weight: 800; }
  .gold-band {
    background: #F0A500;
    padding: 4px 24px;
    font-size: 7.5px;
    font-weight: 700;
    color: #6B0000;
    letter-spacing: 2px;
    text-transform: uppercase;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .body { padding: 10px 18px 8px; }
  
  .profile-card {
    background: #fff;
    border-radius: 8px;
    padding: 12px 16px;
    display: grid;
    grid-template-columns: 1.5fr 1fr 1fr 0.8fr;
    gap: 12px;
    margin-bottom: 12px;
    border-left: 4px solid #BE1622;
    box-shadow: 0 2px 10px rgba(190,22,34,0.08);
  }
  .profile-item label { font-size: 7px; color: #999; text-transform: uppercase; letter-spacing: 0.8px; display: block; margin-bottom: 2px; font-weight: 600; }
  .profile-item span { font-size: 10.5px; font-weight: 700; color: #1A1A2E; }
  
  .section-title {
    font-size: 10px;
    font-weight: 800;
    color: #BE1622;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    border-bottom: 2px solid #F0A500;
    padding-bottom: 4px;
    margin-bottom: 8px;
  }
  
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
    margin-bottom: 12px;
  }
  .kpi {
    background: #fff;
    border-radius: 8px;
    padding: 8px 10px;
    border-left: 4px solid #BE1622;
    box-shadow: 0 2px 10px rgba(190,22,34,0.08);
    text-align: center;
  }
  .kpi.gold { border-left-color: #F0A500; }
  .kpi.green { border-left-color: #28A745; }
  .kpi.purple { border-left-color: #6F42C1; }
  .kpi .kpi-val { font-size: 20px; font-weight: 900; color: #BE1622; line-height: 1.1; }
  .kpi.gold .kpi-val { color: #B07800; }
  .kpi.green .kpi-val { color: #28A745; }
  .kpi.purple .kpi-val { color: #6F42C1; }
  .kpi .kpi-lbl { font-size: 7px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; font-weight: 600; }
  
  .chart-container {
    background: #fff;
    border-radius: 8px;
    padding: 10px 14px;
    margin-bottom: 10px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
    border: 1px solid rgba(190,22,34,0.05);
  }
  
  .bar-group { margin-bottom: 5px; }
  .bar-label {
    display: flex;
    justify-content: space-between;
    font-size: 7.5px;
    color: #666;
    margin-bottom: 1px;
  }
  .bar-label .name { font-weight: 600; color: #1A1A2E; }
  .bar-label .value { font-weight: 700; }
  .bar-track {
    height: 14px;
    background: #F0F0F0;
    border-radius: 4px;
    overflow: hidden;
    position: relative;
  }
  .bar-fill {
    height: 100%;
    border-radius: 4px;
  }
  .bar-fill.green { background: linear-gradient(90deg, #28A745, #34CE57); }
  .bar-fill.red { background: linear-gradient(90deg, #BE1622, #E01A2A); }
  .bar-fill.gold { background: linear-gradient(90deg, #F0A500, #F5C842); }
  .bar-fill.purple { background: linear-gradient(90deg, #6F42C1, #9B59B6); }
  .bar-pct {
    position: absolute;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 6.5px;
    font-weight: 700;
    color: #1A1A2E;
    text-shadow: 0 0 4px rgba(255,255,255,0.9);
  }
  
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  
  table { width: 100%; border-collapse: collapse; }
  th {
    background: #BE1622;
    color: #fff;
    font-size: 7px;
    font-weight: 700;
    padding: 4px 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    text-align: left;
  }
  th.center { text-align: center; }
  td { font-size: 8px; padding: 4px 8px; border-bottom: 1px solid #F0F0F0; }
  tr:last-child td { border-bottom: none; }
  tr:nth-child(even) td { background: #FAFAFA; }
  
  .badge {
    display: inline-block;
    padding: 1px 8px;
    border-radius: 4px;
    font-size: 6.5px;
    font-weight: 700;
    text-transform: uppercase;
  }
  .b-green { background: #D4EDDA; color: #155724; }
  .b-yellow { background: #FFF3CD; color: #856404; }
  .b-red { background: #F8D7DA; color: #721C24; }
  
  .footer {
    background: #1A1A2E;
    padding: 6px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 2px solid #F0A500;
    margin-top: 10px;
  }
  .footer span { font-size: 7.5px; color: rgba(255,255,255,0.5); }
  .footer strong { color: #F0A500; font-size: 8px; font-weight: 700; letter-spacing: 0.5px; }
  .footer .page-num { color: rgba(255,255,255,0.4); font-size: 7.5px; }
  
  .status-ring {
    display: inline-block;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    border: 4px solid #F0A500;
    text-align: center;
    line-height: 52px;
    font-size: 18px;
    font-weight: 900;
    color: #BE1622;
  }
`;

// ─── REPORTE GENERAL DE GESTIÓN ─────────────────────────────────────────────

export async function exportGeneralReportPDF(request, reply) {
  try {
    const [
      overview,
      projects,
      weekly,
      top,
      byStatus,
      completion,
      insts,
      groupData
    ] = await Promise.all([
      computeOverviewData(),
      computeHoursByProjectData(),
      computeHoursWeeklyData(
        new Date(Date.now() - 13 * 24 * 3600 * 1000).toISOString().slice(0, 10),
        new Date().toISOString().slice(0, 10)
      ),
      computeTopStudentsData(10),
      computeHoursByStatus(),
      computeCompletionRate(),
      computeInstitutionsSummary(),
      computeGroupSummary(),
    ]);

    console.log('General report data computed' + JSON.stringify({ overview, projects, weekly, top, byStatus, completion, insts, groupData }));

    const fechaGen = new Date().toLocaleDateString('es-SV', { day: '2-digit', month: 'long', year: 'numeric' });
    const horaGen = new Date().toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' });

    // Estadísticas para insights
    const totalHoras = overview.totalHoras;
    const totalEstudiantes = overview.totalEstudiantes;
    const tasaCumplimiento = completion.tasa_cumplimiento || 0;
    const completados = completion.completados || 0;
    const enProgreso = completion.en_progreso || 0;
    const sinHoras = completion.sin_horas || 0;

    // Top 5 proyectos
    const topProjects = projects.slice(0, 5);
    const maxProj = Math.max(...projects.map(p => p.total_horas), 1);
    const projectBars = topProjects.map(p => {
      const completionPct = p.required_hours > 0 ? Math.min(Math.round((p.total_horas / p.required_hours) * 100), 100) : 0;
      return `
      <div class="bar-group">
        <div class="bar-label">
          <span class="name">${p.proyecto_nombre.length > 25 ? p.proyecto_nombre.substring(0, 25) + '…' : p.proyecto_nombre}</span>
          <span class="value">${p.total_horas}h / ${p.required_hours}h (${completionPct}%)</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill red" style="width:${completionPct}%;"></div>
          <span class="bar-pct">${completionPct}%</span>
        </div>
      </div>
    `;
    }).join('');

    // Top 5 instituciones
    const topInsts = insts.slice(0, 5);
    const maxInst = Math.max(...insts.map(i => i.total_horas), 1);
    const instBars = topInsts.map(i => `
      <div class="bar-group">
        <div class="bar-label">
          <span class="name">${i.institucion_nombre.length > 25 ? i.institucion_nombre.substring(0, 25) + '…' : i.institucion_nombre}</span>
          <span class="value">${i.total_horas}h</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill gold" style="width:${(i.total_horas / maxInst) * 100}%;"></div>
          <span class="bar-pct">${Math.round((i.total_horas / maxInst) * 100)}%</span>
        </div>
      </div>
    `).join('');

    // Actividad semanal - últimos 7 días
    const last7 = weekly.slice(-7);
    const maxWeek = Math.max(...weekly.map(w => w.total_horas), 1);
    const weekBars = last7.map(w => {
      const date = new Date(w.dia);
      const dayName = date.toLocaleDateString('es-SV', { weekday: 'short' });
      return `<div class="bar-group">
        <div class="bar-label">
          <span class="name">${dayName}</span>
          <span class="value">${w.total_horas}h</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill blue" style="width:${(w.total_horas / maxWeek) * 100}%;"></div>
          <span class="bar-pct">${w.total_horas > 0 ? Math.round((w.total_horas / maxWeek) * 100) : 0}%</span>
        </div>
      </div>`;
    }).join('');

    // Estado de registros
    const statusTotal = byStatus.reduce((s, r) => s + r.total_registros, 0);
    const statusBars = byStatus.map(s => {
      const color = s.estado === 'Aprobado' ? 'green' : s.estado === 'Pendiente' ? 'gold' : 'red';
      const pct = statusTotal > 0 ? (s.total_registros / statusTotal) * 100 : 0;
      return `<div class="bar-group">
        <div class="bar-label">
          <span class="name">${s.estado}</span>
          <span class="value">${s.total_registros}</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill ${color}" style="width:${pct}%;"></div>
          <span class="bar-pct">${pct.toFixed(0)}%</span>
        </div>
      </div>`;
    }).join('');

    const statusPieData = byStatus.map(s => {
      const pct = statusTotal > 0 ? (s.total_registros / statusTotal) * 100 : 0;
      const color = s.estado === 'Aprobado' ? '#28A745' : s.estado === 'Pendiente' ? '#F0A500' : '#BE1622';
      return { label: s.estado, value: s.total_registros, pct, color };
    });

    let cumulative = 0;
    const statusPieGradient = statusPieData
      .map(item => {
        const start = cumulative;
        const end = cumulative + item.pct;
        cumulative = end;
        return `${item.color} ${start}% ${end}%`;
      })
      .join(', ');

    const statusPieLegend = statusPieData.map(item => `
      <div class="pie-item">
        <span class="pie-key" style="background:${item.color};"></span>
        <span>${item.label} ${item.pct.toFixed(0)}%</span>
      </div>
    `).join('');

    // Top 5 estudiantes
    const topStudents = top.slice(0, 5);
    const maxTop = Math.max(...top.map(s => s.total_horas), 1);
    const studentBars = topStudents.map((s, i) => `
      <div class="bar-group">
        <div class="bar-label">
          <span class="name">${i + 1}. ${s.nombre.length > 20 ? s.nombre.substring(0, 20) + '…' : s.nombre}</span>
          <span class="value">${s.total_horas}h</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill purple" style="width:${(s.total_horas / maxTop) * 100}%;"></div>
          <span class="bar-pct">${Math.round((s.total_horas / maxTop) * 100)}%</span>
        </div>
      </div>
    `).join('');

    // Grupos con mejor avance
    const topGroups = [...groupData]
      .sort((a, b) => ((b.avance_ambiental + b.avance_social) / 2) - ((a.avance_ambiental + a.avance_social) / 2))
      .slice(0, 8);
    const maxGroupAvance = Math.max(...topGroups.map(g => (g.avance_ambiental + g.avance_social) / 2), 1);
    const groupBars = topGroups.map(g => {
      const avgAvance = (g.avance_ambiental + g.avance_social) / 2;
      const label = g.grupo.length > 20 ? g.grupo.substring(0, 18) + '…' : g.grupo;
      return `<div class="bar-group">
        <div class="bar-label">
          <span class="name">${label}</span>
          <span class="value">${avgAvance.toFixed(0)}%</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill gold" style="width:${avgAvance}%;"></div>
          <span class="bar-pct">${avgAvance.toFixed(0)}%</span>
        </div>
      </div>`;
    }).join('');

    // Determinar nivel de salud del sistema
    let healthLevel = 'Excelente';
    let healthColor = '#28A745';
    let healthIcon = '✅';
    if (tasaCumplimiento < 40) {
      healthLevel = 'Crítico';
      healthColor = '#DC3545';
      healthIcon = '🔴';
    } else if (tasaCumplimiento < 60) {
      healthLevel = 'Regular';
      healthColor = '#F0A500';
      healthIcon = '⚠️';
    } else if (tasaCumplimiento < 80) {
      healthLevel = 'Bueno';
      healthColor = '#17A2B8';
      healthIcon = '📊';
    }

    const html = `<!doctype html><html><head><meta charset="utf-8"/>
    <title>Reporte General de Gestión — ITCA-FEPADE</title>
    <style>${CSS_GENERAL_REPORT}</style>
    </head><body>

    <!-- PÁGINA 1 -->
    <div class="header">
      <div class="header-left">
        <div class="logo-box">IT</div>
        <div class="header-title">
          <h1>Reporte General de Gestión</h1>
          <p>Sistema de Horas Sociales y Ambientales · ITCA-FEPADE</p>
        </div>
      </div>
      <div class="header-right">
        <strong>${fechaGen}</strong>
        ${horaGen} hrs
      </div>
    </div>
    <div class="gold-band">
      <span>Análisis ejecutivo de indicadores clave</span>
      <span>${new Date().getFullYear()} · ITCA-FEPADE</span>
    </div>

    <div class="body">
      <!-- INSIGHT -->
      <div class="insight-box">
        <span class="icon">${healthIcon}</span>
        <strong>Salud del sistema: ${healthLevel}</strong>
        <span style="color:#666;margin-left:8px;">
          Tasa de cumplimiento: ${tasaCumplimiento}% · 
          ${completados} estudiantes completados · 
          ${enProgreso} en progreso · 
          ${sinHoras} sin horas
        </span>
      </div>

      <!-- KPIs -->
      <div class="kpi-grid">
        <div class="kpi">
          <div class="kpi-val">${totalHoras}</div>
          <div class="kpi-lbl">Total horas aprobadas</div>
        </div>
        <div class="kpi gold">
          <div class="kpi-val">${overview.totalProyectos}</div>
          <div class="kpi-lbl">Proyectos activos</div>
        </div>
        <div class="kpi green">
          <div class="kpi-val">${totalEstudiantes}</div>
          <div class="kpi-lbl">Estudiantes registrados</div>
        </div>
        <div class="kpi purple">
          <div class="kpi-val">${tasaCumplimiento}%</div>
          <div class="kpi-lbl">Tasa de cumplimiento</div>
        </div>
      </div>

      <!-- GRÁFICAS PRINCIPALES -->
      <div class="two-col">
        <div class="chart-container">
          <div class="chart-title">📊 Top 5 Proyectos</div>
          ${projectBars}
        </div>
        <div class="chart-container">
          <div class="chart-title">🏛️ Top 5 Instituciones</div>
          ${instBars}
        </div>
      </div>

      <div class="three-col">
        <div class="chart-container">
          <div class="chart-title">📈 Actividad Semanal</div>
          ${weekBars}
        </div>
        <div class="chart-container">
          <div class="chart-title">📋 Estado de Registros</div>
          <div class="pie-chart">
            <div class="pie-circle" style="background: conic-gradient(${statusPieGradient});"></div>
            <div class="pie-legend">
              ${statusPieLegend}
            </div>
          </div>
          ${statusBars}
        </div>
        <div class="chart-container">
          <div class="chart-title">🏆 Top 5 Estudiantes</div>
          ${studentBars}
        </div>
      </div>

      <div class="chart-container">
        <div class="chart-title">📚 Top 8 Grupos por Avance</div>
        ${groupBars}
      </div>

    </div>

    <div class="footer">
      <span>© ${new Date().getFullYear()} · ITCA-FEPADE</span>
      <strong>Reporte General de Gestión</strong>
      <span class="page-num">Pág. 1 / 2</span>
    </div>

    <!-- PÁGINA 2 - TABLAS DETALLADAS -->
    <div class="page-break"></div>

    <div class="header">
      <div class="header-left">
        <div class="logo-box">IT</div>
        <div class="header-title">
          <h1>Reporte General de Gestión</h1>
          <p>Detalle de datos · ITCA-FEPADE</p>
        </div>
      </div>
      <div class="header-right">
        <strong>${fechaGen}</strong>
        ${horaGen} hrs
      </div>
    </div>
    <div class="gold-band">
      <span>Detalle de datos por institución y grupo</span>
      <span>${new Date().getFullYear()} · ITCA-FEPADE</span>
    </div>

    <div class="body">
      <!-- TABLA INSTITUCIONES -->
      <div style="background:#fff;border-radius:8px;padding:10px 14px;box-shadow:0 2px 10px rgba(0,0,0,0.05);border:1px solid rgba(190,22,34,0.05);margin-bottom:12px;">
        <div class="section-title">
          <span>🏛️ Detalle por Institución</span>
          <small>${insts.length} instituciones</small>
        </div>
        <table>
          <tr>
            <th>Institución</th>
            <th class="center">Estudiantes</th>
            <th class="center">Horas Aprobadas</th>
            <th class="center">Prom. por Estudiante</th>
          </tr>
          ${insts.map(i => `
            <tr>
              <td style="font-weight:600;">${i.institucion_nombre}</td>
              <td style="text-align:center;">${i.total_estudiantes}</td>
              <td style="text-align:center;font-weight:700;color:#BE1622;">${i.total_horas}</td>
              <td style="text-align:center;">${i.total_estudiantes > 0 ? (i.total_horas / i.total_estudiantes).toFixed(1) : 0}</td>
            </tr>
          `).join('')}
        </table>
      </div>

      <!-- TABLA COMPLETOS -->
      <div style="background:#fff;border-radius:8px;padding:10px 14px;box-shadow:0 2px 10px rgba(0,0,0,0.05);border:1px solid rgba(190,22,34,0.05);">
        <div class="section-title">
          <span>✅ Estado de Cumplimiento</span>
          <small>${completion.total_estudiantes} estudiantes</small>
        </div>
        <table>
          <tr>
            <th>Estado</th>
            <th class="center">Cantidad</th>
            <th class="center">Porcentaje</th>
          </tr>
          <tr>
            <td><span class="badge b-green">Completado</span></td>
            <td style="text-align:center;font-weight:700;">${completados}</td>
            <td style="text-align:center;">${completion.total_estudiantes > 0 ? ((completados / completion.total_estudiantes) * 100).toFixed(1) : 0}%</td>
          </tr>
          <tr>
            <td><span class="badge b-yellow">En progreso</span></td>
            <td style="text-align:center;font-weight:700;">${enProgreso}</td>
            <td style="text-align:center;">${completion.total_estudiantes > 0 ? ((enProgreso / completion.total_estudiantes) * 100).toFixed(1) : 0}%</td>
          </tr>
          <tr>
            <td><span class="badge b-red">Sin horas</span></td>
            <td style="text-align:center;font-weight:700;">${sinHoras}</td>
            <td style="text-align:center;">${completion.total_estudiantes > 0 ? ((sinHoras / completion.total_estudiantes) * 100).toFixed(1) : 0}%</td>
          </tr>
          <tr style="background:#FFF8E1;font-weight:700;">
            <td><strong>TOTAL</strong></td>
            <td style="text-align:center;">${completion.total_estudiantes}</td>
            <td style="text-align:center;">100%</td>
          </tr>
        </table>
      </div>
    </div>

    <div class="footer">
      <span>© ${new Date().getFullYear()} · ITCA-FEPADE</span>
      <strong>Reporte General de Gestión</strong>
      <span class="page-num">Pág. 2 / 2</span>
    </div>

    </body></html>`;

    const browser = await launchPuppeteer({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: 'new'
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 500));
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      displayHeaderFooter: false,
    });
    await browser.close();

    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', 'attachment; filename="reporte_general_gestion.pdf"');
    return reply.send(pdfBuffer);
  } catch (err) {
    request.log?.error?.(err);
    return reply.status(500).send({
      success: false,
      error: {
        code: 'EXPORT_GENERAL_REPORT_ERROR',
        message: 'Error generando Reporte General de Gestión',
        details: String(err)
      }
    });
  }
}

export async function exportAdvancedStatsPDF(request, reply) {
  try {
    const [overview, completion, projectStats, careerStats, institutionFreq, insts] = await Promise.all([
      computeOverviewData(),
      computeCompletionRate(),
      computeProjectApplicationStats(),
      computeCareerStatistics(),
      computeInstitutionFrequencyStats(),
      computeInstitutionsSummary(),
    ]);

    const fechaGen = new Date().toLocaleDateString('es-SV', { day: '2-digit', month: 'long', year: 'numeric' });
    const horaGen = new Date().toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' });

    const studentSegments = [
      { label: 'Completado', value: completion.completados, color: '#28A745' },
      { label: 'En progreso', value: completion.en_progreso, color: '#F0A500' },
      { label: 'Sin horas', value: completion.sin_horas, color: '#BE1622' },
    ];

    const studentTotal = studentSegments.reduce((sum, item) => sum + item.value, 0) || 1;
    let accumulated = 0;
    const studentPieGradient = studentSegments
      .map(item => {
        const start = accumulated;
        const pct = (item.value / studentTotal) * 100;
        accumulated += pct;
        return `${item.color} ${start}% ${accumulated}%`;
      })
      .join(', ');

    const studentPieLegend = studentSegments.map(item => `
      <div class="pie-item">
        <span class="pie-key" style="background:${item.color};"></span>
        <span>${item.label}: ${item.value}</span>
      </div>
    `).join('');

    const projectStatusSegments = projectStats.projectsByStatus.map(item => ({
      label: item.estado,
      value: item.count,
      color: item.estado === 'Aprobado' ? '#28A745' : item.estado === 'Pendiente' ? '#F0A500' : '#BE1622'
    }));
    const projectTotal = projectStatusSegments.reduce((sum, item) => sum + item.value, 0) || 1;
    accumulated = 0;
    const projectPieGradient = projectStatusSegments
      .map(item => {
        const start = accumulated;
        const pct = (item.value / projectTotal) * 100;
        accumulated += pct;
        return `${item.color} ${start}% ${accumulated}%`;
      })
      .join(', ');

    const projectPieLegend = projectStatusSegments.map(item => `
      <div class="pie-item">
        <span class="pie-key" style="background:${item.color};"></span>
        <span>${item.label}: ${item.value}</span>
      </div>
    `).join('');

    const careerRows = careerStats.slice(0, 8).map(c => `
      <tr>
        <td>${c.carrera_nombre}</td>
        <td style="text-align:center;">${c.total_estudiantes}</td>
        <td style="text-align:center;">${c.total_horas}</td>
        <td style="text-align:center;">${c.promedio_horas}</td>
      </tr>
    `).join('');

    const frequentInstRows = institutionFreq.frequentInstitutions.slice(0, 8).map(i => `
      <tr>
        <td>${i.institucion_nombre}</td>
        <td style="text-align:center;">${i.proyecto_count}</td>
      </tr>
    `).join('');

    const html = `<!doctype html><html><head><meta charset="utf-8"/>
    <title>Reporte de Estadísticas Avanzadas — ITCA-FEPADE</title>
    <style>${CSS_GENERAL_REPORT}</style>
    </head><body>

    <div class="header">
      <div class="header-left">
        <div class="logo-box">IT</div>
        <div class="header-title">
          <h1>Reporte de Estadísticas Avanzadas</h1>
          <p>Sistema de Horas Sociales y Ambientales · ITCA-FEPADE</p>
        </div>
      </div>
      <div class="header-right">
        <strong>${fechaGen}</strong>
        ${horaGen} hrs
      </div>
    </div>
    <div class="gold-band">
      <span>Visión de estudiantes, proyectos y universidades</span>
      <span>${new Date().getFullYear()} · ITCA-FEPADE</span>
    </div>

    <div class="body">
      <div class="kpi-grid">
        <div class="kpi">
          <div class="kpi-val">${overview.totalEstudiantes}</div>
          <div class="kpi-lbl">Estudiantes registrados</div>
        </div>
        <div class="kpi gold">
          <div class="kpi-val">${overview.promedioHorasPorEstudiante}</div>
          <div class="kpi-lbl">Horas promedio / estudiante</div>
        </div>
        <div class="kpi green">
          <div class="kpi-val">${projectStats.totalProjects}</div>
          <div class="kpi-lbl">Proyectos existentes</div>
        </div>
        <div class="kpi purple">
          <div class="kpi-val">${projectStats.averageApplicationsPerProject}</div>
          <div class="kpi-lbl">Solicitudes promedio / proyecto</div>
        </div>
      </div>

      <div class="two-col">
        <div class="chart-container">
          <div class="chart-title">🎓 Estado de estudiantes</div>
          <div class="pie-chart">
            <div class="pie-circle" style="background: conic-gradient(${studentPieGradient});"></div>
            <div class="pie-legend">${studentPieLegend}</div>
          </div>
        </div>
        <div class="chart-container">
          <div class="chart-title">📁 Estado de proyectos</div>
          <div class="pie-chart">
            <div class="pie-circle" style="background: conic-gradient(${projectPieGradient});"></div>
            <div class="pie-legend">${projectPieLegend}</div>
          </div>
        </div>
      </div>

      <div class="chart-container">
        <div class="chart-title">🏛️ Instituciones frecuentes (>2 proyectos)</div>
        <table>
          <tr><th>Institución</th><th class="center">Proyectos</th></tr>
          ${frequentInstRows || '<tr><td colspan="2" style="text-align:center;color:#888;">No hay instituciones frecuentes</td></tr>'}
        </table>
      </div>

      <div class="chart-container">
        <div class="chart-title">📚 Estadísticas por carrera</div>
        <table>
          <tr>
            <th>Carrera</th>
            <th class="center">Estudiantes</th>
            <th class="center">Horas</th>
            <th class="center">Prom. horas</th>
          </tr>
          ${careerRows || '<tr><td colspan="4" style="text-align:center;color:#888;">No hay datos de carreras</td></tr>'}
        </table>
      </div>

      <div class="chart-container">
        <div class="chart-title">🏛️ Instituciones registradas</div>
        <table>
          <tr><th>Institución</th><th class="center">Horas aprobadas</th><th class="center">Estudiantes</th></tr>
          ${insts.slice(0, 8).map(i => `
            <tr>
              <td>${i.institucion_nombre}</td>
              <td style="text-align:center;">${i.total_horas}</td>
              <td style="text-align:center;">${i.total_estudiantes}</td>
            </tr>
          `).join('')}
        </table>
      </div>
    </div>

    <div class="footer">
      <span>© ${new Date().getFullYear()} · ITCA-FEPADE</span>
      <strong>Reporte de Estadísticas Avanzadas</strong>
      <span class="page-num">Pág. 1 / 1</span>
    </div>

    </body></html>`;

    const browser = await launchPuppeteer({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: 'new'
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 500));
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      displayHeaderFooter: false,
    });
    await browser.close();

    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', 'attachment; filename="reporte_estadisticas_avanzadas.pdf"');
    return reply.send(pdfBuffer);
  } catch (err) {
    request.log?.error?.(err);
    return reply.status(500).send({
      success: false,
      error: {
        code: 'EXPORT_ADVANCED_STATS_ERROR',
        message: 'Error generando reporte de estadísticas avanzadas',
        details: String(err)
      }
    });
  }
}

// ─── REPORTE INDIVIDUAL DE DESEMPEÑO ────────────────────────────────────────

export async function exportIndividualReportPDF(request, reply) {
  try {
    const { id } = request.params;
    if (!id) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_ID', message: 'Se requiere id del estudiante' }
      });
    }

    const data = await computeStudentDetail(id);
    const { estudiante, metas, resumen, proyectos, historial } = data;

    const fechaGen = new Date().toLocaleDateString('es-SV', { day: '2-digit', month: 'long', year: 'numeric' });
    const horaGen = new Date().toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' });

    const completado = resumen.completado;
    const estadoGlobal = completado ? 'Completado' : resumen.en_progreso ? 'En progreso' : 'Sin actividad';
    const badgeEstado = completado ? 'b-green' : resumen.en_progreso ? 'b-yellow' : 'b-red';
    const pctTotal = resumen.porcentaje_total;

    // Calcular métricas de desempeño
    const totalHoras = resumen.total_horas_aprobadas;
    const metaTotal = metas.total_meta;
    const pctAmbiental = resumen.porcentaje_ambiental;
    const pctSocial = resumen.porcentaje_social;
    const registrosTotales = resumen.total_registros;
    const promedioHorasPorRegistro = registrosTotales > 0 ? (totalHoras / registrosTotales).toFixed(1) : 0;

    // Datos para gráficas de proyecto
    const maxProj = Math.max(...proyectos.map(p => p.horas_aprobadas), 1);
    const projectBars = proyectos.slice(0, 6).map(p => {
      const pct = metas.total_meta > 0 ? Math.round((p.horas_aprobadas / metas.total_meta) * 100) : 0;
      const color = p.tipo_hora === 'Ambiental' ? 'green' : 'red';
      return `<div class="bar-group">
        <div class="bar-label">
          <span class="name">${p.proyecto_nombre.length > 25 ? p.proyecto_nombre.substring(0, 25) + '…' : p.proyecto_nombre}</span>
          <span class="value">${p.horas_aprobadas}h</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill ${color}" style="width:${pct}%;"></div>
          <span class="bar-pct">${pct}%</span>
        </div>
      </div>`;
    }).join('');

    // Tabla de historial (últimos 8 registros)
    const historyRows = historial.slice(0, 8).map(h => {
      const badge = h.estado === 'Aprobado' ? 'b-green' : h.estado === 'Pendiente' ? 'b-yellow' : 'b-red';
      return `<tr>
        <td style="white-space:nowrap;font-size:7.5px;">${fmtDate(h.fecha)}</td>
        <td style="max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;">${h.proyecto}</td>
        <td style="text-align:center;font-weight:700;">${h.horas}</td>
        <td><span class="badge ${badge}">${h.estado}</span></td>
      </tr>`;
    }).join('');

    const html = `<!doctype html><html><head><meta charset="utf-8"/>
    <title>Reporte Individual de Desempeño — ${estudiante.nombre}</title>
    <style>${CSS_INDIVIDUAL_REPORT}</style>
    </head><body>

    <div class="header">
      <div class="header-left">
        <div class="logo-box">IT</div>
        <div class="header-title">
          <h1>Reporte Individual de Desempeño</h1>
          <p>Análisis de progreso académico · ITCA-FEPADE</p>
        </div>
      </div>
      <div class="header-right">
        <strong>${fechaGen}</strong>
        ${horaGen} hrs
      </div>
    </div>
    <div class="gold-band">
      <span>Análisis de progreso y desempeño académico</span>
      <span class="badge ${badgeEstado}" style="font-size:8px;padding:2px 12px;">${estadoGlobal}</span>
    </div>

    <div class="body">
      <!-- PERFIL -->
      <div class="profile-card">
        <div class="profile-item">
          <label>Nombre completo</label>
          <span>${estudiante.nombre}</span>
        </div>
        <div class="profile-item">
          <label>Carnet</label>
          <span>${estudiante.carnet}</span>
        </div>
        <div class="profile-item">
          <label>Grupo / Carrera</label>
          <span style="font-size:9px;">${estudiante.grupo} / ${estudiante.carrera}</span>
        </div>
        <div class="profile-item">
          <label>Estado</label>
          <span class="badge ${badgeEstado}" style="font-size:8px;">${estadoGlobal}</span>
        </div>
      </div>

      <!-- KPIs -->
      <div class="kpi-grid">
        <div class="kpi green">
          <div class="kpi-val">${totalHoras}</div>
          <div class="kpi-lbl">Horas aprobadas</div>
        </div>
        <div class="kpi gold">
          <div class="kpi-val">${pctTotal.toFixed(0)}%</div>
          <div class="kpi-lbl">Progreso total</div>
        </div>
        <div class="kpi purple">
          <div class="kpi-val">${metaTotal}</div>
          <div class="kpi-lbl">Meta total</div>
        </div>
        <div class="kpi">
          <div class="kpi-val">${registrosTotales}</div>
          <div class="kpi-lbl">Registros totales</div>
        </div>
        <div class="kpi gold">
          <div class="kpi-val">${promedioHorasPorRegistro}</div>
          <div class="kpi-lbl">Prom. horas/registro</div>
        </div>
      </div>

      <!-- GRÁFICAS DE PROGRESO -->
      <div class="two-col">
        <div class="chart-container">
          <div class="section-title" style="font-size:9px;">🌱 Progreso Ambiental</div>
          <div class="bar-group">
            <div class="bar-label">
              <span class="name">${resumen.horas_ambientales_aprobadas}h / ${metas.horas_ambientales}h</span>
              <span class="value">${pctAmbiental.toFixed(0)}%</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill green" style="width:${pctAmbiental}%;"></div>
              <span class="bar-pct">${pctAmbiental.toFixed(0)}%</span>
            </div>
          </div>
        </div>
        <div class="chart-container">
          <div class="section-title" style="font-size:9px;">🤝 Progreso Social</div>
          <div class="bar-group">
            <div class="bar-label">
              <span class="name">${resumen.horas_sociales_aprobadas}h / ${metas.horas_sociales}h</span>
              <span class="value">${pctSocial.toFixed(0)}%</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill red" style="width:${pctSocial}%;"></div>
              <span class="bar-pct">${pctSocial.toFixed(0)}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- DESGLOSE POR PROYECTO -->
      <div class="chart-container">
        <div class="section-title" style="font-size:9px;">📊 Desglose de Horas por Proyecto</div>
        ${projectBars}
      </div>

      <!-- HISTORIAL RECIENTE -->
      <div style="background:#fff;border-radius:8px;padding:10px 14px;box-shadow:0 2px 10px rgba(0,0,0,0.05);border:1px solid rgba(190,22,34,0.05);">
        <div class="section-title" style="font-size:9px;">
          <span>📋 Últimos 8 Registros</span>
          <small>Actividad reciente</small>
        </div>
        <table>
          <tr>
            <th>Fecha</th>
            <th>Proyecto</th>
            <th class="center">Horas</th>
            <th>Estado</th>
          </tr>
          ${historyRows}
          ${historial.length === 0 ? `<tr><td colspan="4" style="text-align:center;color:#999;padding:20px;">No hay registros disponibles</td></tr>` : ''}
        </table>
      </div>

    </div>

    <div class="footer">
      <span>© ${new Date().getFullYear()} · ITCA-FEPADE</span>
      <strong>Reporte Individual de Desempeño</strong>
      <span class="page-num">Pág. 1 / 1</span>
    </div>

    </body></html>`;

    const browser = await launchPuppeteer({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: 'new'
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 500));
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      displayHeaderFooter: false,
    });
    await browser.close();

    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="reporte_individual_${id}.pdf"`);
    return reply.send(pdfBuffer);
  } catch (err) {
    request.log?.error?.(err);
    return reply.status(500).send({
      success: false,
      error: {
        code: 'EXPORT_INDIVIDUAL_REPORT_ERROR',
        message: 'Error generando Reporte Individual de Desempeño',
        details: String(err)
      }
    });
  }
}
