import { Carreras, Escuelas, Usuarios, PerfilUsuario, GrupoCarrera, Grupos, AplicacionesEstudiantes, ProyectosInstitucion, Instituciones } from '../models/index.js';
import { createErrorResponse } from '../utils/errorResponse.js';
import config from '../config/config.js';
import { getRolIdByName } from '../services/roleService.js';
import { group } from 'console';
import { Op } from 'sequelize';

/**
 * Obtiene todas las carreras con información de su escuela asociada
 */
export async function getCarreras(request, reply) {
  try {
    const carreras = await Carreras.findAll({
      include: [{
        model: Escuelas,
        as: 'escuela',
        //attributes: ['id', 'nombre']
      },{
      model: GrupoCarrera,
      as: 'grupos_carrera',
      where: { activo: true },
      attributes : ['id'],
      required: false,
      include : [{
        model: Grupos,
        as: 'grupo'
      }]
    }],
      order: [['nombre', 'ASC']]
    });
    reply.send(carreras);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener el listado de carreras',
      'GET_CARRERAS_ERROR',
      error
    ));
  }
}

/**
 * Obtiene una carrera específica por ID con su escuela
 */
export async function getCarreraById(request, reply) {
  const { id } = request.params;
  try {
    const carrera = await Carreras.findByPk(id, {
      include: [{
        model: Escuelas,
        as: 'escuela'
      }]
    });

    if (!carrera) {
      return reply.status(404).send(createErrorResponse(
        'Carrera no encontrada',
        'CARRERA_NOT_FOUND'
      ));
    }
    reply.send(carrera);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener la información de la carrera',
      'GET_CARRERA_ERROR',
      error
    ));
  }
}

/**
 * Crea una nueva carrera
 */
export async function createCarrera(request, reply) {
  const { nombre, id_escuela } = request.body;
  
  try {
    // Verificar si la escuela existe
    const escuela = await Escuelas.findByPk(id_escuela);
    if (!escuela) {
      return reply.status(400).send(createErrorResponse(
        'La escuela especificada no existe',
        'ESCUELA_NOT_FOUND'
      ));
    }

    const nuevaCarrera = await Carreras.create({
      nombre,
      id_escuela,
    });

    // Obtener la carrera recién creada con la relación de escuela
    const carreraCreada = await Carreras.findByPk(nuevaCarrera.id, {
      include: [{
        model: Escuelas,
        as: 'escuela'
      }]
    });

    reply.status(201).send(carreraCreada);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      reply.status(409).send(createErrorResponse(
        'Ya existe una carrera con este nombre en la escuela especificada',
        'DUPLICATE_CARRERA',
        error
      ));
    } else {
      request.log.error(error);
      reply.status(500).send(createErrorResponse(
        'Error al crear la carrera',
        'CREATE_CARRERA_ERROR',
        error
      ));
    }
  }
}

/**
 * Actualiza una carrera existente
 */
export async function updateCarrera(request, reply) {
  const { id } = request.params;
  const { nombre, id_escuela } = request.body;

  try {
    const carrera = await Carreras.findByPk(id);
    if (!carrera) {
      return reply.status(404).send(createErrorResponse(
        'Carrera no encontrada',
        'CARRERA_NOT_FOUND'
      ));
    }

    // Verificar si la nueva escuela existe
    if (id_escuela) {
      const escuela = await Escuelas.findByPk(id_escuela);
      if (!escuela) {
        return reply.status(400).send(createErrorResponse(
          'La escuela especificada no existe',
          'ESCUELA_NOT_FOUND'
        ));
      }
    }

    await carrera.update({
      nombre: nombre || carrera.nombre,
      id_escuela: id_escuela || carrera.id_escuela
    });

    // Obtener la carrera actualizada con la relación de escuela
    const carreraActualizada = await Carreras.findByPk(id, {
      include: [{
        model: Escuelas,
        as: 'escuela',
        attributes: ['id', 'nombre']
      }]
    });

    reply.send(carreraActualizada);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      reply.status(409).send(createErrorResponse(
        'No se puede actualizar: Ya existe una carrera con este nombre en la escuela especificada',
        'DUPLICATE_CARRERA',
        error
      ));
    } else {
      request.log.error(error);
      reply.status(500).send(createErrorResponse(
        'Error al actualizar la carrera',
        'UPDATE_CARRERA_ERROR',
        error
      ));
    }
  }
}

/**
 * Elimina una carrera
 */
