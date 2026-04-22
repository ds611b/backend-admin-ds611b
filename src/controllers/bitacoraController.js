import { 
  BitacoraItems, 
  BitacoraProyecto, 
  DetalleBitacoraPerfilUsuario, 
  DetalleBitacoraProyectoBitacoraItems,
  PerfilUsuario,
  Usuarios,
  ProyectosInstitucion,
  Instituciones
} from '../models/index.js';
import { createErrorResponse } from '../utils/errorResponse.js';
import { Op } from 'sequelize';

/**
 * Registra manualmente las horas trabajadas en un día específico.
 * Crea un registro de actividad (BitacoraItem) y lo asocia con la bitácora del proyecto.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function registrarHorasDiarias(request, reply) {
  const { 
    id_bitacora_proyecto, 
    id_perfil_usuario, 
    detalle_actividades, 
    total_horas, 
    punch_in, 
    punch_out 
  } = request.body;

  try {
    // Verificar que la bitácora del proyecto existe
    const bitacoraProyecto = await BitacoraProyecto.findByPk(id_bitacora_proyecto);
    if (!bitacoraProyecto) {
      return reply.status(404).send(createErrorResponse(
        'Bitácora de proyecto no encontrada',
        'BITACORA_PROYECTO_NOT_FOUND'
      ));
    }

    // Verificar que el perfil de usuario existe
    const perfilUsuario = await PerfilUsuario.findByPk(id_perfil_usuario);
    if (!perfilUsuario) {
      return reply.status(404).send(createErrorResponse(
        'Perfil de usuario no encontrado',
        'PERFIL_USUARIO_NOT_FOUND'
      ));
    }

    // Verificar que el usuario está asociado a la bitácora
    const usuarioEnBitacora = await DetalleBitacoraPerfilUsuario.findOne({
      where: {
        id_bitacora: id_bitacora_proyecto,
        id_perfil_usuario: id_perfil_usuario
      }
    });

    // Si no está asociado, asociarlo
    if (!usuarioEnBitacora) {
      await DetalleBitacoraPerfilUsuario.create({
        id_bitacora: id_bitacora_proyecto,
        id_perfil_usuario: id_perfil_usuario
      });
    }

    // Crear el registro de actividad
    const bitacoraItem = await BitacoraItems.create({
      detalle_actividades,
      total_horas,
      punch_in: punch_in ? new Date(punch_in) : new Date(),
      punch_out: punch_out ? new Date(punch_out) : new Date()
    });

    // Asociar el item con la bitácora del proyecto
    await DetalleBitacoraProyectoBitacoraItems.create({
      id_bitacora: id_bitacora_proyecto,
      id_bitacora_item: bitacoraItem.id
    });

    reply.status(201).send({
      success: true,
      message: 'Horas registradas exitosamente',
      data: bitacoraItem
    });
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al registrar las horas trabajadas',
      'REGISTRAR_HORAS_ERROR',
      error
    ));
  }
}

/**
 * Obtiene el listado de horas realizadas por un estudiante específico.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function obtenerHorasPorEstudiante(request, reply) {
  const { id_perfil_usuario } = request.params;
  const { id_proyecto } = request.query;

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

    // Construir la consulta base
    const whereClauseBitacora = {};
    if (id_proyecto) {
      whereClauseBitacora.id_proyecto = id_proyecto;
    }

    // Obtener las bitácoras donde participa el estudiante
    const bitacorasUsuario = await DetalleBitacoraPerfilUsuario.findAll({
      where: { id_perfil_usuario },
      include: [{
        model: BitacoraProyecto,
        as: 'bitacora',
        where: whereClauseBitacora,
        include: [{
          model: ProyectosInstitucion,
          as: 'proyecto',
          include: [{
            model: Instituciones,
            as: 'institucion'
          }]
        }]
      }]
    });

    // Obtener todos los items de bitácora relacionados
    const horasDetalladas = [];
    let totalHorasAcumuladas = 0;

    for (const detalleBitacora of bitacorasUsuario) {
      const itemsBitacora = await DetalleBitacoraProyectoBitacoraItems.findAll({
        where: { id_bitacora: detalleBitacora.id_bitacora },
        include: [{
          model: BitacoraItems,
          as: 'bitacoraItem'
        }]
      });

      for (const item of itemsBitacora) {
        if (item.bitacoraItem) {
          totalHorasAcumuladas += item.bitacoraItem.total_horas || 0;
          horasDetalladas.push({
            id_item: item.bitacoraItem.id,
            detalle_actividades: item.bitacoraItem.detalle_actividades,
            total_horas: item.bitacoraItem.total_horas,
            punch_in: item.bitacoraItem.punch_in,
            punch_out: item.bitacoraItem.punch_out,
            proyecto: detalleBitacora.bitacora?.proyecto ? {
              id: detalleBitacora.bitacora.proyecto.id,
              nombre: detalleBitacora.bitacora.proyecto.nombre,
              institucion: detalleBitacora.bitacora.proyecto.institucion?.nombre
            } : null
          });
        }
      }
    }

    reply.send({
      estudiante: {
        id: perfilUsuario.id,
        nombre_completo: perfilUsuario.usuario ? 
          `${perfilUsuario.usuario.primer_nombre} ${perfilUsuario.usuario.segundo_nombre || ''} ${perfilUsuario.usuario.primer_apellido} ${perfilUsuario.usuario.segundo_apellido || ''}`.trim() 
          : null,
        carnet: perfilUsuario.carnet
      },
      total_horas: totalHorasAcumuladas,
      registros: horasDetalladas
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
 * Actualiza el campo "detalle_actividades" de un BitacoraItem.
 * Permite corregir typos o errores de escritura.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function actualizarDetalleActividad(request, reply) {
  const { id } = request.params;
  const { detalle_actividades } = request.body;

  try {
    const bitacoraItem = await BitacoraItems.findByPk(id);
    
    if (!bitacoraItem) {
      return reply.status(404).send(createErrorResponse(
        'Registro de actividad no encontrado',
        'BITACORA_ITEM_NOT_FOUND'
      ));
    }

    await bitacoraItem.update({ detalle_actividades });

    reply.send({
      success: true,
      message: 'Detalle de actividad actualizado exitosamente',
      data: bitacoraItem
    });
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al actualizar el detalle de actividad',
      'UPDATE_DETALLE_ACTIVIDAD_ERROR',
      error
    ));
  }
}

/**
 * Consulta general del estado del proyecto con información y horas por cada estudiante.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function obtenerEstadoProyecto(request, reply) {
  const { id_proyecto } = request.params;

  try {
    // Obtener el proyecto
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

    // Obtener todas las bitácoras del proyecto
    const bitacorasProyecto = await BitacoraProyecto.findAll({
      where: { id_proyecto },
      order: [['created_at', 'DESC']]
    });

    // Recopilar información de estudiantes y horas
    const estudiantesHoras = [];
    let totalHorasProyecto = 0;

    for (const bitacora of bitacorasProyecto) {
      // Obtener estudiantes asociados a esta bitácora
      const estudiantesBitacora = await DetalleBitacoraPerfilUsuario.findAll({
        where: { id_bitacora: bitacora.id },
        include: [{
          model: PerfilUsuario,
          as: 'perfilUsuario',
          include: [{
            model: Usuarios,
            as: 'usuario',
            attributes: ['id', 'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido', 'email']
          }]
        }]
      });

      // Obtener items de bitácora
      const itemsBitacora = await DetalleBitacoraProyectoBitacoraItems.findAll({
        where: { id_bitacora: bitacora.id },
        include: [{
          model: BitacoraItems,
          as: 'bitacoraItem'
        }]
      });

      // Calcular horas totales de la bitácora
      const horasBitacora = itemsBitacora.reduce((sum, item) => {
        return sum + (item.bitacoraItem?.total_horas || 0);
      }, 0);

      totalHorasProyecto += horasBitacora;

      // Agregar información de cada estudiante
      for (const estudianteDet of estudiantesBitacora) {
        const perfil = estudianteDet.perfilUsuario;
        if (!perfil) continue;

        // Buscar si ya existe en el array
        let estudianteExistente = estudiantesHoras.find(e => e.id_perfil_usuario === perfil.id);

        if (!estudianteExistente) {
          estudianteExistente = {
            id_perfil_usuario: perfil.id,
            carnet: perfil.carnet,
            nombre_completo: perfil.usuario ? 
              `${perfil.usuario.primer_nombre} ${perfil.usuario.segundo_nombre || ''} ${perfil.usuario.primer_apellido} ${perfil.usuario.segundo_apellido || ''}`.trim() 
              : null,
            email: perfil.usuario?.email,
            total_horas: 0,
            actividades: []
          };
          estudiantesHoras.push(estudianteExistente);
        }

        // Agregar horas y actividades (distribuidas equitativamente entre estudiantes de la bitácora)
        const numeroEstudiantes = estudiantesBitacora.length;
        estudianteExistente.total_horas += Math.round(horasBitacora / numeroEstudiantes);

        for (const item of itemsBitacora) {
          if (item.bitacoraItem) {
            estudianteExistente.actividades.push({
              fecha: item.bitacoraItem.punch_in,
              detalle: item.bitacoraItem.detalle_actividades,
              horas: item.bitacoraItem.total_horas
            });
          }
        }
      }
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
        direccion: proyecto.direccion
      },
      estadisticas: {
        total_horas_proyecto: totalHorasProyecto,
        numero_estudiantes: estudiantesHoras.length,
        numero_bitacoras: bitacorasProyecto.length
      },
      bitacoras: bitacorasProyecto.map(b => ({
        id: b.id,
        fecha_inicio: b.fecha_inicio,
        fecha_fin: b.fecha_fin,
        estado: b.estado,
        observaciones: b.observaciones
      })),
      estudiantes: estudiantesHoras
    });
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener el estado del proyecto',
      'GET_ESTADO_PROYECTO_ERROR',
      error
    ));
  }
}

/**
 * Obtiene todas las bitácoras de proyectos.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function obtenerBitacorasProyectos(request, reply) {
  try {
    const bitacoras = await BitacoraProyecto.findAll({
      include: [{
        model: ProyectosInstitucion,
        as: 'proyecto',
        include: [{
          model: Instituciones,
          as: 'institucion'
        }]
      }],
      order: [['created_at', 'DESC']]
    });

    reply.send(bitacoras);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener las bitácoras de proyectos',
      'GET_BITACORAS_PROYECTOS_ERROR',
      error
    ));
  }
}

/**
 * Crea una nueva bitácora de proyecto.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function crearBitacoraProyecto(request, reply) {
  const { id_proyecto, fecha_inicio, fecha_fin, estado, observaciones, estudiantes } = request.body;

  try {
    // Verificar que el proyecto existe
    const proyecto = await ProyectosInstitucion.findByPk(id_proyecto);
    if (!proyecto) {
      return reply.status(404).send(createErrorResponse(
        'Proyecto no encontrado',
        'PROYECTO_NOT_FOUND'
      ));
    }

    // Crear la bitácora
    const bitacora = await BitacoraProyecto.create({
      id_proyecto,
      fecha_inicio: fecha_inicio ? new Date(fecha_inicio) : null,
      fecha_fin: fecha_fin ? new Date(fecha_fin) : null,
      estado: estado || 'En Proceso',
      observaciones
    });

    // Asociar estudiantes si se proporcionan
    if (estudiantes && Array.isArray(estudiantes)) {
      for (const id_perfil_usuario of estudiantes) {
        await DetalleBitacoraPerfilUsuario.create({
          id_bitacora: bitacora.id,
          id_perfil_usuario
        });
      }
    }

    const bitacoraCompleta = await BitacoraProyecto.findByPk(bitacora.id, {
      include: [{
        model: ProyectosInstitucion,
        as: 'proyecto'
      }]
    });

    reply.status(201).send({
      success: true,
      message: 'Bitácora de proyecto creada exitosamente',
      data: bitacoraCompleta
    });
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al crear la bitácora de proyecto',
      'CREATE_BITACORA_PROYECTO_ERROR',
      error
    ));
  }
}

/**
 * Actualiza una bitácora de proyecto.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function actualizarBitacoraProyecto(request, reply) {
  const { id } = request.params;
  const { fecha_inicio, fecha_fin, estado, observaciones } = request.body;

  try {
    const bitacora = await BitacoraProyecto.findByPk(id);
    
    if (!bitacora) {
      return reply.status(404).send(createErrorResponse(
        'Bitácora de proyecto no encontrada',
        'BITACORA_PROYECTO_NOT_FOUND'
      ));
    }

    await bitacora.update({
      fecha_inicio: fecha_inicio ? new Date(fecha_inicio) : bitacora.fecha_inicio,
      fecha_fin: fecha_fin ? new Date(fecha_fin) : bitacora.fecha_fin,
      estado: estado || bitacora.estado,
      observaciones: observaciones !== undefined ? observaciones : bitacora.observaciones
    });

    const bitacoraActualizada = await BitacoraProyecto.findByPk(id, {
      include: [{
        model: ProyectosInstitucion,
        as: 'proyecto'
      }]
    });

    reply.send({
      success: true,
      message: 'Bitácora de proyecto actualizada exitosamente',
      data: bitacoraActualizada
    });
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al actualizar la bitácora de proyecto',
      'UPDATE_BITACORA_PROYECTO_ERROR',
      error
    ));
  }
}
