/**
 * Test AuthProvider — wraps children with a mock auth context for component tests.
 *
 * Usage:
 *   <AuthProvider initialUser={null}>
 *     <ComponentUnderTest />
 *   </AuthProvider>
 */
import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children, initialUser = null }) {
  const [user, setUser] = useState(initialUser);

  const login = async (email, password) => {
    setUser({ id: 'test-1', name: 'Test', email, isAdmin: false });
  };

  const logout = () => setUser(null);

  const register = async (payload) => {
    setUser({ id: 'test-2', name: payload.name, email: payload.email, isAdmin: false });
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, register, loading: false }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
