import {
  getGrupoEstudiantes,
  getGrupoEstudianteById,
  createGrupoEstudiante,
  deleteGrupoEstudiante,
  cambiarCarreraEstudiante
} from '../controllers/grupoEstudiantesController.js';

async function grupoEstudiantesRoutes(fastify) {

  // GET ALL
  fastify.get('/grupo-estudiantes', {
    schema: {
      description: 'Obtiene las asignaciones de estudiantes a grupos',
      tags: ['Grupo Estudiantes'],
      response: {
        200: {
          type: 'array',
          items: { $ref: 'GrupoEstudiante' }
        },
        500: { $ref: 'ErrorResponse' }
      }
    }
  }, getGrupoEstudiantes);

  // GET BY ID
  fastify.get('/grupo-estudiantes/:id', {
    schema: {
      description: 'Obtiene una asignación de estudiante a grupo por ID',
      tags: ['Grupo Estudiantes'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'number' }
        },
        required: ['id']
      },
      response: {
        200: { $ref: 'GrupoEstudiante' },
        404: { $ref: 'ErrorResponse' },
        500: { $ref: 'ErrorResponse' }
      }
    }
  }, getGrupoEstudianteById);

  // POST
  fastify.post('/grupo-estudiantes', {
    schema: {
      description: 'Asigna un estudiante a un grupo',
      tags: ['Grupo Estudiantes'],
      body: { $ref: 'GrupoEstudianteValidation' },
      response: {
        201: { $ref: 'GrupoEstudiante' },
        400: { $ref: 'ErrorResponse' },
        500: { $ref: 'ErrorResponse' }
      }
    }
  }, createGrupoEstudiante);

  // DELETE
  fastify.delete('/grupo-estudiantes/:id', {
    schema: {
      description: 'Elimina la asignación de un estudiante a un grupo',
      tags: ['Grupo Estudiantes'],
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
  }, deleteGrupoEstudiante);

  // PUT - Cambiar carrera y grupo del estudiante
  fastify.put('/grupo-estudiantes/:id/cambiar-carrera', {
    schema: {
      description: 'Actualiza la carrera del estudiante y lo reasigna automáticamente al grupo asociado a esa carrera',
      tags: ['Grupo Estudiantes'],
      params: {
        type: 'object',
        properties: {
          id: {
            type: 'number',
            description: 'ID del estudiante'
          }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        properties: {
          id_carrera: {
            type: 'number',
            description: 'ID de la nueva carrera'
          }
        },
        required: ['id_carrera']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { $ref: 'GrupoEstudiante' }
          }
        },
        400: { $ref: 'ErrorResponse' },
        404: { $ref: 'ErrorResponse' },
        500: { $ref: 'ErrorResponse' }
      }
    }
  }, cambiarCarreraEstudiante);

}

export default grupoEstudiantesRoutes;