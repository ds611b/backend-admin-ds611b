import { PerfilUsuario, Carreras, Usuarios, Escuelas } from '../models/index.js';
import { createErrorResponse } from '../utils/errorResponse.js';

/**
 * Obtiene todos los perfiles de usuario con información de carrera.
 */
export async function getPerfilesUsuario(request, reply) {
  try {
    const perfiles = await PerfilUsuario.findAll({
      include: [{
        model: Carreras,
        as: 'carrera',
        attributes: ['id', 'nombre'],
        include: [{
          model: Escuelas,
          as: 'escuela',
          attributes: ['id', 'nombre']
        }]
      },
      {
        model: Usuarios,
        as: 'usuario',
        attributes: ['id', 'primer_nombre', 'primer_apellido', 'email']
      }
      ]
    });

    // imprime la respuesta en la consola
    console.log(JSON.stringify(perfiles, null, 2));


    reply.send(perfiles);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener los perfiles de usuario',
      'GET_PERFILES_USUARIO_ERROR',
      error
    ));
  }
}

/**
 * Obtiene un perfil de usuario por ID con información de carrera.
 */
export async function getPerfilUsuarioById(request, reply) {
  const { id } = request.params;
  try {
    const perfil = await PerfilUsuario.findByPk(id, {
      include: [{
        model: Carreras,
        as: 'carrera',
        attributes: ['id', 'nombre'],
        include: [{
          model: Escuelas,
          as: 'escuela',
          attributes: ['id', 'nombre']
        }]
      },
      {
        model: Usuarios,
        as: 'usuario',
        attributes: ['id', 'primer_nombre', 'primer_apellido', 'email']
      }
      ]
    });

    if (!perfil) {
      return reply.status(404).send(createErrorResponse(
        'Perfil de usuario no encontrado',
        'PERFIL_USUARIO_NOT_FOUND'
      ));
    }
    reply.send(perfil);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener el perfil de usuario',
      'GET_PERFIL_USUARIO_ERROR',
      error
    ));
  }
}

/**
 * Obtiene un perfil de usuario por ID de usuario con información de carrera.
 */
export async function getPerfilUsuarioByUsuarioId(request, reply) {
  const { usuario_id } = request.params;
  try {
    const perfil = await PerfilUsuario.findOne({
      where: { usuario_id },
      include: [{
        model: Carreras,
        as: 'carrera',
        attributes: ['id', 'nombre'],
        include: [{
          model: Escuelas,
          as: 'escuela',
          attributes: ['id', 'nombre']
        }]

      },
      {
        model: Usuarios,
        as: 'usuario',
        attributes: ['id', 'primer_nombre', 'primer_apellido', 'email']
      }
      ]
    });

    reply.send(perfil);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener el perfil de usuario',
      'GET_PERFIL_USUARIO_ERROR',
      error
    ));
  }
}

export async function getPerfilesUsuarioByGenero(request, reply) {
  const { genero } = request.params;
  try {
    const perfiles = await PerfilUsuario.findAll({
      where: { genero },
      include: {
        model: Usuarios,
        as: 'usuario'
      }
    });

    if (!perfiles || perfiles.length === 0) {
      return reply.status(404).send(createErrorResponse(
        'No se encontraron perfiles con el género especificado',
        'PERFILES_NOT_FOUND'
      ));
    }

    reply.send(perfiles);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener perfiles por género',
      'GET_PERFILES_GENERO_ERROR',
      error
    ));
  }
}

/**
 * Crea un nuevo perfil de usuario con opción de carrera.
 */
