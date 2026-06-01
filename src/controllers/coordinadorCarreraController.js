import { CoordinadoresCarrera, Carreras, Escuelas, Usuarios } from '../models/index.js';
import { createErrorResponse } from '../utils/errorResponse.js';
import bcrypt from 'bcryptjs';


const SALT_ROUNDS = 10; // igual que en authService.js

function generarPasswordAleatoria(longitud = 12) {
  const mayusculas = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const minusculas = 'abcdefghijklmnopqrstuvwxyz';
  const numeros    = '0123456789';
  const especiales = '@#$%&*!';
  const todos      = mayusculas + minusculas + numeros + especiales;

  const password = [
    mayusculas[Math.floor(Math.random() * mayusculas.length)],
    minusculas[Math.floor(Math.random() * minusculas.length)],
    numeros   [Math.floor(Math.random() * numeros.length)],
    especiales[Math.floor(Math.random() * especiales.length)],
    ...Array.from({ length: longitud - 4 }, () =>
      todos[Math.floor(Math.random() * todos.length)]
    )
  ];

  return password.sort(() => Math.random() - 0.5).join('');
}


/**
 * Obtiene todos los coordinadores con información de su carrera asociada
 */
export async function getCoordinadores(request, reply) {
  try {
    const coordinadores = await CoordinadoresCarrera.findAll({
      include: [{
        model: Carreras,
        as: 'Carrera',
        attributes: ['id', 'nombre'],
        include: [{
          model: Escuelas,
          as: 'escuela',
          attributes: ['id', 'nombre']
        }]
      }],
      order: [['apellidos', 'ASC'], ['nombres', 'ASC']]
    });
    reply.send(coordinadores);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener el listado de coordinadores',
      'GET_COORDINADORES_ERROR',
      error
    ));
  }
}

/**
 * Obtiene un coordinador específico por ID con su carrera y escuela
 */
export async function getCoordinadorById(request, reply) {
  const { id } = request.params;
  try {
    const coordinador = await CoordinadoresCarrera.findByPk(id, {
      include: [{
        model: Carreras,
        as: 'Carrera',
        attributes: ['id', 'nombre'],
        include: [{
          model: Escuelas,
          as: 'escuela',
          attributes: ['id', 'nombre']
        }]
      }]
    });

    if (!coordinador) {
      return reply.status(404).send(createErrorResponse(
        'Coordinador no encontrado',
        'COORDINADOR_NOT_FOUND'
      ));
    }
    reply.send(coordinador);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al obtener la información del coordinador',
      'GET_COORDINADOR_ERROR',
      error
    ));
  }
}

/**
 * Crea un nuevo coordinador
 */
export async function createCoordinador(request, reply) {
  const transaction = await CoordinadoresCarrera.sequelize.transaction();

  try {
    const {
      nombres,
      apellidos,
      correo_institucional,
      telefono,
      id_carrera,
      rol_id = 4
    } = request.body;

    // 1️⃣ Validar carrera
    const carrera = await Carreras.findByPk(id_carrera, { transaction });
    if (!carrera) {
      await transaction.rollback();
      return reply.status(400).send(createErrorResponse(
        'La carrera especificada no existe',
        'CARRERA_NOT_FOUND'
      ));
    }

    // 2️⃣ Email único en CoordinadoresCarrera
    const existeCoord = await CoordinadoresCarrera.findOne({
      where: { correo_institucional },
      transaction
    });
    if (existeCoord) {
      await transaction.rollback();
      return reply.status(409).send(createErrorResponse(
        'El correo institucional ya está registrado como coordinador',
        'DUPLICATE_EMAIL'
      ));
    }

    // 3️⃣ Email único en Usuarios (igual que register() en authService)
    const existeUsuario = await Usuarios.findOne({
      where: { email: correo_institucional },
      transaction
    });
    if (existeUsuario) {
      await transaction.rollback();
      return reply.status(409).send(createErrorResponse(
        'El correo ya tiene una cuenta de usuario asociada',
        'DUPLICATE_USER_EMAIL'
      ));
    }

    // 4️⃣ Generar contraseña y hashear igual que en authService.register()
    const passwordPlana = generarPasswordAleatoria(12);
    const password_hash = await bcrypt.hash(passwordPlana, SALT_ROUNDS);

    // 5️⃣ Separar nombres/apellidos para el modelo Usuarios
    const [primer_nombre, segundo_nombre = '']     = nombres.split(' ');
    const [primer_apellido, segundo_apellido = ''] = apellidos.split(' ');

    // 6️⃣ Crear usuario (mismo patrón que authService.register)
    const nuevoUsuario = await Usuarios.create({
      primer_nombre,
      segundo_nombre: segundo_nombre || null,
      primer_apellido,
      segundo_apellido: segundo_apellido || null,
      email:         correo_institucional,
      password_hash,
      rol_id,
      status: 1
    }, { transaction });

    // 7️⃣ Crear coordinador vinculado
    const nuevoCoordinador = await CoordinadoresCarrera.create({
      nombres,
      apellidos,
      correo_institucional,
      telefono,
      id_carrera,
      id_usuario: nuevoUsuario.id 
    }, { transaction });

    await transaction.commit();

    // 8️⃣ Fetch completo con relaciones
    const coordinadorCreado = await CoordinadoresCarrera.findByPk(nuevoCoordinador.id, {
      include: [{
        model: Carreras,
        as: 'Carrera',
        include: [{ model: Escuelas, as: 'escuela' }]
      }]
    });

    // ✅ Devolver contraseña en texto plano una sola vez
    return reply.status(201).send({
      coordinador: coordinadorCreado,
      credenciales: {
        email:    correo_institucional,
        password: passwordPlana,
        nota:     'Comparte estas credenciales de forma segura. No se volverán a mostrar.'
      }
    });

  } catch (error) {
    await transaction.rollback();
    request.log.error(error);
    return reply.status(500).send(createErrorResponse(
      'Error al crear el coordinador',
      'CREATE_COORDINADOR_ERROR',
      error
    ));
  }
}

