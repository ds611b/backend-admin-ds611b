import { Grupos, GrupoEstudiantes, Carreras, PerfilUsuario, GrupoCarrera } from '../models/index.js';
import { createErrorResponse } from '../utils/errorResponse.js';

// GET ALL
export async function getGrupos(request, reply) {
  try {
    const grupos = await Grupos.findAll({
      include: [
        {
          model: GrupoCarrera,
          as: 'grupos_carrera',
          where: {
            activo: true   // 🔥 esto filtra SOLO las carreras
          },
          required: false, // 🔥 esto evita filtrar grupos
          include: [
            {
              model: Carreras,
              as: 'carrera'
            }
          ]
        },
        {
          model: GrupoEstudiantes,
          include: [
            {
              model: PerfilUsuario,
              as: 'perfil_estudiante'
            }
          ]
        }
      ]
    });

    reply.send(grupos);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener grupos',
      'GET_GRUPOS_ERROR',
      error
    ));
  }
}

// GET BY ID
export async function getGrupoById(request, reply) {
  const { id } = request.params;

  try {
    const grupo = await Grupos.findByPk(id, {
      include: [
        {
          model: GrupoCarrera,
          as: 'grupos_carrera',
          include: [
            {
              model: Carreras,
              as: 'carrera'
            }
          ]
        },
        {
          model: GrupoEstudiantes,
          include: [
            {
              model: PerfilUsuario,
              as: 'perfil_estudiante'
            }
          ]
        }
      ]
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

// CREATE
export async function createGrupo(request, reply) {
  const transaction = await Grupos.sequelize.transaction();

  try {
    const { nombre, codigo, descripcion, horas_ambientales, horas_sociales, carreras = [] } = request.body;

    const grupo = await Grupos.create({ nombre, codigo, descripcion, horas_ambientales, horas_sociales }, { transaction });

    if (carreras.length > 0) {
      const registros = carreras.map(id => ({
        id_grupo: grupo.id,
        id_carrera : id
      }));

      await GrupoCarrera.bulkCreate(registros, { transaction });
    }

    await transaction.commit();

    const grupoCompleto = await Grupos.findByPk(grupo.id, {
      include: [
        {
          model: GrupoCarrera,
          as: 'grupos_carrera',
          include: [
            {
              model: Carreras,
              as: 'carrera'
            }
          ]
        }
      ]
    });

    reply.status(201).send(grupoCompleto);

  } catch (error) {
    await transaction.rollback();
    request.log.error(error);

    reply.status(500).send(createErrorResponse(
      'Error al crear grupo',
      'CREATE_GRUPO_ERROR',
      error
    ));
  }
}

// UPDATE
export async function updateGrupo(request, reply) {
  const { id } = request.params;
  const { nombre, carreras } = request.body;

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

    await grupo.update({ nombre }, { transaction });

    if (carreras !== undefined) {

      // 🔹 1. Desactivar todas las relaciones actuales
      await GrupoCarrera.update(
        { activo: false },
        {
          where: { id_grupo: id },
          transaction
        }
      );

      // 🔹 2. Procesar nuevas carreras
      for (const id_carrera of carreras) {

        const existente = await GrupoCarrera.findOne({
          where: {
            id_grupo: id,
            id_carrera
          },
          transaction
        });

        if (existente) {
          // 🔥 Reactivar
          await existente.update({ activo: true }, { transaction });
        } else {
          // 🔥 Crear nuevo
          await GrupoCarrera.create({
            id_grupo: id,
            id_carrera,
            activo: true
          }, { transaction });
        }
      }
    }

    await transaction.commit();

    const grupoActualizado = await Grupos.findByPk(id, {
      include: [
        {
          model: GrupoCarrera,
          as: 'grupos_carrera',
          where: { activo: true }, // 🔥 solo activos
          required: false,
          include: [
            {
              model: Carreras,
              as: 'carrera'
            }
          ]
        }
      ]
    });

    reply.send(grupoActualizado);

  } catch (error) {
    await transaction.rollback();
    request.log.error(error);

    reply.status(500).send(createErrorResponse(
      'Error al actualizar grupo',
      'UPDATE_GRUPO_ERROR',
      error
    ));
  }
}

// DELETE
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