import { Grupos, GrupoEstudiantes, PerfilUsuario } from '../models/index.js';
import { createErrorResponse } from '../utils/errorResponse.js';

export async function getGrupos(request, reply) {
  try {
    const grupos = await Grupos.findAll({
      include: {
        model: GrupoEstudiantes,
        include: [{ model: PerfilUsuario, as: 'perfil_usuario' }]
      },
      order: [['fecha_creacion', 'DESC']]
    });

    reply.send(grupos);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener los grupos',
      'GET_GRUPOS_ERROR',
      error
    ));
  }
}

export async function getGrupoById(request, reply) {
  const { id } = request.params;

  try {
    const grupo = await Grupos.findByPk(id, {
      include: {
        model: GrupoEstudiantes,
        include: [{ model: PerfilUsuario, as: 'perfil_usuario' }]
      }
    });

    if (!grupo) {
      return reply.status(404).send(createErrorResponse(
        'Grupo no encontrado',
        'GRUPO_NOT_FOUND'
      ));
    }

    reply.send(grupo);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener el grupo',
      'GET_GRUPO_BY_ID_ERROR',
      error
    ));
  }
}

export async function createGrupo(request, reply) {
  const transaction = await Grupos.sequelize.transaction();

  try {
    const {
      codigo,
      nombre,
      descripcion,
      horas_ambientales,
      horas_sociales
    } = request.body;

    const nuevoGrupo = await Grupos.create({
      codigo,
      nombre,
      descripcion,
      horas_ambientales,
      horas_sociales
    }, { transaction });

    await transaction.commit();

    reply.status(201).send(nuevoGrupo);
  } catch (error) {
    await transaction.rollback();
    request.log.error(error);

    reply.status(500).send(createErrorResponse(
      'Error al crear el grupo',
      'CREATE_GRUPO_ERROR',
      error
    ));
  }
}

export async function updateGrupo(request, reply) {
  const { id } = request.params;
  const transaction = await Grupos.sequelize.transaction();

  try {
    const grupo = await Grupos.findByPk(id, { transaction });

    if (!grupo) {
      await transaction.rollback();
      return reply.status(404).send(createErrorResponse(
        'Grupo no encontrado',
        'GRUPO_NOT_FOUND'
      ));
    }

    await grupo.update(request.body, { transaction });

    await transaction.commit();

    reply.send(grupo);
  } catch (error) {
    await transaction.rollback();
    request.log.error(error);

    reply.status(500).send(createErrorResponse(
      'Error al actualizar el grupo',
      'UPDATE_GRUPO_ERROR',
      error
    ));
  }
}

export async function deleteGrupo(request, reply) {
  const { id } = request.params;
  const transaction = await Grupos.sequelize.transaction();

  try {
    const grupo = await Grupos.findByPk(id, { transaction });

    if (!grupo) {
      await transaction.rollback();
      return reply.status(404).send(createErrorResponse(
        'Grupo no encontrado',
        'GRUPO_NOT_FOUND'
      ));
    }

    await grupo.destroy({ transaction });
    await transaction.commit();

    reply.status(204).send();
  } catch (error) {
    await transaction.rollback();
    request.log.error(error);

    reply.status(500).send(createErrorResponse(
      'Error al eliminar el grupo',
      'DELETE_GRUPO_ERROR',
      error
    ));
  }
}