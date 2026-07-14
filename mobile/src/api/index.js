import client from './client';

// Unwrap the standard { success, message, data } envelope.
const data = (p) => p.then((r) => r.data?.data);
const full = (p) => p.then((r) => r.data);

export const AuthApi = {
  // Accepts a mobile string (legacy) or a { mobile, email, channel } payload.
  requestOtp: (payload) => full(client.post('/auth/request-otp', typeof payload === 'string' ? { mobile: payload } : payload)),
  register: (payload) => data(client.post('/auth/register', payload)),
  login: (email, password) => data(client.post('/auth/login', { email, password })),
  verifyOtp: (mobile, code) => data(client.post('/auth/verify-otp', { mobile, code })),
  passwordLogin: (mobile, password) => data(client.post('/auth/admin-login', { mobile, password })),
  forgotPasswordRequestOtp: (payload) => full(client.post('/auth/forgot-password/request-otp', payload)),
  forgotPasswordReset: (payload) => data(client.post('/auth/forgot-password/reset', payload)),
  changePassword: (payload) => data(client.post('/auth/change-password', payload)),
  me: () => data(client.get('/auth/me')),
  aadhaarGenerateOtp: (aadhaarNumber) => data(client.post('/auth/aadhaar/generate-otp', { aadhaarNumber })),
  aadhaarVerify: (otp) => data(client.post('/auth/aadhaar/verify', { otp })),
  // Manual KYC: upload front + back Aadhaar photos for admin review.
  aadhaarManualSubmit: (formData) =>
    data(client.post('/auth/aadhaar/manual', formData, { headers: { 'Content-Type': 'multipart/form-data' } })),
  aadhaarManualStatus: () => data(client.get('/auth/aadhaar/manual/status')),
};

export const ProfileApi = {
  update: (payload) => data(client.put('/profile', payload)),
  uploadAvatar: (formData) =>
    data(client.post('/profile/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } })),
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
  openRequests: () => data(client.get('/blood/requests/open')),
  respondToMatch: (matchId, action) => data(client.post(`/blood/matches/${matchId}/respond`, { action })),
  respondToRequest: (requestId, action) => data(client.post(`/blood/requests/${requestId}/respond`, { action })),
  createRequest: (payload) => data(client.post('/blood/requests', payload)),
  myRequests: () => data(client.get('/blood/requests/mine')),
  requestDetail: (id) => data(client.get(`/blood/requests/${id}`)),
  cancelRequest: (id, reason) => full(client.post(`/blood/requests/${id}/cancel`, { reason })),
  fulfillRequest: (id) => full(client.post(`/blood/requests/${id}/fulfill`)),
};

export const AmbulanceApi = {
  // full(), not data(): the caller shows the server's own message, which tells
  // the user whether any driver was actually reachable. data() would drop it.
  createRequest: (payload) => full(client.post('/ambulance/requests', payload)),
  myRequests: () => data(client.get('/ambulance/requests/mine')),
  requestDetail: (id) => data(client.get(`/ambulance/requests/${id}`)),
  cancelRequest: (id) => full(client.post(`/ambulance/requests/${id}/cancel`)),
  // Driver
  driverRequests: () => data(client.get('/ambulance/driver/requests')),
  driverAvailable: () => data(client.get('/ambulance/driver/available')),
  accept: (id) => data(client.post(`/ambulance/requests/${id}/accept`)),
  release: (id) => data(client.post(`/ambulance/requests/${id}/release`)),
  updateStatus: (id, status) => data(client.put(`/ambulance/requests/${id}/status`, { status })),
  // On duty: the driver shares their location so requests near them (even in a
  // town they never listed) can reach them.
  duty: () => data(client.get('/ambulance/driver/duty')),
  setDuty: (onDuty) => data(client.put('/ambulance/driver/duty', { on_duty: onDuty })),
  ping: (coord) => data(client.post('/ambulance/driver/ping', coord)),
  // Live tracking
  track: (id) => data(client.get(`/ambulance/requests/${id}/track`)),
  updateLocation: (payload) => full(client.post('/ambulance/driver/location', payload)),
  // Driver's own vehicle registration + documents (admin-approved)
  myVehicle: () => data(client.get('/ambulance/driver/vehicle')),
  registerVehicle: (payload) => data(client.post('/ambulance/driver/vehicle', payload)),
  uploadVehicleDocument: (formData) =>
    data(client.post('/ambulance/driver/vehicle/documents', formData, { headers: { 'Content-Type': 'multipart/form-data' } })),
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
  unreadCount: () => data(client.get('/notifications/unread-count')),
  markRead: (id) => full(client.put(`/notifications/${id}/read`)),
  markAllRead: () => full(client.put('/notifications/read-all')),
  // The FCM address of this device, so the backend has somewhere to push to.
  registerDevice: (token, platform) => full(client.post('/notifications/device-token', { token, platform })),
  unregisterDevice: (token) => full(client.delete('/notifications/device-token', { data: { token } })),
};

export const SupportApi = {
  create: (payload) => data(client.post('/support/tickets', payload)),
  mine: () => data(client.get('/support/tickets')),
};

export default {
  AuthApi, ProfileApi, BloodApi, AmbulanceApi, CatalogApi, OrderApi, NotificationApi, SupportApi,
};