export async function createPerfilUsuario(request, reply) {
  const { usuario_id, direccion, telefono, fecha_nacimiento, genero, foto_perfil, carnet, anio_academico, id_carrera } = request.body;

  try {
    // Verificar si la carrera existe si se proporciona
    if (id_carrera) {
      const carrera = await Carreras.findByPk(id_carrera);
      if (!carrera) {
        return reply.status(400).send(createErrorResponse(
          'La carrera especificada no existe',
          'CARRERA_NOT_FOUND'
        ));
      }
    }

    const nuevoPerfil = await PerfilUsuario.create({
      usuario_id,
      direccion,
      telefono,
      fecha_nacimiento: fecha_nacimiento ? new Date(fecha_nacimiento) : null,
      genero,
      foto_perfil,
      carnet,
      anio_academico,
      id_carrera
    });

    // Obtener el perfil recién creado con la relación de carrera
    const perfilCompleto = await PerfilUsuario.findByPk(nuevoPerfil.id, {
      include: [{
        model: Carreras,
        as: 'carrera',
        attributes: ['id', 'nombre']
      },
      {
        model: Usuarios,
        as: 'usuario',
        attributes: ['id', 'primer_nombre', 'primer_apellido', 'email']
      }
      ]
    });

    reply.status(201).send(perfilCompleto);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al crear el perfil de usuario',
      'CREATE_PERFIL_USUARIO_ERROR',
      error
    ));
  }
}

/**
 * Actualiza un perfil de usuario existente incluyendo la carrera.
 */
export async function updatePerfilUsuario(request, reply) {
  const { id } = request.params;
  const { direccion, telefono, fecha_nacimiento, genero, foto_perfil, carnet, anio_academico, id_carrera } = request.body;

  try {
    const perfil = await PerfilUsuario.findByPk(id);
    if (!perfil) {
      return reply.status(404).send(createErrorResponse(
        'Perfil de usuario no encontrado',
        'PERFIL_USUARIO_NOT_FOUND'
      ));
    }

    // Verificar si la nueva carrera existe
    if (id_carrera) {
      const carrera = await Carreras.findByPk(id_carrera);
      if (!carrera) {
        return reply.status(400).send(createErrorResponse(
          'La carrera especificada no existe',
          'CARRERA_NOT_FOUND'
        ));
      }
    }

    await perfil.update({
      direccion,
      telefono,
      fecha_nacimiento: fecha_nacimiento ? new Date(fecha_nacimiento) : null,
      genero,
      foto_perfil,
      carnet,
      anio_academico,
      id_carrera
    });

    // Obtener el perfil actualizado con la relación de carrera
    const perfilActualizado = await PerfilUsuario.findByPk(id, {
      include: [{
        model: Carreras,
        as: 'carrera',
        attributes: ['id', 'nombre']
      }]
    });

    reply.send(perfilActualizado);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al actualizar el perfil de usuario',
      'UPDATE_PERFIL_USUARIO_ERROR',
      error
    ));
  }
}

/**
 * Elimina un perfil de usuario por ID.
 */
export async function deletePerfilUsuario(request, reply) {
  const { id } = request.params;
  try {
    const perfil = await PerfilUsuario.findByPk(id);
    if (!perfil) {
      return reply.status(404).send(createErrorResponse(
        'Perfil de usuario no encontrado',
        'PERFIL_USUARIO_NOT_FOUND'
      ));
    }
    await perfil.destroy();
    reply.status(204).send();
  } catch (error) {
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      reply.status(400).send(createErrorResponse(
        'No se puede eliminar: Existen registros asociados a este perfil',
        'PERFIL_HAS_RELATIONS',
        error
      ));
    } else {
      request.log.error(error);
      reply.status(500).send(createErrorResponse(
        'Error al eliminar el perfil de usuario',
        'DELETE_PERFIL_USUARIO_ERROR',
        error
      ));
    }
  }
}

/**
 * Actualiza de forma conjunta los datos del Usuario y su Perfil asociado.
 */
