import { getConfiguracionIA, updateConfiguracionIA } from '../controllers/configuracionIAController.js';

const configuracionIAObject = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    chatbot_activo: { type: 'boolean' },
    recomendaciones_activo: { type: 'boolean' },
    actualizado_por: { type: ['integer', 'null'] },
    updated_at: { type: ['string', 'null'], format: 'date-time' }
  }
};

/**
 * Rutas para la configuración global de IA (chatbot + recomendaciones).
 * @param {import('fastify').FastifyInstance} fastify
 */
async function configuracionIARoutes(fastify) {
  // Estado actual de las funciones de IA
  fastify.get('/configuracion-ia', {
    schema: {
      description: 'Obtiene el estado de activación de las funciones de IA (chatbot y recomendaciones).',
      tags: ['Configuración IA'],
      response: {
        200: configuracionIAObject,
        500: { $ref: 'ErrorResponse' }
      }
    }
  }, getConfiguracionIA);

  // Activar/desactivar funciones de IA (Coordinador General)
  fastify.patch('/configuracion-ia', {
    schema: {
      description: 'Activa o desactiva el chatbot y/o las recomendaciones. Ambos campos son opcionales.',
      tags: ['Configuración IA'],
      body: {
        type: 'object',
        properties: {
          chatbot_activo: { type: 'boolean' },
          recomendaciones_activo: { type: 'boolean' },
          actualizado_por: { type: 'integer' }
        }
      },
      response: {
        200: configuracionIAObject,
        400: { $ref: 'ErrorResponse' },
        500: { $ref: 'ErrorResponse' }
      }
    }
  }, updateConfiguracionIA);
}

export default configuracionIARoutes;
