const home = async (request, reply) => {
    return { message: '¡Hola Mundo Fastify!' };
}

const saludo = async (request, reply) => {
    return { message: 'Bienvenido a mi API escalable con arquitectura limpia' }
}

export default {home, saludo}