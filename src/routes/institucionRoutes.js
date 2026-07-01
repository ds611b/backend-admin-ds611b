import {
  getInstituciones,
  getInstitucionById,
  createInstitucionCompleta,
  createInstitucion,
  getInstitucionesActivas,
  updateInstitucion,
  deleteInstitucion,
  getProyectosByInstitucionId,
  assignEncargadoToInstitucion,
  aprobarInstitucion,
  crearPropuestaInstitucion,
  registrarEncargadoParaInstitucion
} from '../controllers/institucionController.js';

/**
 * Define las rutas para las instituciones.
 * @param {import('fastify').FastifyInstance} fastify - La instancia de Fastify.
 * @param {Object} options - Opciones de registro.
 */
async function institucionRoutes(fastify, options) {
  // GET /instituciones
  fastify.get('/instituciones', {
    schema: {
      description: 'Obtiene todas las instituciones',
      tags: ['Instituciones'],
      response: {
        200: {
          description: 'Lista de instituciones obtenida exitosamente',
          type: 'array',
          items: { $ref: 'Instituciones' }
        },
        500: {
          description: 'Error al obtener las instituciones',
          $ref: 'ErrorResponse'
        }
      }
    }
  }, getInstituciones);

  // GET /instituciones/:id
  fastify.get('/instituciones/:id', {
    schema: {
      description: 'Obtiene una institución por ID',
      tags: ['Instituciones'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'ID de la institución' }
        },
        required: ['id']
      },
      response: {
        200: {
          description: 'Institución encontrada',
          $ref: 'Instituciones'
        },
        404: {
          description: 'Institución no encontrada',
          $ref: 'ErrorResponse'
        },
        500: {
          description: 'Error al obtener la institución',
          $ref: 'ErrorResponse'
        }
      }
    }
  }, getInstitucionById);

  // GET /instituciones/activas
  fastify.get('/instituciones/activas', {
    schema: {
      description: 'Obtiene instituciones con estado Pendiente o Aceptado (excluye Rechazadas)',
      tags: ['Instituciones'],
      response: {
        200: {
          description: 'Lista de instituciones activas obtenida exitosamente',
          type: 'array',
          items: { $ref: 'Instituciones' }
        },
        500: {
          description: 'Error al obtener las instituciones activas',
          $ref: 'ErrorResponse'
        }
      }
    }
  }, getInstitucionesActivas);

  // POST /instituciones
  fastify.post('/instituciones', {
    schema: {
      description: 'Crea una institución nueva junto con su encargado y usuario de acceso en el servicio de seguridad',
      tags: ['Instituciones'],
      body: {
        $ref: 'InstitucionesCompletaValidation',
      },
      response: {
        201: {
          description: 'Institución creada exitosamente',
          $ref: 'Instituciones'
        },
        400: {
          description: 'Datos inválidos',
          $ref: 'ErrorResponse'
        },
        503: {
          description: 'Error de conexión con el servicio de seguridad',
          $ref: 'ErrorResponse'
        },
        500: {
          description: 'Error al crear la institución',
          $ref: 'ErrorResponse'
        }
      }
    }
  }, createInstitucion);

  // POST /instituciones/propuesta — el estudiante propone una institución (sin encargado/usuario)
  fastify.post('/instituciones/propuesta', {
    schema: {
      description: 'Crea una propuesta de institución (estado Pendiente, sin encargado ni usuario). No crea cuentas.',
      tags: ['Instituciones'],
      body: {
        type: 'object',
        required: ['institucion'],
        properties: {
          institucion: {
            type: 'object',
            required: ['nombre'],
            properties: {
              nombre: { type: 'string' },
              direccion: { type: 'string' },
              telefono: { type: 'string' },
              email: { type: 'string' },
              nit: { type: 'string' },
              fecha_fundacion: { type: 'string' }
            }
          }
        }
      },
      response: {
        201: { $ref: 'Instituciones' },
        400: { $ref: 'ErrorResponse' },
        409: { $ref: 'ErrorResponse' },
        500: { $ref: 'ErrorResponse' }
      }
    }
  }, crearPropuestaInstitucion);

  // POST /instituciones/:id/encargado — el coordinador crea el encargado (+usuario) para una propuesta
  fastify.post('/instituciones/:id/encargado', {
    schema: {
      description: 'Crea el encargado (con su usuario de seguridad) para una institución existente y lo enlaza. Acción del coordinador al aprobar una propuesta.',
      tags: ['Instituciones'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'integer' } }
      },
      body: {
        type: 'object',
        required: ['encargado', 'usuario'],
        properties: {
          encargado: {
            type: 'object',
            required: ['nombres', 'apellidos', 'correo'],
            properties: {
              nombres: { type: 'string' },
              apellidos: { type: 'string' },
              correo: { type: 'string' },
              telefono: { type: 'string' }
            }
          },
          usuario: {
            type: 'object',
            required: ['primer_nombre', 'primer_apellido', 'email', 'password'],
            properties: {
              primer_nombre: { type: 'string' },
              segundo_nombre: { type: 'string' },
              primer_apellido: { type: 'string' },
              segundo_apellido: { type: 'string' },
              email: { type: 'string' },
              password: { type: 'string' }
            }
          }
        }
      },
      response: {
        201: { $ref: 'Instituciones' },
        400: { $ref: 'ErrorResponse' },
        404: { $ref: 'ErrorResponse' },
        409: { $ref: 'ErrorResponse' },
        500: { $ref: 'ErrorResponse' }
      }
    }
  }, registrarEncargadoParaInstitucion);

  // PUT /instituciones/:id
  fastify.put('/instituciones/:id', {
    schema: {
      description: 'Actualiza una institución existente',
      tags: ['Instituciones'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'ID de la institución a actualizar' }
        },
        required: ['id']
      },
      body: {
        $ref: 'InstitucionesCompletaValidation',
      },
      response: {
        200: {
          description: 'Institución actualizada exitosamente',
          $ref: 'Instituciones'
        },
        404: {
          description: 'Institución no encontrada',
          $ref: 'ErrorResponse'
        },
        500: {
          description: 'Error al actualizar la institución',
          $ref: 'ErrorResponse'
        }
      }
    }
  }, updateInstitucion);

  // DELETE /instituciones/:id
  fastify.delete('/instituciones/:id', {
    schema: {
      description: 'Elimina una institución por ID',
      tags: ['Instituciones'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'ID de la institución a eliminar' }
        },
        required: ['id']
      },
      response: {
        204: {
          description: 'Institución eliminada exitosamente',
          type: 'null'
        },
        404: {
          description: 'Institución no encontrada',
          $ref: 'ErrorResponse'
        },
        500: {
          description: 'Error al eliminar la institución',
          $ref: 'ErrorResponse'
        }
      }
    }
  }, deleteInstitucion);

  // PATCH /instituciones/:id/encargado
  fastify.patch('/instituciones/:id/encargado', {
    schema: {
      description: 'Cambia el encargado asignado a una institución',
      tags: ['Instituciones'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'ID de la institución' }
        },
        required: ['id']
      },
      body: { $ref: 'AssignEncargadoValidation' },
      response: {
        200: {
          description: 'Encargado actualizado exitosamente',
          $ref: 'Instituciones'
        },
        404: {
          description: 'Institución o usuario no encontrado',
          $ref: 'ErrorResponse'
        },
        422: {
          description: 'El usuario no tiene rol de Institución',
          $ref: 'ErrorResponse'
        },
        500: {
          description: 'Error al asignar el encargado',
          $ref: 'ErrorResponse'
        }
      }
    }
  }, assignEncargadoToInstitucion);

  // GET /instituciones/:id/proyectos
  fastify.get('/instituciones/:id/proyectos', {
    schema: {
      description: 'Obtiene el listado de proyectos de una institución específica',
      tags: ['Instituciones'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'ID de la institución' }
        },
        required: ['id']
      },
      response: {
        200: {
          description: 'Lista de proyectos obtenida exitosamente',
          type: 'array',
          items: { $ref: 'ProyectosInstitucion' }
        },
        404: {
          description: 'Institución no encontrada',
          $ref: 'ErrorResponse'
        },
        500: {
          description: 'Error al obtener los proyectos de la institución',
          $ref: 'ErrorResponse'
        }
      }
    }
  }, getProyectosByInstitucionId);

fastify.put('/instituciones/:id/aprobar', {
  schema: {
    description: 'Aprueba o rechaza una institución',
    tags: ['Instituciones'],

    params: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'ID de la institución'
        }
      },
      required: ['id']
    },

    body: {
      type: 'object',
      properties: {
        estado: {
          type: 'string',
          enum: ['Aprobado', 'Rechazado']
        }
      },
      required: ['estado']
    },

    response: {
      200: {
        description: 'Institución actualizada exitosamente',
        $ref: 'Instituciones'
      },
      404: {
        description: 'Institución no encontrada',
        $ref: 'ErrorResponse'
      },
      500: {
        description: 'Error al actualizar la institución',
        $ref: 'ErrorResponse'
      }
    }
  }
}, aprobarInstitucion);


}

export default institucionRoutes;