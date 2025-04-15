import { AplicacionesEstudiantes, ProyectosInstitucion } from '../models/index.js';
import { createErrorResponse } from '../utils/errorResponse.js';

/**
 * Obtiene todas las aplicaciones de estudiantes.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function getAplicacionesEstudiantes(request, reply) {
  try {
    const aplicaciones = await AplicacionesEstudiantes.findAll();
    reply.send(aplicaciones);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener las aplicaciones de estudiantes',
      'GET_APLICACIONES_ERROR',
      error
    ));
  }
}

/**
 * Obtiene una Aplicacion por Estudiante por ID.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function getAplicacionEstudianteById(request, reply) {
  const { id } = request.params;
  try {
    const aplicacion = await AplicacionesEstudiantes.findByPk(id, {
      include: {
        model: ProyectosInstitucion,
        as: 'proyecto'
      },
    });
    if (aplicacion) {
      reply.send(aplicacion);
    } else {
      reply.status(404).send(createErrorResponse(
        'Aplicación no encontrada',
        'APLICACION_NOT_FOUND'
      ));
    }
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener la aplicación de estudiante',
      'GET_APLICACION_ERROR',
      error
    ));
  }
}

/**
 * Crea una aplicación por estudiante.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function createAplicacionEstudiante(request, reply) {
  try {
    const aplicacion = await AplicacionesEstudiantes.create(request.body);
    reply.status(201).send(aplicacion);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      reply.status(409).send(createErrorResponse(
        'El estudiante ya tiene una aplicación activa para este proyecto',
        'DUPLICATE_APLICACION_ESTUDIANTE',
        error
      ));
    } else {
      request.log.error(error);
      reply.status(500).send(createErrorResponse(
        'Error al crear la aplicación de estudiante',
        'CREATE_APLICACION_ERROR',
        error
      ));
    }
  }
}

/**
 * Actualiza una aplicacion de estudiante.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function updateAplicacionEstudiante(request, reply) {
  const { id } = request.params;
  try {
    const [updated] = await AplicacionesEstudiantes.update(request.body, {
      where: { id },
      validate: true
    });
    if (updated) {
      const aplicacion = await AplicacionesEstudiantes.findByPk(id);
      reply.send(aplicacion);
    } else {
      reply.status(404).send(createErrorResponse(
        'Aplicación no encontrada',
        'APLICACION_NOT_FOUND'
      ));
    }
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      reply.status(409).send(createErrorResponse(
        'No se puede actualizar: La nueva combinación de estudiante y proyecto ya existe',
        'DUPLICATE_APLICACION_ESTUDIANTE',
        error
      ));
    } else {
      request.log.error(error);
      reply.status(500).send(createErrorResponse(
        'Error al actualizar la aplicación de estudiante',
        'UPDATE_APLICACION_ERROR',
        error
      ));
    }
  }
}

/**
 * Elimina una aplicación por estudiante por ID.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function deleteAplicacionEstudiante(request, reply) {
  const { id } = request.params;
  try {
    const deleted = await AplicacionesEstudiantes.destroy({ where: { id } });
    if (deleted) {
      reply.status(204).send({ message: 'Aplicación eliminada exitosamente' });
    } else {
      reply.status(404).send(createErrorResponse(
        'Aplicación no encontrada',
        'APLICACION_NOT_FOUND'
      ));
    }
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al eliminar la aplicación de estudiante',
      'DELETE_APLICACION_ERROR',
      error
    ));
  }
}
