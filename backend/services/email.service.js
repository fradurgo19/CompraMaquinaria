/**
 * Servicio de Correo para Notificaciones de Subastas
 */

import { createTransport } from 'nodemailer';

// Configuración del transporter para Gmail
const createTransporter = () => {
  return createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || 'fradurgo19@gmail.com',
      pass: process.env.EMAIL_PASS || 'ylrjeyvjfembryig'
    }
  });
};

/**
 * Envía correo de notificación cuando una subasta es ganada
 * @param {Object} auctionData - Datos de la subasta ganada
 */
export const sendAuctionWonEmail = async (auctionData) => {
  try {
    const transporter = createTransporter();
    
    const {
      auction_date,
      lot_number,
      machine_model,
      machine_serial,
      machine_year,
      machine_hours,
      max_price,
      purchased_price,
      supplier_name,
      comments
    } = auctionData;

    const mailOptions = {
      from: process.env.EMAIL_USER || 'fradurgo19@gmail.com',
      to: process.env.EMAIL_TO || 'analista.mantenimiento@partequipos.com',
      subject: `🏆 Subasta Ganada - ${machine_model} ${machine_serial} - $${purchased_price?.toLocaleString('es-CO') || 'N/A'}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
            .info-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            .info-table th, .info-table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
            .info-table th { background-color: #f2f2f2; font-weight: bold; }
            .highlight { background-color: #e8f5e8; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #4caf50; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏆 ¡Subasta Ganada!</h1>
              <p>Sistema de Gestión de Maquinaria Usada</p>
            </div>
            
            <div class="content">
              <div class="highlight">
                <h3>✅ Subasta Ganada Exitosamente</h3>
                <p>Se ha ganado una nueva subasta y requiere seguimiento inmediato.</p>
              </div>

              <h3>📋 Detalles de la Subasta</h3>
              <table class="info-table">
                <tr>
                  <th>Campo</th>
                  <th>Valor</th>
                </tr>
                <tr>
                  <td><strong>Fecha de Subasta</strong></td>
                  <td>${new Date(auction_date).toLocaleDateString('es-CO')}</td>
                </tr>
                <tr>
                  <td><strong>Número de Lote</strong></td>
                  <td>${lot_number}</td>
                </tr>
                <tr>
                  <td><strong>Proveedor</strong></td>
                  <td>${supplier_name}</td>
                </tr>
                <tr>
                  <td><strong>Precio Máximo</strong></td>
                  <td>$${max_price?.toLocaleString('es-CO') || 'N/A'}</td>
                </tr>
                <tr>
                  <td><strong>Precio de Compra</strong></td>
                  <td>$${purchased_price?.toLocaleString('es-CO') || 'N/A'}</td>
                </tr>
              </table>

              <h3>🚜 Información de la Máquina</h3>
              <table class="info-table">
                <tr>
                  <th>Campo</th>
                  <th>Valor</th>
                </tr>
                <tr>
                  <td><strong>Modelo</strong></td>
                  <td>${machine_model}</td>
                </tr>
                <tr>
                  <td><strong>Serial</strong></td>
                  <td>${machine_serial}</td>
                </tr>
                <tr>
                  <td><strong>Año</strong></td>
                  <td>${machine_year}</td>
                </tr>
                <tr>
                  <td><strong>Horas de Operación</strong></td>
                  <td>${machine_hours?.toLocaleString('es-CO') || 'N/A'}</td>
                </tr>
              </table>

              ${comments ? `
                <h3>💬 Comentarios</h3>
                <div style="background: #f0f0f0; padding: 15px; border-radius: 5px; margin: 10px 0;">
                  ${comments}
                </div>
              ` : ''}

              <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
                <h4>📝 Próximos Pasos</h4>
                <ul>
                  <li>Verificar disponibilidad de fondos</li>
                  <li>Coordinar proceso de pago</li>
                  <li>Programar recogida de la máquina</li>
                  <li>Actualizar estado en el sistema</li>
                </ul>
              </div>
            </div>

            <div class="footer">
              <p>Este correo fue generado automáticamente por el Sistema de Gestión de Maquinaria Usada</p>
              <p>Partequipos S.A.S - ${new Date().toLocaleDateString('es-CO')}</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Correo enviado exitosamente:', result.messageId);
    return { success: true, messageId: result.messageId };
    
  } catch (error) {
    console.error('❌ Error al enviar correo:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Envía correo de notificación de subasta próxima
 * @param {Object} auctionData - Datos de la subasta
 * @param {string} notificationType - '1_DAY_BEFORE' o '3_HOURS_BEFORE'
 */
export const sendAuctionUpcomingEmail = async (auctionData, notificationType) => {
  try {
    const transporter = createTransporter();
    
    const {
      auction_id,
      lot_number,
      machine_model,
      machine_serial,
      machine_year,
      machine_hours,
      max_price,
      supplier_name,
      colombia_time,
      local_time,
      auction_city,
      comments
    } = auctionData;

    const isOneDayBefore = notificationType === '1_DAY_BEFORE';
    const timeRemaining = isOneDayBefore ? '1 día' : '3 horas';
    
    // Formatear fecha y hora de Colombia
    const colombiaDate = colombia_time ? new Date(colombia_time) : null;
    const formattedColombiaTime = colombiaDate 
      ? new Intl.DateTimeFormat('es-CO', {
          dateStyle: 'long',
          timeStyle: 'short',
          timeZone: 'America/Bogota'
        }).format(colombiaDate)
      : 'No definida';

    const subject = isOneDayBefore
      ? `🔔 Recordatorio: Subasta mañana - ${machine_model} ${machine_serial} - Lote ${lot_number}`
      : `⏰ Alerta: Subasta en 3 horas - ${machine_model} ${machine_serial} - Lote ${lot_number}`;

    const mailOptions = {
      from: process.env.EMAIL_USER || 'fradurgo19@gmail.com',
      to: process.env.EMAIL_TO || 'analista.mantenimiento@partequipos.com',
      subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { 
              background: ${isOneDayBefore 
                ? 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)' 
                : 'linear-gradient(135deg, #f44336 0%, #c62828 100%)'}; 
              color: white; 
              padding: 20px; 
              border-radius: 8px 8px 0 0; 
              text-align: center; 
            }
            .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
            .info-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            .info-table th, .info-table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
            .info-table th { background-color: #f2f2f2; font-weight: bold; }
            .alert-box { 
              background-color: ${isOneDayBefore ? '#fff3e0' : '#ffebee'}; 
              padding: 15px; 
              border-radius: 5px; 
              margin: 15px 0; 
              border-left: 4px solid ${isOneDayBefore ? '#ff9800' : '#f44336'}; 
            }
            .time-highlight {
              background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
              padding: 20px;
              border-radius: 8px;
              text-align: center;
              margin: 20px 0;
              border: 2px solid #2196f3;
            }
            .time-highlight .time-value {
              font-size: 32px;
              font-weight: 700;
              color: #1976d2;
              margin: 10px 0;
            }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${isOneDayBefore ? '🔔 Recordatorio de Subasta' : '⏰ Alerta de Subasta'}</h1>
              <p>Sistema de Gestión de Maquinaria Usada</p>
            </div>
            
            <div class="content">
              <div class="alert-box">
                <h3>${isOneDayBefore ? '📅 Subasta Programada para Mañana' : '🚨 Subasta en 3 Horas'}</h3>
                <p>Esta subasta se realizará en <strong>${timeRemaining}</strong> según la hora de Colombia.</p>
              </div>

              <div class="time-highlight">
                <p style="margin: 0; font-size: 14px; color: #666; text-transform: uppercase;">Hora de Colombia</p>
                <div class="time-value">${formattedColombiaTime}</div>
                ${local_time && auction_city ? `
                  <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">
                    Hora local: ${local_time} (${auction_city})
                  </p>
                ` : ''}
              </div>

              <h3>📋 Detalles de la Subasta</h3>
              <table class="info-table">
                <tr>
                  <th>Campo</th>
                  <th>Valor</th>
                </tr>
                <tr>
                  <td><strong>Número de Lote</strong></td>
                  <td>${lot_number}</td>
                </tr>
                <tr>
                  <td><strong>Proveedor</strong></td>
                  <td>${supplier_name || 'N/A'}</td>
                </tr>
                <tr>
                  <td><strong>Precio Máximo</strong></td>
                  <td>$${max_price?.toLocaleString('es-CO') || 'N/A'}</td>
                </tr>
              </table>

              <h3>🚜 Información de la Máquina</h3>
              <table class="info-table">
                <tr>
                  <th>Campo</th>
                  <th>Valor</th>
                </tr>
                <tr>
                  <td><strong>Modelo</strong></td>
                  <td>${machine_model || 'N/A'}</td>
                </tr>
                <tr>
                  <td><strong>Serial</strong></td>
                  <td>${machine_serial || 'N/A'}</td>
                </tr>
                <tr>
                  <td><strong>Año</strong></td>
                  <td>${machine_year || 'N/A'}</td>
                </tr>
                <tr>
                  <td><strong>Horas de Operación</strong></td>
                  <td>${machine_hours?.toLocaleString('es-CO') || 'N/A'}</td>
                </tr>
              </table>

              ${comments ? `
                <h3>💬 Comentarios</h3>
                <div style="background: #f0f0f0; padding: 15px; border-radius: 5px; margin: 10px 0;">
                  ${comments}
                </div>
              ` : ''}

              <div style="background: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #4caf50;">
                <h4>📝 Acciones Recomendadas</h4>
                <ul>
                  ${isOneDayBefore ? `
                    <li>Verificar disponibilidad de fondos para el precio máximo</li>
                    <li>Revisar especificaciones técnicas de la máquina</li>
                    <li>Confirmar contacto con el proveedor</li>
                    <li>Preparar documentación necesaria</li>
                  ` : `
                    <li>Verificar última vez disponibilidad de fondos</li>
                    <li>Confirmar estrategia de puja</li>
                    <li>Estar atento al inicio de la subasta</li>
                    <li>Tener a mano la información de contacto del proveedor</li>
                  `}
                </ul>
              </div>
            </div>

            <div class="footer">
              <p>Este correo fue generado automáticamente por el Sistema de Gestión de Maquinaria Usada</p>
              <p>Partequipos S.A.S - ${new Date().toLocaleDateString('es-CO')}</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`✅ Correo de notificación (${notificationType}) enviado exitosamente:`, result.messageId);
    return { success: true, messageId: result.messageId };
    
  } catch (error) {
    console.error(`❌ Error al enviar correo de notificación (${notificationType}):`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Verifica la configuración del servicio de correo
 */
export const testEmailConnection = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('✅ Servidor de correo configurado correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error en configuración de correo:', error);
    return false;
  }
};
