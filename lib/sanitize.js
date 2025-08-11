import sanitizeHtml from 'sanitize-html';

// A more robust, best-effort sanitization to reduce prompt injection risk.
// This is a mitigation, not a foolproof solution.
export function sanitizeInput(value) {
  const strValue = String(value ?? '');
  const cleaned = sanitizeHtml(strValue, {
    allowedTags: [],
    allowedAttributes: {},
  });
  return cleaned.replace(/[\r\n]+/g, ' ').trim();
}
