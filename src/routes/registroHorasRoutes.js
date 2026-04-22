import {
  getRegistroHoras,
  getRegistroHorasById,
  createRegistroHoras,
  updateRegistroHoras,
  deleteRegistroHoras,
  getHorasPorEstudiante,
  getResumenProyecto
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
          tipo_horas: { type: 'string', enum: ['Ambientales', 'Sociales'], description: 'Filtrar por tipo de horas (opcional)' }
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
}

export default registroHorasRoutes;
