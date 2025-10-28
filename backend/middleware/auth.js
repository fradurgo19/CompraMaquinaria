/**
 * Middleware de Autenticación
 */

import jwt from 'jsonwebtoken';
import { getUserRole } from '../db/connection.js';

// Verificar token JWT
export function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

// Verificar roles específicos
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'No tienes permisos para realizar esta acción'
      });
    }

    next();
  };
}

// Middleware específicos por rol
export const requireSebastian = requireRole('sebastian', 'admin');
export const requireEliana = requireRole('eliana', 'admin');
export const requireGerencia = requireRole('gerencia', 'admin');
export const requireAdmin = requireRole('admin');

// Puede ver subastas: sebastian, gerencia, admin
export const canViewAuctions = requireRole('sebastian', 'gerencia', 'admin');

// Puede ver compras: eliana, gerencia, admin, importaciones, logistica
export const canViewPurchases = requireRole('eliana', 'gerencia', 'admin', 'importaciones', 'logistica');

// Puede ver consolidado: gerencia, admin
export const canViewManagement = requireRole('gerencia', 'admin');

// Puede editar fechas de embarque: eliana, gerencia, admin, importaciones
export const canEditShipmentDates = requireRole('eliana', 'gerencia', 'admin', 'importaciones');

