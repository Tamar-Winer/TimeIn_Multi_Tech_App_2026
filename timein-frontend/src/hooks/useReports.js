
import { useState, useCallback } from 'react';
import { reportsApi } from '../api/reports';
export function useReports() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const fetch = useCallback(async (type, params={}) => {
    setLoading(true); setError(null); setData(null);
    try { const r = await reportsApi[type](params); setData(r); return r; }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);
  return { data, loading, error, fetch };
}
