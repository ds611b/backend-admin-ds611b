import { AplicacionesEstudiantes, ProyectosInstitucion, Usuarios, Instituciones, PerfilUsuario, HorasRequisito, GrupoEstudiantes, GrupoCarrera } from '../models/index.js';
import { createErrorResponse } from '../utils/errorResponse.js';
import sequelize from '../models/db.js';

/**
 * Obtiene todas las aplicaciones de estudiantes.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function getAplicacionesEstudiantes(request, reply) {
  try {
    const aplicaciones = await AplicacionesEstudiantes.findAll({
      include: [
        {
          model: ProyectosInstitucion,
          as: 'proyecto'
        },
        {
          model: Usuarios,
          as: 'estudiante',
          attributes: ['id', 'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido', 'email']
        }
      ]
    });
    reply.send(aplicaciones);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener las aplicaciones de estudiantes',
      'GET_APLICACIONES_ERROR',
      error
    ));
  }
}

/**
 * Obtiene una aplicación por estudiante por ID.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function getAplicacionEstudianteById(request, reply) {
  const { id } = request.params;
  try {
    const aplicacion = await AplicacionesEstudiantes.findByPk(id, {
      include: [
        {
          model: ProyectosInstitucion,
          as: 'proyecto',
          include: [
            {
              model: Instituciones,
              as: 'institucion'
            }
          ]
        },
        {
          model: Usuarios,
          as: 'estudiante',
          attributes: ['id', 'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido', 'email']
        }
      ],
    });
    if (aplicacion) {
      reply.send(aplicacion);
    } else {
      reply.status(404).send(createErrorResponse(
        'Aplicación no encontrada',
        'APLICACION_NOT_FOUND'
      ));
    }
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener la aplicación de estudiante',
      'GET_APLICACION_ERROR',
      error
    ));
  }
}

/**
 * Obtiene todas las aplicaciones de un estudiante específico
 * @param {import('fastify').FastifyRequest} request 
 * @param {import('fastify').FastifyReply} reply 
 */
export async function getAplicacionesByEstudiante(request, reply) {
  const { estudianteId } = request.params;

  try {
    const aplicaciones = await AplicacionesEstudiantes.findAll({
      where: { estudiante_id: estudianteId },
      include: [
        {
          model: ProyectosInstitucion,
          as: 'proyecto',
          include: [
            {
              model: Instituciones,
              as: 'institucion'
            }
          ]
        },
        {
          model: Usuarios,
          as: 'estudiante',
          attributes: ['id', 'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido', 'email']
        }
      ],
      attributes: {
        exclude: ['created_at', 'updated_at']
      }
    });

    const proyectos = aplicaciones.map(app => ({
      ...app.proyecto.get({ plain: true })

    }));


    // Estructura la respuesta similar a tu ejemplo
    const response = aplicaciones.map(app => ({
      id: app.id,
      proyecto_id: app.proyecto_id,
      estado: app.estado,
      proyecto: {
        ...app.proyecto.get({ plain: true }),  // Todas las propiedades del proyecto
        institucion: app.proyecto.institucion ? app.proyecto.institucion.get({ plain: true }) : null
      },
      estudiante: app.estudiante.get({ plain: true }),
      created_at: app.created_at,
      updated_at: app.updated_at
    }));


    reply.send(response);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener las aplicaciones del estudiante',
      'GET_STUDENT_APPLICATIONS_ERROR',
      error
    ));
  }
}

/**
 * Obtiene todas las aplicaciones para un proyecto específico
 * @param {import('fastify').FastifyRequest} request 
 * @param {import('fastify').FastifyReply} reply 
 */
