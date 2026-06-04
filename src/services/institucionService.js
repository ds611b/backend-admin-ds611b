import { Instituciones, EncargadoInstitucion, Usuarios, PerfilUsuario } from '../models/index.js';
import { getRolIdByName } from './roleService.js';
import config from '../config/config.js';

const SECURITY_SERVICE_URL = process.env.SECURITY_SERVICE_URL;

/**
 * Registra un usuario en el backend de seguridad.
 * @param {object} usuarioData - Datos del usuario a registrar.
 * @returns {Promise<object>} El usuario creado con su id.
 */
export async function registrarUsuarioSeguridad(usuarioData) {
  let response;
  try {
    response = await fetch(`${SECURITY_SERVICE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...usuarioData, rol_id: 4 }),
    });
  } catch (networkErr) {
    const err = new Error('No se pudo conectar con el servicio de seguridad');
    err.step = 'REGISTER_USER';
    err.statusCode = 503;
    err.details = networkErr.message;
    throw err;
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const err = new Error(
      body?.message || `El servicio de seguridad respondió con estado ${response.status}`
    );
    err.step = 'REGISTER_USER';
    err.statusCode = response.status;
    err.details = body;
    throw err;
  }

  return response.json();
}

/**
 * Flujo completo: registra usuario en seguridad, crea encargado e institución en ConnectPRO.
 *
 * Si falla después de crear el usuario en seguridad, retorna un error claro
 * indicando el paso que falló y los IDs de los recursos ya creados.
 *
 * @param {object} params
 * @param {object} params.institucion - Datos de la institución.
 * @param {object} params.encargado   - Datos del encargado.
 * @param {object} params.usuario     - Datos del usuario a registrar en seguridad.
 * @returns {Promise<object>} La institución creada con su encargado.
 */
export async function createInstitucionCompleta({ institucion, encargado, usuario }) {
  // Paso 1 — registrar usuario en el backend de seguridad
  const usuarioCreado = await registrarUsuarioSeguridad(usuario);
  const usuarioId = usuarioCreado.id;

  // Paso 2 — crear EncargadoInstitucion en ConnectPRO
  let nuevoEncargado;
  try {
    nuevoEncargado = await EncargadoInstitucion.create({
      nombres: encargado.nombres,
      apellidos: encargado.apellidos,
      correo: encargado.correo,
      telefono: encargado.telefono,
      usuario_id: usuarioId,
    });
  } catch (dbErr) {
    const err = new Error('Error al crear el encargado de institución');
    err.step = 'CREATE_ENCARGADO';
    err.statusCode = 500;
    err.details = dbErr.message;
    err.createdResources = {
      usuarioId,
      nota: 'El usuario fue creado en el servicio de seguridad pero el encargado no pudo guardarse en ConnectPRO.',
    };
    throw err;
  }

  // Paso 3 — crear Institución en ConnectPRO
  let nuevaInstitucion;
  try {
    nuevaInstitucion = await Instituciones.create({
      nombre: institucion.nombre,
      direccion: institucion.direccion,
      telefono: institucion.telefono,
      email: institucion.email,
      nit: institucion.nit,
      fecha_fundacion: institucion.fecha_fundacion ? new Date(institucion.fecha_fundacion) : null,
      estado: 'Pendiente',
      id_encargado: nuevoEncargado.id,
    });
  } catch (dbErr) {
    const err = new Error('Error al crear la institución');
    err.step = 'CREATE_INSTITUCION';
    err.statusCode = 500;
    err.details = dbErr.message;
    err.createdResources = {
      usuarioId,
      encargadoId: nuevoEncargado.id,
      nota: 'El usuario y el encargado fueron creados pero la institución no pudo guardarse en ConnectPRO.',
    };
    throw err;
  }

  // Retornar la institución completa con el encargado incluido
  return Instituciones.findByPk(nuevaInstitucion.id, {
    include: [{ model: EncargadoInstitucion, as: 'encargado' }],
  });
}

/**
 * Asigna un encargado a una institución a partir de un usuario_id.
 *
 * - Verifica que la institución y el usuario existan.
 * - Si ya existe un EncargadoInstitucion para ese usuario_id lo reutiliza;
 *   de lo contrario crea uno nuevo con los datos del usuario.
 * - Actualiza Instituciones.id_encargado sin generar duplicados.
 *
 * @param {object} params
 * @param {number} params.institucionId - ID de la institución.
 * @param {number} params.usuarioId    - ID del usuario en la tabla Usuarios.
 * @returns {Promise<object>} La institución actualizada con su encargado incluido.
 */
export async function assignEncargadoToInstitucion({ institucionId, usuarioId }) {
  // 1. Verificar institución
  const institucion = await Instituciones.findByPk(institucionId);
  if (!institucion) {
    const err = new Error('Institución no encontrada');
    err.statusCode = 404;
    err.code = 'INSTITUCION_NOT_FOUND';
    throw err;
  }

  // 2. Verificar usuario
  const usuario = await Usuarios.findByPk(usuarioId);
  if (!usuario) {
    const err = new Error('Usuario no encontrado');
    err.statusCode = 404;
    err.code = 'USUARIO_NOT_FOUND';
    throw err;
  }

  // 3. Verificar que el usuario tenga rol Institución
  const rolInstitucionId = await getRolIdByName(config.roleNames.INSTITUCION);
  if (rolInstitucionId === null) {
    const err = new Error('Error de configuración: rol "Institución" no encontrado en la base de datos');
    err.statusCode = 500;
    err.code = 'ROLE_CONFIG_ERROR';
    throw err;
  }
  if (usuario.rol_id !== rolInstitucionId) {
    const err = new Error('El usuario no tiene el rol de Institución y no puede ser asignado como encargado');
    err.statusCode = 422;
    err.code = 'INVALID_USER_ROLE';
    throw err;
  }

  // 4. Buscar o crear EncargadoInstitucion para ese usuario_id
  let encargado = await EncargadoInstitucion.findOne({ where: { usuario_id: usuarioId } });
  if (!encargado) {
    const perfil = await PerfilUsuario.findOne({ where: { usuario_id: usuarioId } });
    const nombres = [usuario.primer_nombre, usuario.segundo_nombre].filter(Boolean).join(' ');
    const apellidos = [usuario.primer_apellido, usuario.segundo_apellido].filter(Boolean).join(' ');
    encargado = await EncargadoInstitucion.create({
      nombres,
      apellidos,
      correo: usuario.email,
      telefono: perfil?.telefono ?? null,
      usuario_id: usuarioId,
    });
  }

  // 4. Actualizar la institución con el encargado encontrado/creado
  await institucion.update({ id_encargado: encargado.id });

  return Instituciones.findByPk(institucionId, {
    include: [{ model: EncargadoInstitucion, as: 'encargado' }],
  });
}
