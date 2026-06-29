import { exportRegistroHorasCSV } from '../controllers/reportsController.js';

async function reportsRoutes(fastify) {
  fastify.get('/reports/registro-horas/csv', {
    schema: {
      description: 'Exporta registros de horas a CSV filtrando por fecha y proyecto',
      tags: ['Reportes'],
      querystring: {
        type: 'object',
        properties: {
          from: { type: 'string', format: 'date' },
          to: { type: 'string', format: 'date' },
          id_proyecto: { type: 'integer' },
          tipo_horas: { type: 'string', enum: ['A', 'S'] }
        }
      },
      response: {
        200: { type: 'string' },
        500: { $ref: 'ErrorResponse' }
      }
    }
  }, exportRegistroHorasCSV);
  fastify.get('/reports/registro-horas/xlsx', {
    schema: {
      description: 'Exporta registros de horas a Excel (XLSX) con columnas detalladas',
      tags: ['Reportes'],
      querystring: {
        type: 'object',
        properties: {
          from: { type: 'string', format: 'date' },
          to: { type: 'string', format: 'date' },
          id_proyecto: { type: 'integer' },
          tipo_horas: { type: 'string', enum: ['A', 'S'] }
        }
      },
      response: {
        200: { type: 'string' },
        500: { $ref: 'ErrorResponse' }
      }
    }
  }, async (request, reply) => {
    // Lazy import to avoid startup cost if not used
    const { exportRegistroHorasXLSX } = await import('../controllers/reportsController.js');
    return exportRegistroHorasXLSX(request, reply);
  });
}

export default reportsRoutes;
