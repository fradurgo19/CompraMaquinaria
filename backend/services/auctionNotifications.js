/**
 * Servicio de Notificaciones de Subastas
 * Envía recordatorios automáticos 2 días antes de cada subasta
 */

import { pool } from '../db/connection.js';
import { createTransport } from 'nodemailer';
import cron from 'node-cron';

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
 * Obtiene las subastas que ocurrirán en 2 días
 */
export const getUpcomingAuctions = async () => {
  try {
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
    twoDaysFromNow.setHours(0, 0, 0, 0);

    const twoDaysFromNowEnd = new Date(twoDaysFromNow);
    twoDaysFromNowEnd.setHours(23, 59, 59, 999);

    console.log('🔍 Buscando subastas para:', twoDaysFromNow.toLocaleDateString('es-CO'));

    const result = await pool.query(`
      SELECT 
        a.id,
        a.auction_date,
        a.lot_number,
        a.max_price,
        a.purchased_price,
        a.status,
        a.purchase_type,
        s.name as supplier_name,
        m.brand,
        m.model,
        m.serial,
        m.year,
        m.hours,
        m.machine_type,
        m.wet_line,
        m.arm_type,
        m.track_width,
        m.bucket_capacity,
        m.blade,
        m.warranty_months,
        m.warranty_hours,
        m.engine_brand,
        m.cabin_type
      FROM auctions a
      LEFT JOIN machines m ON a.machine_id = m.id
      LEFT JOIN suppliers s ON a.supplier_id = s.id
      WHERE DATE(a.auction_date) = DATE($1)
      ORDER BY a.auction_date, a.lot_number
    `, [twoDaysFromNow]);

    console.log(`📊 Encontradas ${result.rows.length} subastas para ${twoDaysFromNow.toLocaleDateString('es-CO')}`);

    return result.rows;
  } catch (error) {
    console.error('❌ Error al obtener subastas:', error);
    throw error;
  }
};

/**
 * Formatea los datos de las subastas en una tabla HTML
 */
