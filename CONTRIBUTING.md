# Guía de Contribución

## Configuración del Entorno de Desarrollo

1.  **Clona el repositorio.**
2.  **Instala las dependencias:** `npm install`
3.  **Configura las variables de entorno locales:**
    - Para desarrollo, puedes usar un proyecto de Supabase local (con la [Supabase CLI](https://supabase.com/docs/guides/cli)) o un proyecto de desarrollo en la nube.
    - Copia `.env.example` a `.env` y rellena las credenciales.
4.  **Ejecuta el servidor de desarrollo:** `npm run dev`

## Pruebas y Calidad de Código

- Ejecuta las pruebas unitarias y de integración: `npm test`
- Ejecuta las pruebas E2E contra tu **entorno local**: `npm run cy:run`
- **(Avanzado)** Ejecuta las pruebas E2E contra un **despliegue de Preview en Vercel**:
  1. Abre un Pull Request. Vercel generará y comentará automáticamente una URL de preview.
  2. Ejecuta el siguiente comando en tu terminal, reemplazando la URL por la de Vercel:
     ```bash
     CYPRESS_BASE_URL=https://<tu-preview-url>.vercel.app npm run cy:run:preview
     ```
- Formatea y revisa el estilo del código: `npm run lint`
- Asegúrate de que todas las pruebas pasen antes de enviar un Pull Request.

## Estilo de Código

- Usa comillas simples y punto y coma.
- Prefiere `async/await` sobre callbacks.
- Valida y sanea toda la entrada del usuario.

## Commits y Pull Requests

- No subas secretos o credenciales al repositorio.
- Describe claramente los cambios en tus mensajes de commit y Pull Requests.
