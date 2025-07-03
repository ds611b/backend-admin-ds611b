import { PerfilUsuario } from '../models/index.js';
import { createErrorResponse } from '../utils/errorResponse.js';

/**
 * Obtiene todos los perfiles de usuario.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function getPerfilesUsuario(request, reply) {
  try {
    const perfiles = await PerfilUsuario.findAll();
    reply.send(perfiles);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener los perfiles de usuario', 
      'GET_PERFILES_USUARIO_ERROR', 
      error
    ));
  }
}

/**
 * Obtiene un perfil de usuario por ID.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function getPerfilUsuarioById(request, reply) {
  const { id } = request.params;
  try {
    const perfil = await PerfilUsuario.findByPk(id);
    if (!perfil) {
      return reply.status(404).send(createErrorResponse(
        'Perfil de usuario no encontrado', 
        'PERFIL_USUARIO_NOT_FOUND'
      ));
    }
    reply.send(perfil);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener el perfil de usuario', 
      'GET_PERFIL_USUARIO_ERROR', 
      error
    ));
  }
}

/**
 * Obtiene un perfil de usuario por ID de usuario.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function getPerfilUsuarioByUsuarioId(request, reply) {
  const { usuario_id } = request.params;
  try {
    const perfil = await PerfilUsuario.findOne({ where: { usuario_id } });
    if (!perfil) {
      return reply.status(404).send(createErrorResponse(
        'Perfil de usuario no encontrado', 
        'PERFIL_USUARIO_NOT_FOUND'
      ));
    }
    reply.send(perfil);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener el perfil de usuario', 
      'GET_PERFIL_USUARIO_ERROR', 
      error
    ));
  }
}

/**
 * Crea un nuevo perfil de usuario.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function createPerfilUsuario(request, reply) {
  const { usuario_id, direccion, fecha_nacimiento, genero, foto_perfil } = request.body;
  try {
    const nuevoPerfil = await PerfilUsuario.create({
      usuario_id,
      telefono,
      direccion,
      anio_academico,
      fecha_nacimiento: fecha_nacimiento ? new Date(fecha_nacimiento) : null,
      genero,
      foto_perfil
    });
    reply.status(201).send(nuevoPerfil);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al crear el perfil de usuario', 
      'CREATE_PERFIL_USUARIO_ERROR', 
      error
    ));
  }
}

/**
 * Actualiza un perfil de usuario existente.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function updatePerfilUsuario(request, reply) {
  const { id } = request.params;
  const { direccion, fecha_nacimiento, genero, foto_perfil } = request.body;
  try {
    const perfil = await PerfilUsuario.findByPk(id);
    if (!perfil) {
      return reply.status(404).send(createErrorResponse(
        'Perfil de usuario no encontrado', 
        'PERFIL_USUARIO_NOT_FOUND'
      ));
    }
    
    await perfil.update({
      telefono,
      direccion,
      anio_academico,
      fecha_nacimiento: fecha_nacimiento ? new Date(fecha_nacimiento) : null,
      genero,
      foto_perfil
    });
    
    reply.send(perfil);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al actualizar el perfil de usuario', 
      'UPDATE_PERFIL_USUARIO_ERROR', 
      error
    ));
  }
}

/**
 * Elimina un perfil de usuario por ID.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function deletePerfilUsuario(request, reply) {
  const { id } = request.params;
  try {
    const perfil = await PerfilUsuario.findByPk(id);
    if (!perfil) {
      return reply.status(404).send(createErrorResponse(
        'Perfil de usuario no encontrado', 
        'PERFIL_USUARIO_NOT_FOUND'
      ));
    }
    await perfil.destroy();
    reply.status(204).send();
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al eliminar el perfil de usuario', 
      'DELETE_PERFIL_USUARIO_ERROR', 
      error
    ));
  }
}