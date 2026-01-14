/**
 * Servicio para generar PDFs de órdenes de compra
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import https from 'https';
import storageService from './storage.service.js';

/**
 * Genera un PDF de orden de compra con formato profesional bilingüe
 * @param {Object} orderData - Datos de la orden de compra
 * @param {string} orderData.purchase_order - Número de orden de compra
 * @param {string} orderData.supplier_name - Nombre del proveedor
 * @param {string} orderData.brand - Marca
 * @param {string} orderData.model - Modelo
 * @param {string} orderData.serial - Número de serie
 * @param {number} orderData.quantity - Cantidad de máquinas
 * @param {number} orderData.value - Valor unitario
 * @param {string} orderData.currency - Moneda
 * @param {string} orderData.invoice_date - Fecha de factura
 * @param {string} orderData.empresa - Empresa (Partequipos Maquinaria o Maquitecno)
 * @param {string} orderData.incoterm - Término de entrega (EXW, FOB, etc.)
 * @param {string} orderData.payment_term - Término de pago (ej: "120 days after the BL date")
 * @param {string} orderData.payment_days - Días de pago (deprecated, usar payment_term)
 * @param {string} orderData.description - Descripción del equipo (se muestra en columna DESCRIPTION)
 * @param {string} orderData.observations - Observaciones comerciales (deprecated, usar description)
 * @returns {Promise<string>} - Ruta del archivo PDF generado
 */