export async function getAplicacionesByProyecto(request, reply) {
  const { proyectoId } = request.params;

  try {
    const aplicaciones = await AplicacionesEstudiantes.findAll({
      where: { proyecto_id: proyectoId },
      include: [
        {
          model: ProyectosInstitucion,
          as: 'proyecto',
          include: [
            {
              model: Instituciones,
              as: 'institucion'
            }
          ]
        },
        {
          model: Usuarios,
          as: 'estudiante',
          attributes: ['id', 'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido', 'email']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    if (aplicaciones.length === 0) {
      reply.status(404).send(createErrorResponse(
        'No se encontraron aplicaciones para este proyecto',
        'PROJECT_APPLICATIONS_NOT_FOUND'
      ));
      return;
    }
    const estudiantes = aplicaciones.map(app => ({
      ...app.estudiante.get({ plain: true }),
      aplicacion_id: app.id,
      estado: app.estado
    }));


    const response = {
      proyecto: {
        ...aplicaciones[0].proyecto.get({ plain: true }),
        institucion: aplicaciones[0].proyecto.institucion?.get({ plain: true }) || null
      },
      estudiantes: estudiantes,
      created_at: aplicaciones[0].created_at,
      updated_at: aplicaciones[0].updated_at
    };

    reply.send(response);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener las aplicaciones del proyecto',
      'GET_PROJECT_APPLICATIONS_ERROR',
      error
    ));
  }
}

/**
 * Crea una aplicación por estudiante.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function createAplicacionEstudiante(request, reply) {
  try {
    const aplicacionCreada = await AplicacionesEstudiantes.create(request.body);

    const aplicacionAsociaciones = await AplicacionesEstudiantes.findByPk(aplicacionCreada.id, {
      include: [
        {
          model: ProyectosInstitucion,
          as: 'proyecto'
        },
        {
          model: Usuarios,
          as: 'estudiante'
        }
      ],
    });
    if (aplicacionAsociaciones) {
      reply.status(201).send(aplicacionAsociaciones);
    } else {
      request.log.error(`Registro creado con ID ${aplicacionCreada.id} pero no encontrado con asociaciones.`);
      reply.status(500).send(createErrorResponse(
        'Error al recuperar el registro con sus relaciones después de crearlo',
        'NO_OBTENIDO_CREADO_ERROR'
      ));
    }
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      reply.status(409).send(createErrorResponse(
        'El estudiante ya tiene una aplicación activa para este proyecto',
        'DUPLICATE_APLICACION_ESTUDIANTE',
        error
      ));
    } else {
      request.log.error(error);
      reply.status(500).send(createErrorResponse(
        'Error al crear la aplicación de estudiante',
        'CREATE_APLICACION_ERROR',
        error
      ));
    }
  }
}

/**
 * Actualiza una aplicación de estudiante.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function updateAplicacionEstudiante(request, reply) {
  const { id } = request.params;

  const transaction = await sequelize.transaction();

  try {
    const [updated] = await AplicacionesEstudiantes.update(request.body, {
      where: { id },
      validate: true,
      transaction
    });

    if (!updated) {
      await transaction.rollback();
      return reply.status(404).send({
        message: 'Aplicación no encontrada'
      });
    }

    const aplicacion = await AplicacionesEstudiantes.findByPk(id, {
      include: [
        { model: ProyectosInstitucion, as: 'proyecto' },
        { model: Usuarios, as: 'estudiante' }
      ],
      transaction
    });

    // 🔥 SOLO SI PASA A APROBADO
    if (aplicacion.estado === 'Aprobado') {

      console.log('✅ Aplicación aprobada, iniciando flujo...');

      // 1. Obtener perfil (para carrera)
      const perfil = await PerfilUsuario.findOne({
        where: { usuario_id: aplicacion.estudiante_id },
        transaction
      });

      console.log('📋 Perfil encontrado:', perfil ? perfil.get({ plain: true }) : 'No encontrado');

      if (!perfil) throw new Error('Perfil no encontrado');

      // 2. Obtener grupo por carrera
      const grupoCarrera = await GrupoCarrera.findOne({
        where: {
          id_carrera: perfil.id_carrera,
          activo: true
        },
        transaction
      });

      console.log('📋 GrupoCarrera encontrado:', grupoCarrera ? grupoCarrera.get({ plain: true }) : 'No encontrado');

      if (!grupoCarrera) throw new Error('No hay grupo activo para la carrera');

      // 3. Verificar si ya está en grupo
      let grupoEstudiante = await GrupoEstudiantes.findOne({
        where: {
          id_estudiante: perfil.id,
          id_grupo: grupoCarrera.id_grupo
        },
        transaction
      });

      // 4. Crear grupo si no existe
      if (!grupoEstudiante) {
        console.log('🆕 Creando GrupoEstudiante');

        grupoEstudiante = await GrupoEstudiantes.create({
          id_grupo: grupoCarrera.id_grupo,
          id_estudiante: perfil.id,
          fecha_asignacion: new Date(),
          estado: 'Activo'
        }, { transaction });

        console.log('🆕 GrupoEstudiante creado:', grupoEstudiante.get({ plain: true }));
      }

        console.log('🆕 Creando HorasRequisito');
      // 5. Verificar si ya existe HorasRequisito
      const existe = await HorasRequisito.findOne({
        where: {
          id_grupo_estudiante: grupoEstudiante.id,
          tipo_horas : aplicacion.proyecto.tipo_proyecto
        },
        transaction
      });

        console.log('🆕 Creando HorasRequisito');
      if (!existe) {
        console.log('🆕 Creando HorasRequisito');

        // obtengo el tipo de horas según el tipo de proyecto
        const proyecto = await ProyectosInstitucion.findOne({
          where: { id: aplicacion.proyecto_id },
          transaction
        });

        await HorasRequisito.create({
          id_grupo_estudiante: grupoEstudiante.id,
          id_estudiante: perfil.id,
          horas_completadas: 0,
          fecha_inicio: new Date(),
          tipo_horas: proyecto.tipo_proyecto,
          estado: 'En Progreso'
        }, { transaction });

      } else {
        console.log('⚠️ Ya existe HorasRequisito');
      }
    }

    await transaction.commit();

    reply.send(aplicacion);

  } catch (error) {
    await transaction.rollback();

    request.log.error(error);

    reply.status(500).send({
      message: 'Error al actualizar la aplicación',
      error: error.message
    });
  }
}

/**
 * Elimina una aplicación por estudiante por ID.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function deleteAplicacionEstudiante(request, reply) {
  const { id } = request.params;
  try {
    const deleted = await AplicacionesEstudiantes.destroy({ where: { id } });
    if (deleted) {
      reply.status(204).send();
    } else {
      reply.status(404).send(createErrorResponse(
        'Aplicación no encontrada',
        'APLICACION_NOT_FOUND'
      ));
    }
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al eliminar la aplicación de estudiante',
      'DELETE_APLICACION_ERROR',
      error
    ));
  }
}
