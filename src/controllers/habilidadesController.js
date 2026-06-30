import { Op } from 'sequelize';
import { Habilidades } from '../models/index.js'
import { createErrorResponse } from '../utils/errorResponse.js';

/**
 * Obtiene todas las habilidades.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function getHabilidades(request, reply) {
  const { page = 1, limit = 10, search } = request.query;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  // Filtro opcional por texto: busca la coincidencia en la descripción.
  const termino = typeof search === 'string' ? search.trim() : '';
  const where = termino
    ? { descripcion: { [Op.like]: `%${termino}%` } }
    : undefined;

  try {
    const { count, rows: habilidades } = await Habilidades.findAndCountAll({
      where,
      limit: limitNum,
      offset,
      order: [['descripcion', 'ASC']]
    });

    const totalPages = Math.ceil(count / limitNum);

    reply.send({
      data: habilidades,
      pagination: {
        totalItems: count,
        totalPages,
        currentPage: pageNum,
        itemsPerPage: limitNum
      }
    });
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener las habilidades',
      'GET_HABILIDADES_ERROR',
      error
    ));
  }
}

/**
 * Obtiene una habilidad por ID.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function getHabilidadById(request, reply) {
  const { id } = request.params;
  try {
    const habilidad = await Habilidades.findByPk(id);
    if (habilidad) {
      reply.send(habilidad);
    } else {
      reply.status(404).send(createErrorResponse(
        'Habilidad no encontrada',
        'HABILIDAD_NOT_FOUND'
      ));
    }
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener la habilidad',
      'GET_HABILIDAD_ERROR',
      error
    ));
  }
}

/** Normaliza para comparar: minúsculas, sin acentos, espacios colapsados. */
function normalizarHabilidad(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resuelve una lista de nombres de habilidades a sus IDs, creando las que no
 * existan (find-or-create, sin duplicar, case/acento-insensitive). Pensado para
 * confirmar al guardar las habilidades nuevas recomendadas por la IA.
 *
 * Body: { nombres: string[] }
 * Respuesta: { habilidades: [{ id, descripcion }] }
 */
export async function resolverHabilidades(request, reply) {
  const { nombres } = request.body;

  if (!Array.isArray(nombres) || nombres.length === 0) {
    return reply.status(400).send(createErrorResponse(
      'Debe enviar un arreglo "nombres" no vacío',
      'VALIDATION_ERROR'
    ));
  }

  try {
    // Catálogo actual indexado por nombre normalizado.
    const catalogo = await Habilidades.findAll({ attributes: ['id', 'descripcion'] });
    const mapa = new Map(catalogo.map(h => [normalizarHabilidad(h.descripcion), h]));

    const resultado = [];
    const vistos = new Set();

    for (const raw of nombres) {
      const nombre = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 50);
      if (!nombre) continue;
      const clave = normalizarHabilidad(nombre);
      if (!clave || vistos.has(clave)) continue;
      vistos.add(clave);

      const existente = mapa.get(clave);
      if (existente) {
        resultado.push({ id: existente.id, descripcion: existente.descripcion });
        continue;
      }

      try {
        const creada = await Habilidades.create({ descripcion: nombre });
        mapa.set(clave, creada);
        resultado.push({ id: creada.id, descripcion: creada.descripcion });
      } catch (err) {
        if (err.name === 'SequelizeUniqueConstraintError') {
          const recuperada = await Habilidades.findOne({ where: { descripcion: nombre } });
          if (recuperada) resultado.push({ id: recuperada.id, descripcion: recuperada.descripcion });
        } else {
          throw err;
        }
      }
    }

    reply.send({ habilidades: resultado });
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al resolver las habilidades',
      'RESOLVER_HABILIDADES_ERROR',
      error
    ));
  }
}

/**
 * Crea una habilidad.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function createHabilidad(request, reply) {
  try {
    const habilidad = await Habilidades.create(request.body);
    reply.status(201).send(habilidad);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      reply.status(409).send(createErrorResponse(
        'Ya existe una habilidad con esta descripción',
        'DUPLICATE_HABILIDAD',
        error
      ));
    } else {
      request.log.error(error);
      reply.status(500).send(createErrorResponse(
        'Error al crear la habilidad',
        'CREATE_HABILIDAD_ERROR',
        error
      ));
    }
  }
}

/**
 * Actualiza una habilidad.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function updateHabilidad(request, reply) {
  const { id } = request.params;
  try {
    const [updated] = await Habilidades.update(request.body, {
      where: { id },
      validate: true
    });
    if (updated) {
      const habilidad = await Habilidades.findByPk(id);
      reply.send(habilidad);
    } else {
      reply.status(404).send(createErrorResponse(
        'Habilidad no encontrada',
        'HABILIDAD_NOT_FOUND'
      ));
    }
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      reply.status(409).send(createErrorResponse(
        'No se puede actualizar: Ya existe otra habilidad con esta descripción',
        'HABILIDAD_DUPLICADA',
        error
      ));
    } else {
      request.log.error(error);
      reply.status(500).send(createErrorResponse(
        'Error al actualizar la habilidad',
        'UPDATE_HABILIDAD_ERROR',
        error
      ));
    }
  }
}

/**
 * Elimina una habilidad.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function deleteHabilidad(request, reply) {
  const { id } = request.params;
  try {
    const deleted = await Habilidades.destroy({ where: { id } });
    if (deleted) {
      reply.status(204).send();
    } else {
      reply.status(404).send(createErrorResponse(
        'Habilidad no encontrada',
        'HABILIDAD_NOT_FOUND'
      ));
    }
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al eliminar la habilidad',
      'DELETE_HABILIDAD_ERROR',
      error
    ));
  }
}
