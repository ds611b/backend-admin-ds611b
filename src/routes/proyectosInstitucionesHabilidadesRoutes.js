import {
  getProyectosInstitucionesHabilidades,
  getProyectosInstitucionesHabilidadById,
  createProyectosInstitucionesHabilidad,
  updateProyectosInstitucionesHabilidad,
  deleteProyectosInstitucionesHabilidad
} from '../controllers/proyectosInstitucionesHabilidadesController.js';

/**
 * Define las rutas para gestionar las relaciones entre proyectos, instituciones y habilidades.
 *
 * @param {import('fastify').FastifyInstance} fastify 
 */
async function proyectosInstitucionesHabilidadesRoutes(fastify) {

  /**
   * GET /proyectos-instituciones-habilidades
   * Obtiene todas las relaciones registradas.
   */
  fastify.get('/proyectos-instituciones-habilidades', {
    schema: {
      description: 'Obtiene todas las relaciones de habilidades para proyectos de instituciones',
      tags: ['Proyectos Instituciones Habilidades'],
      response: {
        200: {
          description: 'Lista de relaciones obtenida exitosamente',
          type: 'array',
          items: { $ref: 'ProyectosInstitucionesHabilidades' }
        },
        500: {
          description: 'Error al obtener las relaciones',
          $ref: 'ErrorResponse'
        }
      }
    }
  }, getProyectosInstitucionesHabilidades);

  /**
   * GET /proyectos-instituciones-habilidades/:id
   * Obtiene una relación específica por su ID.
   */
  fastify.get('/proyectos-instituciones-habilidades/:id', {
    schema: {
      description: 'Obtiene una relación de habilidad por ID',
      tags: ['Proyectos Instituciones Habilidades'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'ID de la relación' }
        },
        required: ['id']
      },
      response: {
        200: {
          description: 'Relación obtenida exitosamente',
          $ref: 'ProyectosInstitucionesHabilidades'
        },
        404: {
          description: 'Relación no encontrada',
          $ref: 'ErrorResponse'
        },
        500: {
          description: 'Error al obtener la relación',
          $ref: 'ErrorResponse'
        }
      }
    }
  }, getProyectosInstitucionesHabilidadById);

  /**
   * POST /proyectos-instituciones-habilidades
   * Crea una nueva relación.
   */
  fastify.post('/proyectos-instituciones-habilidades', {
    schema: {
      description: 'Crea una nueva relación de habilidad para un proyecto de institución',
      tags: ['Proyectos Instituciones Habilidades'],
      body: { $ref: 'ProyectosInstitucionesHabilidadesValidation' },
      response: {
        201: {
          description: 'Relación creada exitosamente',
          $ref: 'ProyectosInstitucionesHabilidades'
        },
        409: {
          description: 'Conflicto - Combinación duplicada',
          $ref: 'ErrorResponse'
        },
        500: {
          description: 'Error al crear la relación',
          $ref: 'ErrorResponse'
        }
      }
    }
  }, createProyectosInstitucionesHabilidad);

  /**
   * PUT /proyectos-instituciones-habilidades/:id
   * Actualiza una relación existente.
   */
  fastify.put('/proyectos-instituciones-habilidades/:id', {
    schema: {
      description: 'Actualiza una relación de habilidad por ID',
      tags: ['Proyectos Instituciones Habilidades'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'ID de la relación a actualizar' }
        },
        required: ['id']
      },
      body: { $ref: 'ProyectosInstitucionesHabilidadesValidation' },
      response: {
        200: {
          description: 'Relación actualizada exitosamente',
          $ref: 'ProyectosInstitucionesHabilidades'
        },
        404: {
          description: 'Relación no encontrada',
          $ref: 'ErrorResponse'
        },
        409: {
          description: 'Conflicto - Combinación duplicada',
          $ref: 'ErrorResponse'
        },
        500: {
          description: 'Error al actualizar la relación',
          $ref: 'ErrorResponse'
        }
      }
    }
  }, updateProyectosInstitucionesHabilidad);

  /**
   * DELETE /proyectos-instituciones-habilidades/:id
   * Elimina una relación existente por ID.
   */
  fastify.delete('/proyectos-instituciones-habilidades/:id', {
    schema: {
      description: 'Elimina una relación de habilidad por ID',
      tags: ['Proyectos Instituciones Habilidades'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'ID de la relación a eliminar' }
        },
        required: ['id']
      },
      response: {
        204: {
          description: 'Proyecto institución habilidad eliminado exitosamente.',
          type: 'null'
        },
        404: {
          description: 'Relación no encontrada',
          $ref: 'ErrorResponse'
        },
        500: {
          description: 'Error al eliminar la relación',
          $ref: 'ErrorResponse'
        }
      }
    }
  }, deleteProyectosInstitucionesHabilidad);
}

export default proyectosInstitucionesHabilidadesRoutes;
