import {
  registrarHorasDiarias,
  obtenerHorasPorEstudiante,
  actualizarDetalleActividad,
  obtenerEstadoProyecto,
  obtenerBitacorasProyectos,
  crearBitacoraProyecto,
  actualizarBitacoraProyecto
} from '../controllers/bitacoraController.js';

/**
 * Define las rutas para las bitácoras y registro de horas.
 * @param {import('fastify').FastifyInstance} fastify - La instancia de Fastify.
 * @param {Object} options - Opciones de registro.
 */
async function bitacoraRoutes(fastify, options) {
  // Obtener todas las bitácoras de proyectos
  fastify.get('/bitacoras', {
    schema: {
      description: 'Obtiene una lista de todas las bitácoras de proyectos.',
      tags: ['Bitácoras'],
      response: {
        200: {
          description: 'Lista de bitácoras obtenida exitosamente.',
          type: 'array',
          items: { $ref: 'BitacoraProyecto' },
        },
        500: {
          description: 'Error al obtener las bitácoras.',
          $ref: 'ErrorResponse',
        },
      },
    },
  }, obtenerBitacorasProyectos);

  // Crear una nueva bitácora de proyecto
  fastify.post('/bitacoras', {
    schema: {
      description: 'Crea una nueva bitácora para un proyecto.',
      tags: ['Bitácoras'],
      body: {
        type: 'object',
        required: ['id_proyecto'],
        properties: {
          id_proyecto: { type: 'integer', description: 'ID del proyecto' },
          fecha_inicio: { type: 'string', format: 'date', description: 'Fecha de inicio de la bitácora' },
          fecha_fin: { type: 'string', format: 'date', description: 'Fecha de fin de la bitácora' },
          estado: { type: 'string', enum: ['En Proceso', 'Aprobado', 'Rechazado'], description: 'Estado de la bitácora' },
          observaciones: { type: 'string', description: 'Observaciones adicionales' },
          estudiantes: { 
            type: 'array', 
            items: { type: 'integer' },
            description: 'Array de IDs de perfiles de usuario a asociar con la bitácora'
          }
        }
      },
      response: {
        201: {
          description: 'Bitácora creada exitosamente.',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { $ref: 'BitacoraProyecto' }
          }
        },
        404: {
          description: 'Proyecto no encontrado.',
          $ref: 'ErrorResponse',
        },
        500: {
          description: 'Error al crear la bitácora.',
          $ref: 'ErrorResponse',
        },
      },
    },
  }, crearBitacoraProyecto);

  // Actualizar una bitácora de proyecto
  fastify.put('/bitacoras/:id', {
    schema: {
      description: 'Actualiza una bitácora de proyecto existente.',
      tags: ['Bitácoras'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'integer', description: 'ID único de la bitácora' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          fecha_inicio: { type: 'string', format: 'date', description: 'Fecha de inicio' },
          fecha_fin: { type: 'string', format: 'date', description: 'Fecha de fin' },
          estado: { type: 'string', enum: ['En Proceso', 'Aprobado', 'Rechazado'], description: 'Estado' },
          observaciones: { type: 'string', description: 'Observaciones' }
        }
      },
      response: {
        200: {
          description: 'Bitácora actualizada exitosamente.',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { $ref: 'BitacoraProyecto' }
          }
        },
        404: {
          description: 'Bitácora no encontrada.',
          $ref: 'ErrorResponse',
        },
        500: {
          description: 'Error al actualizar la bitácora.',
          $ref: 'ErrorResponse',
        },
      },
    },
  }, actualizarBitacoraProyecto);

  // Registrar horas de trabajo diarias
  fastify.post('/bitacoras/registrar-horas', {
    schema: {
      description: 'Registra manualmente las horas trabajadas en un día específico para un estudiante.',
      tags: ['Bitácoras'],
      body: {
        type: 'object',
        required: ['id_bitacora_proyecto', 'id_perfil_usuario', 'total_horas'],
        properties: {
          id_bitacora_proyecto: { type: 'integer', description: 'ID de la bitácora del proyecto' },
          id_perfil_usuario: { type: 'integer', description: 'ID del perfil del usuario/estudiante' },
          detalle_actividades: { type: 'string', description: 'Descripción de las actividades realizadas' },
          total_horas: { type: 'integer', description: 'Total de horas trabajadas' },
          punch_in: { type: 'string', format: 'date-time', description: 'Hora de inicio del trabajo' },
          punch_out: { type: 'string', format: 'date-time', description: 'Hora de fin del trabajo' }
        }
      },
      response: {
        201: {
          description: 'Horas registradas exitosamente.',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { $ref: 'BitacoraItems' }
          }
        },
        404: {
          description: 'Bitácora de proyecto o perfil de usuario no encontrado.',
          $ref: 'ErrorResponse',
        },
        500: {
          description: 'Error al registrar las horas.',
          $ref: 'ErrorResponse',
        },
      },
    },
  }, registrarHorasDiarias);

  // Obtener horas realizadas por estudiante específico
  fastify.get('/bitacoras/estudiante/:id_perfil_usuario/horas', {
    schema: {
      description: 'Obtiene el listado de horas realizadas por un estudiante específico.',
      tags: ['Bitácoras'],
      params: {
        type: 'object',
        properties: {
          id_perfil_usuario: { type: 'integer', description: 'ID del perfil del usuario/estudiante' },
        },
        required: ['id_perfil_usuario'],
      },
      querystring: {
        type: 'object',
        properties: {
          id_proyecto: { type: 'integer', description: 'Filtrar por ID de proyecto (opcional)' }
        }
      },
      response: {
        200: {
          description: 'Horas del estudiante obtenidas exitosamente.',
          type: 'object',
          properties: {
            estudiante: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                nombre_completo: { type: 'string' },
                carnet: { type: 'string' }
              }
            },
            total_horas: { type: 'integer' },
            registros: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id_item: { type: 'integer' },
                  detalle_actividades: { type: 'string' },
                  total_horas: { type: 'integer' },
                  punch_in: { type: 'string', format: 'date-time' },
                  punch_out: { type: 'string', format: 'date-time' },
                  proyecto: {
                    type: 'object',
                    properties: {
                      id: { type: 'integer' },
                      nombre: { type: 'string' },
                      institucion: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        },
        404: {
          description: 'Perfil de usuario no encontrado.',
          $ref: 'ErrorResponse',
        },
        500: {
          description: 'Error al obtener las horas del estudiante.',
          $ref: 'ErrorResponse',
        },
      },
    },
  }, obtenerHorasPorEstudiante);

  // Actualizar detalle de actividad (corregir typos)
  fastify.patch('/bitacoras/items/:id/detalle', {
    schema: {
      description: 'Actualiza el campo "detalle_actividades" de un registro de actividad para corregir typos o errores.',
      tags: ['Bitácoras'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'integer', description: 'ID único del item de bitácora' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        required: ['detalle_actividades'],
        properties: {
          detalle_actividades: { type: 'string', description: 'Nuevo detalle de las actividades' }
        }
      },
      response: {
        200: {
          description: 'Detalle de actividad actualizado exitosamente.',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { $ref: 'BitacoraItems' }
          }
        },
        404: {
          description: 'Registro de actividad no encontrado.',
          $ref: 'ErrorResponse',
        },
        500: {
          description: 'Error al actualizar el detalle.',
          $ref: 'ErrorResponse',
        },
      },
    },
  }, actualizarDetalleActividad);

  // Consulta general del estado del proyecto con horas por estudiante
  fastify.get('/bitacoras/proyecto/:id_proyecto/estado', {
    schema: {
      description: 'Consulta general del estado del proyecto con información detallada y horas realizadas por cada estudiante.',
      tags: ['Bitácoras'],
      params: {
        type: 'object',
        properties: {
          id_proyecto: { type: 'integer', description: 'ID del proyecto' },
        },
        required: ['id_proyecto'],
      },
      response: {
        200: {
          description: 'Estado del proyecto obtenido exitosamente.',
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
                direccion: { type: 'string' }
              }
            },
            estadisticas: {
              type: 'object',
              properties: {
                total_horas_proyecto: { type: 'integer' },
                numero_estudiantes: { type: 'integer' },
                numero_bitacoras: { type: 'integer' }
              }
            },
            bitacoras: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  fecha_inicio: { type: 'string', format: 'date' },
                  fecha_fin: { type: 'string', format: 'date' },
                  estado: { type: 'string' },
                  observaciones: { type: 'string' }
                }
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
                  total_horas: { type: 'integer' },
                  actividades: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        fecha: { type: 'string', format: 'date-time' },
                        detalle: { type: 'string' },
                        horas: { type: 'integer' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        404: {
          description: 'Proyecto no encontrado.',
          $ref: 'ErrorResponse',
        },
        500: {
          description: 'Error al obtener el estado del proyecto.',
          $ref: 'ErrorResponse',
        },
      },
    },
  }, obtenerEstadoProyecto);
}

export default bitacoraRoutes;
