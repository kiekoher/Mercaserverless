import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../../lib/logger.server';
import { sanitizeInput } from '../../lib/sanitize'; // Mitiga intentos básicos de prompt injection
import { getCacheClient } from '../../lib/redisCache';
import { z } from 'zod';
import { checkRateLimit } from '../../lib/rateLimiter';
import { verifyCsrf } from '../../lib/csrf';
import { requireUser } from '../../lib/auth';
import env from '../../lib/env.server';

const insightsSchema = z.object({
  rutaId: z.number().int().positive({ message: "El ID de la ruta debe ser un número entero positivo" }).max(1_000_000),
});

const UNSAFE_PROMPT_PATTERN = /(\bSYSTEM\b|http(s)?:)/i;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  if (!verifyCsrf(req, res)) return;

  if (!process.env.GEMINI_API_KEY) {
    logger.error('GEMINI_API_KEY is not configured');
    return res.status(500).json({ error: 'GEMINI_API_KEY no configurada' });
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  const { error: authError, supabase, user } = await requireUser(req, res, ['supervisor', 'admin']);
  if (authError) {
    return res.status(authError.status).json({ error: authError.message });
  }

  logger.info({ userId: user.id }, 'generate-insights invoked');

  if (!(await checkRateLimit(req, { userId: user.id }))) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const parsed = insightsSchema.safeParse(req.body);
  if (!parsed.success) {
    const errorMessages = parsed.error.issues.map(e => e.message).join(', ');
    logger.warn({ errors: parsed.error.format() }, `Invalid request to generate-insights: ${errorMessages}`);
    return res.status(400).json({ error: `Datos de entrada inválidos: ${errorMessages}` });
  }
  const { rutaId } = parsed.data;

  try {
    // 1. Fetch all visits for the given route
    const { data: visitas, error: visitasError } = await supabase
      .from('visitas')
      .select('*, puntos_de_venta(nombre)')
      .eq('ruta_id', rutaId);

    if (visitasError) throw new Error(visitasError.message);
    if (!visitas || visitas.length === 0) {
      return res.status(404).json({ error: 'No se encontraron visitas para esta ruta.' });
    }

    // 2. Format the data for the AI prompt
    const promptData = visitas.map(v =>
      `- Punto: ${sanitizeInput(v.puntos_de_venta.nombre)}, Estado: ${sanitizeInput(v.estado)}, Check-in: ${sanitizeInput(v.check_in_at)}, Check-out: ${sanitizeInput(v.check_out_at)}, Observaciones: ${sanitizeInput(v.observaciones || 'N/A')}`
    ).join('\n'); // Sanitización básica; no garantiza protección total contra prompt injection

    if (UNSAFE_PROMPT_PATTERN.test(promptData)) {
      logger.warn({ rutaId }, 'Prompt contains unsafe content');
      return res.status(400).json({ error: 'Prompt no permitido' });
    }

    const cache = getCacheClient();
    const hasCache = cache && typeof cache.get === 'function';
    const cacheKey = `ai:insights:${rutaId}`;
    if (hasCache) {
      const cached = await cache.get(cacheKey);
      if (cached) {
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
        logger.error('Gemini API request timed out');
        return res.status(504).json({ error: 'Tiempo de espera agotado para la API de IA' });
      }
      throw e;
    } finally {
      clearTimeout(timeout);
    }

    const MAX_RESPONSE_LENGTH = 2000;
    if (text.length > MAX_RESPONSE_LENGTH) {
      logger.error('AI response too long');
      return res.status(500).json({ error: 'Respuesta de IA demasiado larga' });
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
        logger.error({ err: e, text }, 'Failed to parse AI response');
        return res.status(500).json({ error: 'Respuesta de IA inválida' });
      }

      res.status(200).json(parsedOutput);

      if (hasCache) {
        await cache.set(cacheKey, JSON.stringify(parsedOutput), { ex: 60 * 60 });
      }

  } catch (error) {
    logger.error({ err: error }, 'Error generating insights');
    res.status(500).json({ error: 'Error al comunicarse con la API de IA o al procesar los datos.' });
  }
}
