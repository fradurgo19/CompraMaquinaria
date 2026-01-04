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
      to: process.env.EMAIL_AUCTION_ALERTS || 'sdonado@partequiposusa.com',
      subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
              line-height: 1.6; 
              color: #1f2937; 
              background: #f5f7fa;
              padding: 20px;
            }
            .container { 
              max-width: 650px; 
              margin: 0 auto; 
              background: white; 
              border-radius: 16px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.1);
              overflow: hidden;
            }
            .header { 
              background: ${isOneDayBefore 
                ? 'linear-gradient(135deg, #cf1b22 0%, #8a1217 100%)' 
                : 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)'}; 
              color: white; 
              padding: 40px 30px; 
              text-align: center;
              position: relative;
              overflow: hidden;
            }
            .header::before {
              content: '';
              position: absolute;
              top: -50%;
              right: -50%;
              width: 200%;
              height: 200%;
              background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
              animation: pulse 3s ease-in-out infinite;
            }
            @keyframes pulse {
              0%, 100% { opacity: 0.3; }
              50% { opacity: 0.5; }
            }
            .logo-container {
              margin-bottom: 20px;
              position: relative;
              z-index: 1;
            }
            .logo {
              height: 70px;
              width: auto;
              max-width: 200px;
              margin: 0 auto;
              display: block;
              background: white;
              padding: 8px 16px;
              border-radius: 8px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            }
            .header h1 {
              font-size: 28px;
              font-weight: 700;
              margin-bottom: 8px;
              position: relative;
              z-index: 1;
            }
            .header p {
              font-size: 14px;
              opacity: 0.95;
              position: relative;
              z-index: 1;
            }
            .content { 
              background: #ffffff; 
              padding: 30px; 
            }
            .alert-box { 
              background: ${isOneDayBefore 
                ? 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)' 
                : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)'}; 
              padding: 20px; 
              border-radius: 12px; 
              margin: 20px 0; 
              border-left: 5px solid ${isOneDayBefore ? '#cf1b22' : '#dc2626'};
              box-shadow: 0 2px 8px rgba(207, 27, 34, 0.1);
            }
            .alert-box h3 {
              color: ${isOneDayBefore ? '#cf1b22' : '#dc2626'};
              font-size: 18px;
              margin-bottom: 8px;
              font-weight: 700;
            }
            .alert-box p {
              color: ${isOneDayBefore ? '#7f1d1d' : '#991b1b'};
              font-size: 14px;
              margin: 0;
            }
            .time-highlight {
              background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
              padding: 30px;
              border-radius: 12px;
              text-align: center;
              margin: 25px 0;
              border: 2px solid #cf1b22;
              box-shadow: 0 4px 12px rgba(207, 27, 34, 0.15);
            }
            .time-highlight p {
              font-size: 12px;
              color: #6b7280;
              text-transform: uppercase;
              letter-spacing: 1px;
              font-weight: 600;
              margin-bottom: 12px;
            }
            .time-highlight .time-value {
              font-size: 28px;
              font-weight: 700;
              color: #cf1b22;
              margin: 12px 0;
              line-height: 1.2;
            }
            .time-highlight .local-time {
              font-size: 13px;
              color: #6b7280;
              margin-top: 8px;
            }
            .section-title {
              font-size: 18px;
              font-weight: 700;
              color: #1f2937;
              margin: 30px 0 15px 0;
              padding-bottom: 10px;
              border-bottom: 2px solid #e5e7eb;
            }
            .info-table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 20px 0;
              background: white;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .info-table th, .info-table td { 
              padding: 14px 16px; 
              text-align: left; 
              border-bottom: 1px solid #f3f4f6; 
            }
            .info-table th { 
              background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); 
              font-weight: 700;
              color: #374151;
              font-size: 13px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .info-table td {
              color: #1f2937;
              font-size: 14px;
            }
            .info-table tr:last-child td {
              border-bottom: none;
            }
            .info-table tr:hover {
              background: #f9fafb;
            }
            .actions-box {
              background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
              padding: 20px;
              border-radius: 12px;
              margin: 25px 0;
              border-left: 5px solid #10b981;
              box-shadow: 0 2px 8px rgba(16, 185, 129, 0.1);
            }
            .actions-box h4 {
              color: #065f46;
              font-size: 16px;
              margin-bottom: 12px;
              font-weight: 700;
            }
            .actions-box ul {
              margin: 0;
              padding-left: 20px;
              color: #047857;
            }
            .actions-box li {
              margin: 8px 0;
              font-size: 14px;
              line-height: 1.6;
            }
            .footer { 
              text-align: center; 
              margin-top: 30px; 
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              color: #6b7280; 
              font-size: 12px;
              background: #f9fafb;
              padding: 20px 30px;
            }
            .footer p {
              margin: 4px 0;
            }
            .footer .company {
              color: #cf1b22;
              font-weight: 600;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo-container">
                <img src="https://res.cloudinary.com/dbufrzoda/image/upload/v1750457354/Captura_de_pantalla_2025-06-20_170819_wzmyli.png" alt="Partequipos Logo" class="logo" />
              </div>
              <h1>${isOneDayBefore ? '🔔 Recordatorio de Subasta' : '⏰ Alerta de Subasta'}</h1>
              <p>Sistema de Gestión de Maquinaria Usada</p>
            </div>
            
            <div class="content">
              <div class="alert-box">
                <h3>${isOneDayBefore ? '📅 Subasta Programada para Mañana' : '🚨 Subasta en 3 Horas'}</h3>
                <p>Esta subasta se realizará en <strong>${timeRemaining}</strong> según la hora de Colombia.</p>
              </div>

              <div class="time-highlight">
                <p>Hora de Colombia</p>
                <div class="time-value">${formattedColombiaTime}</div>
                ${local_time && auction_city ? `
                  <p class="local-time">Hora local: ${local_time} (${auction_city})</p>
                ` : ''}
              </div>

              <h3 class="section-title">📋 Detalles de la Subasta</h3>
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

              <h3 class="section-title">🚜 Información de la Máquina</h3>
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
                <h3 class="section-title">💬 Comentarios</h3>
                <div style="background: #f0f0f0; padding: 15px; border-radius: 8px; margin: 10px 0;">
                  ${comments}
                </div>
              ` : ''}

              <div class="actions-box">
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
              <p><span class="company">Partequipos S.A.S</span> - ${new Date().toLocaleDateString('es-CO')}</p>
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
