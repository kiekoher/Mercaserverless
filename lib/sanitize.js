// Best-effort sanitization to reduce prompt injection risk.
// Escapes newlines and special characters.
export function sanitizeInput(value) {
  return String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[\`$\\]/g, '\\$&');
}
