import { Instituciones, EncargadoInstitucion, ProyectosInstitucion, Usuarios, PerfilUsuario } from '../models/index.js';
import { createErrorResponse } from '../utils/errorResponse.js';
import {
  createInstitucionCompleta as createInstitucionCompletaService,
  assignEncargadoToInstitucion as assignEncargadoToInstitucionService,
  registrarUsuarioSeguridad
} from '../services/institucionService.js';

/**
 * Obtiene todas las instituciones.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function getInstituciones(request, reply) {
  try {
    const instituciones = await Instituciones.findAll({
      include: [{
        model: EncargadoInstitucion,
        as: 'encargado'
      }]
    });
    reply.send(instituciones);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener las instituciones',
      'GET_INSTITUCIONES_ERROR',
      error
    ));
  }
}

/**
 * Obtiene una institución por ID.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function getInstitucionById(request, reply) {
  const { id } = request.params;
  try {
    const institucion = await Instituciones.findByPk(id, {
      include: [{
        model: EncargadoInstitucion,
        as: 'encargado'
      }]
    });
    if (!institucion) {
      return reply.status(404).send(createErrorResponse(
        'Institución no encontrada',
        'INSTITUCION_NOT_FOUND'
      ));
    }
    reply.send(institucion);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse('Error al obtener la institución', 'GET_INSTITUCION_ERROR', error));
  }
}

/**
 * Crea una nueva institución.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function createInstitucion(request, reply) {
  const {
    institucion,
    encargado,
    usuario,
    id_encargado = 0,
    id_usuario = 0
  } = request.body;

  try {

    let usuarioId = id_usuario;
    let encargadoId = id_encargado;

    // ===== USUARIO =====

    if (!usuarioId) {

      if (!usuario) {
        return reply.status(400).send(
          createErrorResponse(
            'Debe enviar el objeto usuario cuando id_usuario es 0',
            'USUARIO_REQUIRED'
          )
        );
      }

      const usuarioCreado = await registrarUsuarioSeguridad(usuario);

      usuarioId = usuarioCreado.id;


    } else {

      const usuarioExistente = await Usuarios.findByPk(usuarioId);

      if (!usuarioExistente) {
        return reply.status(404).send(
          createErrorResponse(
            'Usuario no encontrado',
            'USUARIO_NOT_FOUND'
          )
        );
      }
    }

    // ===== ENCARGADO =====

    if (!encargadoId) {

      if (!encargado) {
        return reply.status(400).send(
          createErrorResponse(
            'Debe enviar el objeto encargado cuando id_encargado es 0',
            'ENCARGADO_REQUIRED'
          )
        );
      }

      const nuevoEncargado = await EncargadoInstitucion.create({
        nombres: encargado.nombres,
        apellidos: encargado.apellidos,
        correo: encargado.correo,
        telefono: encargado.telefono,
        usuario_id: usuarioId
      });

      encargadoId = nuevoEncargado.id;

    } else {

      const encargadoExistente = await EncargadoInstitucion.findByPk(encargadoId);

      if (!encargadoExistente) {
        return reply.status(404).send(
          createErrorResponse(
            'Encargado no encontrado',
            'ENCARGADO_NOT_FOUND'
          )
        );
      }
    }

    // ===== INSTITUCIÓN =====

    const nuevaInstitucion = await Instituciones.create({
      nombre: institucion.nombre,
      direccion: institucion.direccion,
      telefono: institucion.telefono,
      email: institucion.email,
      nit: institucion.nit,
      fecha_fundacion: institucion.fecha_fundacion
        ? new Date(institucion.fecha_fundacion)
        : null,
      estado: institucion.estado ?? 'Pendiente',
      id_encargado: encargadoId
    });

    // Crear perfil de usuario para el encargado de la institución
    await PerfilUsuario.create({
      usuario_id: usuarioId,
      telefono: encargado?.telefono ?? null,
      id_institucion: nuevaInstitucion.id,
      carnet: ""
    });


    const institucionCompleta = await Instituciones.findByPk(
      nuevaInstitucion.id,
      {
        include: [{
          model: EncargadoInstitucion,
          as: 'encargado'
        }]
      }
    );

    return reply.status(201).send(institucionCompleta);

  } catch (error) {

    request.log.error(error);

    // Reportar con claridad qué campo único está duplicado (en vez de un
    // "Validation error" opaco). Útil porque el flujo no es transaccional y
    // un intento fallido puede dejar institución/encargado/usuario huérfanos.
    if (error.name === 'SequelizeUniqueConstraintError') {
      const campos = (error.errors ?? []).map(e => e.path).join(', ');
      return reply.status(409).send(
        createErrorResponse(
          `Ya existe un registro con el mismo valor en: ${campos || 'un campo único'}`,
          'INSTITUCION_DUPLICADA',
          error.errors?.map(e => ({ campo: e.path, valor: e.value }))
        )
      );
    }

    return reply.status(500).send(
      createErrorResponse(
        'Error al crear la institución',
        'CREATE_INSTITUCION_ERROR',
        error
      )
    );
  }
}

/**
 * Obtiene instituciones con estado Pendiente o Aceptado (excluye Rechazadas)
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function getInstitucionesActivas(request, reply) {
  try {
    const instituciones = await Instituciones.findAll({
      where: {
        estado: ['Pendiente', 'Aprobado']
      },
      include: [{
        model: EncargadoInstitucion,
        as: 'encargado'
      }]
    });
    reply.send(instituciones);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener las instituciones activas',
      'GET_INSTITUCIONES_ACTIVAS_ERROR',
      error
    ));
  }
}

/**
 * Actualiza una institución existente.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function updateInstitucion(request, reply) {
  const { id } = request.params;

  const {
    institucion,
    encargado,
    usuario,
    id_encargado = 0,
    id_usuario = 0
  } = request.body;

  try {

    const institucionActual = await Instituciones.findByPk(id);

    if (!institucionActual) {
      return reply.status(404).send(
        createErrorResponse(
          'Institución no encontrada',
          'INSTITUCION_NOT_FOUND'
        )
      );
    }

    let usuarioId = id_usuario;
    let encargadoId = id_encargado;

    // ===== USUARIO =====

    if (!usuarioId) {

      if (!usuario) {
        return reply.status(400).send(
          createErrorResponse(
            'Debe enviar el objeto usuario cuando id_usuario es 0',
            'USUARIO_REQUIRED'
          )
        );
      }

      const usuarioCreado = await registrarUsuarioSeguridad(usuario);

      usuarioId = usuarioCreado.id;
    } else {

      const usuarioExistente = await Usuarios.findByPk(usuarioId);

      if (!usuarioExistente) {
        return reply.status(404).send(
          createErrorResponse(
            'Usuario no encontrado',
            'USUARIO_NOT_FOUND'
          )
        );
      }
    }

    // ===== ENCARGADO =====

    if (!encargadoId) {

      if (!encargado) {
        return reply.status(400).send(
          createErrorResponse(
            'Debe enviar el objeto encargado cuando id_encargado es 0',
            'ENCARGADO_REQUIRED'
          )
        );
      }

      const nuevoEncargado = await EncargadoInstitucion.create({
        nombres: encargado.nombres,
        apellidos: encargado.apellidos,
        correo: encargado.correo,
        telefono: encargado.telefono,
        usuario_id: usuarioId
      });

      encargadoId = nuevoEncargado.id;

    } else {

      const encargadoExistente = await EncargadoInstitucion.findByPk(encargadoId);

      if (!encargadoExistente) {
        return reply.status(404).send(
          createErrorResponse(
            'Encargado no encontrado',
            'ENCARGADO_NOT_FOUND'
          )
        );
      }
    }

    // ===== ACTUALIZAR INSTITUCIÓN =====

    await institucionActual.update({
      nombre: institucion.nombre,
      direccion: institucion.direccion,
      telefono: institucion.telefono,
      email: institucion.email,
      nit: institucion.nit,
      fecha_fundacion: institucion.fecha_fundacion
        ? new Date(institucion.fecha_fundacion)
        : null,
      estado: institucion.estado,
      id_encargado: encargadoId
    });

    const institucionActualizada = await Instituciones.findByPk(id, {
      include: [{
        model: EncargadoInstitucion,
        as: 'encargado'
      }]
    });

    return reply.send(institucionActualizada);

  } catch (error) {

    request.log.error(error);

    return reply.status(500).send(
      createErrorResponse(
        'Error al actualizar la institución',
        'UPDATE_INSTITUCION_ERROR',
        error
      )
    );
  }
}
/**
 * Elimina una institución por ID.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function deleteInstitucion(request, reply) {
  const { id } = request.params;
  try {
    const institucion = await Instituciones.findByPk(id);
    if (!institucion) {
      return reply.status(404).send(createErrorResponse('Institución no encontrada', 'INSTITUCION_NOT_FOUND'));
    }
    await institucion.destroy();
    reply.status(204).send();
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse('Error al eliminar la institución', 'DELETE_INSTITUCION_ERROR', error));
  }
}

/**
 * Crea una institución completa: registra el usuario en el servicio de seguridad,
 * luego crea el EncargadoInstitucion y la Institución en ConnectPRO en un único flujo.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function createInstitucionCompleta(request, reply) {
  const { institucion, encargado, usuario } = request.body;
  try {
    const result = await createInstitucionCompletaService({ institucion, encargado, usuario });
    reply.status(201).send(result);
  } catch (error) {
    request.log.error(error);
    const statusCode = error.statusCode || 500;
    const errorCode = `CREATE_INSTITUCION_COMPLETA_ERROR_${error.step || 'UNKNOWN'}`;
    const response = createErrorResponse(error.message, errorCode, error);
    if (error.createdResources) {
      response.createdResources = error.createdResources;
    }
    reply.status(statusCode).send(response);
  }
}

/**
 * Obtiene el listado de proyectos de una institución específica
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function assignEncargadoToInstitucion(request, reply) {
  const { id } = request.params;
  const { usuario_id } = request.body;

  try {
    const result = await assignEncargadoToInstitucionService({ institucionId: id, usuarioId: usuario_id });
    reply.send(result);
  } catch (error) {
    request.log.error(error);
    const statusCode = error.statusCode || 500;
    const code = error.code || 'ASSIGN_ENCARGADO_ERROR';
    reply.status(statusCode).send(createErrorResponse(error.message, code, error));
  }
}

export async function getProyectosByInstitucionId(request, reply) {
  const { id } = request.params;

  try {
    // Verificar que la institución existe
    const institucion = await Instituciones.findByPk(id);
    if (!institucion) {
      return reply.status(404).send(createErrorResponse(
        'Institución no encontrada',
        'INSTITUCION_NOT_FOUND'
      ));
    }

    // Obtener proyectos de la institución
    const proyectos = await ProyectosInstitucion.findAll({
      where: { institucion_id: id },
      include: [
        {
          model: EncargadoInstitucion,
          as: 'encargado'
        },
        {
          model: Instituciones,
          as: 'institucion'
        }
      ],
      order: [['created_at', 'DESC']]
    });

    reply.send(proyectos);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener los proyectos de la institución',
      'GET_PROYECTOS_INSTITUCION_ERROR',
      error
    ));
  }
}


// Función para activar el usuario de la institución al ser aprobada la instución
export async function aprobarInstitucion(request, reply) {
  const { id } = request.params;
  const { estado } = request.body;

  try {
    const institucion = await Instituciones.findByPk(id, {
      include: [{
        model: EncargadoInstitucion,
        as: 'encargado'
      }]
    });
    if (!institucion) {
      return reply.status(404).send(
        createErrorResponse(
          'Institución no encontrada',
          'INSTITUCION_NOT_FOUND'
        )
      );
    }
    
    const encargado = institucion.encargado;
    if (!encargado) {
      return reply.status(404).send(
        createErrorResponse(
          'Encargado de institución no encontrado',
          'ENCARGADO_NOT_FOUND'
        )
      );
    }
    const usuario = await Usuarios.findByPk(encargado.usuario_id);
    if (!usuario) {
      return reply.status(404).send(
        createErrorResponse(
          'Usuario del encargado no encontrado',
          'USUARIO_NOT_FOUND'
        )
      );
    }

    institucion.estado = estado;

    await institucion.save();

    if (estado === 'Aprobado') {
      usuario.status = 1;

      await usuario.save();
    }

    return reply.send(institucion);

  } catch (error) {
    request.log.error(error);

    return reply.status(500).send(
      createErrorResponse(
        'Error al actualizar la institución',
        'UPDATE_INSTITUCION_ERROR',
        error
      )
    );
  }
}
