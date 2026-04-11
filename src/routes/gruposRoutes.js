import {
  getGrupos,
  getGrupoById,
  createGrupo,
  updateGrupo,
  deleteGrupo
} from '../controllers/gruposController.js';

async function gruposRoutes(fastify) {

  // GET ALL
  fastify.get('/grupos', {
    schema: {
      description: 'Obtiene todos los grupos',
      tags: ['Grupos'],
      response: {
        200: {
          type: 'array',
          items: { $ref: 'Grupos' }
        },
        500: { $ref: 'ErrorResponse' }
      }
    }
  }, getGrupos);

  // GET BY ID
  fastify.get('/grupos/:id', {
    schema: {
      description: 'Obtiene un grupo por ID',
      tags: ['Grupos'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'number' }
        },
        required: ['id']
      },
      response: {
        200: { $ref: 'Grupos' },
        404: { $ref: 'ErrorResponse' },
        500: { $ref: 'ErrorResponse' }
      }
    }
  }, getGrupoById);

  // POST
  fastify.post('/grupos', {
    schema: {
      description: 'Crea un nuevo grupo',
      tags: ['Grupos'],
      body: { $ref: 'GruposValidation' },
      response: {
        201: { $ref: 'Grupos' },
        500: { $ref: 'ErrorResponse' }
      }
    }
  }, createGrupo);

  // PUT
  fastify.put('/grupos/:id', {
    schema: {
      description: 'Actualiza un grupo',
      tags: ['Grupos'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'number' }
        },
        required: ['id']
      },
      body: { $ref: 'GruposValidation' },
      response: {
        200: { $ref: 'Grupos' },
        404: { $ref: 'ErrorResponse' },
        500: { $ref: 'ErrorResponse' }
      }
    }
  }, updateGrupo);

  // DELETE
  fastify.delete('/grupos/:id', {
    schema: {
      description: 'Elimina un grupo',
      tags: ['Grupos'],
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
  }, deleteGrupo);
}

export default gruposRoutes;