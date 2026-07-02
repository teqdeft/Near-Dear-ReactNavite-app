import client from './client';

const data = (p) => p.then((r) => r.data?.data);
const full = (p) => p.then((r) => r.data);

export const AuthApi = {
  login: (mobile, password) => data(client.post('/auth/admin-login', { mobile, password })),
  registerPharmacy: (payload) => data(client.post('/auth/register-pharmacy', payload)),
  me: () => data(client.get('/auth/me')),
};

export const PharmacyApi = {
  me: () => data(client.get('/pharmacy/me')),
  register: (payload) => data(client.post('/pharmacy/register', payload)),
  uploadDocument: (formData) =>
    data(client.post('/pharmacy/documents', formData, { headers: { 'Content-Type': 'multipart/form-data' } })),
  dashboard: () => data(client.get('/pharmacy/dashboard')),
  medicines: () => data(client.get('/pharmacy/medicines')),
  addMedicine: (payload) => data(client.post('/pharmacy/medicines', payload)),
  updateMedicine: (id, payload) => data(client.put(`/pharmacy/medicines/${id}`, payload)),
  addCategory: (name) => data(client.post('/pharmacy/categories', { name })),
  orders: (status) => data(client.get('/pharmacy/orders', { params: status ? { status } : {} })),
  orderDetail: (id) => data(client.get(`/pharmacy/orders/${id}`)),
  updateOrderStatus: (id, status, reason) => data(client.put(`/pharmacy/orders/${id}/status`, { status, reason })),
  reviewPrescription: (id, status, reason) => data(client.put(`/pharmacy/prescriptions/${id}/review`, { status, reason })),
};

export const CatalogApi = {
  categories: () => data(client.get('/catalog/categories')),
};

export const AdminApi = {
  dashboard: () => data(client.get('/admin/dashboard')),
  users: (params) => data(client.get('/admin/users', { params })),
  setUserStatus: (id, status) => data(client.put(`/admin/users/${id}/status`, { status })),
  pharmacies: (status) => data(client.get('/admin/pharmacies', { params: status ? { status } : {} })),
  pharmacyDetail: (id) => data(client.get(`/admin/pharmacies/${id}`)),
  reviewPharmacy: (id, status, reason) => data(client.put(`/admin/pharmacies/${id}/review`, { status, reason })),
  bloodRequests: (status) => data(client.get('/admin/blood-requests', { params: status ? { status } : {} })),
  ambulanceRequests: (status) => data(client.get('/admin/ambulance-requests', { params: status ? { status } : {} })),
  assignAmbulance: (id, payload) => data(client.put(`/admin/ambulance-requests/${id}/assign`, payload)),
  ambulances: () => data(client.get('/admin/ambulances')),
  addAmbulance: (payload) => data(client.post('/admin/ambulances', payload)),
  providers: () => data(client.get('/admin/ambulances')), // providers shown via ambulances join
  addProvider: (payload) => data(client.post('/admin/ambulance-providers', payload)),
  drivers: () => data(client.get('/admin/drivers')),
  addDriver: (payload) => data(client.post('/admin/drivers', payload)),
  categories: () => data(client.get('/catalog/categories')),
  addCategory: (payload) => data(client.post('/admin/categories', payload)),
  orders: (params) => data(client.get('/admin/orders', { params })),
  tickets: (status) => data(client.get('/admin/tickets', { params: status ? { status } : {} })),
  updateTicket: (id, status) => data(client.put(`/admin/tickets/${id}`, { status })),
  auditLogs: () => data(client.get('/admin/audit-logs')),
};

export { full };
