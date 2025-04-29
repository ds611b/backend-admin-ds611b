import {
  getUsuariosHabilidades,
  getUsuariosHabilidadById,
  createUsuariosHabilidad,
  updateUsuariosHabilidad,
  deleteUsuariosHabilidad
} from '../controllers/usuariosHabilidadesController.js';

async function usuariosHabilidadesRoutes(fastify) {
  // GET: Obtener todas las asignaciones
  fastify.get('/usuarios-habilidades', {
    schema: {
      description: 'Obtiene todas las asignaciones de habilidades a usuarios',
      tags: ['Usuarios Habilidades'],
      response: {
        200: {
          description: 'Lista de asignaciones obtenida exitosamente',
          type: 'array',
          items: { $ref: 'UsuariosHabilidades' }
        },
        500: {
          description: 'Error al obtener las asignaciones',
          $ref: 'ErrorResponse'
        }
      }
    }
  }, getUsuariosHabilidades);

  // GET: Obtener una asignación por ID
  fastify.get('/usuarios-habilidades/:id', {
    schema: {
      description: 'Obtiene una asignación de habilidad a usuario por ID',
      tags: ['Usuarios Habilidades'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'ID de la asignación' }
        },
        required: ['id']
      },
      response: {
        200: {
          description: 'Asignación obtenida exitosamente',
          $ref: 'UsuariosHabilidades'
        },
        404: {
          description: 'Asignación no encontrada',
          $ref: 'ErrorResponse'
        },
        500: {
          description: 'Error al obtener la asignación',
          $ref: 'ErrorResponse'
        }
      }
    }
  }, getUsuariosHabilidadById);

  // POST: Crear una nueva asignación
  fastify.post('/usuarios-habilidades', {
    schema: {
      description: 'Crea una nueva asignación de habilidad a usuario',
      tags: ['Usuarios Habilidades'],
      body: { $ref: 'UsuariosHabilidadesValidation' },
      response: {
        201: {
          description: 'Asignación creada exitosamente',
          $ref: 'UsuariosHabilidades'
        },
        409: {
          description: 'Conflicto - Combinación duplicada',
          $ref: 'ErrorResponse'
        },
        500: {
          description: 'Error al crear la asignación',
          $ref: 'ErrorResponse'
        }
      }
    }
  }, createUsuariosHabilidad);

  // PUT: Actualizar una asignación existente
  fastify.put('/usuarios-habilidades/:id', {
    schema: {
      description: 'Actualiza una asignación de habilidad a usuario por ID',
      tags: ['Usuarios Habilidades'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'ID de la asignación a actualizar' }
        },
        required: ['id']
      },
      body: { $ref: 'UsuariosHabilidadesValidation' },
      response: {
        200: {
          description: 'Asignación actualizada exitosamente',
          $ref: 'UsuariosHabilidades'
        },
        404: {
          description: 'Asignación no encontrada',
          $ref: 'ErrorResponse'
        },
        409: {
          description: 'Conflicto - Combinación duplicada',
          $ref: 'ErrorResponse'
        },
        500: {
          description: 'Error al actualizar la asignación',
          $ref: 'ErrorResponse'
        }
      }
    }
  }, updateUsuariosHabilidad);

  // DELETE: Eliminar una asignación
  fastify.delete('/usuarios-habilidades/:id', {
    schema: {
      description: 'Elimina una asignación de habilidad a usuario por ID',
      tags: ['Usuarios Habilidades'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'ID de la asignación a eliminar' }
        },
        required: ['id']
      },
      response: {
        204: {
          description: 'Asignación eliminada exitosamente'
        },
        404: {
          description: 'Asignación no encontrada',
          $ref: 'ErrorResponse'
        },
        500: {
          description: 'Error al eliminar la asignación',
          $ref: 'ErrorResponse'
        }
      }
    }
  }, deleteUsuariosHabilidad);
}

export default usuariosHabilidadesRoutes;
