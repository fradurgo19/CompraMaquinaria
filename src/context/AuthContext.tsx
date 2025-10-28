import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { UserProfile } from '../types/database';

// URL del backend local
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar si hay un token guardado
    const token = localStorage.getItem('token');
    if (token) {
      loadUserFromToken(token);
    } else {
      setLoading(false);
    }
  }, []);

  const loadUserFromToken = async (token: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Token inválido');
      }

      const { user } = await response.json();
      setUser(user);
      setUserProfile(user as UserProfile);
    } catch (error) {
      console.error('Error loading user:', error);
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al iniciar sesión');
      }

      const { token, user } = await response.json();
      
      // Guardar token
      localStorage.setItem('token', token);
      
      // Actualizar estado
      setUser(user);
      setUserProfile(user as UserProfile);
    } catch (error) {
      console.error('Error en login:', error);
      throw error;
    }
  };

  const signOut = async () => {
    localStorage.removeItem('token');
    setUser(null);
    setUserProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
