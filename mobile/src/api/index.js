import client from './client';

// Unwrap the standard { success, message, data } envelope.
const data = (p) => p.then((r) => r.data?.data);
const full = (p) => p.then((r) => r.data);

export const AuthApi = {
  requestOtp: (mobile) => full(client.post('/auth/request-otp', { mobile })),
  register: (payload) => data(client.post('/auth/register', payload)),
  login: (email, password) => data(client.post('/auth/login', { email, password })),
  verifyOtp: (mobile, code) => data(client.post('/auth/verify-otp', { mobile, code })),
  passwordLogin: (mobile, password) => data(client.post('/auth/admin-login', { mobile, password })),
  me: () => data(client.get('/auth/me')),
  aadhaarGenerateOtp: (aadhaarNumber) => data(client.post('/auth/aadhaar/generate-otp', { aadhaarNumber })),
  aadhaarVerify: (otp) => data(client.post('/auth/aadhaar/verify', { otp })),
};

export const ProfileApi = {
  update: (payload) => data(client.put('/profile', payload)),
  addresses: () => data(client.get('/profile/addresses')),
  addAddress: (payload) => data(client.post('/profile/addresses', payload)),
  deleteAddress: (id) => full(client.delete(`/profile/addresses/${id}`)),
  requestDeletion: (reason) => full(client.post('/profile/delete-request', { reason })),
};

export const BloodApi = {
  becomeDonor: (payload) => data(client.post('/blood/donor', payload)),
  myDonor: () => data(client.get('/blood/donor/me')),
  setAvailability: (is_available) => data(client.put('/blood/donor/availability', { is_available })),
  incomingRequests: () => data(client.get('/blood/donor/requests')),
  respondToMatch: (matchId, action) => data(client.post(`/blood/matches/${matchId}/respond`, { action })),
  createRequest: (payload) => data(client.post('/blood/requests', payload)),
  myRequests: () => data(client.get('/blood/requests/mine')),
  requestDetail: (id) => data(client.get(`/blood/requests/${id}`)),
  cancelRequest: (id, reason) => full(client.post(`/blood/requests/${id}/cancel`, { reason })),
  fulfillRequest: (id) => full(client.post(`/blood/requests/${id}/fulfill`)),
};

export const AmbulanceApi = {
  createRequest: (payload) => data(client.post('/ambulance/requests', payload)),
  myRequests: () => data(client.get('/ambulance/requests/mine')),
  requestDetail: (id) => data(client.get(`/ambulance/requests/${id}`)),
  cancelRequest: (id) => full(client.post(`/ambulance/requests/${id}/cancel`)),
  // Driver
  driverRequests: () => data(client.get('/ambulance/driver/requests')),
  driverAvailable: () => data(client.get('/ambulance/driver/available')),
  accept: (id) => data(client.post(`/ambulance/requests/${id}/accept`)),
  updateStatus: (id, status) => data(client.put(`/ambulance/requests/${id}/status`, { status })),
};

export const CatalogApi = {
  categories: () => data(client.get('/catalog/categories')),
  medicines: (params) => data(client.get('/catalog/medicines', { params })),
  medicineDetail: (id) => data(client.get(`/catalog/medicines/${id}`)),
};

export const OrderApi = {
  uploadPrescription: (formData) =>
    data(client.post('/orders/prescriptions', formData, { headers: { 'Content-Type': 'multipart/form-data' } })),
  myPrescriptions: () => data(client.get('/orders/prescriptions')),
  place: (payload) => data(client.post('/orders', payload)),
  myOrders: () => data(client.get('/orders')),
  orderDetail: (id) => data(client.get(`/orders/${id}`)),
  cancel: (id, reason) => full(client.post(`/orders/${id}/cancel`, { reason })),
};

export const NotificationApi = {
  list: () => data(client.get('/notifications')),
  markRead: (id) => full(client.put(`/notifications/${id}/read`)),
  markAllRead: () => full(client.put('/notifications/read-all')),
};

export const SupportApi = {
  create: (payload) => data(client.post('/support/tickets', payload)),
  mine: () => data(client.get('/support/tickets')),
};

export default {
  AuthApi, ProfileApi, BloodApi, AmbulanceApi, CatalogApi, OrderApi, NotificationApi, SupportApi,
};
