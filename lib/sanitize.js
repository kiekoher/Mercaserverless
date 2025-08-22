import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';

// A more robust, best-effort sanitization to reduce prompt injection risk.
// This is a mitigation, not a foolproof solution.
export function sanitizeInput(value, { maxLength = 200, pattern } = {}) {
  const strValue = String(value ?? '');
  const cleaned = sanitizeHtml(strValue, {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/['"`]/g, '')
    .replace(/[\r\n]+/g, ' ')
    .trim();

  const schema = z
    .string()
    .max(maxLength)
    .refine((v) => (pattern ? pattern.test(v) : true), {
      message: 'Invalid format',
    });

  const result = schema.safeParse(cleaned);
  return result.success ? result.data : '';
}
