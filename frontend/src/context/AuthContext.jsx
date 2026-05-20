import { createContext, useContext, useState, useEffect } from 'react';
import { login as loginApi, register as registerApi } from '../api/auth';

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
    const { token, student } = data.data;
    localStorage.setItem('token', token);
    localStorage.setItem('student', JSON.stringify(student));
    setUser(student);
    return { token, student };
  };

  const register = async (payload) => {
    const { data } = await registerApi(payload);
    const { token, student } = data.data;
    localStorage.setItem('token', token);
    localStorage.setItem('student', JSON.stringify(student));
    setUser(student);
    return { token, student };
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('student');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
