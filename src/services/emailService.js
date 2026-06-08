// src/services/emailService.js

import nodemailer from 'nodemailer'

// EMAIL_MODE=smtp → nodemailer (local / servidores que permiten SMTP)
// EMAIL_MODE=api  → Brevo HTTP API (Railway y PaaS que bloquean puertos SMTP)
const MODE = (process.env.EMAIL_MODE || 'smtp').toLowerCase()

const transporter = MODE === 'smtp'
  ? nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   Number(process.env.SMTP_PORT),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })
  : null

// ─── Estilos compartidos ──────────────────────────────────────────────────────

const BRAND_COLOR = '#9a1e1d'
const GOLD_COLOR  = '#c49336'

function baseTemplate(titulo, contenido) {
  return `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff;">
      <!-- Header -->
      <div style="background: ${BRAND_COLOR}; padding: 24px 32px; border-radius: 8px 8px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">
          SSEPRO
        </h1>
        <p style="color: rgba(255,255,255,0.75); margin: 4px 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">
          Sistema de Servicio Social · ITCA-FEPADE
        </p>
      </div>

      <!-- Body -->
      <div style="padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
        <h2 style="color: ${BRAND_COLOR}; font-size: 18px; margin: 0 0 16px;">${titulo}</h2>
        ${contenido}
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0;">
        <p style="color: #718096; font-size: 12px; margin: 0;">
          Este correo fue generado automáticamente por ConnectPro. No respondas a este mensaje.
        </p>
      </div>

      <!-- Footer ITCA -->
      <div style="text-align: center; padding: 16px; border: 2px solid ${GOLD_COLOR}; border-radius: 6px; margin-top: 12px;">
        <img src="https://www.itca.edu.sv/wp-content/uploads/2017/01/logo-new.png"
             alt="ITCA-FEPADE" style="height: 28px; width: auto;">
      </div>
    </div>
  `
}

function btnPrimary(href, texto) {
  return `
    <p style="margin: 24px 0;">
      <a href="${href}"
         style="background: ${BRAND_COLOR}; color: #ffffff; padding: 12px 28px;
                border-radius: 6px; text-decoration: none; font-weight: 700;
                font-size: 14px; display: inline-block;">
        ${texto}
      </a>
    </p>
  `
}

function badge(texto, color = BRAND_COLOR) {
  return `<span style="background: ${color}; color: #fff; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 700;">${texto}</span>`
}

// ─── Función base (interna) ───────────────────────────────────────────────────

