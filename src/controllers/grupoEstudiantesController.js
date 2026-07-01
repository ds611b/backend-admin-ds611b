import { GrupoEstudiantes, Grupos, PerfilUsuario, Carreras, GrupoCarrera, HorasRequisito } from '../models/index.js';
import { createErrorResponse } from '../utils/errorResponse.js';

export async function getGrupoEstudiantes(request, reply) {
  try {
    const registros = await GrupoEstudiantes.findAll({
      include: [
        { model: Grupos },
        { model: PerfilUsuario, as: 'perfil_estudiante' }
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

export async function getGrupoEstudianteById(request, reply) {
  const { id } = request.params;

  try {
    const registro = await GrupoEstudiantes.findByPk(id, {
      include: [
        { model: Grupos },
        { model: PerfilUsuario, as: 'perfil_estudiante' }
      ]
    });

    if (!registro) {
      return reply.status(404).send(createErrorResponse(
        'Registro no encontrado',
        'GRUPO_ESTUDIANTE_NOT_FOUND'
      ));
    }

    reply.send(registro);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener el registro de grupo',
      'GET_GRUPO_ESTUDIANTE_BY_ID_ERROR',
      error
    ));
  }
}

export async function createGrupoEstudiante(request, reply) {
  const transaction = await GrupoEstudiantes.sequelize.transaction();

  try {
    const {
      id_grupo,
      id_estudiante,
      estado
    } = request.body;

    // Validar duplicado
    const existe = await GrupoEstudiantes.findOne({
      where: { id_grupo, id_estudiante },
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
      id_estudiante,
      fecha_asignacion: new Date(),
      estado
    }, { transaction });

    await transaction.commit();

    const registroCompleto = await GrupoEstudiantes.findByPk(nuevoRegistro.id, {
      include: [
        { model: Grupos },
        { model: PerfilUsuario, as: 'perfil_estudiante' }
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

export async function cambiarCarreraEstudiante(request, reply) {
  const { id } = request.params;
  const { id_carrera } = request.body;

  const transaction = await PerfilUsuario.sequelize.transaction();

  try {
    // Buscar estudiante
    const estudiante = await PerfilUsuario.findByPk(id, { transaction });

    if (!estudiante) {
      await transaction.rollback();
      return reply.status(404).send(
        createErrorResponse(
          'Estudiante no encontrado',
          'ESTUDIANTE_NOT_FOUND'
        )
      );
    }

    // Validar carrera
    const carrera = await Carreras.findByPk(id_carrera, { transaction });

    if (!carrera) {
      await transaction.rollback();
      return reply.status(404).send(
        createErrorResponse(
          'Carrera no encontrada',
          'CARRERA_NOT_FOUND'
        )
      );
    }

    // Buscar el grupo asociado a la carrera
    const grupoCarrera = await GrupoCarrera.findOne({
      where: {
        id_carrera,
        activo: true
      },
      include: [
        {
          model: Grupos,
          as: 'grupo'
        }
      ],
      transaction
    });

    if (!grupoCarrera || !grupoCarrera.grupo) {
      await transaction.rollback();
      return reply.status(404).send(
        createErrorResponse(
          'No existe un grupo asociado a esta carrera',
          'GRUPO_CARRERA_NOT_FOUND'
        )
      );
    }

    // Actualizar carrera del estudiante
    await estudiante.update(
      {
        id_carrera
      },
      { transaction }
    );

    // Buscar grupos activos del estudiante
    const gruposActivos = await GrupoEstudiantes.findAll({
      where: {
        id_estudiante: id,
        estado: 'Activo'
      },
      order: [['fecha_asignacion', 'DESC']],
      transaction
    });

    // Verificar si ya pertenece al grupo correcto
    const grupoActual = gruposActivos.find(
      ge => ge.id_grupo === grupoCarrera.id_grupo
    );

    let nuevoRegistro;

    if (grupoActual) {
      // Ya pertenece al grupo correcto
      nuevoRegistro = grupoActual;
    } else {
      // Inactivar grupos activos anteriores
      if (gruposActivos.length > 0) {
        await GrupoEstudiantes.update(
          {
            estado: 'Inactivo'
          },
          {
            where: {
              id_estudiante: id,
              estado: 'Activo'
            },
            transaction
          }
        );
      }

      // Crear nueva asignación
      nuevoRegistro = await GrupoEstudiantes.create(
        {
          id_grupo: grupoCarrera.id_grupo,
          id_estudiante: id,
          fecha_asignacion: new Date(),
          estado: 'Activo'
        },
        { transaction }
      );
    }

    // Asegurar que exista un HorasRequisito por cada tipo que exige el grupo
    // nuevo (S si horas_sociales>0, A si horas_ambientales>0), apuntando a la
    // asignación activa. NO se copian horas: el avance previo se conserva en los
    // RegistroHoras del grupo viejo (historial) y el resumen los suma aparte.
    const grupoNuevo = grupoCarrera.grupo;
    const tiposRequeridos = [];
    if (Number(grupoNuevo.horas_sociales) > 0) tiposRequeridos.push('S');
    if (Number(grupoNuevo.horas_ambientales) > 0) tiposRequeridos.push('A');

    for (const tipo of tiposRequeridos) {
      await HorasRequisito.findOrCreate({
        where: {
          id_grupo_estudiante: nuevoRegistro.id,
          id_estudiante: id,
          tipo_horas: tipo
        },
        defaults: {
          id_grupo_estudiante: nuevoRegistro.id,
          id_estudiante: id,
          tipo_horas: tipo,
          horas_completadas: 0,
          fecha_inicio: new Date(),
          estado: 'Pendiente'
        },
        transaction
      });
    }

    await transaction.commit();

    // Obtener registro completo
    const resultado = await GrupoEstudiantes.findByPk(nuevoRegistro.id, {
      include: [
        {
          model: Grupos
        },
        {
          model: PerfilUsuario,
          as: 'perfil_estudiante'
        }
      ]
    });

    return reply.send({
      success: true,
      message: grupoActual
        ? 'La carrera fue actualizada. El estudiante ya pertenecía al grupo correspondiente.'
        : 'Carrera y grupo actualizados correctamente.',
      data: resultado
    });

  } catch (error) {
    await transaction.rollback();

    request.log.error(error);

    return reply.status(500).send(
      createErrorResponse(
        'Error al cambiar carrera del estudiante',
        'CHANGE_STUDENT_CAREER_ERROR',
        error
      )
    );
  }
}
