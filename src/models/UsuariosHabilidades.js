import { DataTypes } from 'sequelize';
import sequelize from './db.js';

const UsuariosHabilidades = sequelize.define('UsuariosHabilidades', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  usuario_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  habilidad_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  tableName: 'UsuariosHabilidades',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

export default UsuariosHabilidades;