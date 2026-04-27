
import { useState, useEffect, useCallback } from 'react';
import { timeEntriesApi } from '../api/timeEntries';
import { useToast } from '../context/ToastContext';
export function useTimeEntries(filters={}) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();
  const key = JSON.stringify(filters);
  const fetch = useCallback(async () => {
    setLoading(true);
    try { const d = await timeEntriesApi.getAll(filters); setEntries(d); }
    catch (err) { addToast(err.message, 'error'); }
    finally { setLoading(false); }
  // eslint-disable-next-line
  }, [key]);
  useEffect(() => { fetch(); }, [fetch]);
  const create  = async (data)      => { const e = await timeEntriesApi.create(data);         setEntries(p => [e,...p]);                    addToast('נשמר כטיוטה');           return e; };
  const update  = async (id, data)  => { const e = await timeEntriesApi.update(id, data);     setEntries(p => p.map(x => x.id===id?e:x));  addToast(e.status==='submitted'&&entries.find(x=>x.id===id)?.status==='rejected' ? 'הדיווח תוקן ונשלח לבדיקה נוספת' : 'עודכן בהצלחה'); return e; };
  const submit  = async (id)        => { const e = await timeEntriesApi.submit(id);            setEntries(p => p.map(x => x.id===id?e:x));  addToast('הוגש לאישור');                     };
  const approve = async (id)        => { const e = await timeEntriesApi.approve(id);           setEntries(p => p.map(x => x.id===id?e:x));  addToast('אושר');                            };
  const reject  = async (id,reason) => { const e = await timeEntriesApi.reject(id, reason);   setEntries(p => p.map(x => x.id===id?e:x));  addToast('הבקשה נשלחה לערעור — העובד יקבל התראה','warning');          };
  const remove  = async (id)        => { await timeEntriesApi.delete(id);                      setEntries(p => p.filter(x => x.id!==id));   addToast('נמחק');                            };
  return { entries, loading, refetch: fetch, create, update, submit, approve, reject, remove };
}