export async function deleteCarrera(request, reply) {
  const { id } = request.params;
  
  try {
    const carrera = await Carreras.findByPk(id);
    if (!carrera) {
      return reply.status(404).send(createErrorResponse(
        'Carrera no encontrada',
        'CARRERA_NOT_FOUND'
      ));
    }

    await carrera.destroy();
    reply.status(204).send();
  } catch (error) {
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      reply.status(400).send(createErrorResponse(
        'No se puede eliminar: Existen registros asociados a esta carrera',
        'CARRERA_HAS_RELATIONS',
        error
      ));
    } else {
      request.log.error(error);
      reply.status(500).send(createErrorResponse(
        'Error al eliminar la carrera',
        'DELETE_CARRERA_ERROR',
        error
      ));
    }
  }
}

/**
 * Obtiene la lista de estudiantes (Usuario & Perfil) por ID de carrera
 */
export async function getEstudiantesByCarreraId(request, reply) {
  const { id_carrera: id } = request.params;
  const { page = 1, limit = 10 } = request.query;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  try {
    // Verificar que la carrera existe
    const carrera = await Carreras.findByPk(id);
    if (!carrera) {
      return reply.status(404).send(createErrorResponse(
        'Carrera no encontrada',
        'CARRERA_NOT_FOUND'
      ));
    }

    // Obtener el ID del rol Estudiante desde la BD
    const rolEstudianteId = await getRolIdByName(config.roleNames.ESTUDIANTE);
    
    if (!rolEstudianteId) {
      return reply.status(500).send(createErrorResponse(
        'Error de configuración: Rol "Estudiante" no encontrado en la base de datos',
        'ROLE_NOT_FOUND'
      ));
    }

    // Obtener estudiantes con su perfil
    const { count, rows: estudiantes } = await Usuarios.findAndCountAll({
      where: { 
        rol_id: rolEstudianteId,
        status: 1 
      },
      attributes: { exclude: ['password_hash'] },
      include: [
        {
          model: PerfilUsuario,
          where: { id_carrera: id },
          required: true,
          include: [
            {
              model: Carreras,
              as: 'carrera'
            }
          ]
        }
      ],
      order: [['primer_apellido', 'ASC'], ['segundo_apellido', 'ASC']],
      limit: limitNum,
      offset: offset,
      distinct: true
    });

    const totalPages = Math.ceil(count / limitNum);

    reply.send({
      data: estudiantes,
      pagination: {
        totalItems: count,
        totalPages: totalPages,
        currentPage: pageNum,
        itemsPerPage: limitNum
      }
    });
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener los estudiantes de la carrera',
      'GET_ESTUDIANTES_CARRERA_ERROR',
      error
    ));
  }
}

/* ---------------------------------------------------------------------------
 * GET /api/carreras/:id_carrera/detalle-aplicaciones/:usuario_id
 * Retorna el detalle de un estudiante de la carrera: perfil + proyecto activo
 * o listado de aplicaciones si no tiene proyecto activo.
 * -------------------------------------------------------------------------*/
