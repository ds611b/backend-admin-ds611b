import Fastify from 'fastify';
import config from './config/config.js';
import homeRoutes from './routes/homeRoutes.js';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import staticFiles from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
/**
 * Rutas de ADMIN
 */
import roleRoutes from './routes/roleRoutes.js';
import institucionRoutes from './routes/institucionRoutes.js';

/**
 * Configuración para usar __dirname con ES modules.
 * Convierte la URL del archivo en una ruta de archivo y obtiene el directorio.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Inicializa una instancia de Fastify con opciones de configuración.
 * @type {FastifyInstance}
 */
const fastify = Fastify({ logger: true });

// Obtenemos las configuraciones desde el config.js
const { port, host, docsPath } = config;

/**
 * Configuración de Swagger (esquemas).
 * Define la información básica de la API y las especificaciones de Swagger.
 */
await fastify.register(swagger, {
	swagger: {
		info: {
			title: 'boilerplate-ds611b',
			description: 'API',
			version: '1.0.0'
		},
		externalDocs: {
			url: 'https://swagger.io',
			description: 'Encuentra más información aquí'
		},
		host: `${host}:${port}`,
		schemes: ['http'],
		consumes: ['application/json'],
		produces: ['application/json']
	}
});

/**
 * Esquemas de objetos para Response
 */
fastify.addSchema({
	$id: 'Role',
	type: 'object',
	properties: {
		id: { type: 'integer', example: 1 },
		nombre: { type: 'string', example: 'Admin' },
		descripcion: { type: 'string', example: 'Administrador del sistema' }
	}
});

fastify.addSchema({
	$id: 'ErrorResponse',
	type: 'object',
	properties: {
		success: { type: 'boolean', example: false },
		error: {
			type: 'object',
			properties: {
				code: { type: 'string', example: 'ERR_ROLE_NOT_FOUND' },
				message: { type: 'string', example: 'Rol no encontrado' },
				details: { type: 'string', example: null }
			}
		}
	}
});

fastify.addSchema({
  $id: 'Institucion',
  type: 'object',
  properties: {
    id: { type: 'number', example: 1 },
    nombre: { type: 'string', example: 'Institución Ejemplo' },
    direccion: { type: 'string', example: 'Av. Siempre Viva 123' },
    telefono: { type: 'string', example: '555-1234' },
    email: { type: 'string', example: 'contacto@institucion.com' },
    fecha_fundacion: { type: 'string', format: 'date', example: '2000-01-01' },
    nit: { type: 'string', example: '1234567890' },
    created_at: { type: 'string', example: '2023-01-01T12:00:00Z' },
    updated_at: { type: 'string', example: '2023-01-02T12:00:00Z' }
  }
});

/**
 * Configuración de Swagger UI (interfaz).
 * Define la ruta donde estará disponible la documentación y opciones de la interfaz.
 */
await fastify.register(swaggerUI, {
	routePrefix: `/${docsPath}`,
	uiConfig: {
		deepLinking: true // Permite compartir enlaces directos a endpoints
	},
	staticCSP: true // Mantiene seguridad básica
});

/**
 * Configuración para servir archivos estáticos.
 * Define el directorio raíz y el prefijo para acceder a los archivos públicos.
 */
await fastify.register(staticFiles, {
	root: path.join(__dirname, '../public'),
	prefix: '/public/'
});

/**
 * Registra las rutas de la API.
 * Todas las rutas definidas en homeRoutes estarán bajo el prefijo '/api'.
 */
fastify.register(homeRoutes, { prefix: '/api' });
fastify.register(roleRoutes, { prefix: '/api' });
fastify.register(institucionRoutes, { prefix: '/api' });

/**
 * Registra la landing page de la API
 */
fastify.get('/', {
	schema: {
		hide: true
	}
}, (request, reply) => {
	reply.sendFile('index.html', { root: path.join(__dirname, '../public') });
});

/**
 * Función asíncrona para iniciar el servidor.
 * Intenta escuchar en el puerto y host definidos y maneja errores en caso de fallo.
 */
const start = async () => {
	try {
		await fastify.listen({
			port: port,
			host: host
		});
		fastify.log.info(`Servidor ejecutandose en http://${host}:${port}`);
		fastify.log.info(`Documentacion disponible en http://${host}:${port}/${docsPath}`);
	} catch (err) {
		fastify.log.error(err);
		process.exit(1);
	}
};

start();