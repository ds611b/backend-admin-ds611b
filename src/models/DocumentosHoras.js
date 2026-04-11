import { DataTypes } from 'sequelize';
import sequelize from './db.js';
import RegistroHoras from './RegistroHoras.js';

const DocumentosHoras = sequelize.define('DocumentosHoras', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  id_registro_horas: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: RegistroHoras,
      key: 'id',
    },
  },
  tipo_documento: {
    type: DataTypes.ENUM(
      'Carta Asignación',
      'Constancia',
      'Informe',
      'Fotografía',
      'Otro'
    ),
    allowNull: false,
  },
  nombre_archivo: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  ruta_archivo: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  fecha_subida: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'DocumentosHoras',
  timestamps: false,
});

export default DocumentosHoras;
