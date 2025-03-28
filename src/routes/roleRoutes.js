import { getRoles, getRoleById, createRole, updateRole, deleteRole } from '../controllers/roleController.js';

async function roleRoutes(fastify, options) {
  // Obtener todos los roles
  fastify.get('/roles', {
    schema: {
      description: 'Obtiene una lista de todos los roles disponibles.',
      tags: ['Roles'],
      response: {
        200: {
          description: 'Lista de roles obtenida exitosamente.',
          type: 'array',
          items: { $ref: 'Role#' },
        },
        500: {
          description: 'Error al obtener los roles.',
          $ref: 'ErrorResponse#',
        },
      },
    },
  }, getRoles);

  // Obtener un rol por ID
  fastify.get('/roles/:id', {
    schema: {
      description: 'Obtiene un rol específico basado en su ID.',
      tags: ['Roles'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'integer', description: 'ID único del rol.' },
        },
        required: ['id'],
      },
      response: {
        200: {
          description: 'Detalles del rol obtenidos exitosamente.',
          $ref: 'Role#',
        },
        404: {
          description: 'Rol no encontrado.',
          $ref: 'ErrorResponse#',
        },
        500: {
          description: 'Error al obtener el rol.',
          $ref: 'ErrorResponse#',
        },
      },
    },
  }, getRoleById);

  // Crear un nuevo rol
  fastify.post('/roles', {
    schema: {
      description: 'Crea un nuevo rol en el sistema.',
      tags: ['Roles'],
      body: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'Nombre del rol.' },
          descripcion: { type: 'string', description: 'Descripción del rol.' },
        },
        required: ['nombre'],
      },
      response: {
        201: {
          description: 'Rol creado exitosamente.',
          $ref: 'Role#',
        },
        500: {
          description: 'Error al crear el rol.',
          $ref: 'ErrorResponse#',
        },
      },
    },
  }, createRole);

  // Actualizar un rol existente
  fastify.put('/roles/:id', {
    schema: {
      description: 'Actualiza los detalles de un rol existente.',
      tags: ['Roles'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'integer', description: 'ID único del rol.' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'Nombre del rol.' },
          descripcion: { type: 'string', description: 'Descripción del rol.' },
        },
        required: ['nombre'],
      },
      response: {
        200: {
          description: 'Rol actualizado exitosamente.',
          $ref: 'Role#',
        },
        404: {
          description: 'Rol no encontrado.',
          $ref: 'ErrorResponse#',
        },
        500: {
          description: 'Error al actualizar el rol.',
          $ref: 'ErrorResponse#',
        },
      },
    },
  }, updateRole);

  // Eliminar un rol
  fastify.delete('/roles/:id', {
    schema: {
      description: 'Elimina un rol basado en su ID.',
      tags: ['Roles'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'integer', description: 'ID único del rol.' },
        },
        required: ['id'],
      },
      response: {
        204: {
          description: 'Rol eliminado exitosamente.',
          type: 'null',
        },
        404: {
          description: 'Rol no encontrado.',
          $ref: 'ErrorResponse#',
        },
        500: {
          description: 'Error al eliminar el rol.',
          $ref: 'ErrorResponse#',
        },
      },
    },
  }, deleteRole);
}

export default roleRoutes;
