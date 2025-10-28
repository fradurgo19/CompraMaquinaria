/**
 * Sistema de Notificaciones Toast - Configuración
 */

import { Toaster } from 'react-hot-toast';

export const ToastContainer = () => {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: '#fff',
          color: '#374151',
          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
          borderRadius: '0.75rem',
          padding: '16px',
          fontSize: '14px',
          maxWidth: '400px',
        },
        success: {
          iconTheme: {
            primary: '#10b981',
            secondary: '#fff',
          },
          style: {
            border: '1px solid #d1fae5',
          }
        },
        error: {
          iconTheme: {
            primary: '#ef4444',
            secondary: '#fff',
          },
          style: {
            border: '1px solid #fee2e2',
          }
        },
        loading: {
          iconTheme: {
            primary: '#0ea5e9',
            secondary: '#fff',
          },
        },
      }}
    />
  );
};

// Helper functions
import toast from 'react-hot-toast';

export const showSuccess = (message: string) => {
  toast.success(message);
};

export const showError = (message: string) => {
  toast.error(message);
};

export const showLoading = (message: string) => {
  return toast.loading(message);
};

export const dismissToast = (toastId: string) => {
  toast.dismiss(toastId);
};

