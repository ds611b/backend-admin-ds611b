// routes/usuariosRoutes.js
import {
  createUsuario,
  getUsuarios,
  getUsuarioById,
  updateUsuario,
  deleteUsuario,
  getUsuarioAllById,
  getCoordinadores,
  getEstudiantes,
  searchUsuarios
} from '../controllers/usuariosController.js';

/**
 * Rutas CRUD para el recurso **Usuarios**.
 *
 * @param {import('fastify').FastifyInstance} fastify
 */
async function usuariosRoutes (fastify) {

  /* -----------------------------------------------------------------------   
   * POST /usuarios – crear un nuevo usuario
   * ---------------------------------------------------------------------*/
  fastify.post('/usuarios', {
    schema: {
      description: 'Crea un nuevo usuario',
      tags: ['Usuarios'],
      body: { $ref: 'UsuariosCreation' },
      response: {
        201: { description: 'Usuario creado exitosamente', $ref: 'Usuarios' },
        409: { description: 'Email duplicado', $ref: 'ErrorResponse' },
        500: { description: 'Error al crear el usuario', $ref: 'ErrorResponse' }
      }
    }
  }, createUsuario);

  /* -----------------------------------------------------------------------
   * GET /usuarios – lista de usuarios
   * ---------------------------------------------------------------------*/
  fastify.get('/usuarios', {
    schema: {
      description: 'Obtiene todos los usuarios (sin exponer password_hash) con paginación',
      tags: ['Usuarios'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', description: 'Número de página', default: 1, minimum: 1 },
          limit: { type: 'number', description: 'Elementos por página', default: 10, minimum: 1, maximum: 100 }
        }
      },
      response: {
        200: {
          description: 'Lista de usuarios obtenida exitosamente',
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: { $ref: 'Usuarios' }
            },
            pagination: {
              type: 'object',
              properties: {
                totalItems: { type: 'number' },
                totalPages: { type: 'number' },
                currentPage: { type: 'number' },
                itemsPerPage: { type: 'number' }
              }
            }
          }
        },
        500: {
          description: 'Error al obtener los usuarios',
          $ref: 'ErrorResponse'
        }
      }
    }
  }, getUsuarios);

  /* -----------------------------------------------------------------------   * GET /usuarios/coordinadores – lista de usuarios coordinadores
   * ---------------------------------------------------------------------*/
  fastify.get('/usuarios/coordinadores', {
    schema: {
      description: 'Obtiene todos los usuarios con rol de coordinador con paginación',
      tags: ['Usuarios'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', description: 'Número de página', default: 1, minimum: 1 },
          limit: { type: 'number', description: 'Elementos por página', default: 10, minimum: 1, maximum: 100 }
        }
      },
      response: {
        200: {
          description: 'Lista de coordinadores obtenida exitosamente',
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: { $ref: 'Usuarios' }
            },
            pagination: {
              type: 'object',
              properties: {
                totalItems: { type: 'number' },
                totalPages: { type: 'number' },
                currentPage: { type: 'number' },
                itemsPerPage: { type: 'number' }
              }
            }
          }
        },
        500: {
          description: 'Error al obtener los coordinadores',
          $ref: 'ErrorResponse'
        }
      }
    }
  }, getCoordinadores);

  /* -----------------------------------------------------------------------   * GET /usuarios/estudiantes – lista de usuarios estudiantes
   * ---------------------------------------------------------------------*/
  fastify.get('/usuarios/estudiantes', {
    schema: {
      description: 'Obtiene todos los usuarios con rol de estudiante con paginación',
      tags: ['Usuarios'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', description: 'Número de página', default: 1, minimum: 1 },
          limit: { type: 'number', description: 'Elementos por página', default: 10, minimum: 1, maximum: 100 }
        }
      },
      response: {
        200: {
          description: 'Lista de estudiantes obtenida exitosamente',
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: { $ref: 'Usuarios' }
            },
            pagination: {
              type: 'object',
              properties: {
                totalItems: { type: 'number' },
                totalPages: { type: 'number' },
                currentPage: { type: 'number' },
                itemsPerPage: { type: 'number' }
              }
            }
          }
        },
        500: {
          description: 'Error al obtener los estudiantes',
          $ref: 'ErrorResponse'
        }
      }
    }
  }, getEstudiantes);
  /* -----------------------------------------------------------------------
   * GET /usuarios/search – buscar usuarios por nombres o email
   * ---------------------------------------------------------------------*/
  fastify.get('/usuarios/search', {
    schema: {
      description: 'Busca usuarios por coincidencias en nombres o email con paginación',
      tags: ['Usuarios'],
      querystring: {
        type: 'object',
        properties: {
          q: { 
            type: 'string', 
            description: 'Término de búsqueda para nombres o email',
            minLength: 1
          },
          page: { type: 'number', description: 'Número de página', default: 1, minimum: 1 },
          limit: { type: 'number', description: 'Elementos por página', default: 10, minimum: 1, maximum: 100 }
        },
        required: ['q']
      },
      response: {
        200: {
          description: 'Lista de usuarios que coinciden con la búsqueda',
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: { $ref: 'Usuarios' }
            },
            pagination: {
              type: 'object',
              properties: {
                totalItems: { type: 'number' },
                totalPages: { type: 'number' },
                currentPage: { type: 'number' },
                itemsPerPage: { type: 'number' }
              }
            }
          }
        },
        400: {
          description: 'Parámetro de búsqueda requerido',
          $ref: 'ErrorResponse'
        },
        500: {
          description: 'Error al buscar usuarios',
          $ref: 'ErrorResponse'
        }
      }
    }
  }, searchUsuarios);
  /* -----------------------------------------------------------------------   * GET /usuarios/:id – un usuario por ID
   * ---------------------------------------------------------------------*/
  fastify.get('/usuarios/:id', {
    schema: {
      description: 'Obtiene un usuario por su ID',
      tags: ['Usuarios'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'ID del usuario' }
        },
        required: ['id']
      },
      response: {
        200: { description: 'Usuario obtenido', $ref: 'Usuarios' },
        404: { description: 'Usuario no encontrado', $ref: 'ErrorResponse' },
        500: { description: 'Error al obtener el usuario', $ref: 'ErrorResponse' }
      }
    }
  }, getUsuarioById);

  /* -----------------------------------------------------------------------
   * PUT /usuarios/:id – actualizar (solo campos esenciales)
   * ---------------------------------------------------------------------*/
  fastify.put('/usuarios/:id', {
    schema: {
      description: 'Actualiza un usuario (solo nombres, apellidos, email y rol)',
      tags: ['Usuarios'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'ID del usuario a actualizar' }
        },
        required: ['id']
      },
      body: { $ref: 'UsuariosValidation' },
      response: {
        200: { description: 'Usuario actualizado', $ref: 'Usuarios' },
        404: { description: 'Usuario no encontrado', $ref: 'ErrorResponse' },
        409: { description: 'Email duplicado', $ref: 'ErrorResponse' },
        500: { description: 'Error al actualizar el usuario', $ref: 'ErrorResponse' }
      }
    }
  }, updateUsuario);

  /* -----------------------------------------------------------------------
   * DELETE /usuarios/:id – eliminar usuario
   * ---------------------------------------------------------------------*/
  fastify.delete('/usuarios/:id', {
    schema: {
      description: 'Elimina un usuario por su ID',
      tags: ['Usuarios'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'ID del usuario a eliminar' }
        },
        required: ['id']
      },
      response: {
        204: { description: 'Usuario eliminado exitosamente' },
        404: { description: 'Usuario no encontrado', $ref: 'ErrorResponse' },
        500: { description: 'Error al eliminar el usuario', $ref: 'ErrorResponse' }
      }
    }
  }, deleteUsuario);


    /* -----------------------------------------------------------------------
   * GET /usuarios/:id – un usuario por ID
   * ---------------------------------------------------------------------*/
  fastify.get('/usuarios/all/:id', {
    schema: {
      description: 'Obtiene toda la informacion de un usuario Perfil, Usuario, Proyectos',
      tags: ['Usuarios'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'ID del usuario' }
        },
        required: ['id']
      },
      response: {
        200: { description: 'Usuario obtenido con perfil y proyectos', $ref: 'UsuarioCompleto' },
        404: { description: 'Usuario no encontrado', $ref: 'ErrorResponse' },
        500: { description: 'Error al obtener el usuario', $ref: 'ErrorResponse' }
      }
    }
  }, getUsuarioAllById);

}

export default usuariosRoutes;
