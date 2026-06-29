import { ConfiguracionIA } from '../models/index.js';
import { createErrorResponse } from '../utils/errorResponse.js';

// La configuración vive en una sola fila fija.
const CONFIG_ID = 1;

/**
 * Devuelve (o crea con valores por defecto) la fila única de configuración de IA.
 * Centraliza el findOrCreate para que GET y PATCH operen sobre la misma fila.
 */
async function obtenerOcrearConfig() {
  const [config] = await ConfiguracionIA.findOrCreate({
    where: { id: CONFIG_ID },
    defaults: {
      id: CONFIG_ID,
      chatbot_activo: true,
      recomendaciones_activo: true
    }
  });
  return config;
}

/**
 * GET /api/configuracion-ia
 * Estado actual de las funciones de IA. Lo consume el frontend para mostrar
 * u ocultar el chatbot y las recomendaciones.
 */
export async function getConfiguracionIA(request, reply) {
  try {
    const config = await obtenerOcrearConfig();
    return reply.send(config);
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send(createErrorResponse(
      'Error al obtener la configuración de IA',
      'GET_CONFIGURACION_IA_ERROR',
      error
    ));
  }
}

/**
 * PATCH /api/configuracion-ia
 * Activa/desactiva el chatbot y/o las recomendaciones. Solo se actualizan los
 * campos enviados (ambos son opcionales). Pensado para el Coordinador General.
 */
export async function updateConfiguracionIA(request, reply) {
  const { chatbot_activo, recomendaciones_activo, actualizado_por } = request.body;

  try {
    const config = await obtenerOcrearConfig();

    const cambios = {};
    if (typeof chatbot_activo === 'boolean') cambios.chatbot_activo = chatbot_activo;
    if (typeof recomendaciones_activo === 'boolean') cambios.recomendaciones_activo = recomendaciones_activo;

    if (Object.keys(cambios).length === 0) {
      return reply.status(400).send(createErrorResponse(
        'Debe enviar al menos un campo booleano: chatbot_activo o recomendaciones_activo',
        'VALIDATION_ERROR'
      ));
    }

    cambios.actualizado_por = actualizado_por ?? null;
    cambios.updated_at = new Date();

    await config.update(cambios);
    return reply.send(config);
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send(createErrorResponse(
      'Error al actualizar la configuración de IA',
      'UPDATE_CONFIGURACION_IA_ERROR',
      error
    ));
  }
}
