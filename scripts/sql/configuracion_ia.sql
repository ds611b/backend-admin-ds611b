-- ============================================================================
-- Tabla de configuración de IA (chatbot + recomendaciones)
-- Tabla de una sola fila (id = 1). El Coordinador General la edita para
-- activar/desactivar cada función de IA en toda la plataforma.
--
-- Este proyecto NO usa sequelize.sync() ni migraciones: las tablas se crean
-- manualmente. Ejecuta este script en la BD (local y en Railway).
-- ============================================================================

CREATE TABLE IF NOT EXISTS ConfiguracionIA (
  id                     INT AUTO_INCREMENT PRIMARY KEY,
  chatbot_activo         BOOLEAN  NOT NULL DEFAULT TRUE,
  recomendaciones_activo BOOLEAN  NOT NULL DEFAULT TRUE,
  actualizado_por        INT      NULL,
  updated_at             DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Fila única inicial (ambas funciones activas por defecto).
-- IGNORE evita error si ya existe la fila id = 1.
INSERT IGNORE INTO ConfiguracionIA (id, chatbot_activo, recomendaciones_activo)
VALUES (1, TRUE, TRUE);
