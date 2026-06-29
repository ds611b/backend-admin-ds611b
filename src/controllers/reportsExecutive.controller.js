import { Op, fn, col, literal } from 'sequelize';
import { RegistroHoras, ProyectosInstitucion, GrupoEstudiantes, PerfilUsuario, Usuarios, Carreras, Instituciones, CoordinadoresCarrera, Grupos, EncargadoInstitucion } from '../models/index.js';
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

async function launchPuppeteerWithModule(puppeteerModule, options = {}) {
  try {
    return await puppeteerModule.launch(options);
  } catch (err) {
    if (err && (err.code === 'ENOENT' || /spawn .* ENOENT/.test(String(err.message)))) {
      const exe = process.env.CHROME_PATH || findChromeExecutable();
      if (exe) return await puppeteerModule.launch({ ...options, executablePath: exe });
    }
    throw err;
  }
}

function buildDateFilter(from, to) {
  if (!from && !to) return null;
  const filter = {};
  if (from) filter[Op.gte] = from;
  if (to) filter[Op.lte] = to;
  return filter;
}

function formatNumber(value, decimals = 0) {
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: decimals }).format(Number(value) || 0);
}

function formatPercent(value, decimals = 1) {
  return `${Number(value || 0).toFixed(decimals)}%`;
}

function formatDateRange(from, to) {
  if (from && to) return `${from} — ${to}`;
  if (from) return `Desde ${from}`;
  if (to) return `Hasta ${to}`;
  return 'Todo el periodo disponible';
}

function normalizeText(value) {
  return value ? String(value).trim() : 'N/A';
}

function monthLabel(yearMonth) {
  const [year, month] = String(yearMonth).split('-').map(Number);
  const names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return month && year ? `${names[month - 1]} ${year}` : yearMonth;
}

function buildHtmlList(items) {
  return items.map(item => `<li>${item}</li>`).join('');
}

