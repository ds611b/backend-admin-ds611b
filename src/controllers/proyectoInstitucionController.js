import ProyectosInstitucion from '../models/ProyectosInstitucion.js';
import { createErrorResponse } from '../utils/errorResponse.js';
import Instituciones from '../models/Instituciones.js';

/**
 * Obtiene todos los proyectos de instituciones.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function getProyectosInstitucion(request, reply) {
  try {
    const proyectos = await ProyectosInstitucion.findAll({
      include: { model: Instituciones, as: 'institucion' }
    });
    reply.send(proyectos);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse('Error al obtener los proyectos de instituciones', 'GET_PROYECTOS_INSTITUCION_ERROR', error));
  }
}

/**
 * Obtiene un proyecto de institución por ID.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function getProyectoInstitucionById(request, reply) {
  const { id } = request.params;
  try {
    const proyecto = await ProyectosInstitucion.findByPk(id, {
      include: {
        model: Instituciones,
        as: 'institucion'
      },
    });
    if (!proyecto) {
      return reply.status(404).send(createErrorResponse('Proyecto de institución no encontrado', 'PROYECTO_INSTITUCION_NOT_FOUND'));
    }
    reply.send(proyecto);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse('Error al obtener el proyecto de institución', 'GET_PROYECTO_INSTITUCION_ERROR', error));
  }
}

/**
 * Crea un nuevo proyecto de institución.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function createProyectoInstitucion(request, reply) {
  const { institucion_id, nombre, descripcion, fecha_inicio, fecha_fin, modalidad, direccion, disponibilidad } = request.body;
  try {
    const nuevoProyecto = await ProyectosInstitucion.create({
      institucion_id,
      nombre,
      descripcion,
      fecha_inicio: fecha_inicio ? new Date(fecha_inicio) : null,
      fecha_fin: fecha_fin ? new Date(fecha_fin) : null,
      modalidad,
      direccion,
      disponibilidad
    });
    console.log("objeto: ", nuevoProyecto)
    console.log("id: ", nuevoProyecto.id)
    const proyectoActualizado = await ProyectosInstitucion.findByPk(nuevoProyecto.id, {
      include: {
        model: Instituciones,
        as: 'institucion'
      },
    });
    console.log(proyectoActualizado);
    reply.status(201).send(proyectoActualizado);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse('Error al crear el proyecto de institución', 'CREATE_PROYECTO_INSTITUCION_ERROR', error));
  }
}

/**
 * Actualiza un proyecto de institución existente.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function updateProyectoInstitucion(request, reply) {
  const { id } = request.params;
  const { institucion_id, nombre, descripcion, fecha_inicio, fecha_fin, modalidad, direccion, disponibilidad } = request.body;
  try {
    const proyecto = await ProyectosInstitucion.findByPk(id);
    if (!proyecto) {
      return reply.status(404).send(createErrorResponse('Proyecto de institución no encontrado', 'PROYECTO_INSTITUCION_NOT_FOUND'));
    }
    await proyecto.update({
      institucion_id,
      nombre,
      descripcion,
      fecha_inicio: fecha_inicio ? new Date(fecha_inicio) : null,
      fecha_fin: fecha_fin ? new Date(fecha_fin) : null,
      modalidad,
      direccion,
      disponibilidad
    });
    const proyectoActualizado = await ProyectosInstitucion.findByPk(id, {
      include: {
        model: Instituciones,
        as: 'institucion',
      }
    });
    reply.send(proyectoActualizado);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse('Error al actualizar el proyecto de institución', 'UPDATE_PROYECTO_INSTITUCION_ERROR', error));
  }
}

/**
 * Elimina un proyecto de institución por ID.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function deleteProyectoInstitucion(request, reply) {
  const { id } = request.params;
  try {
    const proyecto = await ProyectosInstitucion.findByPk(id, {
      include: {
        model: Instituciones,
        as: 'institucion'
      },
    });
    if (!proyecto) {
      return reply.status(404).send(createErrorResponse('Proyecto de institución no encontrado', 'PROYECTO_INSTITUCION_NOT_FOUND'));
    }
    await proyecto.destroy();
    reply.status(204).send();
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse('Error al eliminar el proyecto de institución', 'DELETE_PROYECTO_INSTITUCION_ERROR', error));
  }
}