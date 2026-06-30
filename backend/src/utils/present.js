/** Shapers that strip sensitive fields before sending entities to clients. */

function presentUser(user) {
  if (!user) return null;
  const {
    password_hash, // eslint-disable-line no-unused-vars
    aadhaar_reference_id, // eslint-disable-line no-unused-vars
    ...safe
  } = user;
  return safe;
}

module.exports = { presentUser };
