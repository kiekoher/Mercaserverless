import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
    El resumen debe ser de no más de 40 palabras, en un tono motivador.
    Aquí están los detalles:
    - Fecha: ${fecha}
    - Mercaderista: ${mercaderistaId}
    - Número de paradas: ${puntos.length}
    - Puntos de venta: ${puntos.map(p => p.nombre).join(', ')}

    Ejemplo de respuesta: "¡Excelente día, ${mercaderistaId}! Hoy tu ruta del ${fecha} te llevará a ${puntos.length} puntos clave, incluyendo ${puntos[0]?.nombre}. ¡A darlo todo!"
  `;

  try {
    /*
     * REAL OPENAI API CALL
     * const response = await openai.chat.completions.create({
     *   model: 'gpt-3.5-turbo',
     *   messages: [{ role: 'user', content: prompt }],
     *   temperature: 0.7,
     *   max_tokens: 60,
     * });
     * const summary = response.choices[0].message.content;
    */

    // MOCK RESPONSE
    const summary = `¡Hola, ${mercaderistaId}! Tu ruta para el ${fecha} tiene ${puntos.length} paradas estratégicas, visitando lugares como ${puntos.map(p => p.nombre).join(', ')}. ¡Que sea un día de grandes resultados!`;

    res.status(200).json({ summary });

  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    res.status(500).json({ error: 'No se pudo generar el resumen.' });
  }
}
