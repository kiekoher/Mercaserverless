# Guía de Integración Continua y Despliegue Continuo (CI/CD)

Este documento proporciona una guía para configurar y mantener un pipeline de CI/CD robusto y seguro para este proyecto.

## 1. Auditoría de Seguridad de Dependencias

Para prevenir la introducción de nuevas vulnerabilidades a través de las dependencias de `npm`, se ha añadido un script de auditoría automatizada.

### Script

El script `audit:ci` ha sido añadido a `package.json`:

```json
"scripts": {
  ...
  "audit:ci": "npm audit --audit-level=high"
}
```

Este comando ejecuta `npm audit` y hará que el proceso falle (salga con un código de error distinto de cero) si se encuentran vulnerabilidades de severidad `alta` o `crítica`.

### Integración en el Pipeline

Este chequeo debe ser un paso obligatorio en su pipeline de CI/CD (ej. GitHub Actions, GitLab CI, Vercel Build Step). Debe ejecutarse **después** de la instalación de dependencias (`npm install` o `npm ci`) y **antes** de ejecutar los tests o el build.

**Ejemplo de Workflow (conceptual, usando sintaxis de GitHub Actions):**

```yaml
name: Deploy to Vercel

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: **Run Security Audit**
        run: npm run audit:ci  # <-- PASO CRÍTICO AÑADIDO

      - name: Run Unit Tests
        run: npm test

      - name: Build Project
        run: npm run build

      # ... El resto de los pasos de despliegue a Vercel
```

Al integrar este paso, la pipeline se detendrá automáticamente si una nueva Pull Request o un commit a `main` introduce una dependencia con una vulnerabilidad grave, forzando su corrección antes de que llegue a producción.
