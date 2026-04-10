import { UsuariosHabilidades, Habilidades } from '../models/index.js';
import { createErrorResponse } from '../utils/errorResponse.js';

/**
 * Obtiene todas las asignaciones de habilidades a usuarios.
 *
 * @param {import('fastify').FastifyRequest} request 
 * @param {import('fastify').FastifyReply} reply 
 */
export async function getUsuariosHabilidades(request, reply) {
  try {
    const registros = await UsuariosHabilidades.findAll({
      include: [
        {
          model: Habilidades,
          as: 'habilidad'
        }]});
    reply.send(registros);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener las asignaciones de habilidades a usuarios',
      'GET_USUARIOS_HABILIDADES_ERROR',
      error
    ));
  }
}

/**
 * Obtiene una asignación de habilidad por su ID.
 *
 * @param {import('fastify').FastifyRequest} request 
 * @param {import('fastify').FastifyReply} reply 
 */
export async function getUsuariosHabilidadById(request, reply) {
  const { id } = request.params;
  try {
    const registro = await UsuariosHabilidades.findByPk(id, {
      include: [
        {
          model: Habilidades,
          as: 'habilidad',
          attributes: {
            exclude: ['created_at', 'updated_at'] 
          }
        }]});
    if (registro) {
      reply.send(registro);
    } else {
      reply.status(404).send(createErrorResponse(
        'Asignación no encontrada',
        'USUARIOS_HABILIDADES_NOT_FOUND'
      ));
    }
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener la asignación',
      'ERR_GET_USUARIOS_HABILIDAD',
      error
    ));
  }
}

/**
 * Crea una nueva asignación de habilidad a un usuario.
 *
 * @param {import('fastify').FastifyRequest} request 
 * @param {import('fastify').FastifyReply} reply 
 */
export async function createUsuariosHabilidad(request, reply) {
  try {
    const payload = request.body;

    if (payload && Array.isArray(payload.habilidad_id)) {
      const { habilidad_id, ...rest } = payload;
      const data = habilidad_id.map((id) => ({ ...rest, habilidad_id: id }));

      await UsuariosHabilidades.bulkCreate(data);

      const registros = await UsuariosHabilidades.findAll({
        where: {
          usuario_id: rest.usuario_id,
          habilidad_id: habilidad_id
        },
        include: [{
          model: Habilidades,
          as: 'habilidad'
        }],
        order: [['id', 'DESC']]
      });
      return reply.status(201).send(registros);
    }

    const registro = await UsuariosHabilidades.create(payload);
    return reply.status(201).send(registro);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return reply.status(409).send(
        createErrorResponse(
          'Ya existe una asignación para este usuario y habilidad',
          'DUPLICATE_USUARIO_HABILIDAD',
          error
        )
      );
    }

    request.log.error(error);
    return reply.status(500).send(
      createErrorResponse(
        'Error al crear la asignación',
        'CREATE_USUARIOS_HABILIDAD_ERROR',
        error
      )
    );
  }
}

/**
 * Actualiza una asignación de habilidad existente.
 *
 * @param {import('fastify').FastifyRequest} request 
 * @param {import('fastify').FastifyReply} reply 
 */
export async function updateUsuariosHabilidad(request, reply) {
  const { id } = request.params;
  try {
    const [updated] = await UsuariosHabilidades.update(request.body, {
      where: { id },
      validate: true
    });

    if (updated) {
      const registro = await UsuariosHabilidades.findByPk(id);
      reply.send(registro);
    } else {
      reply.status(404).send(createErrorResponse(
        'Asignación no encontrada',
        'USUARIOS_HABILIDADES_NOT_FOUND_ERROR'
      ));
    }
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      reply.status(409).send(createErrorResponse(
        'Ya existe una asignación para este usuario y habilidad',
        'DUPLICATE_USUARIO_HABILIDAD',
        error
      ));
    } else {
      request.log.error(error);
      reply.status(500).send(createErrorResponse(
        'Error al actualizar la asignación',
        'UPDATE_USUARIOS_HABILIDAD_ERROR',
        error
      ));
    }
  }
}

/**
 * Elimina asignaciones de habilidades de un usuario.
 * Acepta un array de habilidad_id para eliminar múltiples asignaciones.
 *
 * @param {import('fastify').FastifyRequest} request 
 * @param {import('fastify').FastifyReply} reply
 */
export async function deleteUsuariosHabilidad(request, reply) {
  try {
    const payload = request.body;
    const { usuario_id, habilidad_id } = payload;

    // Si habilidad_id es un array, eliminar múltiples asignaciones
    if (Array.isArray(habilidad_id)) {
      const deleted = await UsuariosHabilidades.destroy({
        where: {
          usuario_id: usuario_id,
          habilidad_id: habilidad_id
        }
      });

      if (deleted > 0) {
        return reply.status(200).send({
          message: `Se eliminaron ${deleted} asignación(es) de habilidades`,
          deleted_count: deleted,
          usuario_id: usuario_id,
          habilidades_eliminadas: habilidad_id
        });
      } else {
        return reply.status(404).send(createErrorResponse(
          'No se encontraron asignaciones para eliminar con los datos proporcionados',
          'USUARIOS_HABILIDADES_NOT_FOUND_ERROR'
        ));
      }
    }

    // Si es un solo ID (compatibilidad)
    const deleted = await UsuariosHabilidades.destroy({
      where: {
        usuario_id: usuario_id,
        habilidad_id: habilidad_id
      }
    });

    if (deleted) {
      return reply.status(200).send({
        message: 'Asignación eliminada exitosamente',
        deleted_count: deleted,
        usuario_id: usuario_id,
        habilidad_id: habilidad_id
      });
    } else {
      return reply.status(404).send(createErrorResponse(
        'Asignación no encontrada',
        'USUARIOS_HABILIDADES_NOT_FOUND_ERROR'
      ));
    }
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send(createErrorResponse(
      'Error al eliminar la asignación',
      'DELETE_USUARIOS_HABILIDAD_ERROR',
      error
    ));
  }
}


/**
 * Obtiene todas las habilidades de un usuario específico
 *
 * @param {import('fastify').FastifyRequest} request 
 * @param {import('fastify').FastifyReply} reply 
 */
export async function getHabilidadesByUsuario(request, reply) {
  const { usuarioId } = request.params;
  
  try {
    const habilidades = await UsuariosHabilidades.findAll({
      where: { usuario_id: usuarioId },
      include: [
        {
          model: Habilidades,
          as: 'habilidad'
        }
      ]
    });

    if (habilidades.length === 0) {
      reply.status(404).send(createErrorResponse(
        'No se encontraron habilidades para este usuario',
        'USER_SKILLS_NOT_FOUND'
      ));
      return;
    }

    // Estructura la respuesta con información del usuario y sus habilidades
    const response = {
        usuario_id: parseInt(usuarioId),
        habilidades: habilidades.map(h => ({
          id: h.id,  // ID del registro en UsuariosHabilidades (para DELETE)
          habilidad_id: h.habilidad.id,  // ID de la habilidad
          descripcion: h.habilidad.descripcion
        }))
    };

    reply.send(response);
  } catch (error) {
    console.error('Error en getHabilidadesByUsuario:', error);
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener las habilidades del usuario',
      'GET_USER_SKILLS_ERROR',
      error
    ));
  }
}

