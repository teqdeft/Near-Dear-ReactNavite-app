// Production-ready, human labels for the raw status enums used across the app,
// so screens never show a raw value like "out_for_delivery". Anything not listed
// falls back to a Title-cased version of the raw value.
const STATUS_LABELS = {
  // approval / documents
  pending: 'Pending review',
  under_review: 'Under review',
  approved: 'Approved',
  rejected: 'Rejected',
  suspended: 'Suspended',
  verified: 'Verified',
  uploaded: 'Uploaded',
  // medicine orders
  placed: 'Order placed',
  accepted: 'Accepted',
  preparing: 'Preparing',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  failed: 'Failed',
  paid: 'Paid',
  // ambulance
  requested: 'Requested',
  assigned: 'Assigned',
  on_the_way: 'On the way',
  picked_up: 'Picked up',
  completed: 'Completed',
  // blood
  open: 'Open',
  matched: 'Matched',
  fulfilled: 'Fulfilled',
  expired: 'Expired',
  // stock / support
  in_stock: 'In stock',
  out_of_stock: 'Out of stock',
  resolved: 'Resolved',
  in_progress: 'In progress',
};

export function statusLabel(value) {
  if (!value) return '';
  return STATUS_LABELS[value]
    || String(value).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Short, professional one-line descriptions for approval statuses — used on the
// "your documents are being reviewed" screens.
export const APPROVAL_MESSAGE = {
  pending: 'Your documents have been submitted and are under review by our team. You’ll be notified once they’re approved — this usually takes 24–48 hours.',
  approved: 'Your documents have been verified and approved. You’re all set.',
  rejected: 'Some of your documents couldn’t be verified. Please review the reason below, re-upload, and submit again.',
  suspended: 'Your account has been temporarily suspended. Please contact support for assistance.',
};
