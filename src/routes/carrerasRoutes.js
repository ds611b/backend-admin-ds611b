import { 
  getCarreras, 
  getCarreraById, 
  createCarrera, 
  updateCarrera, 
  deleteCarrera,
  getEstudiantesByCarreraId,
  getDetalleAplicacionesEstudiante,
  getEstudiantesDetalleByCarrera
} from '../controllers/carrerasController.js';

async function carrerasRoutes(fastify, options) {
  // GET /carreras
  fastify.get('/carreras', {
    schema: {
      description: 'Obtiene todas las carreras con su escuela asociada',
      tags: ['Carreras'],
      response: {
        200: {
          description: 'Lista de carreras obtenida exitosamente',
          type: 'array',
          items: { $ref: 'Carreras' }
        },
        500: {
          description: 'Error al obtener las carreras',
          $ref: 'ErrorResponse'
        }
      }
    }
  }, getCarreras);

  // GET /carreras/:id
  fastify.get('/carreras/:id', {
    schema: {
      description: 'Obtiene una carrera por ID con su escuela asociada',
      tags: ['Carreras'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'ID de la carrera' }
        },
        required: ['id']
      },
      response: {
        200: {
          description: 'Carrera encontrada',
          $ref: 'Carreras'
        },
        404: {
          description: 'Carrera no encontrada',
          $ref: 'ErrorResponse'
        },
        500: {
          description: 'Error al obtener la carrera',
          $ref: 'ErrorResponse'
        }
      }
    }
  }, getCarreraById);

  // POST /carreras
  fastify.post('/carreras', {
    schema: {
      description: 'Crea una nueva carrera asociada a una escuela',
      tags: ['Carreras'],
      body: {
        $ref: 'CarreraValidation'
      },
      response: {
        201: {
          description: 'Carrera creada exitosamente',
          $ref: 'Carreras'
        },
        400: {
          description: 'La escuela especificada no existe',
          $ref: 'ErrorResponse'
        },
        409: {
          description: 'Ya existe una carrera con este nombre en la escuela',
          $ref: 'ErrorResponse'
        },
        500: {
          description: 'Error al crear la carrera',
          $ref: 'ErrorResponse'
        }
      }
    }
  }, createCarrera);

  // PUT /carreras/:id
  fastify.put('/carreras/:id', {
    schema: {
      description: 'Actualiza una carrera existente',
      tags: ['Carreras'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'ID de la carrera a actualizar' }
        },
        required: ['id']
      },
      body: {
        $ref: 'CarreraValidation'
      },
      response: {
        200: {
          description: 'Carrera actualizada exitosamente',
          $ref: 'Carreras'
        },
        400: {
          description: 'La escuela especificada no existe',
          $ref: 'ErrorResponse'
        },
        404: {
          description: 'Carrera no encontrada',
          $ref: 'ErrorResponse'
        },
        409: {
          description: 'Ya existe una carrera con este nombre en la escuela',
          $ref: 'ErrorResponse'
        },
        500: {
          description: 'Error al actualizar la carrera',
          $ref: 'ErrorResponse'
        }
      }
    }
  }, updateCarrera);

  // DELETE /carreras/:id
  fastify.delete('/carreras/:id', {
    schema: {
      description: 'Elimina una carrera por ID',
      tags: ['Carreras'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'ID de la carrera a eliminar' }
        },
        required: ['id']
      },
      response: {
        204: {
          description: 'Carrera eliminada exitosamente',
          type: 'null'
        },
        400: {
          description: 'No se puede eliminar: Existen registros asociados',
          $ref: 'ErrorResponse'
        },
        404: {
          description: 'Carrera no encontrada',
          $ref: 'ErrorResponse'
        },
        500: {
          description: 'Error al eliminar la carrera',
          $ref: 'ErrorResponse'
        }
      }
    }
  }, deleteCarrera);

  // GET /carreras/:id_carrera/estudiantes
  fastify.get('/carreras/:id_carrera/estudiantes', {
    schema: {
      description: 'Obtiene la lista de estudiantes (Usuario & Perfil) por ID de carrera',
      tags: ['Carreras'],
      params: {
        type: 'object',
        properties: {
          id_carrera: { type: 'number', description: 'ID de la carrera' }
        },
        required: ['id_carrera']
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', description: 'Número de página', default: 1, minimum: 1 },
          limit: { type: 'number', description: 'Elementos por página', default: 10, minimum: 1, maximum: 100 }
        }
      },
      response: {
        200: {
          description: 'Lista de estudiantes obtenida exitosamente',
          type: 'object',
          properties: {
            data: { type: 'array', items: { $ref: 'EstudianteConPerfil' } },
            pagination: {
              type: 'object',
              properties: {
                totalItems: { type: 'number' },
                totalPages: { type: 'number' },
                currentPage: { type: 'number' },
                itemsPerPage: { type: 'number' }
              }
            }
          }
        },
        404: {
          description: 'Carrera no encontrada',
          $ref: 'ErrorResponse'
        },
        500: {
          description: 'Error al obtener los estudiantes de la carrera',
          $ref: 'ErrorResponse'
        }
      }
    }
  }, getEstudiantesByCarreraId);

  // GET /carreras/:id_carrera/detalle-aplicaciones/:usuario_id
  fastify.get('/carreras/:id_carrera/detalle-aplicaciones/:usuario_id', {
    schema: {
      description: 'Retorna el detalle de un estudiante de la carrera: perfil, proyecto activo o listado paginado de aplicaciones',
      tags: ['Carreras'],
      params: {
        type: 'object',
        properties: {
          id_carrera: { type: 'number', description: 'ID de la carrera' },
          usuario_id: { type: 'number', description: 'ID del estudiante' }
        },
        required: ['id_carrera', 'usuario_id']
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', description: 'Número de página (aplicaciones)', default: 1, minimum: 1 },
          limit: { type: 'number', description: 'Elementos por página', default: 10, minimum: 1, maximum: 100 }
        }
      },
      response: {
        404: { description: 'Carrera o estudiante no encontrado', $ref: 'ErrorResponse' },
        500: { description: 'Error al obtener el detalle', $ref: 'ErrorResponse' }
      }
    }
  }, getDetalleAplicacionesEstudiante);

  // GET /carreras/:id_carrera/estudiantes/detalle-aplicaciones
  fastify.get('/carreras/:id_carrera/estudiantes/detalle-aplicaciones', {
    schema: {
      description: 'Lista paginada de estudiantes de la carrera con perfil, proyecto activo o aplicaciones realizadas',
      tags: ['Carreras'],
      params: {
        type: 'object',
        properties: {
          id_carrera: { type: 'number', description: 'ID de la carrera' }
        },
        required: ['id_carrera']
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', description: 'Número de página', default: 1, minimum: 1 },
          limit: { type: 'number', description: 'Elementos por página', default: 10, minimum: 1, maximum: 100 }
        }
      },
      response: {
        404: { description: 'Carrera no encontrada', $ref: 'ErrorResponse' },
        500: { description: 'Error al obtener el detalle', $ref: 'ErrorResponse' }
      }
    }
  }, getEstudiantesDetalleByCarrera);
}

export default carrerasRoutes;