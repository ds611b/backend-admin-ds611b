import { DataTypes } from 'sequelize';
import sequelize from './db.js';
import Institucion from './Institucion.js';

const ProyectoInstitucion = sequelize.define('ProyectoInstitucion', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  institucion_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  nombre: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  fecha_inicio: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  fecha_fin: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  modalidad: {
    type: DataTypes.STRING(25),
    allowNull: true,
  },
  direccion: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  disponibilidad: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'ProyectosInstitucion',
  timestamps: false,
});

// Relación: cada proyecto pertenece a una Institucion.
ProyectoInstitucion.belongsTo(Institucion, {
  foreignKey: 'institucion_id',
  as: 'institucion'
});

export default ProyectoInstitucion;
