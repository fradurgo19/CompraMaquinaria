/**
 * Servicio para generar PDFs de órdenes de compra
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import https from 'https';

/**
 * Genera un PDF de orden de compra masiva
 * @param {Object} orderData - Datos de la orden de compra
 * @param {string} orderData.purchase_order - Número de orden de compra
 * @param {string} orderData.supplier_name - Nombre del proveedor
 * @param {string} orderData.brand - Marca
 * @param {string} orderData.model - Modelo
 * @param {number} orderData.quantity - Cantidad de máquinas
 * @param {number} orderData.value - Valor unitario
 * @param {string} orderData.currency - Moneda
 * @param {string} orderData.invoice_date - Fecha de factura
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
      // Crear directorio si no existe
      const pdfDir = path.join(process.cwd(), 'storage', 'pdfs');
      if (!fs.existsSync(pdfDir)) {
        fs.mkdirSync(pdfDir, { recursive: true });
      }

      // Nombre del archivo
      const fileName = `OC-${orderData.purchase_order || 'SIN-OC'}-${Date.now()}.pdf`;
      const filePath = path.join(pdfDir, fileName);

      // Crear documento PDF
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 40, bottom: 40, left: 50, right: 50 }
      });

      // Pipe al archivo
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Colores institucionales
      const primaryColor = '#cf1b22';
      const darkRed = '#8a1217';
      const gray = '#666666';
      const lightGray = '#f5f5f5';

      // Descargar y agregar logo
      let logoBuffer = null;
      try {
        const logoUrl = 'https://res.cloudinary.com/dbufrzoda/image/upload/v1750457354/Captura_de_pantalla_2025-06-20_170819_wzmyli.png';
        logoBuffer = await downloadImage(logoUrl);
      } catch (logoError) {
        console.warn('No se pudo cargar el logo, continuando sin él:', logoError.message);
      }

      // Header con logo y título
      let yPos = 40;
      
      // Logo en la parte superior izquierda
      if (logoBuffer) {
        try {
          doc.image(logoBuffer, 50, yPos, { width: 60, height: 40, fit: [60, 40] });
        } catch (imgError) {
          console.warn('Error al insertar logo:', imgError.message);
        }
      }

      // Título centrado
      doc
        .fillColor(primaryColor)
        .fontSize(20)
        .font('Helvetica-Bold')
        .text('PARTEQUIPOS S.A.S', 50, yPos + 5, { align: 'center' })
        .fontSize(16)
        .text('ORDEN DE COMPRA', 50, yPos + 30, { align: 'center' });

      // Línea divisoria
      yPos = 85;
      doc
        .strokeColor(primaryColor)
        .lineWidth(2)
        .moveTo(50, yPos)
        .lineTo(562, yPos)
        .stroke();

      // Información de la orden - más compacta
      yPos = 95;
      
      doc
        .fillColor('black')
        .fontSize(9)
        .font('Helvetica-Bold')
        .text('Número de Orden:', 50, yPos)
        .font('Helvetica')
        .text(orderData.purchase_order || 'SIN OC', 170, yPos)
        .font('Helvetica-Bold')
        .text('Fecha:', 400, yPos)
        .font('Helvetica')
        .text(orderData.invoice_date ? new Date(orderData.invoice_date).toLocaleDateString('es-CO') : new Date().toLocaleDateString('es-CO'), 450, yPos);

      yPos += 15;

      doc
        .font('Helvetica-Bold')
        .text('Proveedor:', 50, yPos)
        .font('Helvetica')
        .text(orderData.supplier_name || 'N/A', 170, yPos);

      yPos += 18;

      // Tabla de productos - más compacta
      doc
        .fillColor(primaryColor)
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('DETALLE DE PRODUCTOS', 50, yPos);

      yPos += 12;

      // Encabezados de tabla con fondo rojo - más compactos
      doc
        .fillColor(primaryColor)
        .rect(50, yPos, 512, 18)
        .fill()
        .fillColor('white')
        .fontSize(9)
        .font('Helvetica-Bold')
        .text('#', 55, yPos + 4)
        .text('Marca', 80, yPos + 4)
        .text('Modelo', 200, yPos + 4)
        .text('Valor Unitario', 350, yPos + 4)
        .text('Valor Total', 460, yPos + 4);

      yPos += 20;

      // Datos de la tabla - una fila por cada equipo
      const unitValue = orderData.value || 0;
      const totalValue = unitValue * orderData.quantity;
      const currency = orderData.currency || 'USD';
      const currencySymbol = currency === 'USD' ? 'US$' : currency === 'JPY' ? '¥' : '€';
      const brand = orderData.brand || 'N/A';
      const model = orderData.model || 'N/A';
      const quantity = orderData.quantity || 1;

      // Mostrar cada equipo en una fila separada - diseño ultra compacto para una sola página
      doc.fillColor('black').font('Helvetica').fontSize(8);

      // Altura de fila más pequeña para que quepa más contenido
      const rowHeight = 12;
      // Calcular espacio disponible (altura de página - márgenes - header - info - tabla header - totales - footer)
      const pageHeight = doc.page.height;
      const maxY = pageHeight - 60; // Dejar espacio para totales y footer
      const maxRows = Math.min(quantity, Math.floor((maxY - yPos) / rowHeight));

      // Limitar a lo que cabe en una página
      const rowsToShow = Math.min(quantity, maxRows);

      for (let i = 0; i < rowsToShow; i++) {
        // Verificar si hay espacio antes de dibujar
        if (yPos + rowHeight > maxY) {
          break; // No dibujar más filas si no hay espacio
        }

        // Alternar color de fondo para mejor legibilidad
        if (i % 2 === 0) {
          doc
            .fillColor(lightGray)
            .rect(50, yPos - 1, 512, rowHeight)
            .fill();
        }

        doc
          .fillColor('black')
          .text(String(i + 1), 55, yPos)
          .text(brand, 80, yPos)
          .text(model, 200, yPos)
          .text(`${currencySymbol} ${unitValue.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 350, yPos)
          .text(`${currencySymbol} ${unitValue.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 460, yPos);

        yPos += rowHeight;
      }

      // Si hay más equipos de los que caben, mostrar nota
      if (quantity > rowsToShow) {
        yPos += 5;
        doc
          .fillColor(gray)
          .fontSize(7)
          .font('Helvetica-Italic')
          .text(`Nota: Se muestran ${rowsToShow} de ${quantity} equipos. El total incluye todos los equipos.`, 50, yPos);
        yPos += 10;
      }

      // Totales - más compactos
      yPos += 5;
      
      // Asegurar que los totales estén en la misma página
      if (yPos > maxY - 30) {
        yPos = maxY - 30;
      }
      
      doc
        .strokeColor(gray)
        .lineWidth(2)
        .moveTo(350, yPos)
        .lineTo(562, yPos)
        .stroke();

      yPos += 10;

      doc
        .fillColor('black')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('TOTAL GENERAL:', 350, yPos)
        .fontSize(12)
        .text(`${currencySymbol} ${totalValue.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 460, yPos);

      // Footer - más compacto
      const footerY = pageHeight - 35;

      doc
        .fontSize(7)
        .fillColor(gray)
        .text('PARTEQUIPOS S.A.S - Sistema de Gestión de Maquinaria', 50, footerY, { align: 'center' })
        .text(`Generado el ${new Date().toLocaleString('es-CO')}`, 50, footerY + 10, { align: 'center' });

      // Finalizar documento
      doc.end();

      stream.on('finish', () => {
        const relativePath = `pdfs/${fileName}`;
        resolve(relativePath);
      });

      stream.on('error', (error) => {
        reject(error);
      });

    } catch (error) {
      reject(error);
    }
  });
}

