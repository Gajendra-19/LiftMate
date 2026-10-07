const isValidPhone = (value) => Number.isInteger(Number(value)) && /^\d{10}$/.test(String(value));

const sanitizeValue = (value) => {
  if (typeof value !== 'string') return '';
  return value.replace(/[<>]/g, '').trim();
};

const validatePassword = (password) => {
  if (typeof password !== 'string') return false;
  return password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password);
};

const normalizeEquipment = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

module.exports = { isValidPhone, sanitizeValue, validatePassword, normalizeEquipment };
