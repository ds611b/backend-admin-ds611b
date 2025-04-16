import { ProyectosInstitucionesHabilidades } from '../models/index.js';
import { createErrorResponse } from '../utils/errorResponse.js';

/**
 * Obtiene todas las relaciones de habilidades por proyectos.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function getProyectosInstitucionesHabilidades(request, reply) {
  try {
    const registros = await ProyectosInstitucionesHabilidades.findAll();
    reply.send(registros);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener las relaciones de habilidades',
      'GET_PROYECTOS_INSTITUCIONES_HABILIDADES_ERROR',
      error
    ));
  }
}

/**
 * Obtiene una relación de habilidades por proyecto by ID.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function getProyectosInstitucionesHabilidadById(request, reply) {
  const { id } = request.params;
  try {
    const registro = await ProyectosInstitucionesHabilidades.findByPk(id);
    if (registro) {
      reply.send(registro);
    } else {
      reply.status(404).send(createErrorResponse(
        'Relación no encontrada',
        'RELACION_NOT_FOUND_ERROR'
      ));
    }
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener la relación',
      'GET_PROYECTOS_INSTITUCIONES_HABILIDADES_ERROR',
      error
    ));
  }
}

/**
 * Crea una nueva relación habilidad por proyecto.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function createProyectosInstitucionesHabilidad(request, reply) {
  try {
    const registro = await ProyectosInstitucionesHabilidades.create(request.body);
    reply.status(201).send(registro);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      reply.status(409).send(createErrorResponse(
        'La combinación proyecto-habilidad ya existe',
        'RELACION_DUPLICADA_ERROR',
        error
      ));
    } else {
      request.log.error(error);
      reply.status(500).send(createErrorResponse(
        'Error al crear la relación',
        'CREATE_PROYECTOS_INSTITUCIONES_HABILIDADES_ERROR',
        error
      ));
    }
  }
}

/**
 * Actualiza relación habilidad por proyecto.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function updateProyectosInstitucionesHabilidad(request, reply) {
  const { id } = request.params;
  try {
    const [updated] = await ProyectosInstitucionesHabilidades.update(request.body, {
      where: { id },
      validate: true
    });
    
    if (updated) {
      const registro = await ProyectosInstitucionesHabilidades.findByPk(id);
      reply.send(registro);
    } else {
      reply.status(404).send(createErrorResponse(
        'Relación no encontrada',
        'RELACION_NOT_FOUND_ERROR'
      ));
    }
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      reply.status(409).send(createErrorResponse(
        'No se puede actualizar: La nueva combinación proyecto-habilidad ya existe',
        'RELACION_DUPLICADA_ERROR',
        error
      ));
    } else {
      request.log.error(error);
      reply.status(500).send(createErrorResponse(
        'Error al actualizar la relación',
        'UPDATE_PROYECTOS_INSTITUCIONES_HABILIDADES_ERROR',
        error
      ));
    }
  }
}

/**
 * Elimina la relación habilidad por proyecto.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function deleteProyectosInstitucionesHabilidad(request, reply) {
  const { id } = request.params;
  try {
    const deleted = await ProyectosInstitucionesHabilidades.destroy({ where: { id } });
    if (deleted) {
      reply.status(204).send();
    } else {
      reply.status(404).send(createErrorResponse(
        'Relación no encontrada',
        'RELACION_NOT_FOUND_ERROR'
      ));
    }
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al eliminar la relación',
      'DELETE_PROYECTOS_INSTITUCIONES_HABILIDADES_ERROR',
      error
    ));
  }
}