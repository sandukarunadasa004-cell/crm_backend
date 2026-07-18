'use strict';

/**
 * Validates an email address against a standard format.
 * Returns true if the email is empty/null (optional fields shouldn't fail format validation).
 */
function isValidEmail(email) {
  if (!email || !email.trim()) return true;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validates a mobile/phone number.
 * Returns true if the phone is empty/null.
 * Requires at least 10 digits, allows optional +, spaces, and hyphens.
 */
function isValidPhone(phone) {
  if (!phone || !phone.trim()) return true;
  const sanitized = phone.trim();
  
  // 1. Must contain ONLY numbers, spaces, hyphens, or a leading plus. NO letters.
  if (!/^[+]?[\d\s-]+$/.test(sanitized)) return false;
  
  // 2. Count the actual digits. Real phone numbers are 10 to 12 digits.
  const digitCount = sanitized.replace(/\D/g, '').length;
  return digitCount >= 10 && digitCount <= 12;
}

module.exports = {
  isValidEmail,
  isValidPhone
};
