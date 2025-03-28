import { getInstituciones, getInstitucionById, createInstitucion, updateInstitucion, deleteInstitucion } from '../controllers/institucionController.js';

async function institucionRoutes(fastify, options) {
  // GET /instituciones
  fastify.get('/instituciones', {
    schema: {
      description: 'Obtiene todas las instituciones',
      tags: ['Instituciones'],
      response: {
        200: {
          description: 'Lista de instituciones obtenida exitosamente',
          type: 'array',
          items: { $ref: 'Institucion#' }
        },
        500: {
          description: 'Error al obtener las instituciones',
          $ref: 'ErrorResponse#'
        }
      }
    }
  }, getInstituciones);

  // GET /instituciones/:id
  fastify.get('/instituciones/:id', {
    schema: {
      description: 'Obtiene una institución por ID',
      tags: ['Instituciones'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'ID de la institución' }
        },
        required: ['id']
      },
      response: {
        200: {
          description: 'Institución encontrada',
          $ref: 'Institucion#'
        },
        404: {
          description: 'Institución no encontrada',
          $ref: 'ErrorResponse#'
        },
        500: {
          description: 'Error al obtener la institución',
          $ref: 'ErrorResponse#'
        }
      }
    }
  }, getInstitucionById);

  // POST /instituciones
  fastify.post('/instituciones', {
    schema: {
      description: 'Crea una nueva institución',
      tags: ['Instituciones'],
      body: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'Nombre de la institución' },
          direccion: { type: 'string', description: 'Dirección de la institución' },
          telefono: { type: 'string', description: 'Teléfono de contacto' },
          email: { type: 'string', description: 'Correo electrónico' },
          fecha_fundacion: { type: 'string', format: 'date', description: 'Fecha de fundación' },
          nit: { type: 'string', description: 'Número de identificación tributaria' }
        },
        required: ['nombre']
      },
      response: {
        201: {
          description: 'Institución creada exitosamente',
          $ref: 'Institucion#'
        },
        500: {
          description: 'Error al crear la institución',
          $ref: 'ErrorResponse#'
        }
      }
    }
  }, createInstitucion);

  // PUT /instituciones/:id
  fastify.put('/instituciones/:id', {
    schema: {
      description: 'Actualiza una institución existente',
      tags: ['Instituciones'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'ID de la institución a actualizar' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'Nombre de la institución' },
          direccion: { type: 'string', description: 'Dirección de la institución' },
          telefono: { type: 'string', description: 'Teléfono de contacto' },
          email: { type: 'string', description: 'Correo electrónico' },
          fecha_fundacion: { type: 'string', format: 'date', description: 'Fecha de fundación' },
          nit: { type: 'string', description: 'Número de identificación tributaria' }
        },
        required: ['nombre']
      },
      response: {
        200: {
          description: 'Institución actualizada exitosamente',
          $ref: 'Institucion#'
        },
        404: {
          description: 'Institución no encontrada',
          $ref: 'ErrorResponse#'
        },
        500: {
          description: 'Error al actualizar la institución',
          $ref: 'ErrorResponse#'
        }
      }
    }
  }, updateInstitucion);

  // DELETE /instituciones/:id
  fastify.delete('/instituciones/:id', {
    schema: {
      description: 'Elimina una institución por ID',
      tags: ['Instituciones'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'ID de la institución a eliminar' }
        },
        required: ['id']
      },
      response: {
        204: {
          description: 'Institución eliminada exitosamente',
          type: 'null'
        },
        404: {
          description: 'Institución no encontrada',
          $ref: 'ErrorResponse#'
        },
        500: {
          description: 'Error al eliminar la institución',
          $ref: 'ErrorResponse#'
        }
      }
    }
  }, deleteInstitucion);
}

export default institucionRoutes;
