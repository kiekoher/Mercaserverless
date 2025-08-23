import { sanitizeInput, PATTERNS } from '../lib/sanitize';

describe('sanitizeInput', () => {
  it('removes HTML tags and newlines', () => {
    const malicious = '<script>alert("x")</script>\nnext line';
    const result = sanitizeInput(malicious);
    expect(result).toBe('next line');
  });

  it('returns empty string for undefined', () => {
    expect(sanitizeInput(undefined)).toBe('');
  });

  it('rejects values with disallowed characters', () => {
    const result = sanitizeInput('hola$%');
    expect(result).toBe('');
  });

  it('accepts unicode letters', () => {
    const result = sanitizeInput('camión número ñandú');
    expect(result).toBe('camión número ñandú');
  });

  it('allows addresses with ADDRESS pattern', () => {
    const result = sanitizeInput('Calle 123 #4-56', { pattern: 'ADDRESS' });
    expect(result).toBe('Calle 123 #4-56');
  });

  it('rejects numbers in NAME pattern', () => {
    const result = sanitizeInput('John123', { pattern: 'NAME' });
    expect(result).toBe('');
  });
});
