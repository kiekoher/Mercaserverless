import { GoogleGenerativeAI } from '@google/generative-ai';
import { getSupabaseServerClient } from '../../lib/supabaseServer';
import { checkRateLimit } from '../../lib/rateLimiter';
import logger from '../../lib/logger';
import { sanitizeInput } from '../../lib/sanitize'; // Mitiga intentos básicos de prompt injection
import { z } from 'zod';
import { verifyCsrf } from '../../lib/csrf';

const summarySchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "La fecha debe estar en formato YYYY-MM-DD" }),
  mercaderistaId: z.string().min(1, { message: "El ID del mercaderista es requerido" }),
  puntos: z.array(
    z.object({
      nombre: z.string().min(1, { message: "El nombre del punto de venta es requerido" })
    })
  ).min(1, { message: "Debe haber al menos un punto de venta" }),
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  if (!verifyCsrf(req, res)) return;

  if (!process.env.GEMINI_API_KEY) {
    logger.error('GEMINI_API_KEY is not configured');
    return res.status(500).json({ error: 'GEMINI_API_KEY no configurada' });
  }

  const supabase = getSupabaseServerClient(req, res);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    logger.warn('Unauthorized access attempt to generate-summary');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['supervisor', 'admin'].includes(profile.role)) {
    logger.warn({ userId: user.id, role: profile?.role }, 'Forbidden access attempt to generate-summary');
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!(await checkRateLimit(req, { userId: user.id }))) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  const parsed = summarySchema.safeParse(req.body);

  if (!parsed.success) {
    // Collect all error messages
    const errorMessages = parsed.error.errors.map(e => e.message).join(', ');
    logger.warn({ errors: parsed.error.format() }, `Invalid request to generate-summary: ${errorMessages}`);
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
    `; // Sanitización básica; no garantiza protección total contra prompt injection

  try {
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = (await response.text()).replace(/```json|```/g, '');

      const outputSchema = z.object({ summary: z.string() });

      let parsed;
      try {
        parsed = outputSchema.parse(JSON.parse(text));
      } catch (e) {
        logger.error({ err: e, text }, 'Failed to parse summary response');
        return res.status(500).json({ error: 'Respuesta de IA inválida' });
      }

      res.status(200).json(parsed);

  } catch (error) {
    logger.error({ err: error }, 'Error calling Gemini API');
    const status = error?.response?.status;
    if (status === 401) {
      return res.status(401).json({ error: 'Token inválido para Gemini API.' });
    }
    if (status === 403) {
      return res.status(403).json({ error: 'Límite de cuota de Gemini API excedido.' });
    }
    res.status(500).json({ error: 'No se pudo generar el resumen con Gemini.' });
  }
}
