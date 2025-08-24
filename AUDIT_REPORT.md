# Informe de Auditoría SRE y Plan de Acción para Producción

## A. Resumen Ejecutivo

El proyecto Optimizador de Rutas para Mercaderistas se encuentra en un estado avanzado y demuestra una alta madurez en su ciclo de desarrollo, lo que lo posiciona favorablemente para una transición a producción. Las fortalezas clave incluyen una **arquitectura moderna y serverless** (Next.js, Vercel, Supabase), un **pipeline de CI/CD excepcionalmente robusto** que automatiza pruebas unitarias, E2E, análisis de seguridad estático (SAST) y auditoría de dependencias, y una **documentación clara** (`README.md`, `OPERATIONS.md`). Notablemente, el equipo ha demostrado una **proactividad en seguridad** al haber identificado y corregido ya una vulnerabilidad crítica de control de acceso en las políticas de Row Level Security (RLS).

A pesar de estas fortalezas, la auditoría ha identificado varias áreas de mejora que son cruciales para garantizar la robustez y operabilidad a largo plazo del sistema. El área de mayor riesgo es la **falta de un proceso validado de recuperación ante desastres** (pruebas de restauración de backups). Las recomendaciones se centran en fortalecer esta área, mejorar la observabilidad (monitoreo y alertas) y reducir la deuda técnica menor. Con la implementación del siguiente plan de acción, la aplicación alcanzará el nivel de preparación necesario para un lanzamiento exitoso en beta cerrada.

---

## B. Plan de Acción Priorizado

| Prioridad | Descripción del Problema                                                                                             | Riesgo Asociado                                                                                                                              |
| :-------- | :------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| **Crítico** | No existe un procedimiento validado para restaurar la base de datos desde un backup.                                 | En caso de un evento de pérdida de datos (corrupción, borrado accidental), la incapacidad de restaurar el servicio resultaría en una pérdida total y permanente de los datos. |
| **Alto**    | La suite de pruebas unitarias falla en el entorno local.                                                             | Impide la validación automática de cambios, aumentando el riesgo de introducir regresiones en producción. Dificulta el desarrollo y la corrección de errores. |
| **Medio**   | Monitorización y alertas insuficientes para servicios y flujos críticos (API de IA, geocodificación, errores 5xx). | Incapacidad para detectar fallos silenciosos o degradación del servicio de forma proactiva, aumentando el tiempo de respuesta a incidentes (MTTR). |
| **Medio**   | Uso de funciones `SECURITY DEFINER` en la base de datos.                                                             | Aunque no son explotables actualmente, representan un riesgo de seguridad latente que podría facilitar una escalada de privilegios si se modifican incorrectamente en el futuro. |
| **Bajo**    | Políticas de RLS duplicadas en la tabla `profiles`.                                                                  | Aumenta la complejidad del mantenimiento y la probabilidad de introducir errores de configuración de seguridad en el futuro.                 |
| **Bajo**    | Dependencias `npm` potencialmente obsoletas.                                                                        | Paquetes no actualizados pueden contener vulnerabilidades de seguridad de bajo impacto o bugs que ya han sido corregidos en versiones más recientes. |

---

## C. Soluciones Detalladas y Desarrollo de Características

*Esta sección se desarrollará con implementaciones concretas en las siguientes fases.*

1.  **Validación de Restauración de Backups (Crítico):**
    *   **Solución:** Utilizar el dashboard de Supabase para crear un nuevo proyecto temporal. Restaurar el último backup de producción en esta nueva instancia. Documentar el proceso paso a paso, incluyendo tiempos estimados, en `OPERATIONS.md`. Realizar este simulacro de forma trimestral.

2.  **Reparación de la Suite de Pruebas (Alto):**
    *   **Problema:** Las pruebas unitarias fallan masivamente en un entorno local debido a problemas con la simulación (mocking) de servicios externos, especialmente la base de datos Supabase. La configuración de Jest y las simulaciones actuales son frágiles y no aíslan correctamente el código bajo prueba, especialmente cuando se ven afectadas por componentes de orden superior como el logger de la API.
    *   **Solución Propuesta:** Se debe realizar una refactorización integral de la estrategia de mocking. Se recomienda crear simulaciones globales y robustas para servicios clave como `requireUser` en `jest.setup.js`. Las pruebas individuales deben ser refactorizadas para usar estos mocks globales, anulando su comportamiento por defecto solo cuando sea necesario para un caso de prueba específico. Este enfoque garantiza un entorno de prueba estable y predecible.

3.  **Mejora de Monitorización y Alertas (Medio):**
    *   **Solución:** Configurar alertas en la plataforma de logging (Logtail/Better Stack) para:
        *   Tasa de errores 5xx en funciones serverless.
        *   Latencia anómala en endpoints críticos (ej. `/api/optimize-route`).
        *   Errores específicos con `level: "error"` que contengan "Geocode error" o "AI API timeout".

4.  **Refactorización de `SECURITY DEFINER` (Medio):**
    *   **Solución:** Analizar cada función (`get_my_role`, `handle_new_user`, etc.) y determinar si el privilegio elevado es estrictamente necesario. Si es posible, refactorizar a `SECURITY INVOKER` y ajustar las políticas RLS para que dependan del rol del invocador directamente.

5.  **Consolidación de Políticas RLS (Bajo):**
    *   **Solución:** Unificar las políticas de `SELECT` y `UPDATE` en la tabla `profiles` en una única política para `ALL`, simplificando la lógica a `USING (auth.uid() = id OR get_my_role() = 'admin')`.

6.  **Auditoría de Dependencias (Bajo):**
    *   **Solución:** Ejecutar `npm outdated` para listar paquetes obsoletos. Para cada uno, evaluar el riesgo y el esfuerzo de la actualización. Ejecutar `npm audit` para identificar vulnerabilidades y aplicar parches con `npm audit fix`.

---

## D. Checklist Final de Puesta en Producción

1.  [ ] **Implementar** la cabecera de `Content-Security-Policy` en `next.config.js`.
2.  [ ] **Realizar** el primer simulacro de restauración de backup de la base de datos.
3.  [ ] **Documentar** el procedimiento de restauración en `OPERATIONS.md`.
4.  [ ] **Configurar** las nuevas alertas de monitorización en la plataforma de logging.
5.  [ ] **Refactorizar** las funciones de base de datos para minimizar el uso de `SECURITY DEFINER`.
6.  [ ] **Consolidar** las políticas RLS en la tabla `profiles`.
7.  [ ] **Actualizar** las dependencias `npm` críticas o con vulnerabilidades conocidas.
8.  [ ] **Verificar** que todos los cambios pasan la suite completa de pruebas (lint, unit, E2E).
9.  [ ] **Pausar** los despliegues automáticos en Vercel.
10. [ ] **Desplegar** la última versión estable a producción.
11. [ ] **Reanudar** los despliegues automáticos.
12. [ ] **Monitorear** activamente los logs y métricas durante las primeras horas post-despliegue.
