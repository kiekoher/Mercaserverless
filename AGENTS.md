# Project Guidelines

## Setup
- Install dependencies: `npm install`
- Run unit tests: `npm test`
- Run end-to-end tests: `npm run cy:run`
- Lint code: `npm run lint`

## Code Style
- Use single quotes and semicolons.
- Prefer async/await over callbacks.
- Validate and sanitize all user input.

## Testing
- Provide tests for new or modified endpoints.
- Mock external services such as Supabase or Google APIs.

## Git
- Do not commit secrets or credentials.
- Ensure `npm test` and `npm run cy:run` pass before pushing.
