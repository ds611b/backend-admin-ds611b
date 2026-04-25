import { Json } from 'sequelize/lib/utils';
import { Grupos, HorasRequisito, PerfilUsuario, Usuarios, RegistroHoras, GrupoEstudiantes } from '../models/index.js';
import { createErrorResponse } from '../utils/errorResponse.js';
import { Console } from 'console';

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
          as: 'perfil_estudiante'
        },
        {
          model: GrupoEstudiantes,
          as: 'grupo_estudiante',
          include: [
            {
              model: Grupos,
              as: 'Grupo'
            }
          ]
        }
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

    const requisito = await HorasRequisito.findOne({
      where: {
        id_estudiante: perfil.id,
        tipo_horas: tipo_horas
      }
    });

    if (!requisito) {
      return reply.status(404).send({
        message: 'Requisito de horas no encontrado'
      });
    }

    const grupoId = requisito.id_grupo_estudiante;
    
    const grupoEstudiante = await GrupoEstudiantes.findOne({
      where: { id_estudiante: requisito.id_estudiante}
    });

    const grupo = await Grupos.findOne({
     where : { id: grupoEstudiante.id_grupo },
    })

    if (!grupo) {
      return reply.status(404).send({
        message: 'Grupo no encontrado'
      });
    }

    var requeridas = 0;

    if(tipo_horas === 'A') {
      requeridas = grupo.horas_ambientales;
    } else if (tipo_horas === 'S') {
      requeridas = grupo.horas_sociales;
    }


    const horasPendientes = await RegistroHoras.sum('horas_realizadas', {
      where: {
        id_grupo_estudiante: grupoId,
        estado_validacion: 'Pendiente',
        tipo_horas
      }
    });

    const horasCompletadas = await RegistroHoras.sum('horas_realizadas', {
      where: {
        id_grupo_estudiante: grupoId,
        estado_validacion: 'Aprobado',
        tipo_horas
      }
    });

    // 🔒 asegurar números válidos
    const pendientes = Number(horasPendientes || 0);
    const completadas = Number(horasCompletadas || 0);

    const resumen = {
      usuario_id: idUsuario,
      tipo_horas,
      horas_requeridas: requeridas,
      horas_completadas: completadas,
      horas_pendientes_aprobacion: pendientes,
      horas_restantes: requeridas - completadas
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
    id_estudiante,
    id_grupo,
    horas_requeridas,
    horas_completadas = 0,
    fecha_inicio,
    estado = 'Pendiente',
    tipo_horas
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
      id_estudiante,
      id_grupo,
      horas_requeridas,
      horas_completadas,
      fecha_inicio,
      estado,
      tipo_horas
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
    id_estudiante,
    id_grupo,
    horas_requeridas,
    horas_completadas,
    fecha_inicio,
    estado
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
      id_estudiante,
      id_grupo,
      horas_requeridas,
      horas_completadas,
      fecha_inicio,
      estado
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