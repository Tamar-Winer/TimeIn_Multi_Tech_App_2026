
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const TimerContext = createContext(null);
const STORAGE_KEY = 'timein_timer';
const DEFAULT = { status: 'idle', elapsed: 0, startedAt: null, projectId: '', taskId: '', projectName: '', taskName: '', lastResult: null };

export function TimerProvider({ children }) {
  const [timer, setTimer] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!saved) return DEFAULT;
      if (saved.status === 'running' && saved.startedAt) {
        const extra = Math.floor((Date.now() - new Date(saved.startedAt)) / 1000);
        return { ...saved, elapsed: (saved.elapsed || 0) + extra, startedAt: new Date().toISOString() };
      }
      return saved;
    } catch { return DEFAULT; }
  });

  const tickRef = useRef(null);

  const startTick = useCallback(() => {
    clearInterval(tickRef.current);
    tickRef.current = setInterval(() =>
      setTimer(p => p.status === 'running' ? { ...p, elapsed: p.elapsed + 1 } : p), 1000);
  }, []);

  useEffect(() => {
    if (timer.status === 'running') startTick();
    return () => clearInterval(tickRef.current);
  // eslint-disable-next-line
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timer));
  }, [timer]);

  const start = useCallback((projectId = '', taskId = '', projectName = '', taskName = '') => {
    setTimer({ ...DEFAULT, status: 'running', startedAt: new Date().toISOString(), projectId, taskId, projectName, taskName });
    startTick();
  }, [startTick]);

  const pause = useCallback(() => {
    clearInterval(tickRef.current);
    setTimer(p => ({ ...p, status: 'paused', startedAt: null }));
  }, []);

  const resume = useCallback(() => {
    setTimer(p => ({ ...p, status: 'running', startedAt: new Date().toISOString() }));
    startTick();
  }, [startTick]);

  const stop = useCallback(() => {
    clearInterval(tickRef.current);
    setTimer(p => {
      const now = new Date();
      const durMin = Math.max(1, Math.round(p.elapsed / 60));
      const startDate = new Date(now.getTime() - p.elapsed * 1000);
      return {
        ...DEFAULT,
        lastResult: {
          date: now.toISOString().slice(0, 10),
          startTime: startDate.toTimeString().slice(0, 5),
          endTime: now.toTimeString().slice(0, 5),
          durationMinutes: String(durMin),
          projectId: p.projectId,
          taskId: p.taskId,
          projectName: p.projectName,
          taskName: p.taskName,
        },
      };
    });
  }, []);

  const reset = useCallback(() => {
    clearInterval(tickRef.current);
    setTimer(DEFAULT);
  }, []);

  const clearResult = useCallback(() => setTimer(p => ({ ...p, lastResult: null })), []);

  return (
    <TimerContext.Provider value={{ timer, start, pause, resume, stop, reset, clearResult }}>
      {children}
    </TimerContext.Provider>
  );
}

export const useTimer = () => useContext(TimerContext);
