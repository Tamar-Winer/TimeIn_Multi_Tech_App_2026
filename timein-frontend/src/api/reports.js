
import client from './client';
export const reportsApi = {
  summary:           ()             => client.get('/reports/summary'),
  byUser:            (params={})    => client.get('/reports/by-user',              { params }),
  byUserDetail:      (id, params={})=> client.get(`/reports/by-user/${id}`,        { params }),
  byProject:         (params={})    => client.get('/reports/by-project',           { params }),
  byProjectDetail:   (id, params={})=> client.get(`/reports/by-project/${id}`,     { params }),
  byTask:            (params={})    => client.get('/reports/by-task',              { params }),
  byTaskDetail:      (id, params={})=> client.get(`/reports/by-task/${id}`,        { params }),
  anomalies:         ()             => client.get('/reports/anomalies'),
  estimateVsActual:  (params={})    => client.get('/reports/estimate-vs-actual',   { params }),
  myTaskBreakdown:   ()             => client.get('/reports/my-task-breakdown'),
};
