import { Console } from 'console';
import {
  RegistroHoras,
  HorasRequisito,
  ProyectosInstitucion,
  PerfilUsuario,
  Usuarios,
  Instituciones,
  GrupoEstudiantes,
  Grupos,
  Roles
} from '../models/index.js';
import { createErrorResponse } from '../utils/errorResponse.js';

export async function getRegistroHoras(request, reply) {
  try {
    const registros = await RegistroHoras.findAll({
      include: [
        {
          model: GrupoEstudiantes,
          as: 'grupo_estudiante'
        }
      ]
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
        {
          model: GrupoEstudiantes,
          as: 'grupo_estudiante',
          include: [
            {
              model: HorasRequisito,
              as: 'horas_requisito'
            }
          ]
        }
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
      id_perfil_usuario,
      id_proyecto,
      fecha,
      horas_realizadas,
      descripcion_actividad,
      evidencia_url,
      supervisor_nombre,
      supervisor_cargo
    } = request.body;

    const proyecto = await ProyectosInstitucion.findOne({
      where: { id: id_proyecto },
      attributes: ['tipo_proyecto']
    });

    const grupo_estudiante = await GrupoEstudiantes.findOne({
      where: { id_estudiante: id_perfil_usuario },
      attributes: ['id']
    });

    const id_grupo_estudiante = grupo_estudiante ? grupo_estudiante.id : null;

    const tipo_horas = proyecto?.tipo_proyecto;

    console.log('proyecto encontrado:', proyecto);

    console.log('Tipo de horas del proyecto:', tipo_horas);

    const nuevoRegistro = await RegistroHoras.create({
      id_grupo_estudiante,
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

    console.log('Nuevo registro creado:', nuevoRegistro);

    

    const registroCompleto = await RegistroHoras.findByPk(nuevoRegistro.id, {
        include: [
          {
            model: GrupoEstudiantes,
            as: 'grupo_estudiante',
            include: [
              {
                model: HorasRequisito,
                as: 'horas_requisito'
              }
            ]
          }
        ],
        transaction
      });

    await transaction.commit();

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
      id_proyecto,
      fecha,
      horas_realizadas,
      descripcion_actividad,
      evidencia_url,
      supervisor_nombre,
      supervisor_cargo
    } = request.body;

    // 1️⃣ Verificar que el registro existe (igual que el create verifica el proyecto)
    const registro = await RegistroHoras.findByPk(id, {
      include: [
        {
          model: GrupoEstudiantes,
          as: 'grupo_estudiante',
          include: [
            {
              model: HorasRequisito,
              as: 'horas_requisito'
            }
          ]
        }
      ],
      transaction
    });

    if (!registro) {
      await transaction.rollback();
      return reply.status(404).send(createErrorResponse(
        'Registro de horas no encontrado',
        'REGISTRO_HORAS_NOT_FOUND'
      ));
    }

    // 2️⃣ Guard: no editar si ya fue aprobado
    if (registro.estado_validacion === 'Aprobado') {
      await transaction.rollback();
      return reply.status(409).send(createErrorResponse(
        'No se puede editar un registro ya aprobado',
        'REGISTRO_ALREADY_APPROVED'
      ));
    }

    // 3️⃣ Si cambia el proyecto, recalcular tipo_horas (igual que el create)
    let tipo_horas = registro.tipo_horas;

    if (id_proyecto && id_proyecto !== registro.id_proyecto) {
      const proyecto = await ProyectosInstitucion.findOne({
        where: { id: id_proyecto },
        attributes: ['tipo_proyecto'],
        transaction
      });
      tipo_horas = proyecto?.tipo_proyecto ?? registro.tipo_horas;
    }

    // 4️⃣ Actualizar — vuelve a Pendiente si el estudiante edita
    await registro.update({
      id_proyecto:            id_proyecto            ?? registro.id_proyecto,
      fecha:                  fecha                  ?? registro.fecha,
      horas_realizadas:       horas_realizadas       ?? registro.horas_realizadas,
      descripcion_actividad:  descripcion_actividad  ?? registro.descripcion_actividad,
      evidencia_url:          evidencia_url          ?? registro.evidencia_url,
      supervisor_nombre:      supervisor_nombre      ?? registro.supervisor_nombre,
      supervisor_cargo:       supervisor_cargo       ?? registro.supervisor_cargo,
      tipo_horas,
      estado_validacion: 'Pendiente',   // siempre vuelve a revisión
      observaciones_validacion: null,   // limpiar observaciones anteriores
      validado_por: null,
      fecha_validacion: null
    }, { transaction });

    // 5️⃣ Retornar completo con los mismos includes que el create
    const registroActualizado = await RegistroHoras.findByPk(id, {
      include: [
        {
          model: GrupoEstudiantes,
          as: 'grupo_estudiante',
          include: [
            {
              model: HorasRequisito,
              as: 'horas_requisito'
            }
          ]
        }
      ],
      transaction
    });

    await transaction.commit();

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
/**
 * Obtiene el listado de horas realizadas por un estudiante específico.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function getHorasPorEstudiante(request, reply) {
  const { id_perfil_usuario } = request.params;
  let { id_proyecto, tipo_horas } = request.query;

  try {
    // 🔹 Obtener perfil del estudiante
    const perfilUsuario = await PerfilUsuario.findByPk(id_perfil_usuario, {
      include: [{
        model: Usuarios,
        as: 'usuario',
        attributes: ['id', 'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido', 'email']
      }]
    });

    if (!perfilUsuario) {
      return reply.status(404).send(createErrorResponse(
        'Perfil de usuario no encontrado',
        'PERFIL_USUARIO_NOT_FOUND'
      ));
    }

    // 🔹 Buscar requisitos del estudiante — SIN filtrar por id_proyecto
    //    porque HorasRequisito no tiene columna id_proyecto
    const whereRequisito = {
      id_estudiante: id_perfil_usuario
    };

    // ✅ Si viene id_proyecto, obtener tipo_horas y filtrar requisitos por tipo
    if (id_proyecto && !tipo_horas) {
      const proyecto = await ProyectosInstitucion.findByPk(id_proyecto, {
        attributes: ['tipo_proyecto']
      });
      tipo_horas = proyecto?.tipo_proyecto || null;
    }

    if (tipo_horas) {
      whereRequisito.tipo_horas = tipo_horas;
    }

    const requisitosHoras = await HorasRequisito.findAll({
      where: whereRequisito
    });

    console.log(`Requisitos encontrados para estudiante ${id_perfil_usuario} con tipo_horas ${tipo_horas}:`, requisitosHoras.length);

    // ver que tiene requisitosHoras
    console.log('RequisitosHoras:', JSON.stringify(requisitosHoras, null, 2));

    if (!requisitosHoras.length) {
      return reply.send({
        estudiante: {
          id: perfilUsuario.id,
          nombre_completo: `${perfilUsuario.usuario.primer_nombre} ${perfilUsuario.usuario.segundo_nombre || ''} ${perfilUsuario.usuario.primer_apellido} ${perfilUsuario.usuario.segundo_apellido || ''}`.trim(),
          carnet: perfilUsuario.carnet,
          email: perfilUsuario.usuario?.email
        },
        total_horas_registradas: 0,
        total_horas_aprobadas: 0,
        registros: []
      });
    }

    // 🔹 obtener los IDs de grupos del estudiante de la tabla grupoEstudiante
    const idGrupoEstudiante = await GrupoEstudiantes.findAll({
      where: {
        id_estudiante: id_perfil_usuario
      },
      attributes: ['id']
    });

    const idsGrupoEstudiante = idGrupoEstudiante.map(g => g.id);

    // 🔹 Filtro sobre RegistroHoras
    const whereRegistros = {
      id_grupo_estudiante: idsGrupoEstudiante
    };

    // ✅ id_proyecto se filtra aquí, en RegistroHoras, donde SÍ existe la columna
    if (id_proyecto) {
      whereRegistros.id_proyecto = id_proyecto;
    }

    // 🔹 Obtener registros incluyendo datos del proyecto
    const registros = await RegistroHoras.findAll({
      where: whereRegistros,
      include: [
        {
          model: ProyectosInstitucion,
          as: 'proyecto',
          attributes: ['id', 'nombre'],
          include: [
            {
              model: Instituciones,
              as: 'institucion',
              attributes: ['id', 'nombre']
            }
          ]
        }
      ],
      order: [['fecha', 'DESC']]
    });

    console.log(whereRegistros);

        console.log('registros:', JSON.stringify(registros, null, 2));

    // 🔹 Evitar duplicados
    const registrosUnicos = [];
    const ids = new Set();
    for (const r of registros) {
      if (!ids.has(r.id)) {
        ids.add(r.id);
        registrosUnicos.push(r);
      }
    }

    let totalHorasRegistradas = 0;
    let totalHorasAprobadas = 0;

    const registrosDetallados = registrosUnicos.map(registro => {
      const horas = parseFloat(registro.horas_realizadas) || 0;
      totalHorasRegistradas += horas;

      if (registro.estado_validacion === 'Aprobado') {
        totalHorasAprobadas += horas;
      }

      return {
        id: registro.id,
        fecha: registro.fecha,
        horas_realizadas: horas,
        descripcion_actividad: registro.descripcion_actividad,
        tipo_horas: registro.horas_requisito?.tipo_horas,
        estado_validacion: registro.estado_validacion,
        observaciones_validacion: registro.observaciones_validacion,
        // ✅ Ahora sí viene del include correctamente
        proyecto: registro.proyecto ? {
          id: registro.proyecto.id,
          nombre: registro.proyecto.nombre,
          institucion: registro.proyecto.institucion?.nombre ?? null
        } : null,
        supervisor: {
          nombre: registro.supervisor_nombre,
          cargo: registro.supervisor_cargo
        },
        evidencia_url: registro.evidencia_url
      };
    });

    reply.send({
      estudiante: {
        id: perfilUsuario.id,
        nombre_completo: `${perfilUsuario.usuario.primer_nombre} ${perfilUsuario.usuario.segundo_nombre || ''} ${perfilUsuario.usuario.primer_apellido} ${perfilUsuario.usuario.segundo_apellido || ''}`.trim(),
        carnet: perfilUsuario.carnet,
        email: perfilUsuario.usuario?.email
      },
      total_horas_registradas: totalHorasRegistradas,
      total_horas_aprobadas: totalHorasAprobadas,
      registros: registrosDetallados
    });

  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener las horas del estudiante',
      'GET_HORAS_ESTUDIANTE_ERROR',
      error
    ));
  }
}

/**
 * Obtiene el resumen del estado de un proyecto con información de horas por cada estudiante.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function getResumenProyecto(request, reply) {
  const { id_proyecto } = request.params;

  try {
    // Verificar que el proyecto existe
    const proyecto = await ProyectosInstitucion.findByPk(id_proyecto, {
      include: [{
        model: Instituciones,
        as: 'institucion'
      }]
    });

    if (!proyecto) {
      return reply.status(404).send(createErrorResponse(
        'Proyecto no encontrado',
        'PROYECTO_NOT_FOUND'
      ));
    }

    // Obtener todos los registros de horas del proyecto
    const registrosProyecto = await RegistroHoras.findAll({
      where: { id_proyecto },
      include: [
        {
          model: GrupoEstudiantes,
          as: 'grupo_estudiante', // 🔥 AQUÍ ESTÁ LA CLAVE
          include: [
            {
              model: HorasRequisito,
              as: 'horas_requisito',
              include: [
                {
                  model: PerfilUsuario,
                  as: 'perfil_estudiante',
                  include: [
                    {
                      model: Usuarios,
                      as: 'usuario',
                      attributes: ['id', 'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido', 'email']
                    }
                  ]
                }
              ]
            }
          ]
        }
      ],
      order: [['fecha', 'DESC']]
    });

    console.log (`🔍 Registros encontrados para proyecto ${id_proyecto}:`, registrosProyecto.length);

    // Agrupar por estudiante
    const estudiantesMap = new Map();
    let totalHorasProyecto = 0;
    let totalHorasAprobadas = 0;

    for (const registro of registrosProyecto) {
      const perfil = registro.grupo_estudiante?.horas_requisito?.perfil_estudiante;
      console.log('Perfil del estudiante en el registro:', JSON.stringify(perfil, null, 2));
      if (!perfil) continue;
      console.log(perfil);
      console.log('Perfil del estudiante encontrado:', JSON.stringify(perfil, null, 2));

      const idPerfil = perfil.id;
      const horas = parseFloat(registro.horas_realizadas) || 0;
      totalHorasProyecto += horas;

      if (registro.estado_validacion === 'Aprobado') {
        totalHorasAprobadas += horas;
      }

      if (!estudiantesMap.has(idPerfil)) {
        estudiantesMap.set(idPerfil, {
          id_perfil_usuario: perfil.id,
          carnet: perfil.carnet,
          nombre_completo: perfil.usuario ?
            `${perfil.usuario.primer_nombre} ${perfil.usuario.segundo_nombre || ''} ${perfil.usuario.primer_apellido} ${perfil.usuario.segundo_apellido || ''}`.trim()
            : null,
          email: perfil.usuario?.email,
          total_horas_registradas: 0,
          total_horas_aprobadas: 0,
          total_horas_pendientes: 0,
          total_horas_rechazadas: 0,
          actividades: []
        });
      }

      //* estuiante map console log para ver que tiene el estudiante map
      console.log(`🔍 Estudiante `, JSON.stringify(estudiantesMap.get(idPerfil)));

      const estudianteData = estudiantesMap.get(idPerfil);
      estudianteData.total_horas_registradas += horas;

      if (registro.estado_validacion === 'Aprobado') {
        estudianteData.total_horas_aprobadas += horas;
      } else if (registro.estado_validacion === 'Pendiente') {
        estudianteData.total_horas_pendientes += horas;
      } else if (registro.estado_validacion === 'Rechazado') {
        estudianteData.total_horas_rechazadas += horas;
      }

      estudianteData.actividades.push({
        fecha: registro.fecha,
        descripcion: registro.descripcion_actividad,
        horas: registro.horas_realizadas,
        tipo_horas: registro.HorasRequisito?.tipo_horas,
        estado: registro.estado_validacion,
        observaciones: registro.observaciones_validacion
      });
    }

    reply.send({
      proyecto: {
        id: proyecto.id,
        nombre: proyecto.nombre,
        descripcion: proyecto.descripcion,
        fecha_inicio: proyecto.fecha_inicio,
        fecha_fin: proyecto.fecha_fin,
        institucion: proyecto.institucion?.nombre,
        modalidad: proyecto.modalidad,
        direccion: proyecto.direccion,
        tipo_proyecto: proyecto.tipo_proyecto,
        horas_requeridas: proyecto.horas_requeridas,
        estado: proyecto.estado
      },
      estadisticas: {
        total_horas_registradas: totalHorasProyecto,
        total_horas_aprobadas: totalHorasAprobadas,
        total_horas_pendientes: totalHorasProyecto - totalHorasAprobadas,
        numero_estudiantes: estudiantesMap.size,
        numero_registros: registrosProyecto.length
      },
      estudiantes: Array.from(estudiantesMap.values())
    });
    
    console.log('Este es ' +JSON.stringify({ proyecto: proyecto.nombre, total_registros: registrosProyecto.length, numero_estudiantes: estudiantesMap.size, estudiantes: Array.from(estudiantesMap.values()) }, null, 2));
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener el resumen del proyecto',
      'GET_RESUMEN_PROYECTO_ERROR',
      error
    ));
  }
}

export async function validarRegistroHoras(request, reply) {
  const transaction = await RegistroHoras.sequelize.transaction();

  try {
    const {
      ids,
      accion,
      validado_por,
      observaciones_validacion
    } = request.body;

    // ── Validaciones básicas del body ──────────────────────────────────────
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      await transaction.rollback();
      return reply.status(400).send(createErrorResponse(
        'El campo "ids" es requerido y debe ser un array no vacío',
        'VALIDATION_ERROR'
      ));
    }

    const accionesValidas = ['Aprobado', 'Rechazado', 'Pendiente'];
    if (!accionesValidas.includes(accion)) {
      await transaction.rollback();
      return reply.status(400).send(createErrorResponse(
        `La acción debe ser una de: ${accionesValidas.join(', ')}`,
        'VALIDATION_ERROR'
      ));
    }

    if (accion === 'Rechazado' && !observaciones_validacion?.trim()) {
      await transaction.rollback();
      return reply.status(400).send(createErrorResponse(
        'Las observaciones son requeridas cuando se rechaza un registro',
        'VALIDATION_ERROR'
      ));
    }

    if (!validado_por) {
      await transaction.rollback();
      return reply.status(400).send(createErrorResponse(
        'El campo "validado_por" es requerido',
        'VALIDATION_ERROR'
      ));
    }

    // ── Buscar todos los registros de una sola vez ─────────────────────────
    const registros = await RegistroHoras.findAll({
      where: { id: ids },
      include: [
        {
          model: GrupoEstudiantes,
          as: 'grupo_estudiante',
          include: [
            {
              model: HorasRequisito,
              as: 'horas_requisito'
            }
          ]
        }
      ],
      transaction
    });

    // Detectar IDs que no existen en BD
    const idsEncontrados = registros.map(r => r.id);
    const idsNoEncontrados = ids.filter(id => !idsEncontrados.includes(id));
    if (idsNoEncontrados.length > 0) {
      await transaction.rollback();
      return reply.status(404).send(createErrorResponse(
        `Los siguientes registros no fueron encontrados: ${idsNoEncontrados.join(', ')}`,
        'REGISTRO_HORAS_NOT_FOUND'
      ));
    }

    // ── Procesar cada registro ─────────────────────────────────────────────
    const resultados = { exitosos: [], fallidos: [] };

    for (const registro of registros) {
      try {
        const requisito = registro.grupo_estudiante?.horas_requisito;
        const estadoAnterior = registro.estado_validacion;

        // Caso 1: Se está aprobando un registro que antes NO estaba aprobado
        if (accion === 'Aprobado' && estadoAnterior !== 'Aprobado') {
          if (requisito) {
            await requisito.update({
              horas_completadas: parseFloat(requisito.horas_completadas) + parseFloat(registro.horas_realizadas)
            }, { transaction });
          }
        }

        // Caso 2: Se está revirtiendo un registro que SÍ estaba aprobado
        if (estadoAnterior === 'Aprobado' && accion !== 'Aprobado') {
          if (requisito) {
            const nuevasHoras = Math.max(
              0,
              parseFloat(requisito.horas_completadas) - parseFloat(registro.horas_realizadas)
            );
            await requisito.update({
              horas_completadas: nuevasHoras
            }, { transaction });
          }
        }
        console.log ('Perfil validador ID:', validado_por);
        const perfilValidador = await PerfilUsuario.findOne({
          where: { id: validado_por },
          attributes: ['id', 'usuario_id'],
        });

        console.log('Perfil validador encontrado:', JSON.stringify(perfilValidador, null, 2));
        const usuarioValidador = await Usuarios.findOne({
          where: { id: perfilValidador?.usuario_id },
          attributes: ['id', 'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido', 'rol_id'],
        });
        console.log('Usuario validador encontrado:', JSON.stringify(usuarioValidador, null, 2));
        const cargoValidador = await Roles.findOne({
          where: { id: usuarioValidador?.rol_id },
          attributes: ['nombre'], 
        });
        console.log('Cargo validador encontrado:', JSON.stringify(cargoValidador, null, 2));

        // Actualizar el registro
        await registro.update({
          estado_validacion: accion,
          validado_por,
          supervisor_nombre: usuarioValidador ? `${usuarioValidador.primer_nombre} ${usuarioValidador.primer_apellido}` : null,
          supervisor_cargo: cargoValidador ? cargoValidador.nombre : null,
          observaciones_validacion: observaciones_validacion ?? null,
          fecha_validacion: accion !== 'Pendiente' ? new Date() : null
        }, { transaction });

        resultados.exitosos.push({
          id: registro.id,
          estado_anterior: estadoAnterior,
          estado_nuevo: accion
        });

      } catch (innerError) {
        // Si falla uno en lote, lo registramos pero no interrumpimos los demás
        resultados.fallidos.push({
          id: registro.id,
          error: innerError.message
        });
      }
    }

    // Si todos fallaron, rollback total
    if (resultados.exitosos.length === 0) {
      await transaction.rollback();
      return reply.status(500).send(createErrorResponse(
        'No se pudo procesar ningún registro',
        'VALIDACION_BATCH_ERROR',
        resultados.fallidos
      ));
    }

    await transaction.commit();

    // Respuesta con detalle del lote
    return reply.status(200).send({
      mensaje: `${resultados.exitosos.length} registro(s) procesado(s) correctamente`,
      accion,
      validado_por,
      exitosos: resultados.exitosos,
      ...(resultados.fallidos.length > 0 && { fallidos: resultados.fallidos })
    });

  } catch (error) {
    await transaction.rollback();
    request.log.error(error);
    return reply.status(500).send(createErrorResponse(
      'Error al validar los registros de horas',
      'VALIDAR_REGISTRO_HORAS_ERROR',
      error
    ));
  }
}