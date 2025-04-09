import { DataTypes } from 'sequelize';
import sequelize from '../db.js';

const Usuarios = sequelize.define('Usuarios', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  nombre: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  apellido: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING(150),
    allowNull: false,
    unique: true,
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  telefono: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  rol_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
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
  tableName: 'Usuarios',
  timestamps: false,
});

const associate = (models) => {
  Usuarios.belongsTo(models.Roles, { foreignKey: 'rol_id', onDelete: 'RESTRICT' });
  Usuarios.hasOne(models.PerfilUsuario, { foreignKey: 'usuario_id', onDelete: 'CASCADE' });
  //Usuarios.hasMany(models.AplicacionesEstudiantes, { foreignKey: 'estudiante_id', onDelete: 'CASCADE' });
  //Usuarios.belongsToMany(models.Habilidades, { through: models.UsuariosHabilidades, foreignKey: 'usuario_id', onDelete: 'CASCADE' });
};

export { Usuarios, associate };