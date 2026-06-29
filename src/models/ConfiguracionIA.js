import { DataTypes } from 'sequelize';
import sequelize from './db.js';

/**
 * Configuración global de las funciones de IA del sistema.
 * Es una tabla de una sola fila (id = 1): el Coordinador General activa o
 * desactiva el chatbot y/o las recomendaciones para toda la plataforma.
 */
const ConfiguracionIA = sequelize.define('ConfiguracionIA', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  chatbot_activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  recomendaciones_activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  // Controla la función "Agregar habilidades con IA" (extracción desde texto).
  extraccion_habilidades_activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  // Usuario (id) que hizo el último cambio. Opcional, solo para trazabilidad.
  actualizado_por: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'ConfiguracionIA',
  timestamps: false
});

export default ConfiguracionIA;
