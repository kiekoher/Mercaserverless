import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';
import logger from './logger.server';

// A more robust, best-effort sanitization to reduce prompt injection risk.
// This is a mitigation, not a foolproof solution.
const DEFAULT_PATTERN = /^[\p{L}\d\s.,;:()\-!?@#&/]*$/u;

export const PATTERNS = {
  DEFAULT: DEFAULT_PATTERN,
  NAME: /^[\p{L}\s'-]+$/u,
  ADDRESS: /^[\p{L}\d\s.,#\-]+$/u,
};

export function sanitizeInput(value, { maxLength = 200, pattern = 'DEFAULT' } = {}) {
  const strValue = String(value ?? '');
  const cleaned = sanitizeHtml(strValue, {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/['"`]/g, '')
    .replace(/[\r\n]+/g, ' ')
    .trim();

  const regex = typeof pattern === 'string' ? PATTERNS[pattern] || DEFAULT_PATTERN : pattern;

  const schema = z
    .string()
    .max(maxLength)
    .refine((v) => regex.test(v), {
      message: 'Invalid format',
    });

  const result = schema.safeParse(cleaned);
  if (!result.success) {
    logger.warn({ value: strValue }, 'sanitizeInput rejected value');
    return '';
  }
  return result.data;
}
