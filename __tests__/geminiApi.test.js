/** @jest-environment node */

import { jest } from '@jest/globals';

const mockText = jest.fn();
const mockGenerateContent = jest.fn().mockResolvedValue({ response: { text: mockText } });
const mockGetGenerativeModel = jest.fn().mockReturnValue({ generateContent: mockGenerateContent });

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

function createMockRes() {
  return {
    statusCode: 0,
    headers: {},
    data: null,
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    },
    end(payload) {
      this.data = payload;
      return this;
    },
  };
}

describe('Gemini API routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generate-summary', () => {
    it('returns a summary on success', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      mockText.mockResolvedValueOnce('Hola');

      const { default: handler } = await import('../pages/api/generate-summary.js');

      const req = {
        method: 'POST',
        body: { fecha: '2024-01-01', mercaderistaId: 'm1', puntos: [{ nombre: 'P1' }] },
      };
      const res = createMockRes();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.data.summary).toBe('Hola');
      expect(mockGetGenerativeModel).toHaveBeenCalledWith({ model: 'gemini-pro' });
    });

    it('fails when API key is missing', async () => {
      delete process.env.GEMINI_API_KEY;
      const { default: handler } = await import('../pages/api/generate-summary.js');

      const req = { method: 'POST', body: { fecha: 'f', mercaderistaId: 'm', puntos: [] } };
      const res = createMockRes();

      await handler(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.data).toEqual({ error: 'GEMINI_API_KEY no configurada' });
      expect(mockGetGenerativeModel).not.toHaveBeenCalled();
    });

    it('propagates Gemini API errors', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      mockGenerateContent.mockRejectedValueOnce({ response: { status: 401 } });

      const { default: handler } = await import('../pages/api/generate-summary.js');

      const req = {
        method: 'POST',
        body: { fecha: '2024-01-01', mercaderistaId: 'm1', puntos: [{ nombre: 'P1' }] },
      };
      const res = createMockRes();

      await handler(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.data).toEqual({ error: 'Token inválido para Gemini API.' });
    });
  });

  describe('optimize-route', () => {
    it('returns optimized points on success', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      const responseJSON = JSON.stringify([
        { id: 2, nombre: 'B', direccion: 'd2', ciudad: 'Bogotá' },
        { id: 1, nombre: 'A', direccion: 'd1', ciudad: 'Bogotá' },
      ]);
      mockText.mockResolvedValueOnce(responseJSON);

      const { default: handler } = await import('../pages/api/optimize-route.js');

      const req = {
        method: 'POST',
        body: { puntos: [
          { id: 1, nombre: 'A', direccion: 'd1', ciudad: 'Bogotá' },
          { id: 2, nombre: 'B', direccion: 'd2', ciudad: 'Bogotá' },
        ] },
      };
      const res = createMockRes();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.data.optimizedPuntos).toHaveLength(2);
      expect(res.data.optimizedPuntos[0].id).toBe(2);
    });

    it('returns error when API key missing', async () => {
      delete process.env.GEMINI_API_KEY;
      const { default: handler } = await import('../pages/api/optimize-route.js');

      const req = { method: 'POST', body: { puntos: [{ id: 1 }, { id: 2 }] } };
      const res = createMockRes();

      await handler(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.data).toEqual({ error: 'GEMINI_API_KEY no configurada' });
    });

    it('propagates Gemini API quota errors', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      mockGenerateContent.mockRejectedValueOnce({ response: { status: 403 } });

      const { default: handler } = await import('../pages/api/optimize-route.js');

      const req = { method: 'POST', body: { puntos: [{ id: 1 }, { id: 2 }] } };
      const res = createMockRes();

      await handler(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.data).toEqual({ error: 'Límite de cuota de Gemini API excedido.' });
    });
  });
});

