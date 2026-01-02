/**
 * WebSocket Server para Notificaciones en Tiempo Real
 */

import { WebSocketServer } from 'ws';

let wss = null;
const clients = new Map(); // userId -> WebSocket connection

/**
 * Inicializar WebSocket Server
 * Nota: En Vercel serverless, el servidor no está disponible, así que esta función no se llama
 */
export function initializeWebSocket(server) {
  // Verificar que el servidor esté disponible (no disponible en Vercel serverless)
  if (!server) {
    console.log('⚠️ WebSocket no inicializado: servidor no disponible (normal en Vercel serverless)');
    return;
  }
  
  try {
    wss = new WebSocketServer({ 
      server,
      path: '/ws/notifications'
    });
  } catch (error) {
    console.warn('⚠️ No se pudo inicializar WebSocket (normal en Vercel serverless):', error.message);
    wss = null;
    return;
  }

  wss.on('connection', (ws, req) => {
    console.log('🔌 Nueva conexión WebSocket');

    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);

        if (data.type === 'auth' && data.userId) {
          // Asociar userId con esta conexión
          ws.userId = data.userId;
          ws.role = data.role;
          clients.set(data.userId, ws);
          
          console.log(`✅ Cliente autenticado: ${data.userId} (${data.role})`);
          
          ws.send(JSON.stringify({
            type: 'auth_success',
            message: 'Conectado al servidor de notificaciones en tiempo real'
          }));
        }
      } catch (error) {
        console.error('Error procesando mensaje WebSocket:', error);
      }
    });

    ws.on('close', () => {
      if (ws.userId) {
        clients.delete(ws.userId);
        console.log(`❌ Cliente desconectado: ${ws.userId}`);
      }
    });

    ws.on('error', (error) => {
      console.error('Error en WebSocket:', error);
    });
  });

  // Heartbeat: cerrar conexiones muertas
  const heartbeatInterval = setInterval(() => {
    if (wss && wss.clients) {
      wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }
  }, 30000); // cada 30 segundos

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  console.log('✅ WebSocket Server inicializado en /ws/notifications');
}

/**
 * Enviar notificación a usuario específico
 */
export function sendToUser(userId, data) {
  const client = clients.get(userId);
  if (client && client.readyState === 1) { // OPEN
    client.send(JSON.stringify(data));
    return true;
  }
  return false;
}

/**
 * Enviar notificación a múltiples usuarios
 */
export function sendToUsers(userIds, data) {
  let sent = 0;
  userIds.forEach((userId) => {
    if (sendToUser(userId, data)) {
      sent++;
    }
  });
  return sent;
}

/**
 * Broadcast a todos los clientes de un rol
 */
export function broadcastToRole(role, data) {
  // Verificar si WebSocket está disponible (no disponible en Vercel serverless)
  if (!wss || !wss.clients) {
    return 0;
  }
  
  let sent = 0;
  wss.clients.forEach((client) => {
    if (client.role === role && client.readyState === 1) {
      client.send(JSON.stringify(data));
      sent++;
    }
  });
  console.log(`📢 Broadcast a rol '${role}': ${sent} cliente(s)`);
  return sent;
}

/**
 * Broadcast a múltiples roles
 */
export function broadcastToRoles(roles, data) {
  // Verificar si WebSocket está disponible
  // En Vercel serverless, el WebSocket no está disponible, pero no debe lanzar errores
  if (!wss) {
    // WebSocket no inicializado (normal en Vercel serverless)
    // Las notificaciones se obtendrán vía polling HTTP
    return 0;
  }
  
  // Verificar que wss.clients existe y es válido antes de usarlo
  if (!wss.clients) {
    return 0;
  }
  
  // Verificar que wss.clients tiene el método forEach
  if (typeof wss.clients.forEach !== 'function') {
    return 0;
  }
  
  try {
    let sent = 0;
    wss.clients.forEach((client) => {
      // Verificar que el cliente existe y está conectado
      if (client && client.role && roles.includes(client.role) && client.readyState === 1) {
        try {
          client.send(JSON.stringify(data));
          sent++;
        } catch (sendError) {
          // Ignorar errores individuales de envío
          console.warn('⚠️ Error enviando mensaje WebSocket a cliente:', sendError.message);
        }
      }
    });
    if (sent > 0) {
      console.log(`📢 Broadcast a roles ${roles.join(', ')}: ${sent} cliente(s)`);
    }
    return sent;
  } catch (error) {
    // No lanzar error, solo registrar advertencia
    // En Vercel serverless, el WebSocket no está disponible, pero las notificaciones
    // ya están guardadas en la BD y se obtendrán vía polling HTTP
    console.warn('⚠️ Error en broadcastToRoles (normal si WebSocket no está disponible):', error.message);
    return 0;
  }
}

/**
 * Broadcast a todos los clientes conectados
 */
export function broadcastToAll(data) {
  // Verificar si WebSocket está disponible (no disponible en Vercel serverless)
  if (!wss || !wss.clients) {
    return 0;
  }
  
  let sent = 0;
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(data));
      sent++;
    }
  });
  console.log(`📢 Broadcast general: ${sent} cliente(s)`);
  return sent;
}

/**
 * Obtener estadísticas de conexiones
 */
export function getConnectionStats() {
  const stats = {
    totalConnections: wss ? wss.clients.size : 0,
    authenticatedClients: clients.size,
    byRole: {}
  };

  if (wss) {
    wss.clients.forEach((client) => {
      if (client.role) {
        stats.byRole[client.role] = (stats.byRole[client.role] || 0) + 1;
      }
    });
  }

  return stats;
}

