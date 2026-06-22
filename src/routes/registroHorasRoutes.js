import {
  getRegistroHoras,
  getRegistroHorasById,
  createRegistroHoras,
  updateRegistroHoras,
  deleteRegistroHoras,
  getHorasPorEstudiante,
  getHorasPorEstudianteEnProyecto,
  getResumenProyecto,
  validarRegistroHoras,
  ingresoHorasEquivalentes
} from '../controllers/registroHoras.controller.js';

async function registroHorasRoutes(fastify) {

  fastify.get('/registro-horas', {
    schema: {
      description: 'Obtiene el registro de horas',
      tags: ['Registro de horas'],
      response: {
        200: {
          type: 'array',
          items: { $ref: 'RegistroHoras' }
        },
        500: { $ref: 'ErrorResponse' }
      }
    }
  }, getRegistroHoras);

  fastify.get('/registro-horas/:id', {
    schema: {
      description: 'Obtiene un registro de horas por ID',
      tags: ['Registro de horas'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'number' }
        },
        required: ['id']
      },
      response: {
        200: { $ref: 'RegistroHoras' },
        404: { $ref: 'ErrorResponse' },
        500: { $ref: 'ErrorResponse' }
      }
    }
  }, getRegistroHorasById);

  fastify.post('/registro-horas', {
    schema: {
      description: 'Crea un registro de horas ',
      tags: ['Registro de horas'],
      body: { $ref: 'RegistroHorasValidation' },
      response: {
        201: { $ref: 'RegistroHoras' },
        500: { $ref: 'ErrorResponse' }
      }
    }
  }, createRegistroHoras);

  fastify.put('/registro-horas/:id', {
    schema: {
      description: 'Actualiza un registro de horas',
      tags: ['Registro de horas'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'number' }
        },
        required: ['id']
      },
      body: { $ref: 'RegistroHorasValidation' },
      response: {
        200: { $ref: 'RegistroHoras' },
        404: { $ref: 'ErrorResponse' },
        500: { $ref: 'ErrorResponse' }
      }
    }
  }, updateRegistroHoras);

  fastify.delete('/registro-horas/:id', {
    schema: {
      description: 'Elimina un registro de horas',
      tags: ['Registro de horas'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'number' }
        },
        required: ['id']
      },
      response: {
        204: { type: 'null' },
        404: { $ref: 'ErrorResponse' },
        500: { $ref: 'ErrorResponse' }
      }
    }
  }, deleteRegistroHoras);

  // Obtener listado de horas por estudiante
  fastify.get('/registro-horas/estudiante/:id_perfil_usuario', {
    schema: {
      description: 'Obtiene el listado de horas realizadas por un estudiante específico con totales y detalles de actividades',
      tags: ['Registro de horas'],
      params: {
        type: 'object',
        properties: {
          id_perfil_usuario: { type: 'integer', description: 'ID del perfil del estudiante' }
        },
        required: ['id_perfil_usuario']
      },
      querystring: {
        type: 'object',
        properties: {
          id_proyecto: { type: 'integer', description: 'Filtrar por proyecto específico (opcional)' },
          tipo_horas: { type: 'string', enum: ['A', 'S'], description: 'Filtrar por tipo de horas (opcional)' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            estudiante: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                nombre_completo: { type: 'string' },
                carnet: { type: 'string' },
                email: { type: 'string' }
              }
            },
            total_horas_registradas: { type: 'number' },
            total_horas_aprobadas: { type: 'number' },
            registros: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  fecha: { type: 'string', format: 'date' },
                  horas_realizadas: { type: 'number' },
                  descripcion_actividad: { type: 'string' },
                  tipo_horas: { type: 'string' },
                  estado_validacion: { type: 'string' },
                  observaciones_validacion: { type: 'string' },
                  proyecto: {
                    type: 'object',
                    properties: {
                      id: { type: 'integer' },
                      nombre: { type: 'string' },
                      institucion: { type: 'string' }
                    }
                  },
                  supervisor: {
                    type: 'object',
                    properties: {
                      nombre: { type: 'string' },
                      cargo: { type: 'string' }
                    }
                  },
                  evidencia_url: { type: 'string' }
                }
              }
            }
          }
        },
        404: { $ref: 'ErrorResponse' },
        500: { $ref: 'ErrorResponse' }
      }
    }
  }, getHorasPorEstudiante);

  // Obtener horas de un estudiante en un proyecto específico (id_proyecto obligatorio en la URL)
  fastify.get('/registro-horas/estudiante/:id_perfil_usuario/proyecto/:id_proyecto', {
    schema: {
      description: 'Obtiene las horas de un estudiante en un proyecto específico',
      tags: ['Registro de horas'],
      params: {
        type: 'object',
        properties: {
          id_perfil_usuario: { type: 'integer', description: 'ID del perfil del estudiante' },
          id_proyecto: { type: 'integer', description: 'ID del proyecto' }
        },
        required: ['id_perfil_usuario', 'id_proyecto']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            estudiante: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                nombre_completo: { type: 'string' },
                carnet: { type: 'string' },
                email: { type: 'string' }
              }
            },
            total_horas_registradas: { type: 'number' },
            total_horas_aprobadas: { type: 'number' },
            registros: { type: 'array', items: { type: 'object' } }
          }
        },
        404: { $ref: 'ErrorResponse' },
        500: { $ref: 'ErrorResponse' }
      }
    }
  }, getHorasPorEstudianteEnProyecto);

  // Obtener resumen del proyecto con horas por estudiante
  fastify.get('/registro-horas/proyecto/:id_proyecto/resumen', {
    schema: {
      description: 'Consulta general del estado del proyecto con información detallada y horas realizadas por cada estudiante',
      tags: ['Registro de horas'],
      params: {
        type: 'object',
        properties: {
          id_proyecto: { type: 'integer', description: 'ID del proyecto' }
        },
        required: ['id_proyecto']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            proyecto: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                nombre: { type: 'string' },
                descripcion: { type: 'string' },
                fecha_inicio: { type: 'string', format: 'date' },
                fecha_fin: { type: 'string', format: 'date' },
                institucion: { type: 'string' },
                modalidad: { type: 'string' },
                direccion: { type: 'string' },
                tipo_proyecto: { type: 'string' },
                horas_requeridas: { type: 'integer' },
                estado: { type: 'string' }
              }
            },
            estadisticas: {
              type: 'object',
              properties: {
                total_horas_registradas: { type: 'number' },
                total_horas_aprobadas: { type: 'number' },
                total_horas_pendientes: { type: 'number' },
                numero_estudiantes: { type: 'integer' },
                numero_registros: { type: 'integer' }
              }
            },
            estudiantes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id_perfil_usuario: { type: 'integer' },
                  carnet: { type: 'string' },
                  nombre_completo: { type: 'string' },
                  email: { type: 'string' },
                  total_horas_registradas: { type: 'number' },
                  total_horas_aprobadas: { type: 'number' },
                  total_horas_pendientes: { type: 'number' },
                  total_horas_rechazadas: { type: 'number' },
                  actividades: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        fecha: { type: 'string', format: 'date' },
                        descripcion: { type: 'string' },
                        horas: { type: 'number' },
                        tipo_horas: { type: 'string' },
                        estado: { type: 'string' },
                        observaciones: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        404: { $ref: 'ErrorResponse' },
        500: { $ref: 'ErrorResponse' }
      }
    }
  }, getResumenProyecto);
  // ✅ NUEVA — validar uno o varios registros
  fastify.patch('/registro-horas/validar', {
    schema: {
      description: 'Aprueba, rechaza o revierte uno o múltiples registros de horas',
      tags: ['Registro de horas'],
      body: {
        type: 'object',
        required: ['ids', 'accion', 'validado_por'],
        properties: {
          ids: { type: 'array', items: { type: 'integer' }, minItems: 1 },
          accion: { type: 'string', enum: ['Aprobado', 'Rechazado', 'Pendiente'] },
          validado_por: { type: 'integer' },
          observaciones_validacion: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            mensaje: { type: 'string' },
            accion: { type: 'string' },
            validado_por: { type: 'integer' },
            exitosos: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  estado_anterior: { type: 'string' },
                  estado_nuevo: { type: 'string' }
                }
              }
            },
            fallidos: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  error: { type: 'string' }
                }
              }
            }
          }
        },
        400: { $ref: 'ErrorResponse' },
        404: { $ref: 'ErrorResponse' },
        500: { $ref: 'ErrorResponse' }
      }
    }

  }, validarRegistroHoras);
  // ✅ NUEVA — ingreso rápido de horas equivalentes por coordinador
  fastify.post('/registro-horas/ingreso-equivalente', {
    schema: {
      description: 'Crea institución (o reutiliza), proyecto, aplicación del estudiante y registro de horas en una sola operación. Usado por coordinadores para ingresar horas equivalentes.',
      tags: ['Registro de horas'],
      body: {
        type: 'object',
        required: ['institucion', 'proyecto', 'estudiante', 'registro-horas'],
        properties: {
          institucion: {
            type: 'object',
            required: ['nombre', 'estado'],
            properties: {
              nombre: { type: 'string' },
              direccion: { type: 'string' },
              telefono: { type: 'string' },
              email: { type: 'string', format: 'email' },
              nit: { type: 'string' },
              fecha_fundacion: { type: 'string', format: 'date' },
              estado: { type: 'string', enum: ['Aprobado', 'Pendiente', 'Rechazado'] }
            }
          },
          proyecto: {
            type: 'object',
            required: ['nombre'],
            properties: {
              nombre: { type: 'string' },
              descripcion: { type: 'string' },
              sitio_web: { type: 'string' },
              fecha_inicio: { type: 'string', format: 'date' },
              fecha_fin: { type: 'string', format: 'date' },
              modalidad: { type: 'string', enum: ['Presencial', 'Virtual', 'Híbrido'] },
              direccion: { type: 'string' },
              actividad_principal: { type: 'string' },
              horario_requerido: { type: 'string' },
              disponibilidad: { type: 'boolean' },
              horas_requeridas: { type: 'number' },
              personas_requeridas: { type: 'integer' },
              tipo_proyecto: { type: 'string', enum: ['A', 'S'] },
              estado: { type: 'string', enum: ['Aprobado', 'Pendiente', 'Rechazado'] }
            }
          },
          estudiante: {
            type: 'object',
            required: ['estudiante_id', 'estado'],
            properties: {
              estudiante_id: { type: 'integer' },
              estado: { type: 'string', enum: ['Aprobado', 'Pendiente', 'Rechazado','Finalizada'] }
            }
          },
          'registro-horas': {
            type: 'object',
            required: ['id_perfil_usuario', 'fecha', 'horas_realizadas', 'descripcion_actividad', 'estado', 'validado_por'],
            properties: {
              id_perfil_usuario: { type: 'integer' },
              id_proyecto: { type: 'integer' },
              fecha: { type: 'string', format: 'date' },
              horas_realizadas: { type: 'number' },
              descripcion_actividad: { type: 'string' },
              estado: { type: 'string', enum: ['Aprobado', 'Pendiente', 'Rechazado'] },
              validado_por: { type: 'integer' },
              observaciones_validacion: { type: 'string' }
            }
          }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            mensaje: { type: 'string' },
            institucion: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                nombre: { type: 'string' },
                creada: { type: 'boolean' }
              }
            },
            proyecto: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                nombre: { type: 'string' }
              }
            },
            aplicacion: {
              type: 'object',
              properties: {
                estudiante_id: { type: 'integer' },
                proyecto_id: { type: 'integer' },
                estado: { type: 'string' }
              }
            },
            registro_horas: { type: 'object', additionalProperties: true }
          }
        },
        404: { $ref: 'ErrorResponse' },
        500: { $ref: 'ErrorResponse' }
      }
    }
  }, ingresoHorasEquivalentes);


}


export default registroHorasRoutes;
