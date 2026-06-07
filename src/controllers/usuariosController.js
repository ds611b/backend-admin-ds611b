import { Usuarios, PerfilUsuario, AplicacionesEstudiantes, ProyectosInstitucion, Roles, Carreras, Instituciones } from '../models/index.js';
import { createErrorResponse } from '../utils/errorResponse.js';
import { Op } from 'sequelize';

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
  const { page = 1, limit = 10 } = request.query;
  
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  try {
    const { count, rows: usuarios } = await Usuarios.findAndCountAll({
      where: { status: 1 },
      attributes: { exclude: ['password_hash'] },
      include: [
        {
          model: Roles,
          as: 'rol',
          attributes: ['nombre', 'descripcion']
        }
      ],
      limit: limitNum,
      offset: offset,
      order: [['id', 'ASC']]
    });

    const totalPages = Math.ceil(count / limitNum);

    reply.send({
      data: usuarios,
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
      attributes: { exclude: ['password_hash'] },
      include: [
        {
          model: Roles,
          as: 'rol',
          attributes: ['nombre', 'descripcion']
        }
      ]
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

/* ---------------------------------------------------------------------------
 * GET /api/usuarios/all/:usuario_id - Obtiene usuario con perfil y proyectos
 * -------------------------------------------------------------------------*/
export async function getUsuarioAllById(request, reply) {
  const { usuario_id } = request.params;
  const { page = 1, limit = 10 } = request.query;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  try {
    const usuario = await Usuarios.findByPk(usuario_id, {
      where: { status: 1 },
      attributes: { exclude: ['password_hash'] },
      include: [
        {
          model: PerfilUsuario,
          required: false
        },
        {
          model: AplicacionesEstudiantes,
          required: false,
          include: [
            {
              model: ProyectosInstitucion,
              as: 'proyecto',
              required: false
            }
          ]
        }
      ]
    });

    if (!usuario) {
      return reply.status(404).send(createErrorResponse(
        'Usuario no encontrado',
        'USUARIO_NOT_FOUND'
      ));
    }

    // Transformar el resultado para incluir el array de proyectos con paginación
    const usuarioData = usuario.toJSON();
    const todasLasAplicaciones = usuarioData.AplicacionesEstudiantes || [];
    const proyectosFiltrados = todasLasAplicaciones
      .filter(app => app.proyecto)
      .map(app => app.proyecto);

    // Aplicar paginación a los proyectos
    const totalProyectos = proyectosFiltrados.length;
    const proyectosPaginados = proyectosFiltrados.slice(offset, offset + limitNum);
    const totalPages = Math.ceil(totalProyectos / limitNum);

    // Eliminar AplicacionesEstudiantes del objeto de respuesta
    delete usuarioData.AplicacionesEstudiantes;

    // Construir la respuesta final con paginación
    const response = {
      ...usuarioData,
      proyectos: proyectosPaginados,
      pagination: {
        totalItems: totalProyectos,
        totalPages: totalPages,
        currentPage: pageNum,
        itemsPerPage: limitNum
      }
    };

    reply.send(response);
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
 * GET /api/usuarios/coordinadores - Obtiene solo usuarios coordinadores
 * -------------------------------------------------------------------------*/
export async function getCoordinadores(request, reply) {
  const { page = 1, limit = 10 } = request.query;
  
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  try {
    const { count, rows: coordinadores } = await Usuarios.findAndCountAll({
      where: { status: 1 },
      attributes: { exclude: ['password_hash'] },
      include: [
        {
          model: Roles,
          as: 'rol',
          attributes: ['nombre', 'descripcion'],
          where: { nombre: 'Coordinador' }
        }
      ],
      limit: limitNum,
      offset: offset,
      order: [['id', 'ASC']]
    });

    const totalPages = Math.ceil(count / limitNum);

    reply.send({
      data: coordinadores,
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
      'Error al obtener los coordinadores',
      'GET_COORDINADORES_ERROR',
      error
    ));
  }
}

/* ---------------------------------------------------------------------------
 * GET /api/usuarios/estudiantes - Obtiene solo usuarios estudiantes
 * -------------------------------------------------------------------------*/
export async function getEstudiantes(request, reply) {
  const { page = 1, limit = 10 } = request.query;
  
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  try {
    const { count, rows: estudiantes } = await Usuarios.findAndCountAll({
      where: { status: 1 },
      attributes: { exclude: ['password_hash'] },
      include: [
        {
          model: Roles,
          as: 'rol',
          attributes: ['nombre', 'descripcion'],
          where: { nombre: 'Estudiante' }
        }
      ],
      limit: limitNum,
      offset: offset,
      order: [['id', 'ASC']]
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
      'Error al obtener los estudiantes',
      'GET_ESTUDIANTES_ERROR',
      error
    ));
  }
}

/* ---------------------------------------------------------------------------
 * GET /api/usuarios/search - Busca usuarios por nombres o email
 * -------------------------------------------------------------------------*/
export async function searchUsuarios(request, reply) {
  const { q, page = 1, limit = 10 } = request.query;

  // Validar que se proporcione el parámetro de búsqueda
  if (!q || q.trim() === '') {
    return reply.status(400).send(createErrorResponse(
      'Se requiere el parámetro de búsqueda "q"',
      'SEARCH_QUERY_REQUIRED'
    ));
  }

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  try {
    const searchTerm = `%${q.trim()}%`;

    const { count, rows: usuarios } = await Usuarios.findAndCountAll({
      where: {
        status: 1,
        [Op.or]: [
          { primer_nombre: { [Op.like]: searchTerm } },
          { segundo_nombre: { [Op.like]: searchTerm } },
          { primer_apellido: { [Op.like]: searchTerm } },
          { segundo_apellido: { [Op.like]: searchTerm } },
          { email: { [Op.like]: searchTerm } }
        ]
      },
      attributes: { exclude: ['password_hash'] },
      include: [
        {
          model: Roles,
          as: 'rol',
          attributes: ['nombre', 'descripcion']
        }
      ],
      limit: limitNum,
      offset: offset,
      order: [['id', 'ASC']]
    });

    const totalPages = Math.ceil(count / limitNum);

    reply.send({
      data: usuarios,
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
      'Error al buscar usuarios',
      'SEARCH_USUARIOS_ERROR',
      error
    ));
  }
}

/* ---------------------------------------------------------------------------
 * GET /api/usuarios/detalle/:usuario_id
 * Retorna usuario + perfil (con carrera e institución) + proyecto activo o
 * listado de aplicaciones realizadas. Nunca retorna null: usa {} y [] cuando
 * no hay datos.
 * -------------------------------------------------------------------------*/
export async function getUsuarioDetalleById(request, reply) {
  const { usuario_id } = request.params;
  const { page = 1, limit = 10 } = request.query;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  try {
    // 1. Usuario con perfil, carrera e institución del perfil
    const usuario = await Usuarios.findByPk(usuario_id, {
      where: { status: 1 },
      attributes: { exclude: ['password_hash'] },
      include: [
        {
          model: PerfilUsuario,
          required: false,
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
        'Usuario no encontrado',
        'USUARIO_NOT_FOUND'
      ));
    }

    // 2. Todas las aplicaciones del estudiante con detalle del proyecto e institución
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

    // 3. Determinar si existe un proyecto activo (aplicación Aprobada)
    const aplicacionActiva = aplicaciones.find(app => app.estado === 'Aprobado');

    const usuarioData = usuario.toJSON();
    let response;

    if (aplicacionActiva) {
      // Tiene proyecto activo: devolver sus detalles; aplicaciones vacía
      response = {
        ...usuarioData,
        proyecto_activo: aplicacionActiva.toJSON().proyecto ?? {},
        aplicaciones: [],
        pagination: null
      };
    } else {
      // Sin proyecto activo: devolver aplicaciones paginadas; proyecto_activo vacío
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
      'Error al obtener el detalle del usuario',
      'GET_USUARIO_DETALLE_ERROR',
      error
    ));
  }
}
