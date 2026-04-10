import {
  getGrupoEstudiantes,
  createGrupoEstudiante,
  deleteGrupoEstudiante
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
}

export default grupoEstudiantesRoutes;