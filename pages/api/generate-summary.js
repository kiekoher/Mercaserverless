import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Google AI client with the API key from environment variables
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  const { fecha, mercaderistaId, puntos } = req.body;

  if (!fecha || !mercaderistaId || !puntos) {
    return res.status(400).json({ error: 'Faltan datos de la ruta en la solicitud.' });
  }

  const prompt = `
    Genera un resumen corto y amigable para una ruta de mercaderista.
    El resumen debe ser de no más de 40 palabras, en un tono motivador y profesional.
    Aquí están los detalles:
    - Fecha: ${fecha}
    - Mercaderista: ${mercaderistaId}
    - Número de paradas: ${puntos.length}
    - Puntos de venta: ${puntos.map(p => p.nombre).join(', ')}

    Ejemplo de respuesta: "¡Excelente día, ${mercaderistaId}! Hoy tu ruta del ${fecha} te llevará a ${puntos.length} puntos clave, incluyendo ${puntos[0]?.nombre}. ¡A darlo todo!"
  `;

  try {
    /*
     * REAL GEMINI API CALL
     * const model = genAI.getGenerativeModel({ model: "gemini-pro" });
     * const result = await model.generateContent(prompt);
     * const response = await result.response;
     * const summary = response.text();
    */

    // MOCK RESPONSE
    const summary = `(Generado por Gemini) Resumen para ${mercaderistaId} el ${fecha}: La ruta de hoy tiene ${puntos.length} paradas clave, visitando ${puntos.map(p => p.nombre).join(', ')}. ¡Un día lleno de éxitos!`;

    res.status(200).json({ summary });

  } catch (error) {
    console.error('Error calling Gemini API:', error);
    res.status(500).json({ error: 'No se pudo generar el resumen con Gemini.' });
  }
}
