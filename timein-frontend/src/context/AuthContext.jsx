
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/auth';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('timein_token');
    if (!token) { setLoading(false); return; }
    authApi.me()
      .then(setUser)
      .catch(() => localStorage.removeItem('timein_token'))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password, googleCredential) => {
    let data;
    if (googleCredential) {
      data = await client.post('/auth/google', { credential: googleCredential });
    } else {
      data = await authApi.login(email, password);
    }
    localStorage.setItem('timein_token', data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (fullName, email, password) => {
    await authApi.register({ fullName, email, password });
    // כניסה אוטומטית לאחר הרשמה
    const data = await authApi.login(email, password);
    localStorage.setItem('timein_token', data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('timein_token');
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
