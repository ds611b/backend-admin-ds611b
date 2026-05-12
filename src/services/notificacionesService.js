import { Notificaciones, Usuarios } from '../models/index.js';

/**
 * Mapa en memoria para gestionar las conexiones SSE activas.
 * Key: usuarioId (string)
 * Value: Fastify Reply object
 */
const conexionesActivas = new Map();

/**
 * Gestiona el stream SSE para un usuario específico.
 * @param {number} usuarioId - ID del usuario que se conecta
 * @param {import('fastify').FastifyReply} reply - Objeto reply de Fastify
 */
export function iniciarStreamSSE(usuarioId, reply) {
  // Configurar headers para SSE
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no' // Para desactivar buffering en nginx
  });

  // Guardar la conexión en el mapa
  conexionesActivas.set(String(usuarioId), reply);

  // Enviar mensaje de conexión exitosa
  reply.raw.write(`data: ${JSON.stringify({ tipo: 'conectado', mensaje: 'Conexión SSE establecida' })}\n\n`);

  // Configurar heartbeat cada 30 segundos para mantener la conexión viva
  const heartbeatInterval = setInterval(() => {
    if (!reply.raw.destroyed) {
      reply.raw.write(`: heartbeat\n\n`);
    } else {
      clearInterval(heartbeatInterval);
    }
  }, 30000);

  // Manejar desconexión del cliente
  reply.raw.on('close', () => {
    clearInterval(heartbeatInterval);
    conexionesActivas.delete(String(usuarioId));
    console.log(`📡 Cliente desconectado: Usuario ${usuarioId}`);
  });

  console.log(`📡 Cliente conectado: Usuario ${usuarioId}`);
}

/**
 * Crea una notificación y la emite en tiempo real si el usuario está conectado.
 * @param {number} usuarioId - ID del usuario destinatario
 * @param {object} datos - Datos de la notificación
 * @param {string} datos.titulo - Título de la notificación
 * @param {string} datos.mensaje - Mensaje de la notificación
 * @returns {Promise<object>} La notificación creada
 */
export async function crearNotificacion(usuarioId, { titulo, mensaje }) {
  try {
    console.log('🔔 [NotificacionesService] Creando notificación...');
    console.log('🔔 Usuario ID:', usuarioId);
    console.log('🔔 Título:', titulo);
    console.log('🔔 Mensaje:', mensaje);
    
    // Crear la notificación en la base de datos
    const notificacion = await Notificaciones.create({
      usuario_id: usuarioId,
      titulo,
      mensaje,
      leida: false
    });

    console.log('✅ [NotificacionesService] Notificación guardada en BD con ID:', notificacion.id);

    // Obtener la notificación con las relaciones
    const notificacionCompleta = await Notificaciones.findByPk(notificacion.id, {
      include: [
        {
          model: Usuarios,
          as: 'usuario',
          attributes: ['id', 'primer_nombre', 'primer_apellido', 'email']
        }
      ]
    });

    console.log('✅ [NotificacionesService] Notificación completa obtenida');

    // Emitir en tiempo real si el usuario está conectado
    const conexion = conexionesActivas.get(String(usuarioId));
    if (conexion && !conexion.raw.destroyed) {
      const evento = {
        tipo: 'nueva_notificacion',
        data: notificacionCompleta
      };
      
      conexion.raw.write(`data: ${JSON.stringify(evento)}\n\n`);
      console.log(`📨 Notificación enviada en tiempo real al usuario ${usuarioId}`);
    } else {
      console.log(`📭 Usuario ${usuarioId} no está conectado. Notificación guardada.`);
    }

    return notificacionCompleta;
  } catch (error) {
    console.error('❌ [NotificacionesService] Error al crear notificación:', error);
    console.error('❌ [NotificacionesService] Detalles del error:', error.message);
    console.error('❌ [NotificacionesService] Stack:', error.stack);
    throw error;
  }
}

/**
 * Obtiene el historial de notificaciones de un usuario.
 * @param {number} usuarioId - ID del usuario
 * @param {object} opciones - Opciones de filtrado
 * @param {number} [opciones.limit=50] - Límite de resultados
 * @param {boolean} [opciones.soloNoLeidas=false] - Filtrar solo no leídas
 * @returns {Promise<Array>} Lista de notificaciones
 */
export async function obtenerNotificaciones(usuarioId, { limit = 50, soloNoLeidas = false } = {}) {
  try {
    const whereCondition = { usuario_id: usuarioId };
    
    if (soloNoLeidas) {
      whereCondition.leida = false;
    }

    const notificaciones = await Notificaciones.findAll({
      where: whereCondition,
      order: [['created_at', 'DESC']],
      limit,
      include: [
        {
          model: Usuarios,
          as: 'usuario',
          attributes: ['id', 'primer_nombre', 'primer_apellido', 'email']
        }
      ]
    });

    return notificaciones;
  } catch (error) {
    console.error('Error al obtener notificaciones:', error);
    throw error;
  }
}

/**
 * Marca una notificación como leída.
 * @param {number} notificacionId - ID de la notificación
 * @returns {Promise<object>} La notificación actualizada
 */
export async function marcarComoLeida(notificacionId) {
  try {
    const notificacion = await Notificaciones.findByPk(notificacionId);
    
    if (!notificacion) {
      throw new Error('Notificación no encontrada');
    }

    notificacion.leida = true;
    await notificacion.save();

    return notificacion;
  } catch (error) {
    console.error('Error al marcar notificación como leída:', error);
    throw error;
  }
}

/**
 * Marca todas las notificaciones de un usuario como leídas.
 * @param {number} usuarioId - ID del usuario
 * @returns {Promise<number>} Número de notificaciones actualizadas
 */
export async function marcarTodasComoLeidas(usuarioId) {
  try {
    const [actualizadas] = await Notificaciones.update(
      { leida: true },
      {
        where: {
          usuario_id: usuarioId,
          leida: false
        }
      }
    );

    return actualizadas;
  } catch (error) {
    console.error('Error al marcar todas las notificaciones como leídas:', error);
    throw error;
  }
}

/**
 * Obtiene el conteo de notificaciones no leídas de un usuario.
 * @param {number} usuarioId - ID del usuario
 * @returns {Promise<number>} Cantidad de notificaciones no leídas
 */
export async function contarNoLeidas(usuarioId) {
  try {
    const count = await Notificaciones.count({
      where: {
        usuario_id: usuarioId,
        leida: false
      }
    });

    return count;
  } catch (error) {
    console.error('Error al contar notificaciones no leídas:', error);
    throw error;
  }
}
