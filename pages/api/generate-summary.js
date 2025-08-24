const { GoogleGenerativeAI } = require('@google/generative-ai');
const { z } = require('zod');
const { withLogging } = require('../../lib/api-logger');
const { requireUser } = require('../../lib/auth');
const logger = require('../../lib/logger.server');
const { checkRateLimit } = require('../../lib/rateLimiter');
const { getCacheClient } = require('../../lib/redisCache');
const { sanitizeInput } = require('../../lib/sanitize');


const summarySchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "La fecha debe estar en formato YYYY-MM-DD" }).length(10),
  mercaderistaId: z.string().uuid({ message: "El ID del mercaderista es requerido" }),
  puntos: z.array(
    z.object({
      nombre: z.string().min(1, { message: "El nombre del punto de venta es requerido" }).max(100)
    })
  ).min(1, { message: "Debe haber al menos un punto de venta" }),
});

const UNSAFE_PROMPT_PATTERN = /(\bSYSTEM\b|http(s)?:)/i;

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }


  if (!process.env.GEMINI_API_KEY) {
    logger.error('GEMINI_API_KEY is not configured');
    throw new Error('GEMINI_API_KEY no configurada');
  }

  const { error: authError, user } = await requireUser(req, res, ['supervisor', 'admin']);
  if (authError) {
    return res.status(authError.status).json({ error: authError.message });
  }

  if (!(await checkRateLimit(req, { userId: user.id }))) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 5000;
  const MAX_PROMPT_LENGTH = Number(process.env.MAX_PROMPT_LENGTH) || 1000;

  const parsed = summarySchema.safeParse(req.body);

  if (!parsed.success) {
    const errorMessages = parsed.error.errors.map(e => e.message).join(', ');
    logger.warn({ userId: user.id, errors: parsed.error.format() }, `Invalid request to generate-summary: ${errorMessages}`);
    return res.status(400).json({ error: `Datos de entrada inválidos: ${errorMessages}` });
  }

  const { fecha, mercaderistaId, puntos } = parsed.data;

  const safeFecha = sanitizeInput(fecha);
  const safeMercaderista = sanitizeInput(mercaderistaId);
  const safePuntos = puntos.map(p => sanitizeInput(p.nombre));

  const prompt = `
      Genera un resumen corto y amigable para una ruta de mercaderista.
      Responde exclusivamente en formato JSON con la clave \"summary\":
      {"summary":"..."}
      No incluyas texto adicional.
      Detalles:
      - Fecha: ${safeFecha}
      - Mercaderista: ${safeMercaderista}
      - Número de paradas: ${puntos.length}
      - Puntos de venta: ${safePuntos.join(', ')}
    `;

  if (prompt.length > MAX_PROMPT_LENGTH) {
    logger.warn({ userId: user.id, promptLength: prompt.length }, 'Prompt too long');
    return res.status(400).json({ error: 'Prompt demasiado largo' });
  }

  if (UNSAFE_PROMPT_PATTERN.test(prompt)) {
    logger.warn({ userId: user.id, mercaderistaId }, 'Prompt contains unsafe content');
    return res.status(400).json({ error: 'Prompt no permitido' });
  }

  const cache = getCacheClient();
  const hasCache = cache && typeof cache.get === 'function';
  const cacheKey = `ai:summary:${fecha}:${mercaderistaId}`;
  if (hasCache) {
    const cached = await cache.get(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(JSON.parse(cached));
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent(prompt, { signal: controller.signal });
    clearTimeout(timeout);
    const response = await result.response;
    const text = (await response.text()).replace(/```json|```/g, '');

    const outputSchema = z.object({ summary: z.string() });

    let parsedOutput;
    try {
      parsedOutput = outputSchema.parse(JSON.parse(text));
    } catch (e) {
      logger.error({ err: e, text, userId: user.id }, 'Failed to parse summary response');
      throw new Error('Respuesta de IA inválida');
    }

    if (hasCache) {
      res.setHeader('X-Cache', 'MISS');
      await cache.set(cacheKey, JSON.stringify(parsedOutput), { ex: 60 * 60 });
    }

    res.status(200).json(parsedOutput);

  } catch (error) {
    clearTimeout(timeout);
    logger.error({ err: error, userId: user.id }, 'Error calling Gemini API');
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'La solicitud a la IA expiró' });
    }
    const status = error?.response?.status;
    if (status === 401 || status === 403) {
      throw new Error('Error de autenticación o cuota con la API de IA.');
    }
    throw error;
  }
}

module.exports = withLogging(handler);;
