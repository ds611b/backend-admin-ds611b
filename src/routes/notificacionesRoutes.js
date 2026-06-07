import {
  streamNotificaciones,
  getNotificaciones,
  marcarNotificacionLeida,
  marcarTodasLeidas,
  getConteoNoLeidas
} from '../controllers/notificacionesController.js';

/**
 * Rutas para el sistema de notificaciones.
 * @param {import('fastify').FastifyInstance} fastify
 * @param {object} options
 */
async function notificacionesRoutes(fastify, options) {
  
  // Endpoint SSE para recibir notificaciones en tiempo real
  fastify.get('/stream/:usuarioId', {
    schema: {
      description: 'Stream SSE de notificaciones en tiempo real para un usuario',
      tags: ['Notificaciones'],
      params: {
        type: 'object',
        properties: {
          usuarioId: { type: 'integer', description: 'ID del usuario' }
        },
        required: ['usuarioId']
      },
      response: {
        200: {
          description: 'Stream SSE iniciado exitosamente',
          type: 'string'
        },
        400: {
          description: 'ID de usuario inválido',
          type: 'object',
          properties: {
            error: { type: 'string' },
            code: { type: 'string' }
          }
        }
      }
    }
  }, streamNotificaciones);

  // Obtener historial de notificaciones
  fastify.get('/:usuarioId', {
    schema: {
      description: 'Obtiene el historial de notificaciones de un usuario',
      tags: ['Notificaciones'],
      params: {
        type: 'object',
        properties: {
          usuarioId: { type: 'integer', description: 'ID del usuario' }
        },
        required: ['usuarioId']
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', default: 50, description: 'Límite de resultados' },
          soloNoLeidas: { type: 'boolean', default: false, description: 'Filtrar solo no leídas' }
        }
      },
      response: {
        200: {
          description: 'Lista de notificaciones',
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              usuario_id: { type: 'integer' },
              titulo: { type: 'string' },
              mensaje: { type: 'string' },
              leida: { type: 'boolean' },
              created_at: { type: 'string' }
            }
          }
        }
      }
    }
  }, getNotificaciones);

  // Marcar una notificación como leída
  fastify.patch('/:notificacionId/leer', {
    schema: {
      description: 'Marca una notificación como leída',
      tags: ['Notificaciones'],
      params: {
        type: 'object',
        properties: {
          notificacionId: { type: 'integer', description: 'ID de la notificación' }
        },
        required: ['notificacionId']
      },
      response: {
        200: {
          description: 'Notificación marcada como leída',
          type: 'object',
          properties: {
            id: { type: 'integer' },
            usuario_id: { type: 'integer' },
            titulo: { type: 'string' },
            mensaje: { type: 'string' },
            leida: { type: 'boolean' },
            created_at: { type: 'string' }
          }
        },
        404: {
          description: 'Notificación no encontrada',
          type: 'object',
          properties: {
            error: { type: 'string' },
            code: { type: 'string' }
          }
        }
      }
    }
  }, marcarNotificacionLeida);

  // Marcar todas las notificaciones como leídas
  fastify.patch('/:usuarioId/leer-todas', {
    schema: {
      description: 'Marca todas las notificaciones de un usuario como leídas',
      tags: ['Notificaciones'],
      params: {
        type: 'object',
        properties: {
          usuarioId: { type: 'integer', description: 'ID del usuario' }
        },
        required: ['usuarioId']
      },
      response: {
        200: {
          description: 'Todas las notificaciones marcadas como leídas',
          type: 'object',
          properties: {
            mensaje: { type: 'string' },
            cantidad_actualizada: { type: 'integer' }
          }
        }
      }
    }
  }, marcarTodasLeidas);

  // Obtener conteo de notificaciones no leídas
  fastify.get('/:usuarioId/conteo-no-leidas', {
    schema: {
      description: 'Obtiene el conteo de notificaciones no leídas de un usuario',
      tags: ['Notificaciones'],
      params: {
        type: 'object',
        properties: {
          usuarioId: { type: 'integer', description: 'ID del usuario' }
        },
        required: ['usuarioId']
      },
      response: {
        200: {
          description: 'Conteo de notificaciones no leídas',
          type: 'object',
          properties: {
            usuario_id: { type: 'integer' },
            no_leidas: { type: 'integer' }
          }
        }
      }
    }
  }, getConteoNoLeidas);
}

export default notificacionesRoutes;
