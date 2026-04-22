import { 
  RegistroHoras, 
  HorasRequisito, 
  ProyectosInstitucion, 
  PerfilUsuario, 
  Usuarios, 
  Instituciones 
} from '../models/index.js';
import { createErrorResponse } from '../utils/errorResponse.js';

export async function getRegistroHoras(request, reply) {
  try {
    const registros = await RegistroHoras.findAll({
      include: [
        { model: HorasRequisito },
        { model: ProyectosInstitucion }
      ],
      order: [['fecha', 'DESC']]
    });
    reply.send(registros);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener los registros de horas',
      'GET_REGISTRO_HORAS_ERROR',
      error
    ));
  }
}

export async function getRegistroHorasById(request, reply) {
  const { id } = request.params;
  try {
    const registro = await RegistroHoras.findByPk(id, {
      include: [
        { model: HorasRequisito },
        { model: ProyectosInstitucion }
      ]
    });
    if (!registro) {
      return reply.status(404).send(createErrorResponse(
        'Registro de horas no encontrado',
        'REGISTRO_HORAS_NOT_FOUND'
      ));
    }
    reply.send(registro);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener el registro de horas',
      'GET_REGISTRO_HORAS_BY_ID_ERROR',
      error
    ));
  }
}

export async function createRegistroHoras(request, reply) {
  const transaction = await RegistroHoras.sequelize.transaction();
  
  try {
    const {
      id_horas_requisito,
      id_proyecto,
      fecha,
      tipo_horas,
      horas_realizadas,
      descripcion_actividad,
      evidencia_url,
      supervisor_nombre,
      supervisor_cargo
    } = request.body;

    
      tipo_horas = tipo_horas === 'A' ? 'Ambientales' : tipo_horas === 'S' ? 'Sociales' : null;
    
      if (!tipo_horas) {
        return reply.status(400).send(createErrorResponse(
          'Tipo de horas inválido. Use A para Ambientales o S para Sociales',
          'INVALID_TIPO_HORAS'
        ));
      } 
    

    const nuevoRegistro = await RegistroHoras.create({
      id_horas_requisito,
      id_proyecto,
      fecha,
      tipo_horas,
      horas_realizadas,
      descripcion_actividad,
      evidencia_url,
      supervisor_nombre,
      supervisor_cargo,
      estado_validacion: 'Pendiente'
    }, { transaction });

    await transaction.commit();

    const registroCompleto = await RegistroHoras.findByPk(nuevoRegistro.id, {
      include: [
        { model: HorasRequisito },
        { model: ProyectosInstitucion }
      ]
    });

    reply.status(201).send(registroCompleto);
  } catch (error) {
    await transaction.rollback();
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al crear el registro de horas',
      'CREATE_REGISTRO_HORAS_ERROR',
      error
    ));
  }
}

export async function updateRegistroHoras(request, reply) {
  const { id } = request.params;
  const transaction = await RegistroHoras.sequelize.transaction();
  
  try {
    const {
      id_horas_requisito,
      id_proyecto,
      fecha,
      horas_realizadas,
      descripcion_actividad,
      evidencia_url,
      supervisor_nombre,
      supervisor_cargo,
      estado_validacion,
      observaciones_validacion,
      validado_por
    } = request.body;

    const registro = await RegistroHoras.findByPk(id, { transaction });
    if (!registro) {
      await transaction.rollback();
      return reply.status(404).send(createErrorResponse(
        'Registro de horas no encontrado',
        'REGISTRO_HORAS_NOT_FOUND'
      ));
    }

    // Actualizar horas completadas si cambia el estado a Aprobado
    if (estado_validacion === 'Aprobado' && registro.estado_validacion !== 'Aprobado') {
      const requisito = await HorasRequisito.findByPk(id_horas_requisito, { transaction });
      if (requisito) {
        await requisito.update({
          horas_completadas: requisito.horas_completadas + horas_realizadas
        }, { transaction });
      }
    }

    // Si cambia de Aprobado a otro estado, restar horas
    if (registro.estado_validacion === 'Aprobado' && estado_validacion !== 'Aprobado') {
      const requisito = await HorasRequisito.findByPk(id_horas_requisito, { transaction });
      if (requisito) {
        await requisito.update({
          horas_completadas: requisito.horas_completadas - registro.horas_realizadas
        }, { transaction });
      }
    }

    await registro.update({
      id_horas_requisito,
      id_proyecto,
      fecha,
      horas_realizadas,
      descripcion_actividad,
      evidencia_url,
      supervisor_nombre,
      supervisor_cargo,
      estado_validacion,
      observaciones_validacion,
      validado_por,
      fecha_validacion: estado_validacion !== 'Pendiente' ? new Date() : null
    }, { transaction });

    await transaction.commit();

    const registroActualizado = await RegistroHoras.findByPk(id, {
      include: [
        { model: HorasRequisito },
        { model: ProyectosInstitucion }
      ]
    });

    reply.send(registroActualizado);
  } catch (error) {
    await transaction.rollback();
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al actualizar el registro de horas',
      'UPDATE_REGISTRO_HORAS_ERROR',
      error
    ));
  }
}

