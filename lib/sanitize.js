import sanitizeHtml from 'sanitize-html';

// A more robust, best-effort sanitization to reduce prompt injection risk.
// This is a mitigation, not a foolproof solution.
export function sanitizeInput(value, { maxLength = 200 } = {}) {
  const strValue = String(value ?? '');
  const cleaned = sanitizeHtml(strValue, {
    allowedTags: [],
    allowedAttributes: {},
  });
  return cleaned
    .replace(/['"`]/g, '')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, maxLength)
    .trim();
}
