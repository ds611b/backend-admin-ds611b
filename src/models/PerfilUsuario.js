import { DataTypes } from 'sequelize';
import sequelize from './db.js';

const PerfilUsuario = sequelize.define('PerfilUsuario', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  usuario_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  direccion: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  fecha_nacimiento: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  genero: {
    type: DataTypes.ENUM('Masculino', 'Femenino', 'Otro'),
    allowNull: true,
  },
  foto_perfil: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
}, {
  tableName: 'PerfilUsuario',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

export default PerfilUsuario;