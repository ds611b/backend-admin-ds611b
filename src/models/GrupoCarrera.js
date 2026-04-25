import { DataTypes } from 'sequelize';
import sequelize from './db.js';
import Grupos from './Grupos.js';
import Carreras from './Carreras.js';

const GrupoCarrera = sequelize.define('GrupoCarrera', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },

  id_grupo: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Grupos,
      key: 'id',
    },
  },

  id_carrera: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Carreras,
      key: 'id',
    },
  },

  activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  }

}, {
  tableName: 'GrupoCarrera',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  timestamps: false
});

export default GrupoCarrera;