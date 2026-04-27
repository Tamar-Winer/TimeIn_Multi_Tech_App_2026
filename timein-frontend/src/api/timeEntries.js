
import client from './client';
export const timeEntriesApi = {
  getAll:  (params={}) => client.get('/time-entries', { params }),
  create:  (data)      => client.post('/time-entries', data),
  update:  (id,data)   => client.patch('/time-entries/' + id, data),
  submit:  (id)        => client.patch('/time-entries/' + id + '/submit'),
  approve: (id)        => client.patch('/time-entries/' + id + '/approve'),
  reject:  (id,reason) => client.patch('/time-entries/' + id + '/reject', { reason }),
  delete:  (id)        => client.delete('/time-entries/' + id),
};
