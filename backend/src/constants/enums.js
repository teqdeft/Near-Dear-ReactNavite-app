/**
 * Central enums/constants. Mobile app, backend, pharmacy panel and admin panel
 * should all use the SAME status strings (Developer Note in the blueprint).
 */

const ROLES = {
  USER: 'user',
  DONOR: 'donor',
  PHARMACY_OWNER: 'pharmacy_owner',
  PHARMACY_STAFF: 'pharmacy_staff',
  AMBULANCE_DRIVER: 'ambulance_driver',
  ADMIN: 'admin',
};

const USER_STATUS = { ACTIVE: 'active', BLOCKED: 'blocked', DELETED: 'deleted' };

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const DONOR_STATUS = { ACTIVE: 'active', PAUSED: 'paused', BLOCKED: 'blocked' };

const URGENCY = { NORMAL: 'normal', URGENT: 'urgent', CRITICAL: 'critical' };

const BLOOD_REQUEST_STATUS = {
  OPEN: 'open',
  MATCHED: 'matched',
  FULFILLED: 'fulfilled',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
};

const MATCH_RESPONSE = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  NO_RESPONSE: 'no_response',
};

const PHARMACY_APPROVAL = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended',
};

const DOC_TYPE = {
  LICENSE: 'license',
  OWNER_ID: 'owner_id',
  GST: 'gst',
  STORE_PHOTO: 'store_photo',
  OTHER: 'other',
};

const DOC_STATUS = { PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected' };

// Approval state of a driver's self-registered ambulance (vehicle).
const AMBULANCE_APPROVAL = { PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected' };

// Documents an ambulance driver uploads for their vehicle.
const AMBULANCE_DOC_TYPE = {
  RC: 'rc',
  DRIVING_LICENSE: 'driving_license',
  PERMIT: 'permit',
  INSURANCE: 'insurance',
  VEHICLE_PHOTO: 'vehicle_photo',
  OTHER: 'other',
};

const MEDICINE_FORM = {
  TABLET: 'tablet',
  SYRUP: 'syrup',
  INJECTION: 'injection',
  CAPSULE: 'capsule',
  DROPS: 'drops',
  CREAM: 'cream',
  OTHER: 'other',
};

const STOCK_STATUS = { IN_STOCK: 'in_stock', OUT_OF_STOCK: 'out_of_stock' };

const ACTIVE_STATUS = { ACTIVE: 'active', INACTIVE: 'inactive' };

const PRESCRIPTION_STATUS = {
  UPLOADED: 'uploaded',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

const PAYMENT_METHOD = { COD: 'cod', UPI_MANUAL: 'upi_manual', ONLINE: 'online' };

const PAYMENT_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded',
};

const ORDER_STATUS = {
  PLACED: 'placed',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  PREPARING: 'preparing',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};

const AMBULANCE_TYPE = { BASIC: 'basic', OXYGEN: 'oxygen', ICU: 'icu', OTHER: 'other', ANY: 'any' };

const AMBULANCE_STATUS = {
  REQUESTED: 'requested',
  ASSIGNED: 'assigned',
  ACCEPTED: 'accepted',
  ON_THE_WAY: 'on_the_way',
  PICKED_UP: 'picked_up',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

const NOTIFICATION_TYPE = {
  BLOOD: 'blood',
  // Requester-facing: a donor accepted the user's OWN blood request. Kept
  // separate from BLOOD (which is donor-facing) so the app can route the
  // requester to their request detail instead of the "requests for me" list.
  BLOOD_ACCEPTED: 'blood_accepted',
  MEDICINE_ORDER: 'medicine_order',
  AMBULANCE: 'ambulance',
  ADMIN: 'admin',
  SUPPORT: 'support',
};

const SUPPORT_RELATED = {
  BLOOD_REQUEST: 'blood_request',
  MEDICINE_ORDER: 'medicine_order',
  AMBULANCE: 'ambulance',
  PHARMACY: 'pharmacy',
  GENERAL: 'general',
};

const SUPPORT_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
};

const ADDRESS_TYPE = { HOME: 'home', WORK: 'work', HOSPITAL: 'hospital', OTHER: 'other' };

const AADHAAR_KYC_STATUS = {
  NONE: 'none',
  PENDING: 'pending',
  VERIFIED: 'verified',
  FAILED: 'failed',
};

const vals = (o) => Object.values(o);

module.exports = {
  ROLES,
  USER_STATUS,
  BLOOD_GROUPS,
  DONOR_STATUS,
  URGENCY,
  BLOOD_REQUEST_STATUS,
  MATCH_RESPONSE,
  PHARMACY_APPROVAL,
  DOC_TYPE,
  DOC_STATUS,
  AMBULANCE_APPROVAL,
  AMBULANCE_DOC_TYPE,
  MEDICINE_FORM,
  STOCK_STATUS,
  ACTIVE_STATUS,
  PRESCRIPTION_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  ORDER_STATUS,
  AMBULANCE_TYPE,
  AMBULANCE_STATUS,
  NOTIFICATION_TYPE,
  SUPPORT_RELATED,
  SUPPORT_STATUS,
  ADDRESS_TYPE,
  AADHAAR_KYC_STATUS,
  vals,
};
