import { Roles } from '../models/index.js';

/**
 * Cache para almacenar los IDs de roles y evitar consultas repetitivas
 */
const rolesCache = new Map();

/**
 * Obtiene el ID de un rol por su nombre desde la base de datos
 * Utiliza caché para mejorar el rendimiento
 * 
 * @param {string} nombreRol - Nombre del rol a buscar (ej: 'Estudiante', 'Coordinador')
 * @returns {Promise<number|null>} - ID del rol o null si no existe
 */
export async function getRolIdByName(nombreRol) {
  try {
    // Verificar si ya está en caché
    if (rolesCache.has(nombreRol)) {
      return rolesCache.get(nombreRol);
    }

    // Consultar en la base de datos
    const rol = await Roles.findOne({
      where: { nombre: nombreRol },
      attributes: ['id']
    });

    if (rol) {
      // Guardar en caché
      rolesCache.set(nombreRol, rol.id);
      return rol.id;
    }

    return null;
  } catch (error) {
    console.error(`Error al obtener rol "${nombreRol}":`, error);
    return null;
  }
}

/**
 * Limpia el caché de roles (útil si se actualizan los roles en la BD)
 */
export function clearRolesCache() {
  rolesCache.clear();
}

/**
 * Pre-carga todos los roles en memoria al iniciar la aplicación
 * Optimiza las consultas futuras
 */
export async function preloadRoles() {
  try {
    const roles = await Roles.findAll({
      attributes: ['id', 'nombre']
    });

    roles.forEach(rol => {
      rolesCache.set(rol.nombre, rol.id);
    });

    console.log(`✓ Pre-cargados ${roles.length} roles en caché`);
  } catch (error) {
    console.error('Error al pre-cargar roles:', error);
  }
}

export default {
  getRolIdByName,
  clearRolesCache,
  preloadRoles
};
