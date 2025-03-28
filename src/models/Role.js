// src/models/Role.js
import { DataTypes } from 'sequelize';
import sequelize from './db.js';

const Role = sequelize.define('Role', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nombre: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  descripcion: {
    type: DataTypes.STRING(50),
    allowNull: true
  }
}, {
  tableName: 'Roles',
  timestamps: false
});

export default Role;
