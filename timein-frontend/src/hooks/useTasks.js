
import { useState, useEffect, useCallback } from 'react';
import { tasksApi } from '../api/tasks';
export function useTasks(filters={}) {
  const [tasks,   setTasks]   = useState([]);
  const [loading, setLoading] = useState(false);
  const key = JSON.stringify(filters);
  const fetch = useCallback(() => {
    setLoading(true);
    tasksApi.getAll(filters).then(setTasks).finally(() => setLoading(false));
  // eslint-disable-next-line
  }, [key]);
  useEffect(() => { fetch(); }, [fetch]);
  const create = async (data)    => { const t = await tasksApi.create(data);    setTasks(p => [t,...p]);                  return t; };
  const update = async (id,data) => { const t = await tasksApi.update(id,data); setTasks(p => p.map(x => x.id===id?t:x)); return t; };
  return { tasks, loading, refetch: fetch, create, update };
}
