import {
  getHorasRequisito,
  getHorasRequisitoById,
  createHorasRequisito,
  updateHorasRequisito,
  deleteHorasRequisito,
  getHorasByUsuario 
} from '../controllers/horasRequisito.controller.js';

async function horasRequisitoRoutes(fastify) {

  // GET ALL
  fastify.get('/horas-requisito', {
    schema: {
      description: 'Obtiene los requisitos de horas requeridos',
      tags: ['Horas requisito'],
      response: {
        200: {
          type: 'array',
          items: { $ref: 'HorasRequisito' }
        },
        500: { $ref: 'ErrorResponse' }
      }
    }
  }, getHorasRequisito);

  // GET BY ID
  fastify.get('/horas-requisito/:id', {
    schema: {
      description: 'Obtiene un requisito de horas por ID',
      tags: ['Horas requisito'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'number' }
        },
        required: ['id']
      },
      response: {
        200: { $ref: 'HorasRequisito' },
        404: { $ref: 'ErrorResponse' },
        500: { $ref: 'ErrorResponse' }
      }
    }
  }, getHorasRequisitoById);

  // GET RESUMEN POR USUARIO
// GET RESUMEN POR USUARIO Y TIPO
fastify.get('/horas-requisito/usuario/:idUsuario', {
  schema: {
    description: 'Obtiene el resumen de horas por usuario y tipo',
    tags: ['Horas requisito'],
    
    params: {
      type: 'object',
      properties: {
        idUsuario: { type: 'number' }
      },
      required: ['idUsuario']
    },

    querystring: {
      type: 'object',
      properties: {
        tipo_horas: { 
          type: 'string',
          enum: ['A', 'S'],
          description: 'A = Ambientales, S = Sociales'
        }
      },
      required: ['tipo_horas']
    },

    response: {
      200: {
        type: 'object',
        properties: {
          usuario_id: { type: 'number' },
          tipo_horas: { type: 'string' },
          horas_requeridas: { type: 'number' },
          horas_completadas: { type: 'number' },
          horas_pendientes_aprobacion: { type: 'number' },
          horas_restantes: { type: 'number' }
        }
      },
      404: { $ref: 'ErrorResponse' },
      500: { $ref: 'ErrorResponse' }
    }
  }
}, getHorasByUsuario);

  // POST
  fastify.post('/horas-requisito', {
    schema: {
      description: 'Crea un requisito de horas sociales',
      tags: ['Horas requisito'],
      body: { $ref: 'HorasRequisitoValidation' },
      response: {
        201: { $ref: 'HorasRequisito' },
        500: { $ref: 'ErrorResponse' }
      }
    }
  }, createHorasRequisito);

  // PUT
  fastify.put('/horas-requisito/:id', {
    schema: {
      description: 'Actualiza un requisito de horas sociales',
      tags: ['Horas requisito'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'number' }
        },
        required: ['id']
      },
      body: { $ref: 'HorasRequisitoValidation' },
      response: {
        200: { $ref: 'HorasRequisito' },
        404: { $ref: 'ErrorResponse' },
        500: { $ref: 'ErrorResponse' }
      }
    }
  }, updateHorasRequisito);

  // DELETE
  fastify.delete('/horas-requisito/:id', {
    schema: {
      description: 'Elimina un requisito de horas sociales',
      tags: ['Horas requisito'],
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
  }, deleteHorasRequisito);
}

export default horasRequisitoRoutes;
