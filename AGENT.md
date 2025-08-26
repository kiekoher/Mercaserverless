# Guía de Contribución

## Configuración del Entorno de Desarrollo

1.  **Clona el repositorio.**
2.  **Instala las dependencias:** `npm install`
3.  **Configura las variables de entorno locales:**
    - Para desarrollo, puedes usar un proyecto de Supabase local (con la [Supabase CLI](https://supabase.com/docs/guides/cli)) o un proyecto de desarrollo en la nube.
    - Copia `.env.example` a `.env` y rellena las credenciales.
4.  **Ejecuta el servidor de desarrollo:** `npm run dev`

## Pruebas y Calidad de Código

- Ejecuta las pruebas unitarias: `npm test`
- Ejecuta las pruebas de extremo a extremo (E2E): `npm run cy:run`
- Formatea y revisa el estilo del código: `npm run lint`
- Asegúrate de que todas las pruebas pasen antes de enviar un Pull Request.

## Estilo de Código

- Usa comillas simples y punto y coma.
- Prefiere `async/await` sobre callbacks.
- Valida y sanea toda la entrada del usuario.

## Commits y Pull Requests

- No subas secretos o credenciales al repositorio.
- Describe claramente los cambios en tus mensajes de commit y Pull Requests.
