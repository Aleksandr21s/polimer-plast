import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setToken, loadToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await loadToken();
      if (token) {
        try {
          const { user } = await api.get('/auth/me');
          setUser(user);
        } catch {
          await setToken(null);
        }
      }
      setBooting(false);
    })();
  }, []);

  const login = useCallback(async (email, password) => {
    const { token, user } = await api.post('/auth/login', { email, password });
    await setToken(token);
    setUser(user);
    return user;
  }, []);

  const register = useCallback(async (payload) => {
    const { token, user } = await api.post('/auth/register', payload);
    await setToken(token);
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    await setToken(null);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const { user } = await api.get('/auth/me');
      setUser(user);
    } catch {}
  }, []);

  const isManager = user?.role === 'MANAGER';

  return (
    <AuthContext.Provider value={{ user, booting, login, register, logout, refresh, isManager }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