async function sendMail({ to, subject, html }) {
  if (MODE === 'api') {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY
      },
      body: JSON.stringify({
        sender:      { name: 'ConnectPro', email: process.env.EMAIL_FROM_ADDRESS },
        to:          [{ email: to }],
        subject,
        htmlContent: html
      })
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Brevo API ${res.status}: ${body}`)
    }

    console.log(`✅ [api] Email enviado → ${to} [${subject}]`)
    return
  }

  // MODE === 'smtp'
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html
  })
  console.log(`✅ [smtp] Email enviado → ${to} [${subject}]`)
}

// ─── Templates exportados ─────────────────────────────────────────────────────

/**
 * Notifica al estudiante cuando cambia el estado de su aplicación a un proyecto.
 * @param {string} toEmail
 * @param {{ nombre: string, proyecto: string, estado: 'Aprobado'|'Rechazado'|'Pendiente', observaciones?: string }} data
 */
export async function sendApplicationStatusEmail(toEmail, { nombre, proyecto, estado, observaciones }) {
  const colores = { Aprobado: '#2e7d32', Rechazado: BRAND_COLOR, Pendiente: '#c49336' }
  const color = colores[estado] ?? BRAND_COLOR

  const contenido = `
    <p style="color: #4a5568;">Hola, <strong>${nombre}</strong>.</p>
    <p style="color: #4a5568;">El estado de tu aplicación al proyecto <strong>${proyecto}</strong> ha sido actualizado:</p>
    <p style="margin: 16px 0;">${badge(estado, color)}</p>
    ${observaciones ? `<p style="color: #4a5568; background: #f7fafc; padding: 12px; border-radius: 6px; border-left: 4px solid ${color}; font-size: 13px;">${observaciones}</p>` : ''}
    <p style="color: #718096; font-size: 13px;">Ingresa al sistema para ver los detalles completos.</p>
    ${btnPrimary(process.env.APP_URL ?? '#', 'Ver mi aplicación')}
  `

  await sendMail({
    to: toEmail,
    subject: `Tu aplicación fue ${estado} — ConnectPro`,
    html: baseTemplate('Actualización de aplicación', contenido)
  })
}

/**
 * Notifica al encargado de institución cuando su proyecto cambia de estado (Aprobado/Rechazado).
 * @param {string} toEmail
 * @param {{ nombre: string, proyecto: string, estado: 'Aprobado'|'Rechazado', observaciones?: string }} data
 */
export async function sendProjectStatusEmail(toEmail, { nombre, proyecto, estado, observaciones }) {
  const color = estado === 'Aprobado' ? '#2e7d32' : BRAND_COLOR

  const contenido = `
    <p style="color: #4a5568;">Estimado/a <strong>${nombre}</strong>.</p>
    <p style="color: #4a5568;">El proyecto <strong>${proyecto}</strong> ha sido revisado por el coordinador:</p>
    <p style="margin: 16px 0;">${badge(estado, color)}</p>
    ${observaciones ? `<p style="color: #4a5568; background: #f7fafc; padding: 12px; border-radius: 6px; border-left: 4px solid ${color}; font-size: 13px;">${observaciones}</p>` : ''}
    ${btnPrimary(process.env.APP_URL ?? '#', 'Ver proyecto')}
  `

  await sendMail({
    to: toEmail,
    subject: `Proyecto ${estado} — ConnectPro`,
    html: baseTemplate('Estado de proyecto', contenido)
  })
}

/**
 * Notifica al estudiante cuando es asignado a un grupo de servicio social.
 * @param {string} toEmail
 * @param {{ nombre: string, grupo: string, horas_ambientales: number, horas_sociales: number }} data
 */
export async function sendGroupAssignmentEmail(toEmail, { nombre, grupo, horas_ambientales, horas_sociales }) {
  const contenido = `
    <p style="color: #4a5568;">Hola, <strong>${nombre}</strong>.</p>
    <p style="color: #4a5568;">Has sido asignado/a al grupo de servicio social:</p>
    <div style="background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0 0 8px; font-weight: 700; color: ${BRAND_COLOR}; font-size: 15px;">${grupo}</p>
      <p style="margin: 0; color: #4a5568; font-size: 13px;">
        Horas ambientales: <strong>${horas_ambientales}h</strong> &nbsp;|&nbsp;
        Horas sociales: <strong>${horas_sociales}h</strong>
      </p>
    </div>
    <p style="color: #718096; font-size: 13px;">Ingresa al sistema para ver tus requisitos y comenzar a registrar tus horas.</p>
    ${btnPrimary(process.env.APP_URL ?? '#', 'Ver mi grupo')}
  `

  await sendMail({
    to: toEmail,
    subject: `Asignación a grupo de Servicio Social — ConnectPro`,
    html: baseTemplate('Asignación a grupo', contenido)
  })
}

/**
 * Notifica al estudiante cuando un registro de horas es aprobado o rechazado.
 * @param {string} toEmail
 * @param {{ nombre: string, fecha: string, horas: number, estado: 'Aprobado'|'Rechazado', observaciones?: string }} data
 */
export async function sendHoursValidationEmail(toEmail, { nombre, fecha, horas, estado, observaciones }) {
  const color = estado === 'Aprobado' ? '#2e7d32' : BRAND_COLOR

  const contenido = `
    <p style="color: #4a5568;">Hola, <strong>${nombre}</strong>.</p>
    <p style="color: #4a5568;">Tu registro de <strong>${horas} hora(s)</strong> del <strong>${fecha}</strong> fue revisado:</p>
    <p style="margin: 16px 0;">${badge(estado, color)}</p>
    ${observaciones ? `<p style="color: #4a5568; background: #f7fafc; padding: 12px; border-radius: 6px; border-left: 4px solid ${color}; font-size: 13px;">${observaciones}</p>` : ''}
    ${btnPrimary(process.env.APP_URL ?? '#', 'Ver mis horas')}
  `

  await sendMail({
    to: toEmail,
    subject: `Horas ${estado.toLowerCase()}s — ConnectPro`,
    html: baseTemplate('Validación de horas', contenido)
  })
}

/**
 * Envío genérico para casos no cubiertos por los templates anteriores.
 * @param {string} toEmail
 * @param {string} subject
 * @param {string} titulo  - Título visible dentro del template
 * @param {string} htmlContenido - HTML del cuerpo (sin el wrapper)
 */
export async function sendGenericEmail(toEmail, subject, titulo, htmlContenido) {
  await sendMail({
    to: toEmail,
    subject,
    html: baseTemplate(titulo, htmlContenido)
  })
}

/**
 * Envía HTML completamente personalizado sin ningún wrapper de branding.
 * Útil para correos totalmente custom o diseños propios.
 * @param {string} toEmail
 * @param {string} subject
 * @param {string} html - HTML completo del correo
 */
export async function sendRawHtmlEmail(toEmail, subject, html) {
  await sendMail({ to: toEmail, subject, html })
}

/**
 * Envía un correo de prueba "Hola Mundo" al destinatario indicado.
 * @param {string} toEmail
 */
export async function sendHelloWorld(toEmail) {
  const html = baseTemplate('Prueba de correo', `
    <p style="color: #4a5568; font-size: 15px;">
      ¡Hola Mundo! 👋
    </p>
    <p style="color: #718096; font-size: 13px;">
      Este es un correo de prueba enviado desde <strong>ConnectPro · backend-admin</strong>.
      Si lo recibes correctamente, el servicio de correo está funcionando bien.
    </p>
    <div style="background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 13px; color: #4a5568;">
      <strong>Enviado a:</strong> ${toEmail}<br>
      <strong>Fecha:</strong> ${new Date().toLocaleString('es-SV', { timeZone: 'America/El_Salvador' })}
    </div>
  `)

  await sendMail({
    to: toEmail,
    subject: '✅ Prueba de correo — ConnectPro',
    html
  })
}
