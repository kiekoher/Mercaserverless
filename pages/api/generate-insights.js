const { GoogleGenerativeAI } = require('@google/generative-ai');
const { z } = require('zod');
const { withLogging } = require('../../lib/api-logger');
const { requireUser } = require('../../lib/auth');
const env = require('../../lib/env.server');
const logger = require('../../lib/logger.server');
const { checkRateLimit } = require('../../lib/rateLimiter');
const { getCacheClient } = require('../../lib/redisCache');
const { sanitizeInput } = require('../../lib/sanitize');

const insightsSchema = z.object({
  rutaId: z.number().int().positive({ message: "El ID de la ruta debe ser un número entero positivo" }).max(1_000_000),
});

const UNSAFE_PROMPT_PATTERN = /(\bSYSTEM\b|http(s)?:)/i;

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }


  if (!process.env.GEMINI_API_KEY) {
    logger.error('GEMINI_API_KEY is not configured');
    // Let the HOF catch this and log it as an unhandled error
    throw new Error('GEMINI_API_KEY no configurada');
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  const { error: authError, supabase, user } = await requireUser(req, res, ['supervisor', 'admin']);
  if (authError) {
    return res.status(authError.status).json({ error: authError.message });
  }

  // The HOF already logs the request start, but we can add specific context here.
  logger.info({ userId: user.id }, 'generate-insights specifically invoked');

  if (!(await checkRateLimit(req, { userId: user.id }))) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const parsed = insightsSchema.safeParse(req.body);
  if (!parsed.success) {
    const errorMessages = parsed.error.issues.map(e => e.message).join(', ');
    logger.warn({ userId: user.id, errors: parsed.error.format() }, `Invalid request to generate-insights: ${errorMessages}`);
    return res.status(400).json({ error: `Datos de entrada inválidos: ${errorMessages}` });
  }
  const { rutaId } = parsed.data;

  // 1. Fetch all visits for the given route
  const { data: visitas, error: visitasError } = await supabase
    .from('visitas')
    .select('*, puntos_de_venta(nombre)')
    .eq('ruta_id', rutaId);

  if (visitasError) throw visitasError;
  if (!visitas || visitas.length === 0) {
    return res.status(404).json({ error: 'No se encontraron visitas para esta ruta.' });
  }

  // 2. Format the data for the AI prompt
  const promptData = visitas.map(v =>
    `- Punto: ${sanitizeInput(v.puntos_de_venta.nombre)}, Estado: ${sanitizeInput(v.estado)}, Check-in: ${sanitizeInput(v.check_in_at)}, Check-out: ${sanitizeInput(v.check_out_at)}, Observaciones: ${sanitizeInput(v.observaciones || 'N/A')}`
  ).join('\n');

  if (UNSAFE_PROMPT_PATTERN.test(promptData)) {
    logger.warn({ userId: user.id, rutaId }, 'Prompt contains unsafe content');
    return res.status(400).json({ error: 'Prompt no permitido' });
  }

  const cache = getCacheClient();
  const hasCache = cache && typeof cache.get === 'function';
  const cacheKey = `ai:insights:${rutaId}`;
  if (hasCache) {
    const cached = await cache.get(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(JSON.parse(cached));
    }
  }

  const prompt = `
      Eres un asistente de análisis de operaciones para una fuerza de ventas.
      Analiza los siguientes datos de visitas de una ruta de un mercaderista y responde exclusivamente en JSON con el siguiente formato:
      {"kpi":"...","insight":"...","observation":"...","recommendation":"..."}
      No incluyas texto adicional.

      Datos:
      ${promptData}
    `;

  const MAX_PROMPT_LENGTH = 5000;
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return res.status(400).json({ error: 'Prompt demasiado largo' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(env.AI_TIMEOUT_MS ?? 10000));

  // 3. Call the Gemini API with timeout
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
  let text;
  try {
    const result = await model.generateContent(prompt, { signal: controller.signal });
    const response = await result.response;
    text = response.text().replace(/```json|```/g, '');
  } catch (e) {
    if (e.name === 'AbortError') {
      logger.error({ userId: user.id, rutaId }, 'Gemini API request timed out');
      return res.status(504).json({ error: 'Tiempo de espera agotado para la API de IA' });
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }

  const MAX_RESPONSE_LENGTH = 2000;
  if (text.length > MAX_RESPONSE_LENGTH) {
    logger.error({ userId: user.id, rutaId }, 'AI response too long');
    throw new Error('Respuesta de IA demasiado larga');
  }

  const outputSchema = z.object({
    kpi: z.string(),
    insight: z.string(),
    observation: z.string(),
    recommendation: z.string()
  });

  let parsedOutput;
  try {
    parsedOutput = outputSchema.parse(JSON.parse(text));
  } catch (e) {
    logger.error({ err: e, text, userId: user.id, rutaId }, 'Failed to parse AI response');
    throw new Error('Respuesta de IA inválida');
  }

  if (hasCache) {
    res.setHeader('X-Cache', 'MISS');
    await cache.set(cacheKey, JSON.stringify(parsedOutput), { ex: 60 * 60 });
  }

  res.status(200).json(parsedOutput);
}

module.exports = withLogging(handler);;
