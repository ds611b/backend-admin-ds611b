import { DataTypes } from 'sequelize';
import sequelize from './db.js';
import PerfilUsuario from './PerfilUsuario.js';
import Grupos from './Grupos.js';

const HorasRequisito = sequelize.define('HorasRequisito', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  id_grupo: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: Grupos,
      key: 'id',
    },
  },
  id_perfil_usuario: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: PerfilUsuario,
      key: 'id',
    },
  },
  horas_requeridas: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  horas_completadas: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  fecha_inicio: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  fecha_limite: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  tipo_horas: {
    type: DataTypes.ENUM('Ambientales', 'Sociales'),
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
  institucion_asignada: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  observaciones: {
    type: DataTypes.TEXT,
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
  tableName: 'HorasRequisito',
  timestamps: false,
});

export default HorasRequisito;
