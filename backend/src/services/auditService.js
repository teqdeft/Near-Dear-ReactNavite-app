const db = require('../db/knex');

/**
 * Records an admin action in audit_logs (Developer Note: keep admin actions logged).
 */
async function logAction(adminUserId, { action, entityType = null, entityId = null, oldValue = null, newValue = null, ip = null }) {
  await db('audit_logs').insert({
    admin_user_id: adminUserId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    old_value: oldValue ? JSON.stringify(oldValue) : null,
    new_value: newValue ? JSON.stringify(newValue) : null,
    ip_address: ip,
  });
}

module.exports = { logAction };
