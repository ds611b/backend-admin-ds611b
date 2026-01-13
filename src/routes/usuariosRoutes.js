// routes/usuariosRoutes.js
import {
  createUsuario,
  getUsuarios,
  getUsuarioById,
  updateUsuario,
  deleteUsuario
} from '../controllers/usuariosController.js';

/**
 * Rutas CRUD para el recurso **Usuarios**.
 *
 * @param {import('fastify').FastifyInstance} fastify
 */
async function usuariosRoutes (fastify) {

  /* -----------------------------------------------------------------------   * POST /usuarios – crear un nuevo usuario
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

  /* -----------------------------------------------------------------------   * GET /usuarios – lista de usuarios
   * ---------------------------------------------------------------------*/
  fastify.get('/usuarios', {
    schema: {
      description: 'Obtiene todos los usuarios (sin exponer password_hash)',
      tags: ['Usuarios'],
      response: {
        200: {
          description: 'Lista de usuarios obtenida exitosamente',
          type: 'array',
          items: { $ref: 'Usuarios' }
        },
        500: {
          description: 'Error al obtener los usuarios',
          $ref: 'ErrorResponse'
        }
      }
    }
  }, getUsuarios);

  /* -----------------------------------------------------------------------
   * GET /usuarios/:id – un usuario por ID
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
}

export default usuariosRoutes;
