/**
 * Input validation and sanitization utilities
 */

export function sanitizeText(input: string, maxLength = 10000): string {
  // Remove HTML tags and trim whitespace
  const sanitized = input.replace(/<[^>]*>?/gm, "").trim();
  
  // Enforce maximum length
  return sanitized.slice(0, maxLength);
}

export function validateNumber(value: string | number, min = 0, max = 1000): number {
  const num = parseFloat(String(value));
  if (isNaN(num) || num < min || num > max) {
    throw new Error(`Valor fuera de rango (${min}-${max})`);
  }
  return num;
}

export function validateEmail(email: string): string {
  const sanitized = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(sanitized)) {
    throw new Error("Formato de correo electrónico inválido");
  }
  
  if (sanitized.length > 255) {
    throw new Error("El correo electrónico es demasiado largo");
  }
  
  return sanitized;
}

export function validateRequired(value: string, fieldName = "Campo"): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${fieldName} es requerido`);
  }
  return trimmed;
}