export async function updateUsuarioConPerfil(request, reply) {
  const { id } = request.params; // ID del usuario
  const {
    // Campos de Usuario
    primer_nombre,
    segundo_nombre,
    primer_apellido,
    segundo_apellido,
    email,
    // Campos de PerfilUsuario
    direccion,
    telefono,
    fecha_nacimiento,
    genero,
    carnet,
    anio_academico,
    id_carrera
  } = request.body;

  try {
    // 1. Verificar que el usuario existe
    const usuario = await Usuarios.findByPk(id);
    if (!usuario) {
      return reply.status(404).send(createErrorResponse(
        'Usuario no encontrado',
        'USUARIO_NOT_FOUND'
      ));
    }

    // 2. Validar email único (si se está cambiando)
    if (email && email !== usuario.email) {
      const emailExistente = await Usuarios.findOne({
        where: { email }
      });
      if (emailExistente) {
        return reply.status(409).send(createErrorResponse(
          'El email ya está registrado por otro usuario',
          'EMAIL_DUPLICATED'
        ));
      }
    }

    // 3. Buscar perfil del usuario
    let perfil = await PerfilUsuario.findOne({
      where: { usuario_id: id }
    });

    // 4. Validar carnet único (si se proporciona)
    if (carnet) {
      const perfilConCarnet = await PerfilUsuario.findOne({
        where: { carnet }
      });
      
      // Verificar que el carnet no esté usado por otro perfil
      if (perfilConCarnet && perfilConCarnet.usuario_id !== parseInt(id)) {
        return reply.status(409).send(createErrorResponse(
          'El carné estudiantil ya está registrado por otro usuario',
          'CARNET_DUPLICATED'
        ));
      }
    }

    // 5. Verificar si la carrera existe (si se proporciona)
    if (id_carrera) {
      const carrera = await Carreras.findByPk(id_carrera);
      if (!carrera) {
        return reply.status(400).send(createErrorResponse(
          'La carrera especificada no existe',
          'CARRERA_NOT_FOUND'
        ));
      }
    }

    // 6. Actualizar datos del Usuario
    await Usuarios.update(
      {
        primer_nombre,
        segundo_nombre,
        primer_apellido,
        segundo_apellido,
        email
      },
      { where: { id }, validate: true }
    );

    // 7. Actualizar o crear perfil de usuario
    let perfilId;
    if (perfil) {
      // Actualizar perfil existente
      await perfil.update({
        direccion,
        telefono,
        fecha_nacimiento: fecha_nacimiento ? new Date(fecha_nacimiento) : perfil.fecha_nacimiento,
        genero,
        carnet,
        anio_academico,
        id_carrera
      });
      perfilId = perfil.id;
    } else {
      // Crear nuevo perfil si no existe
      if (!carnet) {
        return reply.status(400).send(createErrorResponse(
          'El carné estudiantil es obligatorio para crear un perfil',
          'CARNET_REQUIRED'
        ));
      }
      const nuevoPerfil = await PerfilUsuario.create({
        usuario_id: id,
        direccion,
        telefono,
        fecha_nacimiento: fecha_nacimiento ? new Date(fecha_nacimiento) : null,
        genero,
        carnet,
        anio_academico,
        id_carrera
      });
      perfilId = nuevoPerfil.id;
    }

    // 8. Obtener perfil actualizado
    const perfilActualizado = await PerfilUsuario.findByPk(perfilId, {
      include: [{
        model: Carreras,
        as: 'carrera',
        attributes: ['id', 'nombre'],
        include: [{
          model: Escuelas,
          as: 'escuela',
          attributes: ['id', 'nombre']
        }]
      },
      {
        model: Usuarios,
        as: 'usuario',
        attributes: ['id', 'primer_nombre', 'primer_apellido', 'email']
      }
      ]
    });

    if (!perfilActualizado) {
      request.log.error(`No se pudo recuperar el perfil con id: ${perfilId}`);
      return reply.status(404).send(createErrorResponse(
        'No se pudo recuperar el perfil actualizado',
        'PERFIL_NOT_RECOVERED'
      ));
    }

    reply.send(perfilActualizado);

  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al actualizar el usuario y perfil',
      'UPDATE_USUARIO_PERFIL_ERROR',
      error
    ));
  }
}