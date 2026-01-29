/**
 * Serverless Function para Vercel
 * Wrapper Express que maneja todas las rutas del backend
 * 
 * IMPORTANTE: Este archivo debe estar en api/index.js
 * Vercel Free solo permite 9 funciones, por eso usamos 1 sola función
 * 
 * NOTA: WebSocket y Cron Jobs no funcionan en serverless
 * - WebSocket: Se debe externalizar a un servicio separado o usar polling
 * - Cron Jobs: Se deben migrar a Vercel Cron Jobs o servicios externos
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool } from '../backend/db/connection.js';

// Importar todas las rutas
import authRoutes from '../backend/routes/auth.js';
import preselectionsRoutes from '../backend/routes/preselections.js';
import auctionsRoutes from '../backend/routes/auctions.js';
import purchasesRoutes from '../backend/routes/purchases.js';
import newPurchasesRoutes from '../backend/routes/newPurchases.js';
import priceHistoryRoutes from '../backend/routes/priceHistory.js';
import priceSuggestionsRoutes from '../backend/routes/priceSuggestions.js';
import machinesRoutes from '../backend/routes/machines.js';
import suppliersRoutes from '../backend/routes/suppliers.js';
import managementRoutes from '../backend/routes/management.js';
import onedriveRoutes from '../backend/routes/onedrive.js';
import filesRoutes from '../backend/routes/files.js';
import purchaseFilesRoutes from '../backend/routes/purchaseFiles.js';
import uploadRoutes from '../backend/routes/upload.js';
import movementsRoutes from '../backend/routes/movements.js';
import equipmentsRoutes from '../backend/routes/equipments.js';
import serviceRoutes from '../backend/routes/service.js';
import notificationsRoutes from '../backend/routes/notifications.js';
import changeLogsRoutes from '../backend/routes/changeLogs.js';
import notificationRulesRoutes from '../backend/routes/notificationRules.js';
import pagosRoutes from '../backend/routes/pagos.js';
import machineSpecDefaultsRoutes from '../backend/routes/machineSpecDefaults.js';
import modelSpecsRoutes from '../backend/routes/modelSpecs.js';
import adminRoutes from '../backend/routes/admin.js';
import brandsAndModelsRoutes from '../backend/routes/brandsAndModels.js';
import autoCostsRoutes from '../backend/routes/autoCosts.js';

// Configuración
dotenv.config();

const app = express();

// Deshabilitar header X-Powered-By para no revelar tecnología (S5689)
app.disable('x-powered-by');

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || '*',
  credentials: true
}));

app.use(express.json({ limit: '50mb' })); // Aumentar límite para archivos grandes
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT NOW()');
    res.json({
      status: 'OK',
      database: 'Connected',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'production',
      platform: 'Vercel Serverless'
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      database: 'Disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Routes - Todas las rutas del backend
app.use('/api/auth', authRoutes);
app.use('/api/preselections', preselectionsRoutes);
app.use('/api/auctions', auctionsRoutes);
app.use('/api/purchases', purchasesRoutes);
app.use('/api/new-purchases', newPurchasesRoutes);
app.use('/api/pagos', pagosRoutes);
app.use('/api/price-history', priceHistoryRoutes);
app.use('/api/price-suggestions', priceSuggestionsRoutes);
app.use('/api/machines', machinesRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/management', managementRoutes);
app.use('/api/onedrive', onedriveRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/purchase-files', purchaseFilesRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/movements', movementsRoutes);
app.use('/api/equipments', equipmentsRoutes);
app.use('/api/service', serviceRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/change-logs', changeLogsRoutes);
app.use('/api/notification-rules', notificationRulesRoutes);
app.use('/api/machine-spec-defaults', machineSpecDefaultsRoutes);
app.use('/api/model-specs', modelSpecsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/brands-and-models', brandsAndModelsRoutes);
app.use('/api/auto-costs', autoCostsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    path: req.path,
    method: req.method
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Error interno',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Exportar como serverless function para Vercel
export default app;

