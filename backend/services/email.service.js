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