/**
 * Actualiza un coordinador existente
 */
export async function updateCoordinador(request, reply) {
  const { id } = request.params;
  const { nombres, apellidos, correo_institucional, telefono, id_carrera } = request.body;

  try {
    const coordinador = await CoordinadoresCarrera.findByPk(id);
    if (!coordinador) {
      return reply.status(404).send(createErrorResponse(
        'Coordinador no encontrado',
        'COORDINADOR_NOT_FOUND'
      ));
    }

    // Validar carrera si se está actualizando
    if (id_carrera) {
      const carrera = await Carreras.findByPk(id_carrera);
      if (!carrera) {
        return reply.status(400).send(createErrorResponse(
          'La carrera especificada no existe',
          'CARRERA_NOT_FOUND'
        ));
      }
    }

    // Validar email único si se está actualizando
    if (correo_institucional && correo_institucional !== coordinador.correo_institucional) {
      const existeEmail = await CoordinadoresCarrera.findOne({ 
        where: { correo_institucional } 
      });
      if (existeEmail) {
        return reply.status(409).send(createErrorResponse(
          'El correo institucional ya está registrado',
          'DUPLICATE_EMAIL'
        ));
      }
    }

    await coordinador.update({
      nombres: nombres || coordinador.nombres,
      apellidos: apellidos || coordinador.apellidos,
      correo_institucional: correo_institucional || coordinador.correo_institucional,
      telefono: telefono || coordinador.telefono,
      id_carrera: id_carrera || coordinador.id_carrera
    });

    // Obtener coordinador actualizado con relaciones
    const coordinadorActualizado = await CoordinadoresCarrera.findByPk(id, {
      include: [{
        model: Carreras,
        as: 'Carrera',
        include: [{
          model: Escuelas,
          as: 'escuela'
        }]
      }]
    });

    reply.send(coordinadorActualizado);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al actualizar el coordinador',
      'UPDATE_COORDINADOR_ERROR',
      error
    ));
  }
}

/**
 * Elimina un coordinador
 */
export async function deleteCoordinador(request, reply) {
  const { id } = request.params;
  
  try {
    const coordinador = await CoordinadoresCarrera.findByPk(id);
    if (!coordinador) {
      return reply.status(404).send(createErrorResponse(
        'Coordinador no encontrado',
        'COORDINADOR_NOT_FOUND'
      ));
    }

    await coordinador.destroy();
    reply.status(204).send();
  } catch (error) {
    request.log.error(error);
    reply.status(500).send(createErrorResponse(
      'Error al eliminar el coordinador',
      'DELETE_COORDINADOR_ERROR',
      error
    ));
  }
}

export default {
  getCoordinadores,
  getCoordinadorById,
  createCoordinador,
  updateCoordinador,
  deleteCoordinador
};