const formatAuctionsTable = (auctions, auctionDate) => {
  const rows = auctions.map(auction => `
    <tr style="border-bottom: 1px solid #e0e0e0;">
      <td style="padding: 12px 8px; text-align: left;">${auction.supplier_name || '-'}</td>
      <td style="padding: 12px 8px; text-align: left;">
        <span style="background: ${auction.purchase_type === 'COMPRA_DIRECTA' ? '#e3f2fd' : '#f3e5f5'}; 
                     color: ${auction.purchase_type === 'COMPRA_DIRECTA' ? '#1976d2' : '#7b1fa2'}; 
                     padding: 4px 8px; 
                     border-radius: 4px; 
                     font-size: 11px; 
                     font-weight: 600;">
          ${auction.purchase_type === 'COMPRA_DIRECTA' ? 'COMPRA DIRECTA' : auction.purchase_type || '-'}
        </span>
      </td>
      <td style="padding: 12px 8px; text-align: center; font-weight: 600; color: #1976d2;">${auction.lot_number || '-'}</td>
      <td style="padding: 12px 8px; text-align: left; font-weight: 600;">${auction.brand || '-'}</td>
      <td style="padding: 12px 8px; text-align: left;">
        <span style="background: #f5f5f5; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">
          ${auction.model || '-'}
        </span>
      </td>
      <td style="padding: 12px 8px; text-align: left; font-family: monospace; font-size: 11px; color: #666;">
        ${auction.serial || '-'}
      </td>
      <td style="padding: 12px 8px; text-align: center;">
        <span style="background: ${auction.year >= 2020 ? '#c8e6c9' : auction.year >= 2015 ? '#fff9c4' : '#ffccbc'}; 
                     padding: 4px 8px; 
                     border-radius: 4px; 
                     font-weight: 600;">
          ${auction.year || '-'}
        </span>
      </td>
      <td style="padding: 12px 8px; text-align: right; font-family: monospace;">
        ${auction.hours ? auction.hours.toLocaleString('es-CO') : '-'}
      </td>
      <td style="padding: 12px 8px; text-align: right; font-weight: 700; color: #d32f2f; font-size: 14px;">
        $${auction.max_price ? auction.max_price.toLocaleString('es-CO') : '0'}
      </td>
    </tr>
  `).join('');

  return `
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden;">
      <thead>
        <tr style="background: linear-gradient(135deg, #c62828 0%, #b71c1c 100%); color: white;">
          <th style="padding: 14px 8px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase;">Proveedor</th>
          <th style="padding: 14px 8px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase;">Tipo</th>
          <th style="padding: 14px 8px; text-align: center; font-size: 12px; font-weight: 600; text-transform: uppercase;">Lote</th>
          <th style="padding: 14px 8px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase;">Marca</th>
          <th style="padding: 14px 8px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase;">Modelo</th>
          <th style="padding: 14px 8px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase;">Serial</th>
          <th style="padding: 14px 8px; text-align: center; font-size: 12px; font-weight: 600; text-transform: uppercase;">Año</th>
          <th style="padding: 14px 8px; text-align: right; font-size: 12px; font-weight: 600; text-transform: uppercase;">Horas</th>
          <th style="padding: 14px 8px; text-align: right; font-size: 12px; font-weight: 600; text-transform: uppercase;">Max</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
};

/**
 * Envía correo de recordatorio de subastas
 */
export const sendAuctionReminder = async (auctions, auctionDate) => {
  try {
    if (!auctions || auctions.length === 0) {
      console.log('ℹ️ No hay subastas para enviar recordatorio');
      return { success: false, message: 'No hay subastas programadas' };
    }

    const transporter = createTransporter();
    
    const formattedDate = new Date(auctionDate).toLocaleDateString('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const mailOptions = {
      from: process.env.EMAIL_USER || 'fradurgo19@gmail.com',
      to: 'analista.mantenimiento@partequipos.com',
      subject: `🔔 Recordatorio: ${auctions.length} subasta${auctions.length > 1 ? 's' : ''} programada${auctions.length > 1 ? 's' : ''} - ${formattedDate}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 900px; margin: 0 auto; padding: 20px; }
            .header { 
              background: linear-gradient(135deg, #c62828 0%, #b71c1c 100%); 
              color: white; 
              padding: 30px 20px; 
              border-radius: 12px 12px 0 0; 
              text-align: center; 
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
            .header p { margin: 10px 0 0 0; font-size: 16px; opacity: 0.95; }
            .content { background: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .alert-box { 
              background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); 
              padding: 20px; 
              border-radius: 8px; 
              margin: 20px 0; 
              border-left: 5px solid #ff9800;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .alert-box h3 { margin: 0 0 10px 0; color: #e65100; font-size: 18px; }
            .alert-box p { margin: 0; font-size: 15px; color: #555; }
            .stats { 
              display: flex; 
              justify-content: space-around; 
              margin: 25px 0; 
              flex-wrap: wrap;
            }
            .stat-card { 
              background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%); 
              padding: 20px; 
              border-radius: 10px; 
              text-align: center; 
              flex: 1; 
              margin: 10px; 
              min-width: 150px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .stat-card .number { font-size: 32px; font-weight: 700; color: #c62828; margin: 0; }
            .stat-card .label { font-size: 14px; color: #666; margin: 5px 0 0 0; text-transform: uppercase; }
            .footer { 
              text-align: center; 
              margin-top: 30px; 
              color: #999; 
              font-size: 13px; 
              padding: 20px; 
              background: #f9f9f9; 
              border-radius: 8px;
            }
            .footer a { color: #c62828; text-decoration: none; }
            @media (max-width: 600px) {
              .stats { flex-direction: column; }
              .stat-card { margin: 5px 0; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔔 Recordatorio de Subastas</h1>
              <p>Sistema de Gestión de Maquinaria Usada - Partequipos S.A.S</p>
            </div>
            
            <div class="content">
              <div class="alert-box">
                <h3>⏰ Subastas Próximas</h3>
                <p>
                  <strong>Fecha de la subasta:</strong> ${formattedDate}<br>
                  <strong>Cantidad de subastas:</strong> ${auctions.length}
                </p>
              </div>

              <div class="stats">
                <div class="stat-card">
                  <p class="number">${auctions.length}</p>
                  <p class="label">Subasta${auctions.length > 1 ? 's' : ''}</p>
                </div>
                <div class="stat-card">
                  <p class="number">$${auctions.reduce((sum, a) => sum + (a.max_price || 0), 0).toLocaleString('es-CO')}</p>
                  <p class="label">Total Máximo</p>
                </div>
                <div class="stat-card">
                  <p class="number">${new Set(auctions.map(a => a.supplier_name)).size}</p>
                  <p class="label">Proveedor${new Set(auctions.map(a => a.supplier_name)).size > 1 ? 'es' : ''}</p>
                </div>
              </div>

              <h3 style="color: #c62828; margin-top: 30px; font-size: 20px;">📋 Detalle de las Subastas</h3>
              
              ${formatAuctionsTable(auctions, auctionDate)}

              <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 5px solid #4caf50;">
                <h4 style="margin: 0 0 10px 0; color: #2e7d32; font-size: 16px;">✅ Preparación Recomendada</h4>
                <ul style="margin: 0; padding-left: 20px; color: #555;">
                  <li>Verificar disponibilidad de fondos para los precios máximos</li>
                  <li>Revisar especificaciones técnicas de cada máquina</li>
                  <li>Confirmar contacto con proveedores</li>
                  <li>Preparar documentación necesaria para el proceso de compra</li>
                  <li>Coordinar con el equipo de logística para posible recogida</li>
                </ul>
              </div>

              <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center; border: 2px dashed #ff9800;">
                <p style="margin: 0; color: #e65100; font-size: 14px;">
                  📌 <strong>Nota:</strong> Este correo se envía automáticamente 2 días antes de cada subasta programada
                </p>
              </div>
            </div>

            <div class="footer">
              <p>Este correo fue generado automáticamente por el Sistema de Gestión de Maquinaria Usada</p>
              <p><strong>Partequipos S.A.S</strong> | ${new Date().toLocaleDateString('es-CO')}</p>
              <p>Para más información, acceda al sistema: <a href="${process.env.FRONTEND_URL || 'https://compra-maquinaria.vercel.app'}/auctions">Ver Subastas</a></p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Correo de recordatorio enviado exitosamente:', result.messageId);
    return { 
      success: true, 
      messageId: result.messageId,
      auctionCount: auctions.length,
      auctionDate: formattedDate
    };
    
  } catch (error) {
    console.error('❌ Error al enviar correo de recordatorio:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Tarea programada que se ejecuta diariamente a las 8:00 AM
 * Verifica si hay subastas en 2 días y envía recordatorio
 */
export const startAuctionReminderCron = () => {
  // Ejecutar todos los días a las 8:00 AM
  cron.schedule('0 8 * * *', async () => {
    console.log('⏰ Ejecutando tarea de recordatorio de subastas...');
    try {
      const upcomingAuctions = await getUpcomingAuctions();
      
      if (upcomingAuctions && upcomingAuctions.length > 0) {
        const result = await sendAuctionReminder(upcomingAuctions, upcomingAuctions[0].auction_date);
        console.log('📧 Resultado del envío:', result);
      } else {
        console.log('ℹ️ No hay subastas programadas para dentro de 2 días');
      }
    } catch (error) {
      console.error('❌ Error en tarea programada:', error);
    }
  }, {
    timezone: "America/Bogota"
  });

  console.log('✅ Cron job de recordatorio de subastas iniciado (8:00 AM diario)');
};

/**
 * Función manual para probar el envío de recordatorios
 */
export const sendReminderNow = async () => {
  try {
    console.log('🔄 Ejecutando recordatorio manual...');
    const upcomingAuctions = await getUpcomingAuctions();
    
    if (upcomingAuctions && upcomingAuctions.length > 0) {
      const result = await sendAuctionReminder(upcomingAuctions, upcomingAuctions[0].auction_date);
      return result;
    } else {
      return { 
        success: false, 
        message: 'No hay subastas programadas para dentro de 2 días' 
      };
    }
  } catch (error) {
    console.error('❌ Error al enviar recordatorio manual:', error);
    return { success: false, error: error.message };
  }
};

