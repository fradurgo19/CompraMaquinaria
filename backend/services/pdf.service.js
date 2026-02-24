/**
 * Servicio para generar PDFs de órdenes de compra
 */

import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { PassThrough } from 'node:stream';
import storageService from './storage.service.js';

const ensureDirectoryExists = (dirPath) => {
  if (fs.existsSync(dirPath)) return;
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch (error) {
    throw new Error(`No se pudo crear el directorio: ${dirPath}`, { cause: error });
  }
};

const sanitizeFileName = (value) => {
  const raw = String(value ?? 'SIN-OC');
  return raw.replaceAll(/[^a-zA-Z0-9_-]/g, '_');
};

const resolveSafePath = (baseDir, fileName) => {
  const resolvedBase = path.resolve(baseDir);
  const resolvedPath = path.resolve(baseDir, fileName);
  if (!resolvedPath.startsWith(`${resolvedBase}${path.sep}`)) {
    throw new Error('Ruta inválida para escritura');
  }
  return resolvedPath;
};

const createPdfWriteStream = (filePath) => fs.createWriteStream(filePath, { flags: 'w' });

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
  return new Promise((resolve, reject) => {
    const run = async () => {
      // Nombre del archivo
      const safeOrder = sanitizeFileName(orderData.purchase_order || 'SIN-OC');
      const fileName = `OC-${safeOrder}-${Date.now()}.pdf`;

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
        ensureDirectoryExists(pdfDir);
        const filePath = resolveSafePath(pdfDir, fileName);
        const fileStream = createPdfWriteStream(filePath);
        stream = fileStream;
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
      const currencySymbols = {
        USD: 'US$',
        JPY: '¥',
        EUR: '€'
      };
      const currencySymbol = currencySymbols[currency] ?? currency;
      const incoterm = orderData.incoterm || 'EXW';
      const paymentTerm = orderData.payment_term || orderData.payment_days || '120 days after the BL date';

      // Parte superior: izquierda (fecha, proveedor, OC) y derecha (términos de pago y entrega)
      const topRightX = 400;
      const lineH = 11;
      const blockLeft = 40;
      const blockRight = 380;

      doc
        .fontSize(8)
        .fillColor(darkGray)
        .font('Helvetica-Bold')
        .text('DATE / FECHA:', 40, yPos)
        .font('Helvetica')
        .text(orderData.invoice_date ? new Date(orderData.invoice_date).toLocaleDateString('es-CO') : new Date().toLocaleDateString('es-CO'), 140, yPos);

      doc
        .font('Helvetica-Bold')
        .text('PAYMENT TERM / TÉRMINO DE PAGO:', topRightX, yPos)
        .font('Helvetica')
        .text(String(paymentTerm || '').trim() || '1', topRightX, yPos + lineH, { width: 172 });

      doc
        .font('Helvetica-Bold')
        .text('DELIVERY TERM / TÉRMINO ENTREGA:', topRightX, yPos + lineH * 2)
        .font('Helvetica')
        .text(incoterm, topRightX, yPos + lineH * 3);

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

      yPos += 28;

      // ==================== CONSIGNEE (izq) y BUYER AND SHIPPER (derecha, alineados) ====================
      const blockGap = 10;
      const buyerBlockWidth = 172;

      doc.fontSize(9).font('Helvetica-Bold').fillColor(primaryColor);
      doc.text('CONSIGNEE / CONSIGNATARIO:', blockLeft, yPos);
      const buyerTitleH = doc.heightOfString('BUYER AND SHIPPER / COMPRADOR Y EMBARCADOR:', { width: buyerBlockWidth });
      doc.text('BUYER AND SHIPPER / COMPRADOR Y EMBARCADOR:', blockRight, yPos, { width: buyerBlockWidth });
      yPos += Math.max(lineH, buyerTitleH);

      doc
        .fontSize(8)
        .fillColor(darkGray)
        .font('Helvetica')
        .text('PARTEQUIPOS MAQUINARIA S.A.S', blockLeft, yPos)
        .text('PARTEQUIPOS MAQUINARIA S.A.S', blockRight, yPos, { width: buyerBlockWidth })
        .text('ID NUMBER: 830.116.807-7', blockLeft, yPos + lineH)
        .text('ID NUMBER: 830.116.807-7', blockRight, yPos + lineH, { width: buyerBlockWidth })
        .text('ADD: DIAGONAL 16 # 96G-85', blockLeft, yPos + lineH * 2)
        .text('ADD: DIAGONAL 16 # 96G-85', blockRight, yPos + lineH * 2, { width: buyerBlockWidth })
        .text('Ph: 57 1 492 62 60', blockLeft, yPos + lineH * 3)
        .text('Ph: 57 1 492 62 60', blockRight, yPos + lineH * 3, { width: buyerBlockWidth });

      yPos += lineH * 4 + blockGap;

      // ==================== TABLA DE ITEMS ====================
      // Columnas justificadas: anchos fijos para que PRICE y TOTAL no se superpongan
      const tableTop = yPos;
      const tableLeft = 40;
      const wItem = 28;
      const wPartNo = 62;
      const wModel = 62;
      const wQty = 28;
      const wDescription = 218;
      const wPrice = 72;
      const wTotal = 72;
      const tableWidth = wItem + wPartNo + wModel + wQty + wDescription + wPrice + wTotal;
      const pad = 4;
      const headerRowHeight = 26;

      const xItem = tableLeft;
      const xPartNo = xItem + wItem;
      const xModel = xPartNo + wPartNo;
      const xQty = xModel + wModel;
      const xDesc = xQty + wQty;
      const xPrice = xDesc + wDescription;
      const xTotal = xPrice + wPrice;

      doc
        .fillColor(tableHeaderBg)
        .rect(tableLeft, tableTop, tableWidth, headerRowHeight)
        .fill();

      doc
        .fontSize(8)
        .fillColor('white')
        .font('Helvetica-Bold')
        .text('ITEM', xItem + pad, tableTop + 6, { width: wItem - pad * 2 })
        .text('PART NUMBER', xPartNo + pad, tableTop + 6, { width: wPartNo - pad * 2 })
        .text('MODEL', xModel + pad, tableTop + 6, { width: wModel - pad * 2 })
        .text('QTY', xQty + pad, tableTop + 6, { width: wQty - pad * 2 })
        .text('DESCRIPTION', xDesc + pad, tableTop + 6, { width: wDescription - pad * 2 })
        .text('PRICE', xPrice + pad, tableTop + 6, { width: wPrice - pad * 2, align: 'right' })
        .text('TOTAL', xTotal + pad, tableTop + 6, { width: wTotal - pad * 2, align: 'right' });

      yPos = tableTop + headerRowHeight;

      const quantity = orderData.quantity || 1;
      const unitValue = orderData.value || 0;
      const totalValue = unitValue * quantity;
      const model = orderData.model || 'N/A';
      const serial = orderData.serial || '-';
      const description = orderData.description || orderData.observations || '-';

      const descriptionHeight = doc.heightOfString(description, { width: wDescription - pad * 2, align: 'left' });
      const rowHeight = Math.max(22, descriptionHeight + 10);

      // Part number: una sola línea dentro de la celda; truncar en código para evitar desborde
      const maxPartNoLen = 14;
      const partNumberRaw = String(serial ?? '-').trim();
      const partNumberText = partNumberRaw.length <= maxPartNoLen
        ? partNumberRaw
        : `${partNumberRaw.slice(0, maxPartNoLen - 3)}...`;
      const partNumberOpts = { width: wPartNo - pad * 2, height: 10, ellipsis: true };

      doc
        .fillColor(lightGray)
        .rect(tableLeft, yPos, tableWidth, rowHeight)
        .fill();

      const priceStr = `${currencySymbol} ${unitValue.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`;
      const totalStr = `${currencySymbol} ${totalValue.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`;

      doc
        .fontSize(8)
        .fillColor(darkGray)
        .font('Helvetica')
        .text('1', xItem + pad, yPos + 8, { width: wItem - pad * 2 })
        .text(partNumberText, xPartNo + pad, yPos + 8, partNumberOpts)
        .text(model, xModel + pad, yPos + 8, { width: wModel - pad * 2, ellipsis: true })
        .text(String(quantity), xQty + pad, yPos + 8, { width: wQty - pad * 2 })
        .text(description, xDesc + pad, yPos + 8, { width: wDescription - pad * 2, align: 'left' })
        .text(priceStr, xPrice + pad, yPos + 8, { width: wPrice - pad * 2, align: 'right' })
        .font('Helvetica-Bold')
        .text(totalStr, xTotal + pad, yPos + 8, { width: wTotal - pad * 2, align: 'right' });

      yPos += rowHeight + 5;

      doc
        .strokeColor('#cccccc')
        .lineWidth(1)
        .moveTo(tableLeft, yPos)
        .lineTo(tableLeft + tableWidth, yPos)
        .stroke();

      yPos += 15;

      // TOTAL / TOTAL: etiqueta y valor en una sola fila (moneda + número juntos a la derecha)
      const totalLabelW = xPrice - tableLeft;
      doc
        .fontSize(10)
        .fillColor(darkGray)
        .font('Helvetica-Bold')
        .text('TOTAL / TOTAL:', tableLeft, yPos, { width: totalLabelW })
        .fontSize(12)
        .fillColor(primaryColor)
        .text(totalStr, xPrice, yPos, { width: tableWidth - totalLabelW, align: 'right' });

      // ==================== FOOTER ====================
      const footerY = 720;
      const tzColombia = 'America/Bogota';
      const now = new Date();
      const footerDate = now.toLocaleDateString('es-CO', { timeZone: tzColombia });
      const footerTime = now.toLocaleTimeString('es-CO', { timeZone: tzColombia, hour: '2-digit', minute: '2-digit', second: '2-digit' });

      doc
        .fontSize(7)
        .fillColor('#666666')
        .font('Helvetica')
        .text(`${empresa.toUpperCase()} - Sistema de Gestión de Maquinaria`, 40, footerY, { align: 'center', width: 532 })
        .text(`Generado el ${footerDate} a las ${footerTime}`, 40, footerY + 10, { align: 'center', width: 532 });

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

    };

    run().catch(reject);
  });
}

