import { createContext, useContext, useState, useEffect } from 'react';
import { login as loginApi, register as registerApi } from '../api/auth';
import { useIdleTimer } from '../hooks/useIdleTimer';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('student');
    if (stored) {
      setUser(JSON.parse(stored));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const { data } = await loginApi({ email, password });
    const { token, refreshToken, student } = data.data;
    localStorage.setItem('token', token);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('student', JSON.stringify(student));
    setUser(student);
    return { token, refreshToken, student };
  };

  const register = async (payload) => {
    const { data } = await registerApi(payload);
    const { token, refreshToken, student } = data.data;
    localStorage.setItem('token', token);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('student', JSON.stringify(student));
    setUser(student);
    return { token, refreshToken, student };
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('student');
    setUser(null);
  };

  useIdleTimer({
    timeout: import.meta.env.VITE_IDLE_TIMEOUT
      ? parseInt(import.meta.env.VITE_IDLE_TIMEOUT, 10)
      : 30 * 60 * 1000,
    onIdle: logout,
    enabled: !!user,
  });

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
