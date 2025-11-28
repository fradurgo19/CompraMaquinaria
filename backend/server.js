/**
 * Backend API - Sistema de Gestión de Maquinaria Usada
 * Desarrollo Local con PostgreSQL 17
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import { pool } from './db/connection.js';
import authRoutes from './routes/auth.js';
import preselectionsRoutes from './routes/preselections.js';
import auctionsRoutes from './routes/auctions.js';
import purchasesRoutes from './routes/purchases.js';
import newPurchasesRoutes from './routes/newPurchases.js';
import priceHistoryRoutes from './routes/priceHistory.js';
import priceSuggestionsRoutes from './routes/priceSuggestions.js';
import machinesRoutes from './routes/machines.js';
import suppliersRoutes from './routes/suppliers.js';
import managementRoutes from './routes/management.js';
import onedriveRoutes from './routes/onedrive.js';
import filesRoutes from './routes/files.js';
import movementsRoutes from './routes/movements.js';
import equipmentsRoutes from './routes/equipments.js';
import serviceRoutes from './routes/service.js';
import notificationsRoutes from './routes/notifications.js';
import changeLogsRoutes from './routes/changeLogs.js';
import notificationRulesRoutes from './routes/notificationRules.js';
import pagosRoutes from './routes/pagos.js';
import purchaseFilesRoutes from './routes/purchaseFiles.js';
import machineSpecDefaultsRoutes from './routes/machineSpecDefaults.js';
import modelSpecsRoutes from './routes/modelSpecs.js';
import { startAuctionReminderCron } from './services/auctionNotifications.js';
import { startNotificationCron } from './services/notificationTriggers.js';
import { initializeWebSocket } from './services/websocketServer.js';

// Configuración
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Servir archivos estáticos desde storage/uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'storage', 'uploads')));
// Servir archivos estáticos de compras desde storage/purchases
app.use('/purchases', express.static(path.join(process.cwd(), 'storage', 'purchases')));

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
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      database: 'Disconnected',
      error: error.message
    });
  }
});

// Routes
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
app.use('/api/movements', movementsRoutes);
app.use('/api/equipments', equipmentsRoutes);
app.use('/api/service', serviceRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/change-logs', changeLogsRoutes);
app.use('/api/notification-rules', notificationRulesRoutes);
app.use('/api/model-specs', modelSpecsRoutes);
app.use('/api/machine-spec-defaults', machineSpecDefaultsRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Start server
const server = http.createServer(app);

// Inicializar WebSocket
initializeWebSocket(server);

server.listen(PORT, () => {
  console.log('========================================');
  console.log('  Backend API - Maquinaria Usada');
  console.log('========================================');
  console.log(`✓ Servidor HTTP corriendo en http://localhost:${PORT}`);
  console.log(`✓ WebSocket disponible en ws://localhost:${PORT}/ws/notifications`);
  console.log(`✓ Frontend permitido: ${process.env.FRONTEND_URL}`);
  console.log(`✓ Base de datos: ${process.env.DB_NAME}`);
  console.log('========================================');
  
  // Iniciar cron jobs
  startAuctionReminderCron();
  startNotificationCron();
  
  console.log('Presiona Ctrl+C para detener');
  console.log('');
});

