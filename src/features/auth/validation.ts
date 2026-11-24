export const PASSWORD_MIN = 8;
export const USERNAME_RE = /^[A-Za-z0-9_.-]{3,24}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Enter your email address.';
  if (!EMAIL_RE.test(email.trim())) return 'Enter a valid email address.';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Enter a password.';
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'Include at least one letter and one number.';
  return null;
}

export function validateUsername(username: string): string | null {
  if (!username.trim()) return 'Choose a username.';
  if (!USERNAME_RE.test(username.trim())) return '3–24 characters: letters, numbers, dots, dashes or underscores.';
  return null;
}
