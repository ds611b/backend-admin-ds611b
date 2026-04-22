import { DataTypes } from 'sequelize';
import sequelize from './db.js';
import HorasRequisito from './HorasRequisito.js';
import ProyectosInstitucion from './ProyectosInstitucion.js';
import PerfilUsuario from './PerfilUsuario.js';

const RegistroHoras = sequelize.define('RegistroHoras', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  id_horas_requisito: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: HorasRequisito,
      key: 'id',
    },
  },
  id_proyecto: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: ProyectosInstitucion,
      key: 'id',
    },
  },
  fecha: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  horas_realizadas: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
  },
  descripcion_actividad: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  evidencia_url: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  supervisor_nombre: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  supervisor_cargo: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  estado_validacion: {
    type: DataTypes.ENUM('Pendiente', 'Aprobado', 'Rechazado'),
    defaultValue: 'Pendiente',
  },
  tipo_horas: {
    type: DataTypes.ENUM('Ambientales', 'Sociales'),
    allowNull: false
  },
  observaciones_validacion: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  validado_por: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: PerfilUsuario,
      key: 'id',
    },
  },
  fecha_validacion: {
    type: DataTypes.DATE,
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
  tableName: 'RegistroHoras',
  timestamps: false,
});

export default RegistroHoras;
