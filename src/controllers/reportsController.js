import { Op } from 'sequelize';
import ExcelJS from 'exceljs';
import {
  RegistroHoras,
  GrupoEstudiantes,
  PerfilUsuario,
  Usuarios,
  ProyectosInstitucion,
  Instituciones
} from '../models/index.js';
import { Grupos, Carreras } from '../models/index.js';
import { createErrorResponse } from '../utils/errorResponse.js';

function _escapeCsv(value) {
  if (value === null || value === undefined) return '';
  const s = String(value).replace(/"/g, '""');
  if (s.includes(',') || s.includes('\n') || s.includes('"')) return `"${s}"`;
  return s;
}

export async function exportRegistroHorasCSV(request, reply) {
  try {
    const { from, to, id_proyecto, tipo_horas } = request.query;

    const where = {};
    if (id_proyecto) where.id_proyecto = Number(id_proyecto);
    if (tipo_horas) where.tipo_horas = tipo_horas;
    if (from || to) {
      where.fecha = {};
      if (from) where.fecha[Op.gte] = from;
      if (to) where.fecha[Op.lte] = to;
    }

    const registros = await RegistroHoras.findAll({
      where,
      include: [
        {
          model: GrupoEstudiantes,
          as: 'grupo_estudiante',
          include: [
            {
              model: PerfilUsuario,
              as: 'perfil_estudiante',
              include: [
                {
                  model: Usuarios,
                  as: 'usuario',
                  attributes: ['id', 'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido', 'email']
                }
                ,
                {
                  model: Carreras,
                  as: 'carrera',
                  attributes: ['id', 'nombre']
                }
              ]
            }
            ,
            {
              model: Grupos,
              attributes: ['id', 'codigo', 'nombre']
            }
          ]
        },
        {
          model: ProyectosInstitucion,
          as: 'proyecto',
          include: [
            {
              model: Instituciones,
              as: 'institucion',
              attributes: ['id', 'nombre']
            }
          ]
        }
      ],
      order: [['fecha', 'ASC']]
    });

    // Build CSV
    let csv = '';
    const headers = [
      'registro_id',
      'fecha',
      'horas_realizadas',
      'tipo_horas',
      'estado_validacion',
      'descripcion_actividad',
      'observaciones_validacion',
      'supervisor_nombre',
      'supervisor_cargo',
      'evidencia_url',
      'estudiante_nombre',
      'carnet',
      'email',
      'carrera',
      'grupo_codigo',
      'proyecto_nombre',
      'proyecto_descripcion',
      'proyecto_modalidad',
      'proyecto_fecha_inicio',
      'proyecto_fecha_fin',
      'institucion_nombre',
      'institucion_nit'
    ];

    csv += headers.join(',') + '\n';

    for (const r of registros) {
      const grupoEst = r.grupo_estudiante;
      const perfil = grupoEst?.perfil_estudiante;
      const usuario = perfil?.usuario;
      const grupo = grupoEst?.grupo;
      const carrera = perfil?.carrera;
      const institucion = r.proyecto?.institucion;
      const nombreCompleto = usuario ? `${usuario.primer_nombre || ''} ${usuario.segundo_nombre || ''} ${usuario.primer_apellido || ''} ${usuario.segundo_apellido || ''}`.trim() : '';

      const row = [
        _escapeCsv(r.id),
        _escapeCsv(r.fecha),
        _escapeCsv(r.horas_realizadas),
        _escapeCsv(r.tipo_horas),
        _escapeCsv(r.estado_validacion),
        _escapeCsv(r.descripcion_actividad),
        _escapeCsv(r.observaciones_validacion),
        _escapeCsv(r.supervisor_nombre),
        _escapeCsv(r.supervisor_cargo),
        _escapeCsv(r.evidencia_url),
        _escapeCsv(nombreCompleto),
        _escapeCsv(perfil?.carnet),
        _escapeCsv(usuario?.email),
        _escapeCsv(carrera?.nombre),
        _escapeCsv(grupo?.codigo ?? grupo?.nombre),
        _escapeCsv(r.proyecto?.nombre),
        _escapeCsv(r.proyecto?.descripcion),
        _escapeCsv(r.proyecto?.modalidad),
        _escapeCsv(r.proyecto?.fecha_inicio),
        _escapeCsv(r.proyecto?.fecha_fin),
        _escapeCsv(institucion?.nombre),
        _escapeCsv(institucion?.nit)
      ];

      csv += row.join(',') + '\n';
    }

    const filename = `registro_horas_${from || 'all'}_${to || 'all'}.csv`;
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return reply.send(Buffer.from(csv, 'utf8'));
  } catch (error) {
    request.log?.error?.(error);
    reply.status(500).send(createErrorResponse(
      'Error al exportar registros de horas',
      'EXPORT_REGISTRO_HORAS_ERROR',
      error
    ));
  }
}

export async function exportRegistroHorasXLSX(request, reply) {
  try {
    const { from, to, id_proyecto, tipo_horas } = request.query;

    const where = {};
    if (id_proyecto) where.id_proyecto = Number(id_proyecto);
    if (tipo_horas) where.tipo_horas = tipo_horas;
    if (from || to) {
      where.fecha = {};
      if (from) where.fecha[Op.gte] = from;
      if (to) where.fecha[Op.lte] = to;
    }

    const registros = await RegistroHoras.findAll({
      where,
      include: [
        {
          model: GrupoEstudiantes,
          as: 'grupo_estudiante',
          include: [
            {
              model: PerfilUsuario,
              as: 'perfil_estudiante',
              include: [
                {
                  model: Usuarios,
                  as: 'usuario',
                  attributes: ['id', 'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido', 'email']
                },
                {
                  model: Carreras,
                  as: 'carrera',
                  attributes: ['id', 'nombre']
                }
              ]
            },
            {
              model: Grupos,
              attributes: ['id', 'codigo', 'nombre']
            }
          ]
        },
        {
          model: ProyectosInstitucion,
          as: 'proyecto',
          include: [
            {
              model: Instituciones,
              as: 'institucion',
              attributes: ['id', 'nombre', 'nit']
            }
          ]
        }
      ],
      order: [['fecha', 'ASC']]
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('RegistroHoras');

    sheet.columns = [
      { header: 'Registro ID', key: 'registro_id', width: 12 },
      { header: 'Fecha', key: 'fecha', width: 15 },
      { header: 'Horas realizadas', key: 'horas', width: 18 },
      { header: 'Tipo de horas', key: 'tipo_horas', width: 12 },
      { header: 'Estado de validación', key: 'estado', width: 18 },
      { header: 'Descripción de la actividad', key: 'descripcion', width: 40 },
      { header: 'Observaciones validación', key: 'observaciones', width: 30 },
      { header: 'Supervisor (nombre)', key: 'supervisor_nombre', width: 25 },
      { header: 'Supervisor (cargo)', key: 'supervisor_cargo', width: 20 },
      { header: 'Evidencia URL', key: 'evidencia', width: 40 },
      { header: 'Estudiante (nombre completo)', key: 'estudiante_nombre', width: 35 },
      { header: 'Carné', key: 'carnet', width: 12 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Carrera', key: 'carrera', width: 25 },
      { header: 'Grupo (codigo/nombre)', key: 'grupo', width: 20 },
      { header: 'Proyecto (nombre)', key: 'proyecto_nombre', width: 30 },
      { header: 'Descripción del proyecto', key: 'proyecto_descripcion', width: 40 },
      { header: 'Modalidad proyecto', key: 'proyecto_modalidad', width: 15 },
      { header: 'Fecha inicio proyecto', key: 'proyecto_fecha_inicio', width: 15 },
      { header: 'Fecha fin proyecto', key: 'proyecto_fecha_fin', width: 15 },
      { header: 'Institución', key: 'institucion', width: 30 },
      { header: 'NIT institución', key: 'institucion_nit', width: 20 }
    ];

    for (const r of registros) {
      const grupoEst = r.grupo_estudiante;
      const perfil = grupoEst?.perfil_estudiante;
      const usuario = perfil?.usuario;
      const grupo = grupoEst?.grupo;
      const carrera = perfil?.carrera;
      const institucion = r.proyecto?.institucion;
      const nombreCompleto = usuario ? `${usuario.primer_nombre || ''} ${usuario.segundo_nombre || ''} ${usuario.primer_apellido || ''} ${usuario.segundo_apellido || ''}`.trim() : '';

      sheet.addRow({
        registro_id: r.id,
        fecha: r.fecha,
        horas: Number(r.horas_realizadas),
        tipo_horas: r.tipo_horas,
        estado: r.estado_validacion,
        descripcion: r.descripcion_actividad,
        observaciones: r.observaciones_validacion,
        supervisor_nombre: r.supervisor_nombre,
        supervisor_cargo: r.supervisor_cargo,
        evidencia: r.evidencia_url,
        estudiante_nombre: nombreCompleto,
        carnet: perfil?.carnet,
        email: usuario?.email,
        carrera: carrera?.nombre,
        grupo: grupo?.codigo ?? grupo?.nombre,
        proyecto_nombre: r.proyecto?.nombre,
        proyecto_descripcion: r.proyecto?.descripcion,
        proyecto_modalidad: r.proyecto?.modalidad,
        proyecto_fecha_inicio: r.proyecto?.fecha_inicio,
        proyecto_fecha_fin: r.proyecto?.fecha_fin,
        institucion: institucion?.nombre,
        institucion_nit: institucion?.nit
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `registro_horas_${from || 'all'}_${to || 'all'}.xlsx`;
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return reply.send(Buffer.from(buffer));
  } catch (error) {
    request.log?.error?.(error);
    reply.status(500).send(createErrorResponse(
      'Error al exportar registros de horas (XLSX)',
      'EXPORT_REGISTRO_HORAS_XLSX_ERROR',
      error
    ));
  }
}