// Función auxiliar para descargar imagen desde URL
function downloadImage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download image: ${response.statusCode}`));
        return;
      }
      
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

export async function generatePurchaseOrderPDF(orderData) {
  return new Promise(async (resolve, reject) => {
    try {
      // Nombre del archivo
      const fileName = `OC-${orderData.purchase_order || 'SIN-OC'}-${Date.now()}.pdf`;

      // Crear documento PDF
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 40, bottom: 40, left: 40, right: 40 }
      });

      // Determinar si usar Supabase Storage o almacenamiento local
      const isProduction = process.env.NODE_ENV === 'production' || process.env.SUPABASE_STORAGE_ENABLED === 'true';
      
      let pdfBuffer;
      let stream;
      
      if (isProduction && storageService.supabase) {
        // Producción: capturar PDF en buffer para subir a Supabase
        const { PassThrough } = await import('stream');
        const chunks = [];
        const passThrough = new PassThrough();
        
        passThrough.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        passThrough.on('end', () => {
          pdfBuffer = Buffer.concat(chunks);
        });
        
        stream = passThrough;
        doc.pipe(stream);
      } else {
        // Desarrollo: escribir a disco
        const pdfDir = path.join(process.cwd(), 'storage', 'pdfs');
        if (!fs.existsSync(pdfDir)) {
          fs.mkdirSync(pdfDir, { recursive: true });
        }
        const filePath = path.join(pdfDir, fileName);
        stream = fs.createWriteStream(filePath);
        doc.pipe(stream);
      }

      // Colores institucionales
      const primaryColor = '#cf1b22';
      const lightGray = '#f5f5f5';
      const darkGray = '#333333';
      const tableHeaderBg = '#cf1b22';

      // Determinar logo según empresa
      const empresa = orderData.empresa || 'Partequipos Maquinaria';
      let logoUrl;
      if (empresa.toLowerCase().includes('maquitecno')) {
        logoUrl = 'https://res.cloudinary.com/dbufrzoda/image/upload/v1765547531/Maquitecno_VECTORES_gy4pzs.png';
      } else {
        logoUrl = 'https://res.cloudinary.com/dbufrzoda/image/upload/v1750457354/Captura_de_pantalla_2025-06-20_170819_wzmyli.png';
      }

      // Descargar logo
      let logoBuffer = null;
      try {
        logoBuffer = await downloadImage(logoUrl);
      } catch (logoError) {
        console.warn('No se pudo cargar el logo:', logoError.message);
      }

      let yPos = 40;

      // ==================== HEADER ====================
      // Logo izquierdo
      if (logoBuffer) {
        try {
          doc.image(logoBuffer, 40, yPos, { width: 80, height: 50, fit: [80, 50] });
        } catch (imgError) {
          console.warn('Error al insertar logo:', imgError.message);
        }
      }

      // Título centrado
      doc
        .fontSize(10)
        .fillColor(darkGray)
        .font('Helvetica-Bold')
        .text('GESTION DE DESARROLLO Y COMPRA DE PRODUCTOS', 130, yPos, { align: 'center', width: 380 })
        .fontSize(14)
        .fillColor(primaryColor)
        .text('ORDEN DE COMPRA GENERAL', 130, yPos + 15, { align: 'center', width: 380 })
        .fontSize(12)
        .fillColor(darkGray)
        .text('GENERAL PURCHASE ORDER', 130, yPos + 32, { align: 'center', width: 380 });

      yPos += 65;

      // Línea divisoria
      doc
        .strokeColor(primaryColor)
        .lineWidth(2)
        .moveTo(40, yPos)
        .lineTo(572, yPos)
        .stroke();

      yPos += 15;

      // ==================== INFORMACIÓN PRINCIPAL ====================
      const currency = orderData.currency || 'USD';
      const currencySymbol = currency === 'USD' ? 'US$' : currency === 'JPY' ? '¥' : currency === 'EUR' ? '€' : currency;
      const incoterm = orderData.incoterm || 'EXW';
      const paymentTerm = orderData.payment_term || orderData.payment_days || '120 days after the BL date';

      // Columna izquierda
      doc
        .fontSize(8)
        .fillColor(darkGray)
        .font('Helvetica-Bold')
        .text('DATE / FECHA:', 40, yPos)
        .font('Helvetica')
        .text(orderData.invoice_date ? new Date(orderData.invoice_date).toLocaleDateString('es-CO') : new Date().toLocaleDateString('es-CO'), 140, yPos);

      yPos += 12;

      doc
        .font('Helvetica-Bold')
        .text('SUPPLIER NAME / PROVEEDOR:', 40, yPos)
        .font('Helvetica')
        .text(orderData.supplier_name || 'N/A', 200, yPos);

      yPos += 12;

      doc
        .font('Helvetica-Bold')
        .text('PURCHASE ORDER NUMBER / No. OC:', 40, yPos)
        .font('Helvetica')
        .text(orderData.purchase_order || 'SIN OC', 220, yPos);

      yPos += 20;

      // ==================== CONSIGNEE ====================
      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor(primaryColor)
        .text('CONSIGNEE / CONSIGNATARIO:', 40, yPos);

      yPos += 12;

      doc
        .fontSize(8)
        .fillColor(darkGray)
        .font('Helvetica')
        .text('PARTEQUIPOS MAQUINARIA S.A.S', 40, yPos)
        .text('ID NUMBER: 830.116.807-7', 40, yPos + 10)
        .text('ADD: DIAGONAL 16 # 96G-85', 40, yPos + 20)
        .text('Ph: 57 1 492 62 60', 40, yPos + 30);

      // Payment y Delivery Terms (columna derecha)
      const rightCol = 320;
      doc
        .font('Helvetica-Bold')
        .text('PAYMENT TERM / TÉRMINO DE PAGO:', rightCol, yPos)
        .font('Helvetica')
        .text(paymentTerm, rightCol, yPos + 10, { width: 232 });

      doc
        .font('Helvetica-Bold')
        .text('DELIVERY TERM / TÉRMINO ENTREGA:', rightCol, yPos + 20)
        .font('Helvetica')
        .text(incoterm, rightCol, yPos + 30);

      yPos += 50;

      // ==================== BUYER AND SHIPPER ====================
      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor(primaryColor)
        .text('BUYER AND SHIPPER / COMPRADOR Y EMBARCADOR:', 40, yPos);

      yPos += 12;

      doc
        .fontSize(8)
        .fillColor(darkGray)
        .font('Helvetica')
        .text('PARTEQUIPOS MAQUINARIA S.A.S', 40, yPos)
        .text('ID NUMBER: 830.116.807-7', 40, yPos + 10)
        .text('ADD: DIAGONAL 16 # 96G-85', 40, yPos + 20)
        .text('Ph: 57 1 492 62 60', 40, yPos + 30);

      yPos += 50;

      // ==================== TABLA DE ITEMS ====================
      // Encabezados de tabla - Ajustados para dar más espacio a DESCRIPTION
      const tableTop = yPos;
      const col1 = 40;   // ITEM (30px)
      const col2 = 70;   // PART NUMBER (60px) - reducido
      const col3 = 130;  // MODEL (70px) - reducido
      const col4 = 200;  // QTY (40px) - reducido
      const col5 = 240;  // DESCRIPTION (200px) - más ancho
      const col6 = 440;  // PRICE (60px)
      const col7 = 500;  // TOTAL (70px)

      // Calcular ancho total de la tabla (ajustado para dar más espacio a DESCRIPTION)
      const tableWidth = 550; // Ancho total de la tabla
      
      doc
        .fillColor(tableHeaderBg)
        .rect(col1, tableTop, tableWidth, 20)
        .fill();

      doc
        .fontSize(8)
        .fillColor('white')
        .font('Helvetica-Bold')
        .text('ITEM', col1 + 5, tableTop + 6)
        .text('PART NUMBER', col2 + 5, tableTop + 6)
        .text('MODEL', col3 + 5, tableTop + 6)
        .text('QTY', col4 + 5, tableTop + 6)
        .text('DESCRIPTION', col5 + 5, tableTop + 6)
        .text('PRICE', col6 + 5, tableTop + 6)
        .text('TOTAL', col7 + 5, tableTop + 6);

      yPos = tableTop + 22;

      // Datos del item
      const quantity = orderData.quantity || 1;
      const unitValue = orderData.value || 0;
      const totalValue = unitValue * quantity;
      const model = orderData.model || 'N/A';
      const serial = orderData.serial || '-';
      const description = orderData.description || orderData.observations || '-';

      // Calcular altura dinámica basada en la descripción
      const descriptionWidth = col6 - col5 - 10; // Ancho disponible para descripción (200px - 10px de padding)
      const descriptionHeight = doc.heightOfString(description, { 
        width: descriptionWidth,
        align: 'left'
      });
      const rowHeight = Math.max(25, descriptionHeight + 15); // Mínimo 25, más si la descripción es larga

      // Fila de datos
      doc
        .fillColor(lightGray)
        .rect(col1, yPos, tableWidth, rowHeight)
        .fill();

      // Renderizar campos con anchos ajustados
      doc
        .fontSize(8)
        .fillColor(darkGray)
        .font('Helvetica')
        .text('1', col1 + 5, yPos + 8)
        .text(serial || '-', col2 + 5, yPos + 8, { width: col3 - col2 - 10, ellipsis: true })
        .text(model, col3 + 5, yPos + 8, { width: col4 - col3 - 10, ellipsis: true })
        .text(String(quantity), col4 + 5, yPos + 8);
      
      // Descripción con más espacio y altura dinámica
      doc
        .text(description, col5 + 5, yPos + 8, { 
          width: descriptionWidth,
          align: 'left'
        });
      
      // Precio y Total
      doc
        .text(`${currencySymbol} ${unitValue.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`, col6 + 5, yPos + 8)
        .font('Helvetica-Bold')
        .text(`${currencySymbol} ${totalValue.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`, col7 + 5, yPos + 8);

      yPos += rowHeight + 5;

      // Línea de separación
      doc
        .strokeColor('#cccccc')
        .lineWidth(1)
        .moveTo(col1, yPos)
        .lineTo(col1 + tableWidth, yPos)
        .stroke();

      yPos += 15;

      // ==================== TOTALES ====================
      doc
        .fontSize(10)
        .fillColor(darkGray)
        .font('Helvetica-Bold')
        .text('TOTAL / TOTAL:', col6 - 30, yPos)
        .fontSize(12)
        .fillColor(primaryColor)
        .text(`${currencySymbol} ${totalValue.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`, col7 + 5, yPos);

      // ==================== FOOTER ====================
      const footerY = 720;

      doc
        .fontSize(7)
        .fillColor('#666666')
        .font('Helvetica')
        .text(`${empresa.toUpperCase()} - Sistema de Gestión de Maquinaria`, 40, footerY, { align: 'center', width: 532 })
        .text(`Generado el ${new Date().toLocaleDateString('es-CO')} a las ${new Date().toLocaleTimeString('es-CO')}`, 40, footerY + 10, { align: 'center', width: 532 });

      // Finalizar documento
      doc.end();

      if (isProduction && storageService.supabase) {
        // Producción: subir a Supabase Storage
        // Esperar a que el stream termine y el buffer esté completo
        stream.on('end', async () => {
          try {
            if (!pdfBuffer) {
              throw new Error('PDF buffer no se generó correctamente');
            }
            
            const { path: filePath } = await storageService.uploadFile(
              pdfBuffer,
              fileName,
              'new-purchase-files',
              'pdfs'
            );
            resolve(filePath);
          } catch (uploadError) {
            reject(new Error(`Error subiendo PDF a Supabase Storage: ${uploadError.message}`));
          }
        });

        stream.on('error', (error) => {
          reject(error);
        });
      } else {
        // Desarrollo: usar ruta local
        stream.on('finish', () => {
          const relativePath = `pdfs/${fileName}`;
          resolve(relativePath);
        });

        stream.on('error', (error) => {
          reject(error);
        });
      }

    } catch (error) {
      reject(error);
    }
  });
}

