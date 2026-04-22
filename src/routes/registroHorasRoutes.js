import {
  getRegistroHoras,
  getRegistroHorasById,
  createRegistroHoras,
  updateRegistroHoras,
  deleteRegistroHoras
} from '../controllers/registroHoras.controller.js';

async function registroHorasRoutes(fastify) {

  fastify.get('/registro-horas', {
    schema: {
      description: 'Obtiene el registro de horas',
      tags: ['Registro de horas'],
      response: {
        200: {
          type: 'array',
          items: { $ref: 'RegistroHoras' }
        },
        500: { $ref: 'ErrorResponse' }
      }
    }
  }, getRegistroHoras);

  fastify.get('/registro-horas/:id', {
    schema: {
      description: 'Obtiene un registro de horas por ID',
      tags: ['Registro de horas'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'number' }
        },
        required: ['id']
      },
      response: {
        200: { $ref: 'RegistroHoras' },
        404: { $ref: 'ErrorResponse' },
        500: { $ref: 'ErrorResponse' }
      }
    }
  }, getRegistroHorasById);

  fastify.post('/registro-horas', {
    schema: {
      description: 'Crea un registro de horas ',
      tags: ['Registro de horas'],
      body: { $ref: 'RegistroHorasValidation' },
      response: {
        201: { $ref: 'RegistroHoras' },
        500: { $ref: 'ErrorResponse' }
      }
    }
  }, createRegistroHoras);

  fastify.put('/registro-horas/:id', {
    schema: {
      description: 'Actualiza un registro de horas',
      tags: ['Registro de horas'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'number' }
        },
        required: ['id']
      },
      body: { $ref: 'RegistroHorasValidation' },
      response: {
        200: { $ref: 'RegistroHoras' },
        404: { $ref: 'ErrorResponse' },
        500: { $ref: 'ErrorResponse' }
      }
    }
  }, updateRegistroHoras);

  fastify.delete('/registro-horas/:id', {
    schema: {
      description: 'Elimina un registro de horas',
      tags: ['Registro de horas'],
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
  }, deleteRegistroHoras);
}

export default registroHorasRoutes;
