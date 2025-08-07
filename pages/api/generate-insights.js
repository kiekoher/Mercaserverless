import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY no configurada' });
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  const supabase = createPagesServerClient({ req, res });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { rutaId } = req.body;
  if (!rutaId) {
    return res.status(400).json({ error: 'Se requiere el ID de la ruta.' });
  }

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
      `- Punto: ${v.puntos_de_venta.nombre}, Estado: ${v.estado}, Check-in: ${v.check_in_at}, Check-out: ${v.check_out_at}, Observaciones: ${v.observaciones || 'N/A'}`
    ).join('\n');

    const prompt = `
      Eres un asistente de análisis de operaciones para una fuerza de ventas.
      Analiza los siguientes datos de visitas de una ruta de un mercaderista y genera un resumen ejecutivo conciso.
      El resumen debe incluir:
      1.  Un KPI clave: Porcentaje de visitas completadas vs. con incidencia.
      2.  Un insight sobre la eficiencia: ¿Hay tiempos muertos o visitas demasiado largas/cortas?
      3.  Una observación cualitativa: ¿Qué temas comunes aparecen en las observaciones?
      4.  Una recomendación accionable para el supervisor.

      Aquí están los datos de las visitas:
      ${promptData}

      Por favor, presenta el resultado en formato de texto plano, claro y directo.
    `;

    // 3. Call the Gemini API
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // 4. Return the AI-generated summary
    res.status(200).json({ summary: text });

  } catch (error) {
    console.error('Error generating insights:', error);
    res.status(500).json({ error: 'Error al comunicarse con la API de IA o al procesar los datos.' });
  }
}
