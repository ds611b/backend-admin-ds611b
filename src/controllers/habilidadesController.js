import { Habilidades } from '../models/index.js'
import { createErrorResponse } from '../utils/errorResponse.js';

/**
 * Obtiene todas las habilidades.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function getHabilidades(request, reply) {
  try {
    const habilidades = await Habilidades.findAll();
    reply.send(habilidades);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener las habilidades',
      'ERR_GET_HABILIDADES',
      error
    ));
  }
}

/**
 * Obtiene una habilidad por ID.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function getHabilidadById(request, reply) {
  const { id } = request.params;
  try {
    const habilidad = await Habilidades.findByPk(id);
    if (habilidad) {
      reply.send(habilidad);
    } else {
      reply.status(404).send(createErrorResponse(
        'Habilidad no encontrada',
        'ERR_HABILIDAD_NOT_FOUND'
      ));
    }
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener la habilidad',
      'ERR_GET_HABILIDAD',
      error
    ));
  }
}

/**
 * Crea una habilidad.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function createHabilidad(request, reply) {
  try {
    const habilidad = await Habilidades.create(request.body);
    reply.status(201).send(habilidad);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al crear la habilidad',
      'ERR_CREATE_HABILIDAD',
      error
    ));
  }
}

/**
 * Actualiza una habilidad.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function updateHabilidad(request, reply) {
  const { id } = request.params;
  try {
    const [updated] = await Habilidades.update(request.body, { where: { id } });
    if (updated) {
      const habilidad = await Habilidades.findByPk(id);
      reply.send(habilidad);
    } else {
      reply.status(404).send(createErrorResponse(
        'Habilidad no encontrada',
        'ERR_HABILIDAD_NOT_FOUND'
      ));
    }
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al actualizar la habilidad',
      'ERR_UPDATE_HABILIDAD',
      error
    ));
  }
}

/**
 * Elimina una habilidad.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function deleteHabilidad(request, reply) {
  const { id } = request.params;
  try {
    const deleted = await Habilidades.destroy({ where: { id } });
    if (deleted) {
      reply.send({ message: 'Habilidad eliminada exitosamente' });
    } else {
      reply.status(404).send(createErrorResponse(
        'Habilidad no encontrada',
        'ERR_HABILIDAD_NOT_FOUND'
      ));
    }
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al eliminar la habilidad',
      'ERR_DELETE_HABILIDAD',
      error
    ));
  }
}
