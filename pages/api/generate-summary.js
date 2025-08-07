import { GoogleGenerativeAI } from '@google/generative-ai';
import { sanitizeInput } from '../../lib/sanitize'; // Mitiga intentos básicos de prompt injection

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY no configurada' });
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  const { fecha, mercaderistaId, puntos } = req.body;

  if (!fecha || !mercaderistaId || !puntos) {
    return res.status(400).json({ error: 'Faltan datos de la ruta en la solicitud.' });
  }

  const safeFecha = sanitizeInput(fecha);
  const safeMercaderista = sanitizeInput(mercaderistaId);
  const safePuntos = puntos.map(p => sanitizeInput(p.nombre));

  const prompt = `
    Genera un resumen corto y amigable para una ruta de mercaderista.
    El resumen debe ser de no más de 40 palabras, en un tono motivador y profesional.
    Aquí están los detalles:
    - Fecha: ${safeFecha}
    - Mercaderista: ${safeMercaderista}
    - Número de paradas: ${puntos.length}
    - Puntos de venta: ${safePuntos.join(', ')}

    Ejemplo de respuesta: "¡Excelente día, ${safeMercaderista}! Hoy tu ruta del ${safeFecha} te llevará a ${puntos.length} puntos clave, incluyendo ${safePuntos[0]}. ¡A darlo todo!"
  `; // Sanitización básica; no garantiza protección total contra prompt injection

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const summary = await response.text();

    res.status(200).json({ summary });

  } catch (error) {
    console.error('Error calling Gemini API:', error);
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
