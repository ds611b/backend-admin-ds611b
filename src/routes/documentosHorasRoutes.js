import {    
    getDocumentosHoras,
    getDocumentosHorasById,
    createDocumentosHoras,
    deleteDocumentosHoras
} from '../controllers/documentosHoras.controller.js';

async function documentosHorasRoutes(fastify) {

  fastify.get('/documentos-horas', {
    schema: {
      description: 'Obtiene documentos de soporte de horas',
      tags: ['Documentos de horas'],
      response: {
        200: {
          type: 'array',
          items: { $ref: 'DocumentosHoras' }
        },
        500: { $ref: 'ErrorResponse' }
      }
    }
  }, getDocumentosHoras);

  fastify.get('/documentos-horas/:id', {
    schema: {
      description: 'Obtiene un documento de horas por ID',
      tags: ['Documentos de horas'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'number' }
        },
        required: ['id']
      },
      response: {
        200: { $ref: 'DocumentosHoras' },
        404: { $ref: 'ErrorResponse' },
        500: { $ref: 'ErrorResponse' }
      }
    }
  }, getDocumentosHorasById);

  fastify.post('/documentos-horas', {
    schema: {
      description: 'Sube un documento de horas sociales',
      tags: ['Documentos de horas'],
      body: { $ref: 'DocumentosHorasValidation' },
      response: {
        201: { $ref: 'DocumentosHoras' },
        500: { $ref: 'ErrorResponse' }
      }
    }
  }, createDocumentosHoras);

  fastify.delete('/documentos-horas/:id', {
    schema: {
      description: 'Elimina un documento de horas sociales',
      tags: ['Documentos de horas'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'number' }
        },
        required: ['id']
      },
      response: {
        204: { type: 'null' },
        404: { $ref: 'ErrorResponse' },
        500: { $ref: 'ErrorResponse' }
      }
    }
  }, deleteDocumentosHoras);
}

export default documentosHorasRoutes;
