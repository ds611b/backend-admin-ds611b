import { Usuarios } from '../models/index.js';
import { createErrorResponse } from '../utils/errorResponse.js';

/* ---------------------------------------------------------------------------
 * GET /api/usuarios
 * -------------------------------------------------------------------------*/
export async function getUsuarios(request, reply) {
  try {
    const usuarios = await Usuarios.findAll({
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
    rol_id
  } = request.body;

  try {
    // Si cambia el email, comprobar que no esté en uso por otro usuario
    if (email) {
      const duplicado = await Usuarios.findOne({
        where: { email }
      });
      if (duplicado) {
        return reply.status(409).send(createErrorResponse(
          'El email ya está registrado por otro usuario',
          409,
          'EMAIL_DUPLICATED'
        ));
      }
    }

    const [updated] = await Usuarios.update(
      {
        primer_nombre,
        segundo_nombre,
        primer_apellido,
        segundo_apellido,
        email,
        rol_id
      },
      { where: { id }, validate: true }
    );

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
    const deleted = await Usuarios.destroy({ where: { id } });

    if (deleted) {
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
