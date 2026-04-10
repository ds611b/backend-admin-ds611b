import dotenv from 'dotenv';

dotenv.config();

export default {
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || 'localhost',
  nodeEnv: process.env.NODE_ENV || 'development',
  docsPath: process.env.DOCS_PATH,
  /**
   * Nombres de roles para consultar dinámicamente desde la BD
   * Los IDs se obtienen automáticamente desde la tabla Roles
   */
  roleNames: {
    ESTUDIANTE: 'Estudiante',
    COORDINADOR: 'Coordinador',
    ADMIN: 'Admin',
    // Agregar más roles según sea necesario
  }
};