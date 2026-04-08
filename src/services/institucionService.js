import { Instituciones, EncargadoInstitucion } from '../models/index.js';

const SECURITY_SERVICE_URL = process.env.SECURITY_SERVICE_URL;

/**
 * Registra un usuario en el backend de seguridad.
 * @param {object} usuarioData - Datos del usuario a registrar.
 * @returns {Promise<object>} El usuario creado con su id.
 */
async function registrarUsuarioSeguridad(usuarioData) {
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
