import { RegistroHoras, HorasRequisito, ProyectosInstitucion } from '../models/index.js';
import { createErrorResponse } from '../utils/errorResponse.js';

export async function getRegistroHoras(request, reply) {
  try {
    const registros = await RegistroHoras.findAll({
      include: [
        { model: HorasRequisito },
        { model: ProyectosInstitucion }
      ],
      order: [['fecha', 'DESC']]
    });
    reply.send(registros);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener los registros de horas',
      'GET_REGISTRO_HORAS_ERROR',
      error
    ));
  }
}

export async function getRegistroHorasById(request, reply) {
  const { id } = request.params;
  try {
    const registro = await RegistroHoras.findByPk(id, {
      include: [
        { model: HorasRequisito },
        { model: ProyectosInstitucion }
      ]
    });
    if (!registro) {
      return reply.status(404).send(createErrorResponse(
        'Registro de horas no encontrado',
        'REGISTRO_HORAS_NOT_FOUND'
      ));
    }
    reply.send(registro);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener el registro de horas',
      'GET_REGISTRO_HORAS_BY_ID_ERROR',
      error
    ));
  }
}

export async function createRegistroHoras(request, reply) {
  const transaction = await RegistroHoras.sequelize.transaction();
  
  try {
    const {
      id_horas_requisito,
      id_proyecto,
      fecha,
      tipo_horas,
      horas_realizadas,
      descripcion_actividad,
      evidencia_url,
      supervisor_nombre,
      supervisor_cargo
    } = request.body;

    
      tipo_horas = tipo_horas === 'A' ? 'Ambientales' : tipo_horas === 'S' ? 'Sociales' : null;
    
      if (!tipo_horas) {
        return reply.status(400).send(createErrorResponse(
          'Tipo de horas inválido. Use A para Ambientales o S para Sociales',
          'INVALID_TIPO_HORAS'
        ));
      } 
    

    const nuevoRegistro = await RegistroHoras.create({
      id_horas_requisito,
      id_proyecto,
      fecha,
      tipo_horas,
      horas_realizadas,
      descripcion_actividad,
      evidencia_url,
      supervisor_nombre,
      supervisor_cargo,
      estado_validacion: 'Pendiente'
    }, { transaction });

    await transaction.commit();

    const registroCompleto = await RegistroHoras.findByPk(nuevoRegistro.id, {
      include: [
        { model: HorasRequisito },
        { model: ProyectosInstitucion }
      ]
    });

    reply.status(201).send(registroCompleto);
  } catch (error) {
    await transaction.rollback();
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al crear el registro de horas',
      'CREATE_REGISTRO_HORAS_ERROR',
      error
    ));
  }
}

export async function updateRegistroHoras(request, reply) {
  const { id } = request.params;
  const transaction = await RegistroHoras.sequelize.transaction();
  
  try {
    const {
      id_horas_requisito,
      id_proyecto,
      fecha,
      horas_realizadas,
      descripcion_actividad,
      evidencia_url,
      supervisor_nombre,
      supervisor_cargo,
      estado_validacion,
      observaciones_validacion,
      validado_por
    } = request.body;

    const registro = await RegistroHoras.findByPk(id, { transaction });
    if (!registro) {
      await transaction.rollback();
      return reply.status(404).send(createErrorResponse(
        'Registro de horas no encontrado',
        'REGISTRO_HORAS_NOT_FOUND'
      ));
    }

    // Actualizar horas completadas si cambia el estado a Aprobado
    if (estado_validacion === 'Aprobado' && registro.estado_validacion !== 'Aprobado') {
      const requisito = await HorasRequisito.findByPk(id_horas_requisito, { transaction });
      if (requisito) {
        await requisito.update({
          horas_completadas: requisito.horas_completadas + horas_realizadas
        }, { transaction });
      }
    }

    // Si cambia de Aprobado a otro estado, restar horas
    if (registro.estado_validacion === 'Aprobado' && estado_validacion !== 'Aprobado') {
      const requisito = await HorasRequisito.findByPk(id_horas_requisito, { transaction });
      if (requisito) {
        await requisito.update({
          horas_completadas: requisito.horas_completadas - registro.horas_realizadas
        }, { transaction });
      }
    }

    await registro.update({
      id_horas_requisito,
      id_proyecto,
      fecha,
      horas_realizadas,
      descripcion_actividad,
      evidencia_url,
      supervisor_nombre,
      supervisor_cargo,
      estado_validacion,
      observaciones_validacion,
      validado_por,
      fecha_validacion: estado_validacion !== 'Pendiente' ? new Date() : null
    }, { transaction });

    await transaction.commit();

    const registroActualizado = await RegistroHoras.findByPk(id, {
      include: [
        { model: HorasRequisito },
        { model: ProyectosInstitucion }
      ]
    });

    reply.send(registroActualizado);
  } catch (error) {
    await transaction.rollback();
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al actualizar el registro de horas',
      'UPDATE_REGISTRO_HORAS_ERROR',
      error
    ));
  }
}

export async function deleteRegistroHoras(request, reply) {
  const { id } = request.params;
  const transaction = await RegistroHoras.sequelize.transaction();
  
  try {
    const registro = await RegistroHoras.findByPk(id, { transaction });
    if (!registro) {
      await transaction.rollback();
      return reply.status(404).send(createErrorResponse(
        'Registro de horas no encontrado',
        'REGISTRO_HORAS_NOT_FOUND'
      ));
    }

    // Si estaba aprobado, restar las horas
    if (registro.estado_validacion === 'Aprobado') {
      const requisito = await HorasRequisito.findByPk(registro.id_horas_requisito, { transaction });
      if (requisito) {
        await requisito.update({
          horas_completadas: requisito.horas_completadas - registro.horas_realizadas
        }, { transaction });
      }
    }

    await registro.destroy({ transaction });
    await transaction.commit();
    
    reply.status(204).send();
  } catch (error) {
    await transaction.rollback();
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al eliminar el registro de horas',
      'DELETE_REGISTRO_HORAS_ERROR',
      error
    ));
  }
}