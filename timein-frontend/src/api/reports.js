
import client from './client';
export const reportsApi = {
  summary:   ()          => client.get('/reports/summary'),
  byUser:    (params={}) => client.get('/reports/by-user',    { params }),
  byProject: (params={}) => client.get('/reports/by-project', { params }),
  byTask:    (params={}) => client.get('/reports/by-task',    { params }),
  anomalies: ()          => client.get('/reports/anomalies'),
};
