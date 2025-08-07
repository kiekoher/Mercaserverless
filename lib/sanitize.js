// A more robust, best-effort sanitization to reduce prompt injection risk.
// This is a mitigation, not a foolproof solution. The best defense is a
// combination of input validation, sanitization, and careful prompt engineering.
export function sanitizeInput(value) {
  const strValue = String(value ?? '');

  // 1. Escape a wide range of special characters that might be interpreted as instructions,
  // code, or formatting by the LLM (e.g., Markdown, special symbols).
  const escapedValue = strValue.replace(/[\\`*_{}[\]()#+-.!$]/g, '\\$&');

  // 2. Remove newlines to prevent instruction separation.
  return escapedValue.replace(/[\r\n]+/g, ' ');
}
