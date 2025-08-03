import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { puntos } = req.body; // Expects an array of point-of-sale objects

  if (!puntos || !Array.isArray(puntos) || puntos.length < 2) {
    return res.status(400).json({ error: 'Se requiere una lista de al menos 2 puntos de venta.' });
  }

  const prompt = `
    Eres un experto en logística para la ciudad de Bogotá, Colombia.
    Tu tarea es optimizar una ruta de visitas para un mercaderista.
    Dada la siguiente lista de puntos de venta (con su nombre y dirección), reordénala para crear la ruta más lógica y eficiente posible, minimizando los desplazamientos.
    No agregues ni elimines ningún punto de venta. Devuelve la lista reordenada en formato JSON.
    El JSON de salida debe ser un array de objetos, donde cada objeto tiene exactamente las mismas propiedades que los objetos de entrada ('id', 'nombre', 'direccion', 'ciudad').

    Puntos de venta a optimizar:
    ${JSON.stringify(puntos, null, 2)}

    Responde únicamente con el array JSON reordenado, sin texto adicional ni markdown.
  `;

  try {
    /*
     * REAL GEMINI API CALL
     * const model = genAI.getGenerativeModel({ model: "gemini-pro" });
     * const result = await model.generateContent(prompt);
     * const response = await result.response;
     * const text = response.text().replace(/```json|```/g, '').trim(); // Clean up potential markdown
     * const optimizedPuntos = JSON.parse(text);
    */

    // MOCK RESPONSE
    // To simulate a reordering, we'll just reverse the list.
    const optimizedPuntos = [...puntos].reverse();

    res.status(200).json({ optimizedPuntos });

  } catch (error) {
    console.error('Error calling Gemini for optimization:', error);
    res.status(500).json({ error: 'No se pudo optimizar la ruta.' });
  }
}
