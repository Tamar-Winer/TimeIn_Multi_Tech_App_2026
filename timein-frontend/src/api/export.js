
const BASE = process.env.REACT_APP_API_URL || '/api';

function downloadCSV(url, filename) {
  const token = localStorage.getItem('timein_token');
  return fetch(url, { headers: { Authorization: 'Bearer ' + token } })
    .then(res => {
      if (!res.ok) throw new Error('שגיאה בייצוא');
      return res.blob();
    })
    .then(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    });
}

function buildQuery(params) {
  const q = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => { if (v) q.set(k, v); });
  const s = q.toString();
  return s ? '?' + s : '';
}

export const exportApi = {
  timeEntries:     (params) => downloadCSV(`${BASE}/export/time-entries${buildQuery(params)}`,     'time-entries.csv'),
  reportByUser:    (params) => downloadCSV(`${BASE}/export/report-by-user${buildQuery(params)}`,   'report-by-user.csv'),
  reportByProject: (params) => downloadCSV(`${BASE}/export/report-by-project${buildQuery(params)}`, 'report-by-project.csv'),
  payroll:         (params) => downloadCSV(`${BASE}/payroll/export${buildQuery(params)}`,           'payroll.csv'),
};
