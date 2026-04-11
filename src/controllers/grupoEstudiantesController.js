import { GrupoEstudiantes, Grupos, PerfilUsuario } from '../models/index.js';
import { createErrorResponse } from '../utils/errorResponse.js';

export async function getGrupoEstudiantes(request, reply) {
  try {
    const registros = await GrupoEstudiantes.findAll({
      include: [
        { model: Grupos },
        { model: PerfilUsuario, as: 'perfil_usuario' }
      ],
      order: [['fecha_asignacion', 'DESC']]
    });

    reply.send(registros);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener los registros de grupo',
      'GET_GRUPO_ESTUDIANTES_ERROR',
      error
    ));
  }
}

export async function createGrupoEstudiante(request, reply) {
  const transaction = await GrupoEstudiantes.sequelize.transaction();

  try {
    const {
      id_grupo,
      id_perfil_usuario,
      estado
    } = request.body;

    // Validar duplicado
    const existe = await GrupoEstudiantes.findOne({
      where: { id_grupo, id_perfil_usuario },
      transaction
    });

    if (existe) {
      await transaction.rollback();
      return reply.status(400).send(createErrorResponse(
        'El estudiante ya pertenece a este grupo',
        'DUPLICATE_GRUPO_ESTUDIANTE'
      ));
    }

    const nuevoRegistro = await GrupoEstudiantes.create({
      id_grupo,
      id_perfil_usuario,
      fecha_asignacion: new Date(),
      estado
    }, { transaction });

    await transaction.commit();

    const registroCompleto = await GrupoEstudiantes.findByPk(nuevoRegistro.id, {
      include: [
        { model: Grupos },
        { model: PerfilUsuario, as: 'perfil_usuario' }
      ]
    });

    reply.status(201).send(registroCompleto);
  } catch (error) {
    await transaction.rollback();
    request.log.error(error);

    reply.status(500).send(createErrorResponse(
      'Error al asignar estudiante al grupo',
      'CREATE_GRUPO_ESTUDIANTE_ERROR',
      error
    ));
  }
}

export async function deleteGrupoEstudiante(request, reply) {
  const { id } = request.params;
  const transaction = await GrupoEstudiantes.sequelize.transaction();

  try {
    const registro = await GrupoEstudiantes.findByPk(id, { transaction });

    if (!registro) {
      await transaction.rollback();
      return reply.status(404).send(createErrorResponse(
        'Registro no encontrado',
        'GRUPO_ESTUDIANTE_NOT_FOUND'
      ));
    }

    await registro.destroy({ transaction });
    await transaction.commit();

    reply.status(204).send();
  } catch (error) {
    await transaction.rollback();
    request.log.error(error);

    reply.status(500).send(createErrorResponse(
      'Error al eliminar el registro',
      'DELETE_GRUPO_ESTUDIANTE_ERROR',
      error
    ));
  }
}