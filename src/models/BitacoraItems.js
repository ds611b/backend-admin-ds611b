import { DataTypes } from 'sequelize';
import sequelize from './db.js';

const BitacoraItems = sequelize.define('BitacoraItems', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  detalle_actividades: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  total_horas: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  punch_in: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
  punch_out: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
}, {
  tableName: 'BitacoraItems',
  timestamps: false,
});

export default BitacoraItems;