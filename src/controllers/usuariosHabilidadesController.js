import { UsuariosHabilidades } from '../models/index.js'
import { createErrorResponse } from '../utils/errorResponse.js';

// GET: Obtener todas las asignaciones de habilidades a usuarios
export async function getUsuariosHabilidades(request, reply) {
  try {
    const registros = await UsuariosHabilidades.findAll();
    reply.send(registros);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener las asignaciones de habilidades a usuarios',
      'GET_USUARIOS_HABILIDADES_ERROR',
      error
    ));
  }
}

// GET by ID: Obtener una asignación por ID
export async function getUsuariosHabilidadById(request, reply) {
  const { id } = request.params;
  try {
    const registro = await UsuariosHabilidades.findByPk(id);
    if (registro) {
      reply.send(registro);
    } else {
      reply.status(404).send(createErrorResponse(
        'Asignación no encontrada',
        'USUARIOS_HABILIDADES_NOT_FOUND'
      ));
    }
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener la asignación',
      'ERR_GET_USUARIOS_HABILIDAD',
      error
    ));
  }
}

// POST: Crear una nueva asignación de habilidad a usuario
export async function createUsuariosHabilidad(request, reply) {
  try {
    const registro = await UsuariosHabilidades.create(request.body);
    reply.status(201).send(registro);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      reply.status(409).send(
        createErrorResponse(
          "Ya existe una asignación para este usuario y habilidad",
          "DUPLICATE_USUARIO_HABILIDAD",
          error
        )
      );
    } else {
      request.log.error(error);
      reply.status(500).send(
        createErrorResponse(
          "Error al crear la asignación",
          "CREATE_USUARIOS_HABILIDAD_ERROR",
          error
        )
      );
    }
  }
}

// PUT: Actualizar una asignación de habilidad a usuario existente
export async function updateUsuariosHabilidad(request, reply) {
  const { id } = request.params;
  try {
    const [updated] = await UsuariosHabilidades.update(request.body, {
      where: { id },
      validate: true
    });
    if (updated) {
      const registro = await UsuariosHabilidades.findByPk(id);
      reply.send(registro);
    } else {
      reply.status(404).send(createErrorResponse(
        'Asignación no encontrada',
        'USUARIOS_HABILIDADES_NOT_FOUND_ERROR'
      ));
    }
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      reply.status(409).send(
        createErrorResponse(
          "Ya existe una asignación para este usuario y habilidad",
          "DUPLICATE_USUARIO_HABILIDAD",
          error
        )
      );
    } else {
      request.log.error(error);
      reply.status(500).send(
        createErrorResponse(
          "Error al actualizar la asignación",
          "UPDATE_USUARIOS_HABILIDAD_ERROR",
          error
        )
      );
    }
  }
}

// DELETE: Eliminar una asignación de habilidad a usuario
export async function deleteUsuariosHabilidad(request, reply) {
  const { id } = request.params;
  try {
    const deleted = await UsuariosHabilidades.destroy({ where: { id } });
    if (deleted) {
      reply.code(204).send();
    } else {
      reply.status(404).send(createErrorResponse(
        'Asignación no encontrada',
        'USUARIOS_HABILIDADES_NOT_FOUND_ERROR'
      ));
    }
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al eliminar la asignación',
      'DELETE_USUARIOS_HABILIDAD_ERROR',
      error
    ));
  }
}
