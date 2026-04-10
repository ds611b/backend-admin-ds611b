import { DataTypes } from 'sequelize';
import sequelize from './db.js';

const Grupos = sequelize.define('Grupos', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  codigo: {
    type: DataTypes.STRING(20),
    unique: true,
    allowNull: true,
  },
  nombre: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  descripcion: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  horas_ambientales: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  horas_sociales: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  fecha_creacion: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'Grupos',
  timestamps: false,
});

export default Grupos;