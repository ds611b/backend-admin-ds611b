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
      'ERR_GET_APLICACIONES',
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
        'ERR_APLICACION_NOT_FOUND'
      ));
    }
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener la aplicación de estudiante',
      'ERR_GET_APLICACION',
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
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al crear la aplicación de estudiante',
      'ERR_CREATE_APLICACION',
      error
    ));
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
      where: { id }
    });
    if (updated) {
      const aplicacion = await AplicacionesEstudiantes.findByPk(id);
      reply.send(aplicacion);
    } else {
      reply.status(404).send(createErrorResponse(
        'Aplicación no encontrada',
        'ERR_APLICACION_NOT_FOUND'
      ));
    }
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al actualizar la aplicación de estudiante',
      'ERR_UPDATE_APLICACION',
      error
    ));
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
      reply.send({ message: 'Aplicación eliminada exitosamente' });
    } else {
      reply.status(404).send(createErrorResponse(
        'Aplicación no encontrada',
        'ERR_APLICACION_NOT_FOUND'
      ));
    }
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al eliminar la aplicación de estudiante',
      'ERR_DELETE_APLICACION',
      error
    ));
  }
}
