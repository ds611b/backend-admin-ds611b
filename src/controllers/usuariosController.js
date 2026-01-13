import { Usuarios } from '../models/index.js';
import { createErrorResponse } from '../utils/errorResponse.js';

/* ---------------------------------------------------------------------------
 * POST /api/usuarios
 * -------------------------------------------------------------------------*/
export async function createUsuario(request, reply) {
  const {
    primer_nombre,
    segundo_nombre,
    primer_apellido,
    segundo_apellido,
    email,
    password_hash,
    rol_id,
    status = 1
  } = request.body;

  try {
    // Verificar que el email no esté duplicado
    const duplicado = await Usuarios.findOne({
      where: { email }
    });
    if (duplicado) {
      return reply.status(409).send(createErrorResponse(
        'El email ya está registrado',
        'EMAIL_DUPLICATED'
      ));
    }

    const nuevoUsuario = await Usuarios.create({
      primer_nombre,
      segundo_nombre,
      primer_apellido,
      segundo_apellido,
      email,
      password_hash,
      rol_id,
      status
    });

    // Retornar sin el password_hash
    const usuarioCreado = await Usuarios.findByPk(nuevoUsuario.id, {
      attributes: { exclude: ['password_hash'] }
    });

    reply.code(201).send(usuarioCreado);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al crear el usuario',
      'CREATE_USUARIO_ERROR',
      error
    ));
  }
}

/* ---------------------------------------------------------------------------
 * GET /api/usuarios
 * -------------------------------------------------------------------------*/
export async function getUsuarios(request, reply) {
  try {
    const usuarios = await Usuarios.findAll({
      where: { status: 1 },
      attributes: { exclude: ['password_hash'] }
    });
    reply.send(usuarios);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener los usuarios',
      'GET_USUARIOS_ERROR',
      error
    ));
  }
}

/* ---------------------------------------------------------------------------
 * GET /api/usuarios/:id
 * -------------------------------------------------------------------------*/
export async function getUsuarioById(request, reply) {
  const { id } = request.params;

  try {
    const usuario = await Usuarios.findByPk(id, {
      where: { status: 1 },
      attributes: { exclude: ['password_hash'] }
    });

    if (usuario) {
      reply.send(usuario);
    } else {
      reply.status(404).send(createErrorResponse(
        'Usuario no encontrado',
        'USUARIO_NOT_FOUND'
      ));
    }
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener el usuario',
      'GET_USUARIO_ERROR',
      error
    ));
  }
}

/* ---------------------------------------------------------------------------
 * PUT /api/usuarios/:id
 * -------------------------------------------------------------------------*/
export async function updateUsuario(request, reply) {
  const { id } = request.params;
  const {
    primer_nombre,
    segundo_nombre,
    primer_apellido,
    segundo_apellido,
    email,
    rol_id,
    status
  } = request.body;

  try {
    // Verificar que el usuario exista y esté activo
    const usuario = await Usuarios.findByPk(id);
    if (!usuario || usuario.status === 0) {
      return reply.status(404).send(createErrorResponse(
        'Usuario no encontrado',
        'USUARIO_NOT_FOUND'
      ));
    }

    // Si cambia el email, comprobar que no esté en uso por otro usuario
    if (email && email !== usuario.email) {
      const duplicado = await Usuarios.findOne({
        where: { email }
      });
      if (duplicado) {
        return reply.status(409).send(createErrorResponse(
          'El email ya está registrado por otro usuario',
          'EMAIL_DUPLICATED'
        ));
      }
    }

    // Construir objeto de actualización solo con campos definidos
    const updateData = {};
    if (primer_nombre !== undefined) updateData.primer_nombre = primer_nombre;
    if (segundo_nombre !== undefined) updateData.segundo_nombre = segundo_nombre;
    if (primer_apellido !== undefined) updateData.primer_apellido = primer_apellido;
    if (segundo_apellido !== undefined) updateData.segundo_apellido = segundo_apellido;
    if (email !== undefined) updateData.email = email;
    if (rol_id !== undefined) updateData.rol_id = rol_id;
    if (status !== undefined) updateData.status = status;

    // Si no hay campos para actualizar, retornar el usuario sin cambios
    if (Object.keys(updateData).length === 0) {
      const usuarioActual = await Usuarios.findByPk(id, {
        attributes: { exclude: ['password_hash'] }
      });
      return reply.send(usuarioActual);
    }

    const [updated] = await Usuarios.update(updateData, { 
      where: { id }, 
      validate: true 
    });

    if (!updated) {
      return reply.status(404).send(createErrorResponse(
        'Usuario no encontrado',
        'USUARIO_NOT_FOUND'
      ));
    }

    const usuarioActualizado = await Usuarios.findByPk(id, {
      attributes: { exclude: ['password_hash'] }
    });
    reply.send(usuarioActualizado);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al actualizar el usuario',
      'UPDATE_USUARIO_ERROR',
      error
    ));
  }
}

/* ---------------------------------------------------------------------------
 * DELETE /api/usuarios/:id
 * -------------------------------------------------------------------------*/
export async function deleteUsuario(request, reply) {
  const { id } = request.params;

  try {
    // Soft delete: actualizar status a 0 (inactivo)
    const [updated] = await Usuarios.update(
      { status: 0 },
      { where: { id } }
    );

    if (updated) {
      reply.code(204).send();
    } else {
      reply.status(404).send(createErrorResponse(
        'Usuario no encontrado',
        'USUARIO_NOT_FOUND'
      ));
    }
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al eliminar el usuario',
      'DELETE_USUARIO_ERROR',
      error
    ));
  }
}