export async function getDetalleAplicacionesEstudiante(request, reply) {
  const { id_carrera, usuario_id } = request.params;
  const { page = 1, limit = 10 } = request.query;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  try {
    // 1. Verificar que la carrera existe
    const carrera = await Carreras.findByPk(id_carrera);
    if (!carrera) {
      return reply.status(404).send(createErrorResponse(
        'Carrera no encontrada',
        'CARRERA_NOT_FOUND'
      ));
    }

    // 2. Usuario con perfil validando que pertenece a esta carrera
    const usuario = await Usuarios.findByPk(usuario_id, {
      where: { status: 1 },
      attributes: { exclude: ['password_hash'] },
      include: [
        {
          model: PerfilUsuario,
          required: true,
          where: { id_carrera: id_carrera },
          include: [
            {
              model: Carreras,
              as: 'carrera',
              required: false
            },
            {
              model: Instituciones,
              as: 'institucion',
              required: false
            }
          ]
        }
      ]
    });

    if (!usuario) {
      return reply.status(404).send(createErrorResponse(
        'Estudiante no encontrado o no pertenece a esta carrera',
        'ESTUDIANTE_NOT_FOUND'
      ));
    }

    // 3. Todas las aplicaciones del estudiante con detalle del proyecto e institución
    const aplicaciones = await AplicacionesEstudiantes.findAll({
      where: { estudiante_id: usuario_id },
      include: [
        {
          model: ProyectosInstitucion,
          as: 'proyecto',
          required: false,
          include: [
            {
              model: Instituciones,
              as: 'institucion',
              required: false
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // 4. Determinar si existe un proyecto activo (aplicación Aprobada)
    const aplicacionActiva = aplicaciones.find(app => app.estado === 'Aprobado');

    const usuarioData = usuario.toJSON();
    let response;

    if (aplicacionActiva) {
      response = {
        ...usuarioData,
        proyecto_activo: aplicacionActiva.toJSON().proyecto ?? {},
        aplicaciones: [],
        pagination: null
      };
    } else {
      const aplicacionesData = aplicaciones.map(app => app.toJSON());
      const totalAplicaciones = aplicacionesData.length;
      const aplicacionesPaginadas = aplicacionesData.slice(offset, offset + limitNum);
      const totalPages = Math.ceil(totalAplicaciones / limitNum);

      response = {
        ...usuarioData,
        proyecto_activo: {},
        aplicaciones: aplicacionesPaginadas,
        pagination: {
          totalItems: totalAplicaciones,
          totalPages: totalPages,
          currentPage: pageNum,
          itemsPerPage: limitNum
        }
      };
    }

    reply.send(response);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener el detalle del estudiante',
      'GET_DETALLE_ESTUDIANTE_ERROR',
      error
    ));
  }
}

/* ---------------------------------------------------------------------------
 * GET /api/carreras/:id_carrera/estudiantes/detalle-aplicaciones
 * Lista paginada de estudiantes de la carrera donde cada elemento incluye:
 * perfil + proyecto activo (si existe) o aplicaciones realizadas.
 * -------------------------------------------------------------------------*/
export async function getEstudiantesDetalleByCarrera(request, reply) {
  const { id_carrera } = request.params;
  const { page = 1, limit = 10 } = request.query;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  try {
    // 1. Verificar que la carrera existe
    const carrera = await Carreras.findByPk(id_carrera);
    if (!carrera) {
      return reply.status(404).send(createErrorResponse(
        'Carrera no encontrada',
        'CARRERA_NOT_FOUND'
      ));
    }

    // 2. Obtener rol Estudiante
    const rolEstudianteId = await getRolIdByName(config.roleNames.ESTUDIANTE);
    if (!rolEstudianteId) {
      return reply.status(500).send(createErrorResponse(
        'Error de configuración: Rol "Estudiante" no encontrado',
        'ROLE_NOT_FOUND'
      ));
    }

    // 3. Obtener estudiantes paginados de la carrera con su perfil
    const { count, rows: estudiantes } = await Usuarios.findAndCountAll({
      where: { rol_id: rolEstudianteId, status: 1 },
      attributes: { exclude: ['password_hash'] },
      include: [
        {
          model: PerfilUsuario,
          required: true,
          where: { id_carrera: id_carrera },
          include: [
            { model: Carreras, as: 'carrera', required: false },
            { model: Instituciones, as: 'institucion', required: false }
          ]
        }
      ],
      order: [['primer_apellido', 'ASC'], ['segundo_apellido', 'ASC']],
      limit: limitNum,
      offset: offset,
      distinct: true
    });

    // 4. Obtener todas las aplicaciones de estos estudiantes en una sola consulta
    const estudianteIds = estudiantes.map(e => e.id);
    const todasLasAplicaciones = estudianteIds.length > 0
      ? await AplicacionesEstudiantes.findAll({
          where: { estudiante_id: { [Op.in]: estudianteIds } },
          include: [
            {
              model: ProyectosInstitucion,
              as: 'proyecto',
              required: false,
              include: [
                { model: Instituciones, as: 'institucion', required: false }
              ]
            }
          ],
          order: [['created_at', 'DESC']]
        })
      : [];

    // 5. Agrupar aplicaciones por estudiante_id
    const aplicacionesPorEstudiante = {};
    for (const app of todasLasAplicaciones) {
      const eid = app.estudiante_id;
      if (!aplicacionesPorEstudiante[eid]) aplicacionesPorEstudiante[eid] = [];
      aplicacionesPorEstudiante[eid].push(app.toJSON());
    }

    // 6. Construir respuesta con la misma lógica de detalle-aplicaciones
    const data = estudiantes.map(estudiante => {
      const estudianteData = estudiante.toJSON();
      const apps = aplicacionesPorEstudiante[estudiante.id] || [];
      const activa = apps.find(app => app.estado === 'Aprobado');

      if (activa) {
        return {
          ...estudianteData,
          proyecto_activo: activa.proyecto ?? {},
          aplicaciones: []
        };
      } else {
        return {
          ...estudianteData,
          proyecto_activo: {},
          aplicaciones: apps
        };
      }
    });

    const totalPages = Math.ceil(count / limitNum);

    reply.send({
      data,
      pagination: {
        totalItems: count,
        totalPages: totalPages,
        currentPage: pageNum,
        itemsPerPage: limitNum
      }
    });
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener el detalle de los estudiantes',
      'GET_ESTUDIANTES_DETALLE_ERROR',
      error
    ));
  }
}

export default {
  getCarreras,
  getCarreraById,
  createCarrera,
  updateCarrera,
  deleteCarrera,
  getEstudiantesByCarreraId,
  getDetalleAplicacionesEstudiante,
  getEstudiantesDetalleByCarrera
};