function svgLogo() {
  return `<svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="logoTitle"><title id="logoTitle">Logo Universidad</title><defs><linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#2563eb"/><stop offset="100%" stop-color="#16a34a"/></linearGradient></defs><rect x="12" y="12" width="96" height="96" rx="20" fill="url(#logoGradient)"/><path d="M38 83 L56 47 L72 74 L82 40" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function buildSectionHeader(title) {
  return `<div class="section-header"><div><span class="section-chip">SECCIÓN</span><h2>${title}</h2></div></div>`;
}

async function computeDashboardData(from, to) {
  const dateFilter = buildDateFilter(from, to);
  const where = dateFilter ? { fecha: dateFilter } : {};
  const sequelize = RegistroHoras.sequelize;

  const summary = await RegistroHoras.findOne({
    attributes: [
      [fn('SUM', literal(`CASE WHEN estado_validacion = 'Aprobado' THEN horas_realizadas ELSE 0 END`)), 'horasAprobadas'],
      [fn('SUM', literal(`CASE WHEN estado_validacion = 'Pendiente' THEN horas_realizadas ELSE 0 END`)), 'horasPendientes'],
      [fn('SUM', literal(`CASE WHEN estado_validacion = 'Rechazado' THEN horas_realizadas ELSE 0 END`)), 'horasRechazadas'],
      [fn('SUM', col('horas_realizadas')), 'horasTotal'],
      [fn('COUNT', fn('DISTINCT', col('grupo_estudiante.id_estudiante'))), 'estudiantesActivos']
    ],
    include: [{ model: GrupoEstudiantes, as: 'grupo_estudiante', attributes: [] }],
    where,
    raw: true
  });

  const totalEstudiantes = await PerfilUsuario.count();
  const totalProyectos = await ProyectosInstitucion.count();
  const totalInstituciones = await Instituciones.count();
  const totalCoordinadores = await CoordinadoresCarrera.count();

  const horasAprobadas = Number(summary?.horasAprobadas || 0);
  const horasPendientes = Number(summary?.horasPendientes || 0);
  const horasRechazadas = Number(summary?.horasRechazadas || 0);
  const horasTotal = Number(summary?.horasTotal || 0);
  const estudiantesActivos = Number(summary?.estudiantesActivos || 0);
  const estudiantesSinHoras = Math.max(0, totalEstudiantes - estudiantesActivos);
  const promedioHorasPorEstudiante = totalEstudiantes ? Number((horasAprobadas / totalEstudiantes).toFixed(2)) : 0;
  const promedioHorasPorProyecto = totalProyectos ? Number((horasAprobadas / totalProyectos).toFixed(2)) : 0;
  const porcentajeAprobacion = horasTotal ? Number((horasAprobadas / horasTotal * 100).toFixed(1)) : 0;

  return {
    totalHorasAprobadas: horasAprobadas,
    totalHorasPendientes: horasPendientes,
    totalHorasRechazadas: horasRechazadas,
    totalEstudiantes,
    estudiantesActivos,
    estudiantesSinHoras,
    totalProyectos,
    totalInstituciones,
    totalCoordinadores,
    promedioHorasPorEstudiante,
    promedioHorasPorProyecto,
    porcentajeAprobacion,
    periodo: formatDateRange(from, to)
  };
}

async function computeValidationData(from, to) {
  const dateFilter = buildDateFilter(from, to);
  const where = dateFilter ? { fecha: dateFilter } : {};

  const rows = await RegistroHoras.findAll({
    attributes: [
      'estado_validacion',
      [fn('COUNT', col('id')), 'cantidad'],
      [fn('SUM', col('horas_realizadas')), 'horas']
    ],
    where,
    group: ['estado_validacion'],
    raw: true
  });

  const totalHoras = rows.reduce((sum, row) => sum + Number(row.horas || 0), 0);
  return rows.map(row => ({
    estado: row.estado_validacion,
    cantidad: Number(row.cantidad || 0),
    horas: Number(row.horas || 0),
    porcentaje: totalHoras ? Number(((Number(row.horas || 0) * 100) / totalHoras).toFixed(1)) : 0
  }));
}

async function computeProjectsData(from, to) {
  const dateFilter = buildDateFilter(from, to);
  const where = dateFilter ? { fecha: dateFilter } : {};

  const rows = await RegistroHoras.findAll({
    attributes: [
      'id_proyecto',
      [fn('SUM', col('horas_realizadas')), 'totalHoras'],
      [fn('COUNT', fn('DISTINCT', col('id_grupo_estudiante'))), 'estudiantes'],
      [fn('AVG', col('horas_realizadas')), 'promedioHoras']
    ],
    include: [
      {
        model: ProyectosInstitucion,
        as: 'proyecto',
        attributes: ['id', 'nombre'],
        include: [
          { model: Instituciones, as: 'institucion', attributes: ['nombre'] },
          { model: EncargadoInstitucion, as: 'encargado', attributes: ['nombres', 'apellidos'] }
        ]
      }
    ],
    where,
    group: [
      'id_proyecto',
      'proyecto.id',
      'proyecto.nombre',
      'proyecto.institucion.id',
      'proyecto.institucion.nombre',
      'proyecto.encargado.id',
      'proyecto.encargado.nombres',
      'proyecto.encargado.apellidos'
    ],
    order: [[fn('SUM', col('horas_realizadas')), 'DESC']],
    raw: true
  });

  return rows.map(row => ({
    proyecto: normalizeText(row['proyecto.nombre']),
    institucion: normalizeText(row['proyecto.institucion.nombre']),
    coordinador: normalizeText(`${row['proyecto.encargado.nombres'] || ''} ${row['proyecto.encargado.apellidos'] || ''}`),
    estudiantes: Number(row.estudiantes || 0),
    horas: Number(row.totalHoras || 0),
    promedio: Number(row.promedioHoras || 0)
  }));
}

async function computeInstitutionsData(from, to) {
  const dateFilter = buildDateFilter(from, to);
  const where = dateFilter ? { fecha: dateFilter } : {};

  const rows = await RegistroHoras.findAll({
    attributes: [
      [col('proyecto.institucion.nombre'), 'institucion'],
      [fn('COUNT', fn('DISTINCT', col('id_proyecto'))), 'proyectos'],
      [fn('COUNT', fn('DISTINCT', col('id_grupo_estudiante'))), 'estudiantes'],
      [fn('SUM', col('horas_realizadas')), 'horas'],
      [fn('AVG', col('horas_realizadas')), 'promedioHoras']
    ],
    include: [
      {
        model: ProyectosInstitucion,
        as: 'proyecto',
        attributes: [],
        include: [{ model: Instituciones, as: 'institucion', attributes: [] }]
      }
    ],
    where,
    group: ['proyecto.institucion.nombre'],
    order: [[fn('SUM', col('horas_realizadas')), 'DESC']],
    raw: true
  });

  return rows.map(row => ({
    institucion: normalizeText(row.institucion),
    proyectos: Number(row.proyectos || 0),
    estudiantes: Number(row.estudiantes || 0),
    horas: Number(row.horas || 0),
    promedio: Number(row.promedioHoras || 0)
  }));
}

async function computeStudentsRanking(from, to, limit = 20) {
  const dateFilter = buildDateFilter(from, to);
  const where = dateFilter ? { fecha: dateFilter } : {};

  const rows = await RegistroHoras.findAll({
    attributes: [
      [col('grupo_estudiante.id_estudiante'), 'id_estudiante'],
      [col('grupo_estudiante.id_grupo'), 'id_grupo'],
      [fn('SUM', literal(`CASE WHEN estado_validacion = 'Aprobado' THEN horas_realizadas ELSE 0 END`)), 'horasAprobadas'],
      [fn('SUM', literal(`CASE WHEN estado_validacion = 'Aprobado' AND tipo_horas = 'A' THEN horas_realizadas ELSE 0 END`)), 'horasAmbientales'],
      [fn('SUM', literal(`CASE WHEN estado_validacion = 'Aprobado' AND tipo_horas = 'S' THEN horas_realizadas ELSE 0 END`)), 'horasSociales'],
      [literal(`GROUP_CONCAT(DISTINCT proyecto.nombre ORDER BY proyecto.nombre SEPARATOR ', ')`), 'proyectos'],
      [col('grupo_estudiante.perfil_estudiante.carnet'), 'carnet'],
      [col('grupo_estudiante.perfil_estudiante.usuario.primer_nombre'), 'primer_nombre'],
      [col('grupo_estudiante.perfil_estudiante.usuario.segundo_nombre'), 'segundo_nombre'],
      [col('grupo_estudiante.perfil_estudiante.usuario.primer_apellido'), 'primer_apellido'],
      [col('grupo_estudiante.perfil_estudiante.carrera.nombre'), 'carrera']
    ],
    include: [
      {
        model: GrupoEstudiantes,
        as: 'grupo_estudiante',
        attributes: ['id_grupo'],
        include: [
          {
            model: PerfilUsuario,
            as: 'perfil_estudiante',
            attributes: [],
            include: [
              { model: Usuarios, as: 'usuario', attributes: [] },
              { model: Carreras, as: 'carrera', attributes: [] }
            ]
          }
        ]
      },
      { model: ProyectosInstitucion, as: 'proyecto', attributes: [] }
    ],
    where,
    group: [
      'grupo_estudiante.id_estudiante',
      'grupo_estudiante.id_grupo',
      'grupo_estudiante.perfil_estudiante.carnet',
      'grupo_estudiante.perfil_estudiante.usuario.primer_nombre',
      'grupo_estudiante.perfil_estudiante.usuario.segundo_nombre',
      'grupo_estudiante.perfil_estudiante.usuario.primer_apellido',
      'grupo_estudiante.perfil_estudiante.carrera.nombre'
    ],
    order: [[literal('horasAprobadas'), 'DESC']],
    limit,
    raw: true
  });

  const groupIds = rows.map(row => row.id_grupo).filter(Boolean);
  const groups = await Grupos.findAll({
    where: { id: groupIds },
    attributes: ['id', 'horas_ambientales', 'horas_sociales'],
    raw: true
  });
  const groupRequirementMap = groups.reduce((acc, group) => {
    acc[group.id] = Number(group.horas_ambientales || 0) + Number(group.horas_sociales || 0);
    return acc;
  }, {});

  return rows.map((row, index) => {
    const fullName = `${row.primer_nombre || ''} ${row.segundo_nombre || ''} ${row.primer_apellido || ''}`.trim();
    const required = Number(groupRequirementMap[row.id_grupo] || 0);
    const approved = Number(row.horasAprobadas || 0);
    const percentComplete = required ? Number((approved / required * 100).toFixed(1)) : 0;

    return {
      posicion: index + 1,
      carnet: normalizeText(row.carnet),
      nombre: normalizeText(fullName),
      carrera: normalizeText(row.carrera),
      proyecto: normalizeText(row.proyectos),
      horasAprobadas: approved,
      horasRequeridas: required,
      porcentajeCompletado: percentComplete
    };
  });
}

async function computeRiskStudents(from, to, threshold = 100) {
  const studentGroups = await GrupoEstudiantes.findAll({
    attributes: ['id_estudiante', 'id_grupo'],
    include: [
      {
        model: PerfilUsuario,
        as: 'perfil_estudiante',
        attributes: ['carnet'],
        include: [
          { model: Usuarios, as: 'usuario', attributes: ['primer_nombre', 'segundo_nombre', 'primer_apellido'] },
          { model: Carreras, as: 'carrera', attributes: ['nombre'] }
        ]
      },
      { model: Grupos, attributes: ['horas_ambientales', 'horas_sociales'] }
    ],
    raw: true
  });

  const dateFilter = buildDateFilter(from, to);
  const where = dateFilter ? { fecha: dateFilter } : {};
  const approvedHours = await RegistroHoras.findAll({
    attributes: [
      [col('grupo_estudiante.id_estudiante'), 'id_estudiante'],
      [fn('SUM', literal(`CASE WHEN estado_validacion = 'Aprobado' THEN horas_realizadas ELSE 0 END`)), 'horasAprobadas']
    ],
    include: [{ model: GrupoEstudiantes, as: 'grupo_estudiante', attributes: [] }],
    where,
    group: ['grupo_estudiante.id_estudiante'],
    raw: true
  });

  const approvedMap = approvedHours.reduce((acc, row) => {
    acc[row.id_estudiante] = Number(row.horasAprobadas || 0);
    return acc;
  }, {});

  const list = studentGroups
    .map(row => {
      const required = Number((row['Grupo.horas_ambientales'] || 0) + (row['Grupo.horas_sociales'] || 0));
      if (!required) return null;
      const current = Number(approvedMap[row.id_estudiante] || 0);
      const faltantes = Math.max(0, required - current);
      const porcentaje = required ? Number((current / required * 100).toFixed(1)) : 0;
      const nombre = `${row['perfil_estudiante.usuario.primer_nombre'] || ''} ${row['perfil_estudiante.usuario.segundo_nombre'] || ''} ${row['perfil_estudiante.usuario.primer_apellido'] || ''}`.trim();

      return {
        carnet: normalizeText(row['perfil_estudiante.carnet']),
        nombre: normalizeText(nombre),
        carrera: normalizeText(row['perfil_estudiante.carrera.nombre']),
        horasActuales: current,
        horasRequeridas: required,
        horasFaltantes: faltantes,
        porcentaje: porcentaje
      };
    })
    .filter(Boolean)
    .filter(student => student.horasFaltantes > 0)
    .sort((a, b) => b.horasFaltantes - a.horasFaltantes)
    .slice(0, 20);

  return list;
}

async function computeMonthlyTrend(from, to) {
  const sequelize = RegistroHoras.sequelize;
  const dateFilter = buildDateFilter(from, to);
  const where = { estado_validacion: 'Aprobado' };
  if (dateFilter) where.fecha = dateFilter;

  const rows = await RegistroHoras.findAll({
    attributes: [
      [fn('DATE_FORMAT', col('fecha'), '%Y-%m'), 'mes'],
      [fn('SUM', col('horas_realizadas')), 'horas']
    ],
    where,
    group: [fn('DATE_FORMAT', col('fecha'), '%Y-%m')],
    order: [[fn('DATE_FORMAT', col('fecha'), '%Y-%m'), 'ASC']],
    raw: true
  });

  const values = rows.map(row => ({ mes: row.mes, horas: Number(row.horas || 0) }));
  const compare = values.length >= 2 ? values[values.length - 1].horas - values[values.length - 2].horas : 0;
  const percentChange = values.length >= 2 && values[values.length - 2].horas ? Number((compare / values[values.length - 2].horas * 100).toFixed(1)) : 0;

  return {
    series: values.map(row => ({ label: monthLabel(row.mes), value: row.horas })),
    delta: compare,
    percentChange
  };
}

async function computeIndicators(from, to) {
  const dateFilter = buildDateFilter(from, to);
  const where = dateFilter ? { fecha: dateFilter } : {};

  const projectRows = await RegistroHoras.findAll({
    attributes: [
      'id_proyecto',
      [fn('SUM', col('horas_realizadas')), 'horas']
    ],
    include: [{ model: ProyectosInstitucion, as: 'proyecto', attributes: ['nombre'] }],
    where,
    group: ['id_proyecto', 'proyecto.id', 'proyecto.nombre'],
    order: [[fn('SUM', col('horas_realizadas')), 'DESC']],
    raw: true
  });

  const projectWithMore = projectRows[0] ? { nombre: normalizeText(projectRows[0]['proyecto.nombre']), horas: Number(projectRows[0].horas || 0) } : null;
  const projectWithLess = projectRows.slice().reverse().find(row => Number(row.horas || 0) > 0) || null;

  const institutionRows = await RegistroHoras.findAll({
    attributes: [
      [col('proyecto.institucion.nombre'), 'institucion'],
      [fn('SUM', col('horas_realizadas')), 'horas']
    ],
    include: [{ model: ProyectosInstitucion, as: 'proyecto', attributes: [], include: [{ model: Instituciones, as: 'institucion', attributes: [] }] }],
    where,
    group: ['proyecto.institucion.nombre'],
    order: [[fn('SUM', col('horas_realizadas')), 'DESC']],
    raw: true
  });

  const institutionWithMore = institutionRows[0] ? { nombre: normalizeText(institutionRows[0].institucion), horas: Number(institutionRows[0].horas || 0) } : null;

  const careerRows = await RegistroHoras.findAll({
    attributes: [
      [col('grupo_estudiante.perfil_estudiante.carrera.nombre'), 'carrera'],
      [fn('SUM', col('horas_realizadas')), 'horas']
    ],
    include: [
      {
        model: GrupoEstudiantes,
        as: 'grupo_estudiante',
        attributes: [],
        include: [{ model: PerfilUsuario, as: 'perfil_estudiante', attributes: [], include: [{ model: Carreras, as: 'carrera', attributes: [] }] }]
      }
    ],
    where,
    group: ['grupo_estudiante.perfil_estudiante.carrera.nombre'],
    order: [[fn('SUM', col('horas_realizadas')), 'DESC']],
    raw: true
  });

  const careerMostActive = careerRows[0] ? { nombre: normalizeText(careerRows[0].carrera), horas: Number(careerRows[0].horas || 0) } : null;

  const studentCountByCareer = await GrupoEstudiantes.findAll({
    attributes: [
      [col('perfil_estudiante.id_carrera'), 'carreraId'],
      [fn('COUNT', fn('DISTINCT', col('id_estudiante'))), 'estudiantes']
    ],
    include: [
      {
        model: PerfilUsuario,
        as: 'perfil_estudiante',
        attributes: [],
        include: [{ model: Carreras, as: 'carrera', attributes: ['id', 'nombre'] }]
      }
    ],
    group: ['perfil_estudiante.id_carrera', 'perfil_estudiante.carrera.id', 'perfil_estudiante.carrera.nombre'],
    raw: true
  });

  const coordinators = await CoordinadoresCarrera.findAll({
    include: [{ model: Carreras, as: 'carrera', attributes: ['id', 'nombre'] }],
    raw: true
  });

  const careerMap = studentCountByCareer.reduce((acc, row) => {
    acc[row.carreraId] = Number(row.estudiantes || 0);
    return acc;
  }, {});

  const coordinatorWithMoreStudents = coordinators
    .map(coord => ({
      nombre: normalizeText(`${coord.nombres || ''} ${coord.apellidos || ''}`),
      carrera: normalizeText(coord['carrera.nombre']),
      estudiantes: careerMap[coord.id_carrera] || 0
    }))
    .sort((a, b) => b.estudiantes - a.estudiantes)[0] || null;

  const validationTimeRow = await RegistroHoras.findOne({
    attributes: [[fn('AVG', literal('DATEDIFF(fecha_validacion, fecha)')), 'diasValidacion']],
    where: {
      fecha_validacion: { [Op.ne]: null }
    },
    raw: true
  });

  const validationRows = await RegistroHoras.findAll({
    attributes: ['estado_validacion', [fn('COUNT', col('id')), 'cantidad']],
    where: {
      estado_validacion: { [Op.in]: ['Pendiente', 'Rechazado'] }
    },
    group: ['estado_validacion'],
    raw: true
  });

  const pendingCount = validationRows.find(row => row.estado_validacion === 'Pendiente');
  const rejectedCount = validationRows.find(row => row.estado_validacion === 'Rechazado');

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const projects = await ProyectosInstitucion.findAll({
    attributes: ['nombre'],
    include: [{
      model: RegistroHoras,
      attributes: ['id'],
      where: { fecha: { [Op.gte]: thirtyDaysAgo.toISOString().slice(0, 10) } },
      required: false
    }],
    raw: false
  });

  const inactiveProjects = projects
    .filter(project => !project.RegistroHoras || project.RegistroHoras.length === 0)
    .slice(0, 5)
    .map(project => normalizeText(project.nombre));

  const institutionStudents = await PerfilUsuario.findAll({
    attributes: [
      [col('institucion.nombre'), 'institucion'],
      [fn('COUNT', col('PerfilUsuario.id')), 'estudiantes']
    ],
    include: [{ model: Instituciones, as: 'institucion', attributes: [] }],
    where: { id_institucion: { [Op.ne]: null } },
    group: ['institucion.id', 'institucion.nombre'],
    order: [[fn('COUNT', col('PerfilUsuario.id')), 'DESC']],
    raw: true
  });

  return {
    proyectoConMasHoras: projectWithMore,
    proyectoConMenosHoras: projectWithLess ? { nombre: normalizeText(projectWithLess['proyecto.nombre']), horas: Number(projectWithLess.horas || 0) } : null,
    institucionMasParticipativa: institutionWithMore,
    carreraMasActiva: careerMostActive,
    coordinadorConMasEstudiantes: coordinatorWithMoreStudents,
    tiempoPromedioValidacion: validationTimeRow ? Number(Number(validationTimeRow.diasValidacion || 0).toFixed(1)) : 0,
    registrosPendientes: Number(pendingCount?.cantidad || 0),
    registrosRechazados: Number(rejectedCount?.cantidad || 0),
    proyectosSinActividad30Dias: inactiveProjects,
    institucionesMasEstudiantes: institutionStudents.slice(0, 5).map(row => ({ institucion: normalizeText(row.institucion), estudiantes: Number(row.estudiantes || 0) }))
  };
}

function generateExecutiveAnalysis(dashboard, indicators, projectsData) {
  const projectShare = projectsData.length && dashboard.totalHorasAprobadas ? Number((projectsData[0].horas / dashboard.totalHorasAprobadas * 100).toFixed(1)) : 0;
  const inactiveCount = indicators.proyectosSinActividad30Dias.length;

  return [
    `El ${formatPercent(dashboard.porcentajeAprobacion)} de las horas registradas están aprobadas.`,
    `Hay ${dashboard.estudiantesSinHoras} estudiantes sin horas registradas y ${dashboard.estudiantesActivos} estudiantes activos.`,
    `El proyecto ${indicators.proyectoConMasHoras?.nombre || 'N/A'} concentra el ${formatPercent(projectShare)} de las horas aprobadas.`,
    `La carrera ${indicators.carreraMasActiva?.nombre || 'N/A'} es la más activa con ${formatNumber(indicators.carreraMasActiva?.horas || 0)} horas.`,
    `Existen ${inactiveCount} proyectos sin actividad en los últimos 30 días.${inactiveCount ? ` Ejemplos: ${indicators.proyectosSinActividad30Dias.join(', ')}.` : ''}`,
    `El tiempo promedio de validación es de ${formatNumber(indicators.tiempoPromedioValidacion, 1)} días.`
  ];
}

function buildCard(title, value, subtitle = '') {
  return `<div class="card"><p class="card-label">${title}</p><p class="card-value">${value}</p>${subtitle ? `<p class="card-note">${subtitle}</p>` : ''}</div>`;
}

function buildTable(headers, rows) {
  const headerHtml = headers.map(item => `<th>${item}</th>`).join('');
  const bodyHtml = rows.map(row => `<tr>${headers.map(key => `<td>${normalizeText(row[key])}</td>`).join('')}</tr>`).join('');
  return `<div class="table-container"><table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`;
}

function buildHorizontalBars(rows, maxValue, labelKey, valueKey) {
  return rows
    .map(row => {
      const width = maxValue ? Math.max(4, Math.round((row[valueKey] / maxValue) * 100)) : 0;
      return `<div class="chart-row"><div class="chart-label">${normalizeText(row[labelKey])}</div><div class="bar"><div class="bar-fill" style="width:${width}%;"></div></div><div class="chart-value">${formatNumber(row[valueKey])}</div></div>`;
    })
    .join('');
}

function buildLineSeries(series) {
  const max = Math.max(...series.map(item => item.value), 1);
  return series
    .map(item => `<div class="line-item"><span class="line-dot" style="bottom:${(item.value / max) * 100}%"></span><span class="line-bar" style="height:${(item.value / max) * 100}%"></span><span class="line-label">${item.label}</span></div>`)
    .join('');
}

function buildPDFHtml(reportData) {
  const { cover, executive, validation, projects, institutions, ranking, risk, trend, indicators, conclusions, meta } = reportData;
  const validationDonut = validation.reduce((acc, row) => ({ ...acc, [row.estado.toLowerCase()]: row.porcentaje }), { aprobadas: 0, pendientes: 0, rechazadas: 0 });
  const photo = svgLogo();
  const projectMax = Math.max(...projects.map(item => item.horas), 1);
  const institutionMax = Math.max(...institutions.map(item => item.horas), 1);

  return `<!doctype html><html><head><meta charset="utf-8"><title>Reporte Ejecutivo</title><style>
    @page { size: A4; margin: 20mm; }
    @page { @bottom-center { content: "Página " counter(page) " de " counter(pages); color: #64748b; font-size: 10px; } }
    body { font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0f172a; margin: 0; padding: 0; background: #f8fafc; }
    .page { width: 100%; padding: 28mm 24mm 18mm; box-sizing: border-box; }
    .cover { min-height: 270mm; display: flex; flex-direction: column; justify-content: space-between; background: linear-gradient(180deg, #0f172a 0%, #175cd3 58%, #ffffff 100%); color: white; padding: 40px; border-radius: 28px; }
    .cover .brand { display: flex; align-items: center; gap: 18px; }
    .cover .brand svg { width: 84px; height: 84px; }
    .cover h1 { margin: 0; font-size: 38px; line-height: 1.05; letter-spacing: -0.03em; }
    .cover p { margin: 18px 0 0; color: #dbeafe; max-width: 55%; font-size: 16px; }
    .cover .meta { display: grid; grid-template-columns: repeat(2, minmax(180px, 1fr)); gap: 16px; margin-top: 34px; }
    .cover .meta .item { background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.14); border-radius: 18px; padding: 18px; }
    .cover .meta .item span { display: block; color: #f8fafc; opacity: 0.8; font-size: 12px; }
    .cover .meta .item strong { display: block; margin-top: 8px; font-size: 18px; }
    .cover-footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 40px; font-size: 12px; color: rgba(255,255,255,0.72); }
    .section { page-break-after: always; padding: 0; }
    .section-header { display: flex; align-items: center; gap: 16px; margin-bottom: 14px; }
    .section-chip { background: #dbeafe; color: #1e40af; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; padding: 4px 10px; border-radius: 999px; }
    h2 { margin: 0; font-size: 26px; color: #0f172a; }
    h3 { margin: 0 0 10px; font-size: 18px; color: #0f172a; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card { background: white; border-radius: 22px; padding: 20px; box-shadow: 0 18px 45px rgba(15,23,42,0.08); min-height: 120px; }
    .card-label { margin: 0 0 12px; color: #475569; font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; }
    .card-value { margin: 0; font-size: 32px; font-weight: 700; color: #0f172a; }
    .card-note { margin: 12px 0 0; color: #64748b; font-size: 12px; }
    .validation-panel { display: grid; grid-template-columns: 260px 1fr; gap: 24px; align-items: start; margin-bottom: 24px; }
    .donut { width: 220px; height: 220px; border-radius: 50%; background: conic-gradient(#16a34a 0% ${validationDonut.aprobadas}%, #f59e0b ${validationDonut.aprobadas}% ${validationDonut.aprobadas + validationDonut.pendientes}%, #ef4444 ${validationDonut.aprobadas + validationDonut.pendientes}% 100%); position: relative; box-shadow: inset 0 2px 20px rgba(15,23,42,0.12); }
    .donut::before { content: ''; position: absolute; inset: 28px; border-radius: 50%; background: #f8fafc; }
    .donut-center { position: absolute; inset: 0; display: grid; place-items: center; font-size: 14px; color: #0f172a; text-align: center; padding: 0 12px; }
    .donut-label { display: block; font-size: 10px; color: #64748b; margin-top: 4px; }
    .legend { display: grid; gap: 10px; }
    .legend-item { display: flex; align-items: center; gap: 10px; font-size: 13px; color: #334155; }
    .legend-dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }
    .legend-dot.aprobadas { background: #16a34a; }
    .legend-dot.pendientes { background: #f59e0b; }
    .legend-dot.rechazadas { background: #ef4444; }
    .analysis-card { background: white; border-radius: 22px; padding: 22px; box-shadow: 0 18px 45px rgba(15,23,42,0.08); line-height: 1.65; color: #334155; }
    .section-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .table-container { overflow: hidden; border-radius: 20px; border: 1px solid #e2e8f0; box-shadow: 0 12px 30px rgba(15,23,42,0.06); }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 14px 16px; text-align: left; font-size: 12px; }
    thead { background: #f8fafc; }
    th { color: #0f172a; border-bottom: 1px solid #e2e8f0; }
    tr { border-bottom: 1px solid #e2e8f0; }
    tr:last-child { border-bottom: none; }
    td { color: #475569; }
    .table-container tbody tr:nth-child(even) { background: #ffffff; }
    .chart-list { display: grid; gap: 12px; }
    .chart-row { display: grid; grid-template-columns: minmax(120px, 1fr) 1fr 80px; gap: 12px; align-items: center; }
    .chart-label { color: #334155; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bar { height: 12px; background: #e2e8f0; border-radius: 999px; overflow: hidden; }
    .bar-fill { height: 100%; background: linear-gradient(90deg, #2563eb, #16a34a); border-radius: 999px; }
    .chart-value { color: #0f172a; font-size: 12px; font-weight: 700; text-align: right; }
    .trend-graph { display: flex; align-items: flex-end; justify-content: space-between; gap: 10px; padding: 18px 14px 0; }
    .line-item { width: calc(100% / 7 - 10px); display: grid; place-items: center; position: relative; }
    .line-dot { width: 12px; height: 12px; border-radius: 50%; background: #2563eb; position: absolute; }
    .line-bar { width: 4px; background: #2563eb; margin-top: auto; border-radius: 999px 999px 0 0; }
    .line-label { margin-top: 12px; color: #475569; font-size: 10px; text-align: center; }
    .summary-block { background: white; border-radius: 22px; padding: 24px; box-shadow: 0 18px 45px rgba(15,23,42,0.08); }
    .summary-block p { margin: 0 0 10px; color: #475569; }
    .summary-block strong { display: block; font-size: 18px; color: #0f172a; margin-top: 4px; }
    .alert-box { background: #fef3c7; border: 1px solid #fde68a; color: #92400e; padding: 18px 20px; border-radius: 18px; margin-bottom: 24px; }
    .footer-signature { display: grid; grid-template-columns: repeat(3, minmax(200px, 1fr)); gap: 18px; margin-top: 32px; }
    .signature { border-top: 1px solid #cbd5e1; padding-top: 14px; color: #475569; font-size: 12px; }
    .page-break { page-break-after: always; }
    .footer-line { display: flex; justify-content: space-between; align-items: center; color: #94a3b8; font-size: 10px; margin-top: 24px; }
    .footer-line span { display: inline-block; }
  </style></head><body>
    <div class="page cover">
      <div>
        <div class="brand">${photo}<div><span style="font-size:12px;text-transform:uppercase;letter-spacing:0.15em;opacity:0.85;">Reporte Ejecutivo</span><h1>Reporte Ejecutivo del Sistema de Gestión de Horas Sociales y Ambientales</h1></div></div>
        <p>Documento diseñado para administración universitaria con visión ejecutiva, indicadores clave y análisis estructurado por secciones.</p>
        <div class="meta">
          <div class="item"><span>Fecha de generación</span><strong>${meta.generatedAt}</strong></div>
          <div class="item"><span>Periodo consultado</span><strong>${meta.period}</strong></div>
          <div class="item"><span>Universidad</span><strong>${normalizeText(meta.university)}</strong></div>
          <div class="item"><span>Administrador</span><strong>${normalizeText(meta.adminName)}</strong></div>
        </div>
      </div>
      <div class="cover-footer"><span>Reporte preparado para toma de decisiones estratégicas.</span><span>${normalizeText(meta.university)}</span></div>
    </div>
    <div class="page section">
      ${buildSectionHeader('Resumen ejecutivo')}
      <div class="summary-grid">
        ${buildCard('Horas aprobadas', formatNumber(executive.totalHorasAprobadas), '')}
        ${buildCard('Horas pendientes', formatNumber(executive.totalHorasPendientes), '')}
        ${buildCard('Horas rechazadas', formatNumber(executive.totalHorasRechazadas), '')}
        ${buildCard('Estudiantes totales', formatNumber(executive.totalEstudiantes), '')}
        ${buildCard('Estudiantes activos', formatNumber(executive.estudiantesActivos), '')}
        ${buildCard('Estudiantes sin horas', formatNumber(executive.estudiantesSinHoras), '')}
        ${buildCard('Proyectos', formatNumber(executive.totalProyectos), '')}
        ${buildCard('Instituciones', formatNumber(executive.totalInstituciones), '')}
        ${buildCard('Coordinadores', formatNumber(executive.totalCoordinadores), '')}
        ${buildCard('Promedio horas / estudiante', formatNumber(executive.promedioHorasPorEstudiante, 2), '')}
        ${buildCard('Promedio horas / proyecto', formatNumber(executive.promedioHorasPorProyecto, 2), '')}
        ${buildCard('Aprobación', formatPercent(executive.porcentajeAprobacion), '')}
      </div>
      <div class="footer-line"><span>Período: ${meta.period}</span><span>Generado el ${meta.generatedAt}</span></div>
    </div>
    <div class="page section">
      ${buildSectionHeader('Estado de validaciones')}
      <div class="validation-panel">
        <div class="donut"><div class="donut-center"><strong>${formatPercent(validationDonut.aprobadas)}</strong><span class="donut-label">Aprobadas</span></div></div>
        <div class="legend">
          <div class="legend-item"><span class="legend-dot aprobadas"></span>Aprobadas: ${formatPercent(validationDonut.aprobadas)}</div>
          <div class="legend-item"><span class="legend-dot pendientes"></span>Pendientes: ${formatPercent(validationDonut.pendientes)}</div>
          <div class="legend-item"><span class="legend-dot rechazadas"></span>Rechazadas: ${formatPercent(validationDonut.rechazadas)}</div>
        </div>
      </div>
      ${buildTable(['Estado', 'Cantidad', 'Porcentaje'], validation.map(item => ({ Estado: item.estado, Cantidad: formatNumber(item.cantidad), Porcentaje: formatPercent(item.porcentaje) })))}
      <div class="analysis-card"><strong>Análisis ejecutivo</strong><p>${conclusions[0]}</p></div>
    </div>
    <div class="page section">
      ${buildSectionHeader('Horas por proyecto')}
      <div class="chart-list">${buildHorizontalBars(projects.slice(0, 10), projectMax, 'proyecto', 'horas')}</div>
      ${buildTable(['Proyecto', 'Institución', 'Coordinador', 'Estudiantes', 'Horas', 'Promedio'], projects.slice(0, 12).map(item => ({ Proyecto: item.proyecto, Institución: item.institucion, Coordinador: item.coordinador, Estudiantes: formatNumber(item.estudiantes), Horas: formatNumber(item.horas, 2), Promedio: formatNumber(item.promedio, 2) })))}
    </div>
    <div class="page section">
      ${buildSectionHeader('Horas por institución')}
      <div class="chart-list">${buildHorizontalBars(institutions.slice(0, 10), institutionMax, 'institucion', 'horas')}</div>
      ${buildTable(['Institución', 'Proyectos', 'Estudiantes', 'Horas', 'Promedio'], institutions.slice(0, 12).map(item => ({ Institución: item.institucion, Proyectos: formatNumber(item.proyectos), Estudiantes: formatNumber(item.estudiantes), Horas: formatNumber(item.horas, 2), Promedio: formatNumber(item.promedio, 2) })))}
    </div>
    <div class="page section">
      ${buildSectionHeader('Ranking de estudiantes')}
      ${buildTable(['Posición', 'Carnet', 'Nombre', 'Carrera', 'Proyecto', 'Horas aprobadas', 'Horas requeridas', '% completado'], ranking.slice(0, 12).map(item => ({ Posición: item.posicion, Carnet: item.carnet, Nombre: item.nombre, Carrera: item.carrera, Proyecto: item.proyecto, 'Horas aprobadas': formatNumber(item.horasAprobadas, 2), 'Horas requeridas': formatNumber(item.horasRequeridas, 2), '% completado': formatPercent(item.porcentajeCompletado) })))}
    </div>
    <div class="page section">
      ${buildSectionHeader('Estudiantes en riesgo')}
      <div class="alert-box">Se muestran los estudiantes que aún no alcanzan las horas requeridas y requieren atención prioritaria.</div>
      ${buildTable(['Carnet', 'Nombre', 'Carrera', 'Horas actuales', 'Horas requeridas', 'Horas faltantes', '%'], risk.map(item => ({ Carnet: item.carnet, Nombre: item.nombre, Carrera: item.carrera, 'Horas actuales': formatNumber(item.horasActuales, 2), 'Horas requeridas': formatNumber(item.horasRequeridas, 2), 'Horas faltantes': formatNumber(item.horasFaltantes, 2), '%': formatPercent(item.porcentaje) })))}
    </div>
    <div class="page section">
      ${buildSectionHeader('Tendencia de horas')}
      <div class="summary-block"><p>Comparación mensual de horas aprobadas.</p><strong>${trend.delta >= 0 ? `▲ Incrementó ${formatPercent(trend.percentChange)}` : `▼ Disminuyó ${formatPercent(Math.abs(trend.percentChange))}`}</strong></div>
      <div class="trend-graph">${buildLineSeries(trend.series.slice(-7))}</div>
    </div>
    <div class="page section">
      ${buildSectionHeader('Indicadores de gestión')}
      <div class="section-grid">
        <div class="summary-block"><p>Proyecto con más horas</p><strong>${normalizeText(indicators.proyectoConMasHoras?.nombre)} (${formatNumber(indicators.proyectoConMasHoras?.horas, 2)} h)</strong></div>
        <div class="summary-block"><p>Proyecto con menos horas</p><strong>${normalizeText(indicators.proyectoConMenosHoras?.nombre)} (${formatNumber(indicators.proyectoConMenosHoras?.horas, 2)} h)</strong></div>
        <div class="summary-block"><p>Institución más participativa</p><strong>${normalizeText(indicators.institucionMasParticipativa?.nombre)}</strong></div>
        <div class="summary-block"><p>Carrera más activa</p><strong>${normalizeText(indicators.carreraMasActiva?.nombre)}</strong></div>
        <div class="summary-block"><p>Coordinador con más estudiantes</p><strong>${normalizeText(indicators.coordinadorConMasEstudiantes?.nombre)}</strong></div>
        <div class="summary-block"><p>Tiempo promedio de validación</p><strong>${formatNumber(indicators.tiempoPromedioValidacion, 1)} días</strong></div>
        <div class="summary-block"><p>Registros pendientes</p><strong>${formatNumber(indicators.registrosPendientes)}</strong></div>
        <div class="summary-block"><p>Registros rechazados</p><strong>${formatNumber(indicators.registrosRechazados)}</strong></div>
      </div>
      <div class="summary-block"><p>Proyectos sin actividad en los últimos 30 días:</p><strong>${indicators.proyectosSinActividad30Dias.length ? indicators.proyectosSinActividad30Dias.join(', ') : 'Ninguno'}</strong></div>
      <div class="summary-block"><p>Instituciones con mayor cantidad de estudiantes</p>${indicators.institucionesMasEstudiantes.map(item => `<p>${normalizeText(item.institucion)}: ${formatNumber(item.estudiantes)}</p>`).join('')}</div>
    </div>
    <div class="page section">
      ${buildSectionHeader('Conclusiones')}
      <div class="analysis-card"><ul>${buildHtmlList(conclusions)}</ul></div>
      <div class="footer-signature">
        <div class="signature">Administrador</div>
        <div class="signature">Coordinador</div>
        <div class="signature">Fecha: ${meta.generatedAt}</div>
      </div>
    </div>
  </body></html>`;
}

async function generatePDF(html) {
  const puppeteerModule = await import('puppeteer');
  const browser = await launchPuppeteerWithModule(puppeteerModule.default, { args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 500));
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '18mm', bottom: '20mm', left: '18mm' }
    });
  } finally {
    await browser.close();
  }
}

export async function exportDashboardPDF(request, reply) {
  try {
    const from = request.query.from;
    const to = request.query.to;
    const adminName = request.query.adminName || '';
    const university = request.query.university || 'Nombre de la Universidad';

    const executive = await computeDashboardData(from, to);
    const validation = await computeValidationData(from, to);
    const projects = await computeProjectsData(from, to);
    const institutions = await computeInstitutionsData(from, to);
    const ranking = await computeStudentsRanking(from, to, 20);
    const risk = await computeRiskStudents(from, to);
    const trend = await computeMonthlyTrend(from, to);
    const indicators = await computeIndicators(from, to);
    const conclusions = generateExecutiveAnalysis(executive, indicators, projects);

    const html = buildPDFHtml({
      cover: {},
      executive,
      validation,
      projects,
      institutions,
      ranking,
      risk,
      trend,
      indicators,
      conclusions,
      meta: {
        generatedAt: new Date().toISOString().slice(0, 10),
        period: formatDateRange(from, to),
        university,
        adminName
      }
    });

    const pdfBuffer = await generatePDF(html);
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', 'attachment; filename="reporte_ejecutivo.pdf"');
    return reply.send(pdfBuffer);
  } catch (error) {
    request.log?.error?.(error);
    return reply.status(500).send({ success: false, error: { code: 'EXPORT_EXECUTIVE_PDF_ERROR', message: 'Error generando reporte ejecutivo en PDF', details: String(error) } });
  }
}
