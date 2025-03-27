import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Instancia de Sequelize para la conexión a la base de datos.
 * @type {Sequelize}
 */
const sequelize = new Sequelize(
  process.env.DB_NAME, 
  process.env.DB_USER, 
  process.env.DB_PASSWORD, 
  {
    host: process.env.DB_HOST,
    dialect: 'mysql', // Usamos MySQL como dialecto
    logging: true,   // Cambia a true para ver las consultas SQL
  }
);

export default sequelize;
