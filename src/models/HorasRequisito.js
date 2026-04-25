import { DataTypes } from 'sequelize';
import sequelize from './db.js';
import PerfilUsuario from './PerfilUsuario.js';
import Grupos from './Grupos.js';
import GrupoEstudiantes from './GrupoEstudiantes.js';

const HorasRequisito = sequelize.define('HorasRequisito', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  id_grupo_estudiante: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: GrupoEstudiantes,
      key: 'id',
    },
  },
  id_estudiante: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: PerfilUsuario,
      key: 'id',
    },
  },
  horas_completadas: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  fecha_inicio: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  tipo_horas: {
    type: DataTypes.ENUM('A', 'S'),
    allowNull: false
  },
  estado: {
    type: DataTypes.ENUM(
      'Pendiente',
      'En Progreso',
      'Completado',
      'Vencido'
    ),
    defaultValue: 'Pendiente',
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
  tableName: 'HorasRequisito',
  timestamps: false,
});

export default HorasRequisito;
