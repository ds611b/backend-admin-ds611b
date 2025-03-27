import Fastify from 'fastify';
import config from './config/config.js';
import homeRoutes from './routes/homeRoutes.js';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import staticFiles from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';

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
		fastify.log.info(`Servidor ejecutándose en http://${host}:${port}`);
		fastify.log.info(`Documentación disponible en http://${host}:${port}/${docsPath}`);
	} catch (err) {
		fastify.log.error(err);
		process.exit(1);
	}
};

start();