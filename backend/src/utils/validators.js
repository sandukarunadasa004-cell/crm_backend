'use strict';

function isValidEmail(email) {
  if (!email || !email.trim()) return true;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

function isValidPhone(phone) {
  if (!phone || !phone.trim()) return true;
  const sanitized = phone.trim();
  
  
  if (!/^[+]?[\d\s-]+$/.test(sanitized)) return false;
  
  
  const digitCount = sanitized.replace(/\D/g, '').length;
  
  if (sanitized.startsWith('+')) {
    
    return digitCount >= 11 && digitCount <= 12;
  }
  
  
  return digitCount === 10;
}

module.exports = {
  isValidEmail,
  isValidPhone
};
