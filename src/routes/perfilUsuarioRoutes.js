import {
  getPerfilesUsuario,
  getPerfilUsuarioById,
  getPerfilUsuarioByUsuarioId,
  getPerfilesUsuarioByGenero,
  createPerfilUsuario,
  updatePerfilUsuario,
  deletePerfilUsuario,
  updateUsuarioConPerfil
} from '../controllers/perfilUsuarioController.js';

/**
 * Define las rutas para los perfiles de usuario.
 * @param {import('fastify').FastifyInstance} fastify - La instancia de Fastify.
 * @param {Object} options - Opciones de registro.
 */
async function perfilUsuarioRoutes(fastify, options) {
  // Obtener todos los perfiles de usuario
  fastify.get('/perfiles-usuario', {
    schema: {
      description: 'Obtiene una lista de todos los perfiles de usuario disponibles.',
      tags: ['Perfiles de Usuario'],
      response: {
        200: {
          description: 'Lista de perfiles de usuario obtenida exitosamente.',
          type: 'array',
          items: { $ref: 'PerfilUsuario' },
        },
        500: {
          description: 'Error al obtener los perfiles de usuario.',
          $ref: 'ErrorResponse',
        },
      },
    },
  }, getPerfilesUsuario);

  // Obtener un perfil de usuario por ID
  fastify.get('/perfiles-usuario/:id', {
    schema: {
      description: 'Obtiene un perfil de usuario específico basado en su ID.',
      tags: ['Perfiles de Usuario'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'integer', description: 'ID único del perfil de usuario.' },
        },
        required: ['id'],
      },
      response: {
        200: {
          description: 'Detalles del perfil de usuario obtenidos exitosamente.',
          $ref: 'PerfilUsuario',
        },
        404: {
          description: 'Perfil de usuario no encontrado.',
          $ref: 'ErrorResponse',
        },
        500: {
          description: 'Error al obtener el perfil de usuario.',
          $ref: 'ErrorResponse',
        },
      },
    },
  }, getPerfilUsuarioById);

  // Obtener un perfil de usuario por ID de usuario
  fastify.get('/perfiles-usuario/usuario/:usuario_id', {
    schema: {
      description: 'Obtiene un perfil de usuario específico basado en el ID de usuario.',
      tags: ['Perfiles de Usuario'],
      params: {
        type: 'object',
        properties: {
          usuario_id: { type: 'integer', description: 'ID único del usuario asociado al perfil.' },
        },
        required: ['usuario_id'],
      },
      response: {
        200: {
          description: 'Detalles del perfil de usuario obtenidos exitosamente.',
          $ref: 'PerfilUsuario',
        },
        404: {
          description: 'Perfil de usuario no encontrado.',
          $ref: 'ErrorResponse',
        },
        500: {
          description: 'Error al obtener el perfil de usuario.',
          $ref: 'ErrorResponse',
        },
      },
    },
  }, getPerfilUsuarioByUsuarioId);

  // Crear un nuevo perfil de usuario
  fastify.post('/perfiles-usuario', {
    schema: {
      description: 'Crea un nuevo perfil de usuario en el sistema.',
      tags: ['Perfiles de Usuario'],
      body: {
        $ref: 'PerfilUsuarioValidation',
      },
      response: {
        201: {
          description: 'Perfil de usuario creado exitosamente.',
          $ref: 'PerfilUsuario',
        },
        400: {
          description: 'Datos de entrada no validos.',
          $ref: 'ErrorResponse',
        },
        500: {
          description: 'Error al crear el perfil de usuario.',
          $ref: 'ErrorResponse',
        },
      },
    },
  }, createPerfilUsuario);

  // Actualizar un perfil de usuario existente
  fastify.put('/perfiles-usuario/:id', {
    schema: {
      description: 'Actualiza los detalles de un perfil de usuario existente.',
      tags: ['Perfiles de Usuario'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'integer', description: 'ID único del perfil de usuario.' },
        },
        required: ['id'],
      },
      body: {
        $ref: 'PerfilUsuarioValidation',
      },
      response: {
        200: {
          description: 'Perfil de usuario actualizado exitosamente.',
          $ref: 'PerfilUsuario',
        },
        404: {
          description: 'Perfil de usuario no encontrado.',
          $ref: 'ErrorResponse',
        },
        500: {
          description: 'Error al actualizar el perfil de usuario.',
          $ref: 'ErrorResponse',
        },
      },
    },
  }, updatePerfilUsuario);

  // Eliminar un perfil de usuario
  fastify.delete('/perfiles-usuario/:id', {
    schema: {
      description: 'Elimina un perfil de usuario basado en su ID.',
      tags: ['Perfiles de Usuario'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'integer', description: 'ID único del perfil de usuario.' },
        },
        required: ['id'],
      },
      response: {
        204: {
          description: 'Perfil de usuario eliminado exitosamente.',
          type: 'null',
        },
        404: {
          description: 'Perfil de usuario no encontrado.',
          $ref: 'ErrorResponse',
        },
        500: {
          description: 'Error al eliminar el perfil de usuario.',
          $ref: 'ErrorResponse',
        },
      },
    },
  }, deletePerfilUsuario);

  // Filtrar perfiles por género
  fastify.get('/perfiles-usuario/genero/:genero', {
    schema: {
      description: 'Obtiene perfiles de usuario filtrados por género.',
      tags: ['Perfiles de Usuario'],
      params: {
        type: 'object',
        properties: {
          genero: {
            type: 'string',
            description: 'Género del usuario (Masculino, Femenino, Otro)',
            enum: ['Masculino', 'Femenino', 'Otro']
          }
        },
        required: ['genero']
      },
      response: {
        200: {
          description: 'Perfiles filtrados obtenidos exitosamente',
          type: 'array',
          items: { $ref: 'PerfilUsuario' }
        },
        404: {
          $ref: 'ErrorResponse',
          description: 'No se encontraron perfiles con el género especificado'
        },
        500: {
          $ref: 'ErrorResponse',
          description: 'Error al filtrar perfiles'
        }
      }
    }
  }, getPerfilesUsuarioByGenero);

  /* -----------------------------------------------------------------------
   * PUT /usuarios/:id/perfil-completo – actualizar usuario y perfil en conjunto
   * ---------------------------------------------------------------------*/
  fastify.put('/usuarios/:id/perfil-completo', {
    schema: {
      description: 'Actualiza de forma conjunta los datos del usuario y su perfil asociado',
      tags: ['Perfiles de Usuario'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'integer', description: 'ID del usuario' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        properties: {
          primer_nombre: { type: 'string', maxLength: 100 },
          segundo_nombre: { type: 'string', maxLength: 100 },
          primer_apellido: { type: 'string', maxLength: 100 },
          segundo_apellido: { type: 'string', maxLength: 100 },
          email: { type: 'string', format: 'email' },
          direccion: { type: 'string' },
          telefono: { type: 'string', maxLength: 20 },
          fecha_nacimiento: { type: 'string', format: 'date' },
          genero: { type: 'string', enum: ['Masculino', 'Femenino', 'Otro'] },
          carnet: { type: 'string', maxLength: 7 },
          anio_academico: { type: 'string', maxLength: 25 },
          id_carrera: { type: 'integer' }
        }
      },
      response: {
        200: { description: 'Usuario y perfil actualizados exitosamente', type: 'object' },
        400: { description: 'Carnet requerido o carrera no encontrada', $ref: 'ErrorResponse' },
        404: { description: 'Usuario no encontrado', $ref: 'ErrorResponse' },
        409: { description: 'Email o carnet duplicado', $ref: 'ErrorResponse' },
        500: { description: 'Error al actualizar', $ref: 'ErrorResponse' }
      }
    }
  }, updateUsuarioConPerfil);
}

export default perfilUsuarioRoutes;