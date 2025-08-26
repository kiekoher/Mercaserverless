const { GoogleGenerativeAI } = require('@google/generative-ai');
const { z } = require('zod');
const { withLogging } = require('../../lib/api-logger');
const { requireUser } = require('../../lib/auth');
const env = require('../../lib/env.server');
const logger = require('../../lib/logger.server');
const { checkRateLimit } = require('../../lib/rateLimiter');
const { getCacheClient } = require('../../lib/redisCache');
const { sanitizeInput } = require('../../lib/sanitize');

// Schema for input validation
const summarySchema = z.object({
  fecha_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "El formato de la fecha de inicio debe ser YYYY-MM-DD"),
  fecha_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "El formato de la fecha de fin debe ser YYYY-MM-DD"),
  mercaderista_id: z.string().uuid().optional(),
});

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  if (!env.GEMINI_API_KEY) {
    logger.error('GEMINI_API_KEY is not configured');
    throw new Error('La clave de API de Gemini no está configurada.');
  }

  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

  const { error: authError, supabase, user } = await requireUser(req, res, ['supervisor', 'admin']);
  if (authError) {
    return res.status(authError.status).json({ error: authError.message });
  }

  logger.info({ userId: user.id }, 'generate-summary endpoint invoked');

  if (!(await checkRateLimit(req, { userId: user.id }))) {
    return res.status(429).json({ error: 'Demasiadas solicitudes' });
  }

  const parsed = summarySchema.safeParse(req.body);
  if (!parsed.success) {
    const errorMessages = parsed.error.issues.map(e => e.message).join(', ');
    logger.warn({ userId: user.id, errors: parsed.error.format() }, `Invalid request to generate-summary: ${errorMessages}`);
    return res.status(400).json({ error: `Datos de entrada inválidos: ${errorMessages}` });
  }
  const { fecha_inicio, fecha_fin, mercaderista_id } = parsed.data;

  // Build the query to fetch visits
  let query = supabase
    .from('visitas')
    .select('*, puntos_de_venta(nombre), profiles(full_name)')
    .gte('created_at', fecha_inicio)
    .lte('created_at', `${fecha_fin}T23:59:59.999Z`);

  if (mercaderista_id) {
    query = query.eq('mercaderista_id', mercaderista_id);
  }

  const { data: visitas, error: visitasError } = await query;

  if (visitasError) throw visitasError;
  if (!visitas || visitas.length === 0) {
    return res.status(404).json({ error: 'No se encontraron visitas para el rango y filtro seleccionados.' });
  }

  // Format the data for the AI prompt
  const promptData = visitas.map(v =>
    `- Mercaderista: ${v.profiles ? sanitizeInput(v.profiles.full_name) : 'N/A'}, Punto: ${v.puntos_de_venta ? sanitizeInput(v.puntos_de_venta.nombre) : 'N/A'}, Estado: ${sanitizeInput(v.estado)}, Observaciones: ${sanitizeInput(v.observaciones || 'N/A')}`
  ).join('\n');

  const cache = getCacheClient();
  const hasCache = cache && typeof cache.get === 'function';
  const cacheKey = `ai:summary:${fecha_inicio}:${fecha_fin}:${mercaderista_id || 'all'}`;

  if (hasCache) {
    const cached = await cache.get(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json({ summary: cached });
    }
  }

  const prompt = `
      Eres un asistente de análisis de operaciones para una fuerza de ventas.
      Analiza los siguientes datos de visitas de un equipo de mercaderistas y genera un resumen ejecutivo conciso en formato de texto plano (párrafos, no JSON).
      El resumen debe destacar tendencias clave, puntos de dolor evidentes, y oportunidades de mejora basadas en los datos.

      Datos de Visitas:
      ${promptData}
    `;

  if (prompt.length > 15000) {
    logger.warn({ userId: user.id, length: prompt.length }, 'Prompt too long for summary generation');
    return res.status(413).json({ error: 'El rango de fechas es demasiado grande para generar un resumen. Por favor, elige un período más corto.' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(env.AI_TIMEOUT_MS ?? 15000));

  let text;
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent(prompt, { signal: controller.signal });
    const response = await result.response;
    text = response.text();
  } catch (e) {
    if (e.name === 'AbortError') {
      logger.error({ userId: user.id }, 'AI API timeout');
      return res.status(504).json({ error: 'Tiempo de espera agotado para la API de IA' });
    }
    logger.error({ err: e, userId: user.id }, 'Gemini error');
    throw e;
  } finally {
    clearTimeout(timeout);
  }

  if (hasCache) {
    res.setHeader('X-Cache', 'MISS');
    await cache.set(cacheKey, text, { ex: 60 * 30 }); // Cache for 30 minutes
  }

  res.status(200).json({ summary: text });
}

module.exports = withLogging(handler);
