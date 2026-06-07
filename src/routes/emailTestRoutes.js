// src/routes/emailTestRoutes.js

import {
  sendHelloWorld,
  sendRawHtmlEmail,
  sendApplicationStatusEmail,
  sendProjectStatusEmail,
  sendGroupAssignmentEmail,
  sendHoursValidationEmail,
} from '../services/emailService.js'

const TAG = ['Email (pruebas)']

const okResponse = {
  200: {
    description: 'Correo enviado correctamente',
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' }
    }
  },
  500: {
    description: 'Error al enviar el correo',
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      error:   { type: 'string' }
    }
  }
}

async function emailTestRoutes(fastify) {

  /* ─── 1. Hola Mundo ─────────────────────────────────────────────────────── */
  fastify.post('/hola-mundo', {
    schema: {
      tags: TAG,
      summary: 'Prueba básica — envía "Hola Mundo" al correo indicado',
      body: {
        type: 'object',
        required: ['to'],
        properties: {
          to: { type: 'string', format: 'email', description: 'Correo de destino' }
        }
      },
      response: okResponse
    }
  }, async (req, reply) => {
    try {
      await sendHelloWorld(req.body.to)
      reply.send({ success: true, message: `Correo enviado a ${req.body.to}` })
    } catch (err) {
      reply.code(500).send({ success: false, error: err.message })
    }
  })

  /* ─── 2. HTML personalizado ─────────────────────────────────────────────── */
  fastify.post('/html', {
    schema: {
      tags: TAG,
      summary: 'Envía un correo con HTML completamente personalizado (sin wrapper de branding)',
      description: 'Pasa el HTML completo del correo. Se envía tal cual, sin ningún wrapper adicional.',
      body: {
        type: 'object',
        required: ['to', 'subject', 'html'],
        properties: {
          to:      { type: 'string', format: 'email', description: 'Correo de destino' },
          subject: { type: 'string', description: 'Asunto del correo' },
          html:    { type: 'string', description: 'HTML completo del cuerpo del correo' }
        }
      },
      response: okResponse
    }
  }, async (req, reply) => {
    try {
      const { to, subject, html } = req.body
      await sendRawHtmlEmail(to, subject, html)
      reply.send({ success: true, message: `Correo enviado a ${to}` })
    } catch (err) {
      reply.code(500).send({ success: false, error: err.message })
    }
  })

  /* ─── 3. Template: Aplicación ───────────────────────────────────────────── */
  fastify.post('/template/aplicacion', {
    schema: {
      tags: TAG,
      summary: 'Prueba template — cambio de estado de aplicación a proyecto',
      body: {
        type: 'object',
        required: ['to', 'nombre', 'proyecto', 'estado'],
        properties: {
          to:            { type: 'string', format: 'email' },
          nombre:        { type: 'string' },
          proyecto:      { type: 'string' },
          estado:        { type: 'string', enum: ['Aprobado', 'Rechazado', 'Pendiente'] },
          observaciones: { type: 'string', nullable: true }
        }
      },
      response: okResponse
    }
  }, async (req, reply) => {
    try {
      const { to, ...data } = req.body
      await sendApplicationStatusEmail(to, data)
      reply.send({ success: true, message: `Correo enviado a ${to}` })
    } catch (err) {
      reply.code(500).send({ success: false, error: err.message })
    }
  })

  /* ─── 4. Template: Proyecto ─────────────────────────────────────────────── */
  fastify.post('/template/proyecto', {
    schema: {
      tags: TAG,
      summary: 'Prueba template — cambio de estado de proyecto (para encargado de institución)',
      body: {
        type: 'object',
        required: ['to', 'nombre', 'proyecto', 'estado'],
        properties: {
          to:            { type: 'string', format: 'email' },
          nombre:        { type: 'string' },
          proyecto:      { type: 'string' },
          estado:        { type: 'string', enum: ['Aprobado', 'Rechazado'] },
          observaciones: { type: 'string', nullable: true }
        }
      },
      response: okResponse
    }
  }, async (req, reply) => {
    try {
      const { to, ...data } = req.body
      await sendProjectStatusEmail(to, data)
      reply.send({ success: true, message: `Correo enviado a ${to}` })
    } catch (err) {
      reply.code(500).send({ success: false, error: err.message })
    }
  })

  /* ─── 5. Template: Grupo ────────────────────────────────────────────────── */
  fastify.post('/template/grupo', {
    schema: {
      tags: TAG,
      summary: 'Prueba template — asignación de estudiante a grupo de servicio social',
      body: {
        type: 'object',
        required: ['to', 'nombre', 'grupo', 'horas_ambientales', 'horas_sociales'],
        properties: {
          to:                { type: 'string', format: 'email' },
          nombre:            { type: 'string' },
          grupo:             { type: 'string' },
          horas_ambientales: { type: 'integer' },
          horas_sociales:    { type: 'integer' }
        }
      },
      response: okResponse
    }
  }, async (req, reply) => {
    try {
      const { to, ...data } = req.body
      await sendGroupAssignmentEmail(to, data)
      reply.send({ success: true, message: `Correo enviado a ${to}` })
    } catch (err) {
      reply.code(500).send({ success: false, error: err.message })
    }
  })

  /* ─── 6. Template: Horas ────────────────────────────────────────────────── */
  fastify.post('/template/horas', {
    schema: {
      tags: TAG,
      summary: 'Prueba template — validación de registro de horas',
      body: {
        type: 'object',
        required: ['to', 'nombre', 'fecha', 'horas', 'estado'],
        properties: {
          to:            { type: 'string', format: 'email' },
          nombre:        { type: 'string' },
          fecha:         { type: 'string' },
          horas:         { type: 'number' },
          estado:        { type: 'string', enum: ['Aprobado', 'Rechazado'] },
          observaciones: { type: 'string', nullable: true }
        }
      },
      response: okResponse
    }
  }, async (req, reply) => {
    try {
      const { to, ...data } = req.body
      await sendHoursValidationEmail(to, data)
      reply.send({ success: true, message: `Correo enviado a ${to}` })
    } catch (err) {
      reply.code(500).send({ success: false, error: err.message })
    }
  })
}

export default emailTestRoutes
