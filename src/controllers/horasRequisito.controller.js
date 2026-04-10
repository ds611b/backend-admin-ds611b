import { Json } from 'sequelize/lib/utils';
import { Grupos, HorasRequisito, PerfilUsuario, Usuarios, RegistroHoras } from '../models/index.js';
import { createErrorResponse } from '../utils/errorResponse.js';

export async function getHorasRequisito(request, reply) {
  try {
    const requisitos = await HorasRequisito.findAll({
      include: [
        {
          model: PerfilUsuario,
          include: [
            {
              model: Usuarios,
              as: 'usuario',
              attributes: ['id', 'primer_nombre', 'primer_apellido', 'email']
            }
          ],
          as: 'perfil_usuario'
        },
        { model: Grupos, as: 'grupo' },
      ],
      order: [['created_at', 'DESC']]
    });
    reply.send(requisitos);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener los requisitos de horas sociales',
      'GET_HORAS_REQUISITO_ERROR',
      error
    ));
  }
}
export async function getHorasByUsuario(request, reply) {
  const { idUsuario } = request.params;
  const { tipo_horas } = request.query; // Ambientales o Sociales

  try {
    const perfil = await PerfilUsuario.findOne({
      where: { usuario_id: idUsuario }
    });

    if (!perfil) {
      return reply.status(404).send({
        message: 'Perfil no encontrado'
      });
    }

    let tipoMap;

    if (tipo_horas === 'A') {
      tipoMap = 'Ambientales';
    } else if (tipo_horas === 'S') {
      tipoMap = 'Sociales';
    } else {
      return reply.status(400).send({
        message: 'Tipo inválido. Use A o S'
      });
    }


    const requisito = await HorasRequisito.findOne({
      where: {
        id_perfil_usuario: perfil.id,
        tipo_horas: tipoMap
      }
    });

    if (!requisito) {
      return reply.status(404).send({
        message: 'Requisito de horas no encontrado'
      });
    }

    // 🔥 SOLO horas pendientes
    const horasPendientes = await RegistroHoras.sum('horas_realizadas', {
      where: {
        id_horas_requisito: requisito.id,
        estado_validacion: 'Pendiente',
        tipo_horas: tipoMap
      }
    });

    const horasCompletadas = await RegistroHoras.sum('horas_realizadas', {
      where: {
        id_horas_requisito: requisito.id,
        estado_validacion: 'Aprobado',
        tipo_horas: tipo_horas
      }
    });



    const resumen = {
      usuario_id: idUsuario,
      tipo_horas: tipo_horas,
      horas_requeridas: requisito.horas_requeridas,
      horas_completadas: horasCompletadas || 0,
      horas_pendientes_aprobacion: horasPendientes || 0,
      horas_restantes:
        requisito.horas_requeridas - (horasCompletadas || 0)
    };

    reply.send(resumen);

  } catch (error) {
    request.log.error(error);
    reply.status(500).send({
      message: 'Error al obtener resumen de horas'
    });
  }
}

export async function getHorasRequisitoById(request, reply) {
  const { id } = request.params;
  try {
    const requisito = await HorasRequisito.findByPk(id, {
      include: [
        {
          model: PerfilUsuario,
          include: [
            {
              model: Usuarios,
              as: 'usuario',
              attributes: ['id', 'primer_nombre', 'primer_apellido', 'email']
            }
          ]
        }
      ]
    });
    if (!requisito) {
      return reply.status(404).send(createErrorResponse(
        'Requisito de horas no encontrado',
        'HORAS_REQUISITO_NOT_FOUND'
      ));
    }
    reply.send(requisito);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener el requisito de horas sociales',
      'GET_HORAS_REQUISITO_BY_ID_ERROR',
      error
    ));
  }
}

export async function createHorasRequisito(request, reply) {
  const {
    id_perfil_usuario,
    id_grupo,
    horas_requeridas,
    horas_completadas = 0,
    fecha_inicio,
    fecha_limite,
    estado = 'Pendiente',
    institucion_asignada,
    tipo_horas,
    observaciones
  } = request.body;


  tipo_horas = tipo_horas === 'A' ? 'Ambientales' : tipo_horas === 'S' ? 'Sociales' : null;

  if (!tipo_horas) {
    return reply.status(400).send(createErrorResponse(
      'Tipo de horas inválido. Use A para Ambientales o S para Sociales',
      'INVALID_TIPO_HORAS'
    ));
  }

  try {
    const nuevoRequisito = await HorasRequisito.create({
      id_perfil_usuario,
      id_grupo,
      horas_requeridas,
      horas_completadas,
      fecha_inicio,
      fecha_limite,
      estado,
      institucion_asignada,
      tipo_horas,
      observaciones
    });

    const requisitoCompleto = await HorasRequisito.findByPk(nuevoRequisito.id, {
      include: [
        {
          model: PerfilUsuario,
          include: [
            {
              model: Usuarios,
              as: 'usuario',
              attributes: ['id', 'primer_nombre', 'primer_apellido', 'email']
            }
          ]
        },
        { model: Grupos, as: 'grupo' },
      ]
    });

    reply.status(201).send(requisitoCompleto);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al crear el requisito de horas sociales',
      'CREATE_HORAS_REQUISITO_ERROR',
      error
    ));
  }
}

export async function updateHorasRequisito(request, reply) {
  const { id } = request.params;
  const {
    id_perfil_usuario,
    id_grupo,
    horas_requeridas,
    horas_completadas,
    fecha_inicio,
    fecha_limite,
    estado,
    institucion_asignada,
    observaciones
  } = request.body;

  try {
    const requisito = await HorasRequisito.findByPk(id);
    if (!requisito) {
      return reply.status(404).send(createErrorResponse(
        'Requisito de horas no encontrado',
        'HORAS_REQUISITO_NOT_FOUND'
      ));
    }

    await requisito.update({
      id_perfil_usuario,
      id_grupo,
      horas_requeridas,
      horas_completadas,
      fecha_inicio,
      fecha_limite,
      estado,
      institucion_asignada,
      observaciones
    });

    const requisitoActualizado = await HorasRequisito.findByPk(id, {
      include: [
        {
          model: PerfilUsuario,
          include: [
            {
              model: Usuarios,
              as: 'usuario',
              attributes: ['id', 'primer_nombre', 'primer_apellido', 'email']
            }
          ]
        },
        { model: Grupos, as: 'grupo' },
      ]
    });

    reply.send(requisitoActualizado);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al actualizar el requisito de horas sociales',
      'UPDATE_HORAS_REQUISITO_ERROR',
      error
    ));
  }
}

export async function deleteHorasRequisito(request, reply) {
  const { id } = request.params;
  try {
    const requisito = await HorasRequisito.findByPk(id);
    if (!requisito) {
      return reply.status(404).send(createErrorResponse(
        'Requisito de horas no encontrado',
        'HORAS_REQUISITO_NOT_FOUND'
      ));
    }
    await requisito.destroy();
    reply.status(204).send();
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al eliminar el requisito de horas sociales',
      'DELETE_HORAS_REQUISITO_ERROR',
      error
    ));
  }
}