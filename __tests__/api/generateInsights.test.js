/** @jest-environment node */
const { createMockReq, createMockRes } = require('../../lib/test-utils');
const { requireUser } = require('../../lib/auth');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getCacheClient } = require('../../lib/redisCache');
const { rawHandler: handler } = require('../../pages/api/generate-insights');

jest.mock('../../lib/auth');
jest.mock('@google/generative-ai');
jest.mock('../../lib/redisCache');

describe('generate-insights API', () => {
  let supabase;
  let mockGenAI;
  let mockCache;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase client
    supabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    // Mock Google Gemini AI
    mockGenAI = {
      getGenerativeModel: jest.fn().mockReturnThis(),
      generateContent: jest.fn(),
    };
    GoogleGenerativeAI.mockImplementation(() => mockGenAI);

    // Mock Redis Cache
    mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(),
    };
    getCacheClient.mockReturnValue(mockCache);

    // Default auth mock for a successful supervisor login
    requireUser.mockResolvedValue({ user: { id: 'test-supervisor-id' }, role: 'supervisor', supabase });

    // Set dummy env vars
    process.env.GEMINI_API_KEY = 'test-key';
  });

  it('should return 403 if user is not a supervisor or admin', async () => {
    // This mock simulates the behavior of requireUser when the role check fails
    requireUser.mockResolvedValue({ error: { status: 403, message: 'Forbidden' } });
    const req = createMockReq('POST', { rutaId: 1 });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(403);
    expect(res._getJSONData().error).toBe('Forbidden');
    expect(supabase.from).not.toHaveBeenCalled(); // Ensure we don't proceed to DB call
  });

  it('should return 400 for invalid input', async () => {
    const req = createMockReq('POST', { rutaId: 'this-is-not-a-number' });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res._getJSONData().error).toContain('Datos de entrada inválidos');
  });

  it('should return 404 if route is not found', async () => {
    supabase.single.mockResolvedValue({ data: null, error: null });
    const req = createMockReq('POST', { rutaId: 999 });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res._getJSONData().error).toBe('No se encontró la ruta especificada.');
  });

  it('should successfully generate insights and build a correct prompt', async () => {
    const mockRouteData = {
      fecha: '2024-08-27',
      profiles: { full_name: 'Juan Perez' },
      ruta_pdv: [
        { pdv_id: 1, puntos_de_venta: { nombre: 'Supermercado La Fama' } },
        { pdv_id: 2, puntos_de_venta: { nombre: 'Tienda La Esquina' } },
        { pdv_id: 3, puntos_de_venta: { nombre: 'Bodega Central' } },
      ],
      visitas: [
        { punto_de_venta_id: 1, estado: 'Completada', observaciones: 'Stock completo.' },
        { punto_de_venta_id: 3, estado: 'Incidencia', observaciones: 'No se encontraba el gerente.' },
      ],
    };
    supabase.single.mockResolvedValue({ data: mockRouteData, error: null });

    const mockAiResponse = {
      kpi: "66.7% de visitas completadas (2 de 3 puntos asignados).",
      insight: "El punto de venta 'Tienda La Esquina' fue omitido, lo que representa una oportunidad de venta perdida.",
      observation: "Se reportó una incidencia en 'Bodega Central' por ausencia del gerente, lo que impidió una gestión efectiva.",
      recommendation: "Contactar al mercaderista para entender la omisión de 'Tienda La Esquina' y reprogramar la visita a 'Bodega Central' para hablar con el gerente."
    };
    mockGenAI.generateContent.mockResolvedValue({
      response: { text: () => JSON.stringify(mockAiResponse) }
    });

    const req = createMockReq('POST', { rutaId: 1 });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toEqual(mockAiResponse);
    expect(mockGenAI.generateContent).toHaveBeenCalledTimes(1);

    // Verify the prompt content
    const prompt = mockGenAI.generateContent.mock.calls[0][0];
    expect(prompt).toContain('Juan Perez');
    expect(prompt).toContain('- VISITADO: Supermercado La Fama');
    expect(prompt).toContain('- VISITADO: Bodega Central');
    expect(prompt).toContain('- NO VISITADO: Tienda La Esquina');
  });

  it('should throw an error if the AI response is invalid JSON', async () => {
    const mockRouteData = {
      fecha: '2024-08-27',
      profiles: { full_name: 'Juan Perez' },
      ruta_pdv: [],
      visitas: [],
    };
    supabase.single.mockResolvedValue({ data: mockRouteData, error: null });
    mockGenAI.generateContent.mockResolvedValue({
      response: { text: () => 'this is definitely not json' }
    });

    const req = createMockReq('POST', { rutaId: 1 });
    const res = createMockRes();

    await expect(handler(req, res)).rejects.toThrow('Respuesta de IA inválida');
  });

  it('should use cache when available', async () => {
    const cachedData = { kpi: 'cached kpi', insight: 'cached insight', observation: 'cached obs', recommendation: 'cached rec' };
    mockCache.get.mockResolvedValue(JSON.stringify(cachedData));
    // Add a mock for supabase just in case the cache logic fails, to prevent a crash
    supabase.single.mockResolvedValue({ data: { profiles: {}, ruta_pdv: [], visitas: [] }, error: null });

    const req = createMockReq('POST', { rutaId: 1 });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toEqual(cachedData);
    expect(res._getHeaders()['x-cache']).toBe('HIT');
    // The auth check may call supabase.from, so we can't assert it's never called.
    // The most important check is that the expensive AI call is skipped.
    expect(mockGenAI.generateContent).not.toHaveBeenCalled();
  });
});