export async function deleteRegistroHoras(request, reply) {
  const { id } = request.params;
  const transaction = await RegistroHoras.sequelize.transaction();
  
  try {
    const registro = await RegistroHoras.findByPk(id, { transaction });
    if (!registro) {
      await transaction.rollback();
      return reply.status(404).send(createErrorResponse(
        'Registro de horas no encontrado',
        'REGISTRO_HORAS_NOT_FOUND'
      ));
    }

    // Si estaba aprobado, restar las horas
    if (registro.estado_validacion === 'Aprobado') {
      const requisito = await HorasRequisito.findByPk(registro.id_horas_requisito, { transaction });
      if (requisito) {
        await requisito.update({
          horas_completadas: requisito.horas_completadas - registro.horas_realizadas
        }, { transaction });
      }
    }

    await registro.destroy({ transaction });
    await transaction.commit();
    
    reply.status(204).send();
  } catch (error) {
    await transaction.rollback();
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al eliminar el registro de horas',
      'DELETE_REGISTRO_HORAS_ERROR',
      error
    ));
  }
}

/**
 * Obtiene el listado de horas realizadas por un estudiante específico.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function getHorasPorEstudiante(request, reply) {
  const { id_perfil_usuario } = request.params;
  const { id_proyecto, tipo_horas } = request.query;

  try {
    // Verificar que el perfil de usuario existe
    const perfilUsuario = await PerfilUsuario.findByPk(id_perfil_usuario, {
      include: [{
        model: Usuarios,
        as: 'usuario',
        attributes: ['id', 'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido', 'email']
      }]
    });

    if (!perfilUsuario) {
      return reply.status(404).send(createErrorResponse(
        'Perfil de usuario no encontrado',
        'PERFIL_USUARIO_NOT_FOUND'
      ));
    }

    // Obtener todos los requisitos de horas del estudiante
    const whereRequisito = { id_perfil_usuario };
    if (tipo_horas) {
      whereRequisito.tipo_horas = tipo_horas;
    }

    const requisitosHoras = await HorasRequisito.findAll({
      where: whereRequisito
    });

    if (requisitosHoras.length === 0) {
      return reply.send({
        estudiante: {
          id: perfilUsuario.id,
          nombre_completo: perfilUsuario.usuario ? 
            `${perfilUsuario.usuario.primer_nombre} ${perfilUsuario.usuario.segundo_nombre || ''} ${perfilUsuario.usuario.primer_apellido} ${perfilUsuario.usuario.segundo_apellido || ''}`.trim() 
            : null,
          carnet: perfilUsuario.carnet,
          email: perfilUsuario.usuario?.email
        },
        total_horas_registradas: 0,
        total_horas_aprobadas: 0,
        registros: []
      });
    }

    // Obtener los IDs de los requisitos
    const idsRequisitos = requisitosHoras.map(r => r.id);

    // Construir el where para los registros
    const whereRegistros = { id_horas_requisito: idsRequisitos };
    if (id_proyecto) {
      whereRegistros.id_proyecto = id_proyecto;
    }

    // Obtener todos los registros de horas del estudiante
    const registros = await RegistroHoras.findAll({
      where: whereRegistros,
      include: [
        { 
          model: HorasRequisito,
          attributes: ['id', 'tipo_horas', 'horas_requeridas', 'horas_completadas']
        },
        { 
          model: ProyectosInstitucion,
          include: [{
            model: Instituciones,
            as: 'institucion',
            attributes: ['id', 'nombre']
          }]
        }
      ],
      order: [['fecha', 'DESC']]
    });

    // Calcular totales
    let totalHorasRegistradas = 0;
    let totalHorasAprobadas = 0;

    const registrosDetallados = registros.map(registro => {
      const horas = parseFloat(registro.horas_realizadas) || 0;
      totalHorasRegistradas += horas;
      if (registro.estado_validacion === 'Aprobado') {
        totalHorasAprobadas += horas;
      }

      return {
        id: registro.id,
        fecha: registro.fecha,
        horas_realizadas: registro.horas_realizadas,
        descripcion_actividad: registro.descripcion_actividad,
        tipo_horas: registro.HorasRequisito?.tipo_horas,
        estado_validacion: registro.estado_validacion,
        observaciones_validacion: registro.observaciones_validacion,
        proyecto: registro.ProyectosInstitucion ? {
          id: registro.ProyectosInstitucion.id,
          nombre: registro.ProyectosInstitucion.nombre,
          institucion: registro.ProyectosInstitucion.institucion?.nombre
        } : null,
        supervisor: {
          nombre: registro.supervisor_nombre,
          cargo: registro.supervisor_cargo
        },
        evidencia_url: registro.evidencia_url
      };
    });

    reply.send({
      estudiante: {
        id: perfilUsuario.id,
        nombre_completo: perfilUsuario.usuario ? 
          `${perfilUsuario.usuario.primer_nombre} ${perfilUsuario.usuario.segundo_nombre || ''} ${perfilUsuario.usuario.primer_apellido} ${perfilUsuario.usuario.segundo_apellido || ''}`.trim() 
          : null,
        carnet: perfilUsuario.carnet,
        email: perfilUsuario.usuario?.email
      },
      total_horas_registradas: totalHorasRegistradas,
      total_horas_aprobadas: totalHorasAprobadas,
      registros: registrosDetallados
    });
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener las horas del estudiante',
      'GET_HORAS_ESTUDIANTE_ERROR',
      error
    ));
  }
}

/**
 * Obtiene el resumen del estado de un proyecto con información de horas por cada estudiante.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function getResumenProyecto(request, reply) {
  const { id_proyecto } = request.params;

  try {
    // Verificar que el proyecto existe
    const proyecto = await ProyectosInstitucion.findByPk(id_proyecto, {
      include: [{
        model: Instituciones,
        as: 'institucion'
      }]
    });

    if (!proyecto) {
      return reply.status(404).send(createErrorResponse(
        'Proyecto no encontrado',
        'PROYECTO_NOT_FOUND'
      ));
    }

    // Obtener todos los registros de horas del proyecto
    const registrosProyecto = await RegistroHoras.findAll({
      where: { id_proyecto },
      include: [
        { 
          model: HorasRequisito,
          include: [{
            model: PerfilUsuario,
            as: 'perfil_usuario',
            include: [{
              model: Usuarios,
              as: 'usuario',
              attributes: ['id', 'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido', 'email']
            }]
          }]
        }
      ],
      order: [['fecha', 'DESC']]
    });

    // Agrupar por estudiante
    const estudiantesMap = new Map();
    let totalHorasProyecto = 0;
    let totalHorasAprobadas = 0;

    for (const registro of registrosProyecto) {
      const perfil = registro.HorasRequisito?.perfil_usuario;
      if (!perfil) continue;

      const idPerfil = perfil.id;
      const horas = parseFloat(registro.horas_realizadas) || 0;
      totalHorasProyecto += horas;
      
      if (registro.estado_validacion === 'Aprobado') {
        totalHorasAprobadas += horas;
      }

      if (!estudiantesMap.has(idPerfil)) {
        estudiantesMap.set(idPerfil, {
          id_perfil_usuario: perfil.id,
          carnet: perfil.carnet,
          nombre_completo: perfil.usuario ? 
            `${perfil.usuario.primer_nombre} ${perfil.usuario.segundo_nombre || ''} ${perfil.usuario.primer_apellido} ${perfil.usuario.segundo_apellido || ''}`.trim() 
            : null,
          email: perfil.usuario?.email,
          total_horas_registradas: 0,
          total_horas_aprobadas: 0,
          total_horas_pendientes: 0,
          total_horas_rechazadas: 0,
          actividades: []
        });
      }

      const estudianteData = estudiantesMap.get(idPerfil);
      estudianteData.total_horas_registradas += horas;

      if (registro.estado_validacion === 'Aprobado') {
        estudianteData.total_horas_aprobadas += horas;
      } else if (registro.estado_validacion === 'Pendiente') {
        estudianteData.total_horas_pendientes += horas;
      } else if (registro.estado_validacion === 'Rechazado') {
        estudianteData.total_horas_rechazadas += horas;
      }

      estudianteData.actividades.push({
        fecha: registro.fecha,
        descripcion: registro.descripcion_actividad,
        horas: registro.horas_realizadas,
        tipo_horas: registro.HorasRequisito?.tipo_horas,
        estado: registro.estado_validacion,
        observaciones: registro.observaciones_validacion
      });
    }

    reply.send({
      proyecto: {
        id: proyecto.id,
        nombre: proyecto.nombre,
        descripcion: proyecto.descripcion,
        fecha_inicio: proyecto.fecha_inicio,
        fecha_fin: proyecto.fecha_fin,
        institucion: proyecto.institucion?.nombre,
        modalidad: proyecto.modalidad,
        direccion: proyecto.direccion,
        tipo_proyecto: proyecto.tipo_proyecto,
        horas_requeridas: proyecto.horas_requeridas,
        estado: proyecto.estado
      },
      estadisticas: {
        total_horas_registradas: totalHorasProyecto,
        total_horas_aprobadas: totalHorasAprobadas,
        total_horas_pendientes: totalHorasProyecto - totalHorasAprobadas,
        numero_estudiantes: estudiantesMap.size,
        numero_registros: registrosProyecto.length
      },
      estudiantes: Array.from(estudiantesMap.values())
    });
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener el resumen del proyecto',
      'GET_RESUMEN_PROYECTO_ERROR',
      error
    ));
  }
}