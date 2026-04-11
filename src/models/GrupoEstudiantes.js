import { DataTypes } from 'sequelize';
import sequelize from './db.js';
import Grupos from './Grupos.js';
import PerfilUsuario from './PerfilUsuario.js';

const GrupoEstudiantes = sequelize.define('GrupoEstudiantes', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  id_grupo: {
    type: DataTypes.INTEGER,
    allowNull: false,
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
  fecha_asignacion: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  estado: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
}, {
  tableName: 'GrupoEstudiantes',
  timestamps: false,
});

export default GrupoEstudiantes;