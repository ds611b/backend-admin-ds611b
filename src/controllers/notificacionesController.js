import { 
  iniciarStreamSSE, 
  obtenerNotificaciones, 
  marcarComoLeida, 
  marcarTodasComoLeidas,
  contarNoLeidas 
} from '../services/notificacionesService.js';
import { createErrorResponse } from '../utils/errorResponse.js';

/**
 * Endpoint SSE para stream de notificaciones en tiempo real.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function streamNotificaciones(request, reply) {
  const { usuarioId } = request.params;

  try {
    // Validar que el usuarioId sea un número válido
    const id = parseInt(usuarioId, 10);
    if (isNaN(id)) {
      return reply.status(400).send(createErrorResponse(
        'El usuarioId debe ser un número válido',
        'INVALID_USER_ID'
      ));
    }

    // Iniciar el stream SSE
    iniciarStreamSSE(id, reply);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al iniciar el stream de notificaciones',
      'STREAM_ERROR',
      error
    ));
  }
}

/**
 * Obtiene el historial de notificaciones de un usuario.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function getNotificaciones(request, reply) {
  const { usuarioId } = request.params;
  const { limit, soloNoLeidas } = request.query;

  try {
    const id = parseInt(usuarioId, 10);
    if (isNaN(id)) {
      return reply.status(400).send(createErrorResponse(
        'El usuarioId debe ser un número válido',
        'INVALID_USER_ID'
      ));
    }

    const opciones = {
      limit: limit ? parseInt(limit, 10) : 50,
      soloNoLeidas: soloNoLeidas === 'true' || soloNoLeidas === true
    };

    const notificaciones = await obtenerNotificaciones(id, opciones);
    reply.send(notificaciones);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener las notificaciones',
      'GET_NOTIFICACIONES_ERROR',
      error
    ));
  }
}

/**
 * Marca una notificación como leída.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function marcarNotificacionLeida(request, reply) {
  const { notificacionId } = request.params;

  try {
    const id = parseInt(notificacionId, 10);
    if (isNaN(id)) {
      return reply.status(400).send(createErrorResponse(
        'El notificacionId debe ser un número válido',
        'INVALID_NOTIFICATION_ID'
      ));
    }

    const notificacion = await marcarComoLeida(id);
    reply.send(notificacion);
  } catch (error) {
    if (error.message === 'Notificación no encontrada') {
      return reply.status(404).send(createErrorResponse(
        'Notificación no encontrada',
        'NOTIFICACION_NOT_FOUND'
      ));
    }

    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al marcar la notificación como leída',
      'MARK_READ_ERROR',
      error
    ));
  }
}

/**
 * Marca todas las notificaciones de un usuario como leídas.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function marcarTodasLeidas(request, reply) {
  const { usuarioId } = request.params;

  try {
    const id = parseInt(usuarioId, 10);
    if (isNaN(id)) {
      return reply.status(400).send(createErrorResponse(
        'El usuarioId debe ser un número válido',
        'INVALID_USER_ID'
      ));
    }

    const actualizadas = await marcarTodasComoLeidas(id);
    reply.send({
      mensaje: 'Todas las notificaciones han sido marcadas como leídas',
      cantidad_actualizada: actualizadas
    });
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al marcar todas las notificaciones como leídas',
      'MARK_ALL_READ_ERROR',
      error
    ));
  }
}

/**
 * Obtiene el conteo de notificaciones no leídas.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function getConteoNoLeidas(request, reply) {
  const { usuarioId } = request.params;

  try {
    const id = parseInt(usuarioId, 10);
    if (isNaN(id)) {
      return reply.status(400).send(createErrorResponse(
        'El usuarioId debe ser un número válido',
        'INVALID_USER_ID'
      ));
    }

    const count = await contarNoLeidas(id);
    reply.send({ 
      usuario_id: id,
      no_leidas: count 
    });
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener el conteo de notificaciones no leídas',
      'COUNT_ERROR',
      error
    ));
  }
}
