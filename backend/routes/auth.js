/**
 * Rutas de Autenticación
 */

import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db/connection.js';

const router = express.Router();

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('🔐 Intento de login:', email);

    // Verificar usuario y contraseña directamente en PostgreSQL
    const userResult = await pool.query(
      `SELECT id, email 
       FROM auth.users 
       WHERE email = $1 
       AND encrypted_password = crypt($2, encrypted_password)`,
      [email, password]
    );

    console.log('👤 Usuario encontrado:', userResult.rows.length > 0);

    if (userResult.rows.length === 0) {
      console.log('❌ Credenciales inválidas');
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = userResult.rows[0];

    // Obtener perfil del usuario
    const profileResult = await pool.query(
      'SELECT id, full_name, email, role FROM users_profile WHERE id = $1',
      [user.id]
    );

    console.log('📋 Perfil encontrado:', profileResult.rows.length > 0);

    if (profileResult.rows.length === 0) {
      console.log('❌ Perfil no encontrado');
      return res.status(401).json({ error: 'Perfil de usuario no encontrado' });
    }

    const profile = profileResult.rows[0];

    // Generar token JWT
    const token = jwt.sign(
      {
        userId: profile.id,
        email: profile.email,
        role: profile.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('✅ Login exitoso:', profile.full_name, '(' + profile.role + ')');

    res.json({
      token,
      user: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role
      }
    });

  } catch (error) {
    console.error('❌ Error en login:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// Verificar token
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const profileResult = await pool.query(
      'SELECT id, full_name, email, role FROM users_profile WHERE id = $1',
      [decoded.userId]
    );

    if (profileResult.rows.length === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    res.json({ user: profileResult.rows[0] });

  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
});

export default router;

