import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';
import logger from './logger.server';

// A more robust, best-effort sanitization to reduce prompt injection risk.
// This is a mitigation, not a foolproof solution.
const DEFAULT_PATTERN = /^[\w\s.,;:()\-!?@#&/]*$/;

export function sanitizeInput(value, { maxLength = 200, pattern = DEFAULT_PATTERN } = {}) {
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
    .refine((v) => pattern.test(v), {
      message: 'Invalid format',
    });

  const result = schema.safeParse(cleaned);
  if (!result.success) {
    logger.warn({ value: strValue }, 'sanitizeInput rejected value');
    return '';
  }
  return result.data;
}
