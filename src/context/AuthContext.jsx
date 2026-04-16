import { createContext, useContext, useState, useCallback } from 'react';
import { loginDJ } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('dj_token'));

  const login = useCallback(async (username, password) => {
    const data = await loginDJ(username, password);
    localStorage.setItem('dj_token', data.token);
    setToken(data.token);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('dj_token');
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, isAuthenticated: Boolean(token), login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
