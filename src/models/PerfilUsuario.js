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
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'PerfilUsuario',
  timestamps: false,
});

const associate = (models) => {
  PerfilUsuario.belongsTo(models.Usuarios, { foreignKey: 'usuario_id', onDelete: 'CASCADE' });
};

export { PerfilUsuario, associate };