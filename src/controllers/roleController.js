import Role from '../models/Role.js';
import { createErrorResponse } from '../utils/errorResponse.js';

// Obtener todos los roles
export async function getRoles(request, reply) {
  try {
    const roles = await Role.findAll();
    reply.send(roles);
  } catch (error) {
    reply.status(500).send(createErrorResponse('Error al obtener los roles', 'GET_ROLES_ERROR', error));
  }
}

// Obtener un rol por ID
export async function getRoleById(request, reply) {
  const { id } = request.params;
  try {
    const role = await Role.findByPk(id);
    if (role) {
      reply.send(role);
    } else {
      reply.status(404).send(createErrorResponse('Rol no encontrado', 'ROLE_NOT_FOUND'));
    }
  } catch (error) {
    reply.status(500).send(createErrorResponse('Error al obtener el rol', 'GET_ROLE_ERROR', error));
  }
}

// Crear un nuevo rol
export async function createRole(request, reply) {
  const { nombre, descripcion } = request.body;
  try {
    const newRole = await Role.create({ nombre, descripcion });
    reply.status(201).send(newRole);
  } catch (error) {
    reply.status(500).send(createErrorResponse('Error al crear el rol', 'CREATE_ROLE_ERROR', error));
  }
}

// Actualizar un rol existente
export async function updateRole(request, reply) {
  const { id } = request.params;
  const { nombre, descripcion } = request.body;
  try {
    const role = await Role.findByPk(id);
    if (role) {
      role.nombre = nombre;
      role.descripcion = descripcion;
      await role.save();
      reply.send(role);
    } else {
      reply.status(404).send(createErrorResponse('Rol no encontrado', 'ROLE_NOT_FOUND'));
    }
  } catch (error) {
    reply.status(500).send(createErrorResponse('Error al actualizar el rol', 'UPDATE_ROLE_ERROR', error));
  }
}

// Eliminar un rol
export async function deleteRole(request, reply) {
  const { id } = request.params;
  try {
    const role = await Role.findByPk(id);
    if (role) {
      await role.destroy();
      reply.status(204).send();
    } else {
      reply.status(404).send(createErrorResponse('Rol no encontrado', 'ROLE_NOT_FOUND'));
    }
  } catch (error) {
    reply.status(500).send(createErrorResponse('Error al eliminar el rol', 'DELETE_ROLE_ERROR', error));
  }
}
