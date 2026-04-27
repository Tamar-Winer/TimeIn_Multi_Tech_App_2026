
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/auth';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const token = localStorage.getItem('timein_token');
    if (!token) { setLoading(false); return; }
    authApi.me().then(setUser).catch(() => localStorage.removeItem('timein_token')).finally(() => setLoading(false));
  }, []);
  const login  = useCallback(async (email, password) => {
    const { token, user } = await authApi.login(email, password);
    localStorage.setItem('timein_token', token);
    setUser(user); return user;
  }, []);
  const logout = useCallback(() => { localStorage.removeItem('timein_token'); setUser(null); }, []);
  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
