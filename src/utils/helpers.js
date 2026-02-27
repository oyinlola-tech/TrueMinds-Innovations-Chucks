function createId(prefix) {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${random}`;
}

function nowIso() {
  return new Date().toISOString();
}

function isExpired(isoDateString) {
  return new Date(isoDateString).getTime() < Date.now();
}

function sanitizeContact(value) {
  return String(value || "").trim().toLowerCase();
}

module.exports = {
  createId,
  nowIso,
  isExpired,
  sanitizeContact
};
