import { DocumentosHoras, RegistroHoras } from '../models/index.js';
import { createErrorResponse } from '../utils/errorResponse.js';

export async function getDocumentosHoras(request, reply) {
  try {
    const documentos = await DocumentosHoras.findAll({
      include: [{ model: RegistroHoras }],
      order: [['fecha_subida', 'DESC']]
    });
    reply.send(documentos);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener los documentos',
      'GET_DOCUMENTOS_HORAS_ERROR',
      error
    ));
  }
}

export async function getDocumentosHorasById(request, reply) {
  const { id } = request.params;
  try {
    const documento = await DocumentosHoras.findByPk(id, {
      include: [{ model: RegistroHoras }]
    });
    if (!documento) {
      return reply.status(404).send(createErrorResponse(
        'Documento no encontrado',
        'DOCUMENTO_HORAS_NOT_FOUND'
      ));
    }
    reply.send(documento);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener el documento',
      'GET_DOCUMENTO_HORAS_BY_ID_ERROR',
      error
    ));
  }
}

export async function createDocumentosHoras(request, reply) {
  const {
    id_registro_horas,
    tipo_documento,
    nombre_archivo,
    ruta_archivo,
    descripcion
  } = request.body;

  try {
    const nuevoDocumento = await DocumentosHoras.create({
      id_registro_horas,
      tipo_documento,
      nombre_archivo,
      ruta_archivo,
      descripcion
    });
    reply.status(201).send(nuevoDocumento);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al crear el documento',
      'CREATE_DOCUMENTO_HORAS_ERROR',
      error
    ));
  }
}

export async function updateDocumentosHoras(request, reply) {
  const { id } = request.params;
  const {
    id_registro_horas,
    tipo_documento,
    nombre_archivo,
    ruta_archivo,
    descripcion
  } = request.body;

  try {
    const documento = await DocumentosHoras.findByPk(id);
    if (!documento) {
      return reply.status(404).send(createErrorResponse(
        'Documento no encontrado',
        'DOCUMENTO_HORAS_NOT_FOUND'
      ));
    }
    await documento.update({
      id_registro_horas,
      tipo_documento,
      nombre_archivo,
      ruta_archivo,
      descripcion
    });
    reply.send(documento);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al actualizar el documento',
      'UPDATE_DOCUMENTO_HORAS_ERROR',
      error
    ));
  }
}

export async function deleteDocumentosHoras(request, reply) {
  const { id } = request.params;
  try {
    const documento = await DocumentosHoras.findByPk(id);
    if (!documento) {
      return reply.status(404).send(createErrorResponse(
        'Documento no encontrado',
        'DOCUMENTO_HORAS_NOT_FOUND'
      ));
    }
    await documento.destroy();
    reply.status(204).send();
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al eliminar el documento',
      'DELETE_DOCUMENTO_HORAS_ERROR',
      error
    ));
  }
}