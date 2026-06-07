import { DataTypes } from 'sequelize';
import sequelize from './db.js';

const Notificaciones = sequelize.define('Notificaciones', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  usuario_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  titulo: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  mensaje: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  leida: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
}, {
  tableName: 'Notificaciones',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

export default Notificaciones;
