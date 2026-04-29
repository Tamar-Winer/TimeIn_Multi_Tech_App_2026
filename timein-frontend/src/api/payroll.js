
import client from './client';
export const payrollApi = {
  summary:    (params={}) => client.get('/payroll/summary', { params }),
  updateRate: (userId, hourlyRate) => client.patch(`/payroll/rate/${userId}`, { hourlyRate }),
};
