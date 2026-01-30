/**
 * Servicio de Correos Automatizados
 * Envía correos con archivos agrupados por módulo
 */

import { pool } from '../db/connection.js';
import nodemailer from 'nodemailer';

// Configuración del transportador de correo (forzar TLS por seguridad)
const transporter = nodemailer.createTransport({
  // Ejemplo para Gmail - ajustar según tu configuración
  service: process.env.EMAIL_SERVICE || 'gmail',
  secure: process.env.EMAIL_SECURE ? process.env.EMAIL_SECURE === 'true' : true,
  port: process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : 465,
  requireTLS: true,
  tls: {
    minVersion: 'TLSv1.2'
  },
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * Obtener archivos agrupados por módulo para una máquina
 */
export async function getFilesByModule(machineId) {
  const result = await pool.query(`
    SELECT 
      f.scope as module,
      f.file_type,
      json_agg(json_build_object(
        'id', f.id,
        'file_name', f.file_name,
        'file_path', f.file_path,
        'file_size', f.file_size,
        'uploaded_at', f.uploaded_at
      ) ORDER BY f.uploaded_at DESC) as files
    FROM machine_files f
    WHERE f.machine_id = $1
    GROUP BY f.scope, f.file_type
  `, [machineId]);

  const grouped = {};
  result.rows.forEach(row => {
    if (!grouped[row.module]) {
      grouped[row.module] = {
        FOTO: [],
        DOCUMENTO: []
      };
    }
    grouped[row.module][row.file_type] = row.files;
  });

  return grouped;
}

/**
 * Enviar correo con archivos de un módulo específico
 */
export async function sendModuleEmail(machineId, module, recipients, options = {}) {
  try {
    // Obtener información de la máquina
    const machineResult = await pool.query(`
      SELECT m.model, m.serial, m.id
      FROM machines m
      WHERE m.id = $1
    `, [machineId]);

    if (machineResult.rows.length === 0) {
      throw new Error('Máquina no encontrada');
    }

    const machine = machineResult.rows[0];

    // Obtener archivos del módulo
    const filesResult = await pool.query(`
      SELECT f.*, m.model, m.serial
      FROM machine_files f
      JOIN machines m ON f.machine_id = m.id
      WHERE f.machine_id = $1 AND f.scope = $2
      ORDER BY f.file_type, f.uploaded_at DESC
    `, [machineId, module]);

    const files = filesResult.rows;
    const photos = files.filter(f => f.file_type === 'FOTO');
    const documents = files.filter(f => f.file_type === 'DOCUMENTO');

    // Construir HTML del correo
    const html = `
      <h2>Archivos de ${module} - ${machine.model} (${machine.serial})</h2>
      <p>Se adjuntan los siguientes archivos:</p>
      
      ${photos.length > 0 ? `<h3>Fotos (${photos.length})</h3><ul>${photos.map(f => `<li>${f.file_name}</li>`).join('')}</ul>` : ''}
      ${documents.length > 0 ? `<h3>Documentos (${documents.length})</h3><ul>${documents.map(f => `<li>${f.file_name}</li>`).join('')}</ul>` : ''}
    `;

    // Configurar correo
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@partequipos.com',
      to: recipients.join(', '),
      subject: options.subject || `Archivos de ${module} - ${machine.model}`,
      html,
      // Aquí se podrían adjuntar los archivos físicos si es necesario
      // attachments: files.map(f => ({ path: f.file_path }))
    };

    // Enviar correo
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error enviando correo:', error);
    throw error;
  }
}

/**
 * Enviar correos automáticos a todos los módulos de una máquina
 */
export async function sendAllModuleEmails(machineId, moduleRecipients) {
  // moduleRecipients: { LOGISTICA: ['email1@...'], EQUIPOS: ['email2@...'], etc. }
  
  const results = [];
  
  for (const [module, recipients] of Object.entries(moduleRecipients)) {
    if (recipients && recipients.length > 0) {
      try {
        const result = await sendModuleEmail(machineId, module, recipients);
        results.push({ module, success: true, result });
      } catch (error) {
        results.push({ module, success: false, error: error.message });
      }
    }
  }
  
  return results;
}

