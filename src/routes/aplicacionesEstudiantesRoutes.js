import {
  getAplicacionesEstudiantes,
  getAplicacionEstudianteById,
  createAplicacionEstudiante,
  updateAplicacionEstudiante,
  deleteAplicacionEstudiante
} from '../controllers/aplicacionesEstudiantesController.js';

async function aplicacionesEstudiantesRoutes(fastify) {
  // GET: Obtener todas las aplicaciones
  fastify.get('/aplicaciones-estudiantes', {
    schema: {
      description: 'Obtiene todas las aplicaciones de estudiantes',
      tags: ['Aplicaciones Estudiantes'],
      response: {
        200: {
          description: 'Lista de aplicaciones obtenida exitosamente',
          type: 'array',
          items: { $ref: 'AplicacionesEstudiantes' }
        },
        500: {
          description: 'Error al obtener las aplicaciones',
          $ref: 'ErrorResponse#'
        }
      }
    }
  }, getAplicacionesEstudiantes);

  // GET: Obtener una aplicación por ID
  fastify.get('/aplicaciones-estudiantes/:id', {
    schema: {
      description: 'Obtiene una aplicación de estudiante por ID',
      tags: ['Aplicaciones Estudiantes'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'ID de la aplicación a obtener' }
        },
        required: ['id']
      },
      response: {
        200: {
          description: 'Aplicación obtenida exitosamente',
          $ref: 'AplicacionesEstudiantesID'
        },
        404: {
          description: 'Aplicación no encontrada',
          $ref: 'ErrorResponseValidation'
        },
        500: {
          description: 'Error al obtener la aplicación',
          $ref: 'ErrorResponseValidation'
        }
      }
    }
  }, getAplicacionEstudianteById);

  // POST: Crear una nueva aplicación
  fastify.post('/aplicaciones-estudiantes', {
    schema: {
      description: 'Crea una nueva aplicación de estudiante',
      tags: ['Aplicaciones Estudiantes'],
      body: { $ref: 'AplicacionesEstudiantesValidation' },
      response: {
        201: {
          description: 'Aplicación creada exitosamente',
          $ref: 'AplicacionesEstudiantes'
        },
        500: {
          description: 'Error al crear la aplicación',
          $ref: 'ErrorResponseValidation'
        }
      }
    }
  }, createAplicacionEstudiante);

  // PUT: Actualizar una aplicación existente
  fastify.put('/aplicaciones-estudiantes/:id', {
    schema: {
      description: 'Actualiza una aplicación de estudiante por ID',
      tags: ['Aplicaciones Estudiantes'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'ID de la aplicación a actualizar' }
        },
        required: ['id']
      },
      body: { $ref: 'AplicacionesEstudiantesValidation' },
      response: {
        200: {
          description: 'Aplicación actualizada exitosamente',
          $ref: 'AplicacionesEstudiantes'
        },
        404: {
          description: 'Aplicación no encontrada',
          $ref: 'ErrorResponseValidation'
        },
        500: {
          description: 'Error al actualizar la aplicación',
          $ref: 'ErrorResponseValidation'
        }
      }
    }
  }, updateAplicacionEstudiante);

  // DELETE: Eliminar una aplicación
  fastify.delete('/aplicaciones-estudiantes/:id', {
    schema: {
      description: 'Elimina una aplicación de estudiante por ID',
      tags: ['Aplicaciones Estudiantes'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'ID de la aplicación a eliminar' }
        },
        required: ['id']
      },
      response: {
        200: {
          description: 'Aplicación eliminada exitosamente',
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        },
        404: {
          description: 'Aplicación no encontrada',
          $ref: 'ErrorResponse#'
        },
        500: {
          description: 'Error al eliminar la aplicación',
          $ref: 'ErrorResponse#'
        }
      }
    }
  }, deleteAplicacionEstudiante);
}

export default aplicacionesEstudiantesRoutes;
