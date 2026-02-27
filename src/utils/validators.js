function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
}

function isValidPhone(phone) {
  return /^\+?\d{10,15}$/.test(String(phone || ""));
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

module.exports = {
  isValidEmail,
  isValidPhone,
  isPositiveInteger
};
