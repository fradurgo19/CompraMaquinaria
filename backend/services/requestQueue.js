/**
 * Sistema de cola para limitar la concurrencia de peticiones
 * Evita saturar el pool de conexiones con demasiadas peticiones simultáneas
 */

class RequestQueue {
  constructor(maxConcurrent = 2) {
    this.maxConcurrent = maxConcurrent;
    this.running = 0;
    this.queue = [];
  }

  /**
   * Agregar una petición a la cola
   * @param {Function} fn - Función async a ejecutar
   * @returns {Promise} - Promise que se resuelve cuando la petición se ejecuta
   */
  async add(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        fn,
        resolve,
        reject
      });
      this.process();
    });
  }

  /**
   * Procesar la siguiente petición en la cola
   */
  async process() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    this.running++;
    const { fn, resolve, reject } = this.queue.shift();

    try {
      const result = await fn();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.running--;
      // Procesar siguiente petición
      setImmediate(() => this.process());
    }
  }

  /**
   * Obtener estadísticas de la cola
   */
  getStats() {
    return {
      running: this.running,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent
    };
  }
}

// Cola global para auto-costs/apply (máximo 2 concurrentes)
export const autoCostsQueue = new RequestQueue(2);

// Cola global para otras operaciones pesadas (máximo 3 concurrentes)
export const heavyOperationsQueue = new RequestQueue(3);
