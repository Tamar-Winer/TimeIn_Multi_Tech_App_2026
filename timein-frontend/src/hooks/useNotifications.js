
import { useState, useEffect, useCallback } from 'react';
import { notificationsApi } from '../api/notifications';

export function useNotifications() {
  const [notifications, setNotifications] = useState([]);

  const load = useCallback(async () => {
    try { setNotifications(await notificationsApi.getAll()); } catch {}
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const markRead = async (id) => {
    await notificationsApi.markRead(id).catch(() => {});
    setNotifications(p => p.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    await notificationsApi.markAllRead().catch(() => {});
    setNotifications(p => p.map(n => ({ ...n, is_read: true })));
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return { notifications, unreadCount, markRead, markAllRead, reload: load };
}
