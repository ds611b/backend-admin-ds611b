// src/models/Institucion.js
import { DataTypes } from 'sequelize';
import sequelize from './db.js';

/**
 * Modelo que representa la tabla 'Instituciones'
 */
const Institucion = sequelize.define('Institucion', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nombre: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true
  },
  direccion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  telefono: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  email: {
    type: DataTypes.STRING(150),
    allowNull: true,
    unique: true
  },
  fecha_fundacion: {
    type: DataTypes.DATE,
    allowNull: true
  },
  nit: {
    type: DataTypes.STRING(25),
    allowNull: true
  }
}, {
  tableName: 'Instituciones',
  timestamps: true,              // Activamos timestamps
  createdAt: 'created_at',       // Mapeamos a la columna created_at
  updatedAt: 'updated_at'        // Mapeamos a la columna updated_at
});

export default Institucion;
