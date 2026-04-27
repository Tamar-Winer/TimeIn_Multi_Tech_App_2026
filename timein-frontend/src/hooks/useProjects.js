
import { useState, useEffect } from 'react';
import { projectsApi } from '../api/projects';
export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [loading,  setLoading]  = useState(false);
  useEffect(() => {
    setLoading(true);
    projectsApi.getAll().then(setProjects).finally(() => setLoading(false));
  }, []);
  const create = async (data)    => { const p = await projectsApi.create(data);    setProjects(prev => [...prev, p]);                   return p; };
  const update = async (id,data) => { const p = await projectsApi.update(id,data); setProjects(prev => prev.map(x => x.id===id?p:x));  return p; };
  return { projects, loading, create, update };
}
