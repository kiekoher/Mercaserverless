# AGENT.MD - Directiva de Evolución para Producción

**Objetivo:** Transformar el prototipo funcional (MVP) en una solución de planificación y optimización inteligente que automatice la generación de rutas, incorpore la lógica de negocio del cliente y proporcione métricas avanzadas para la gestión de recursos.

---

### **Tarea 1: Mejora Fundacional - Expansión del Modelo de Datos**

Para habilitar las capacidades de automatización y optimización inteligente, es fundamental que el sistema comprenda todas las variables de negocio.

1.  **Crear una nueva migración de Supabase:**
    * Se generará un nuevo archivo de migración, `supabase/migrations/005_enrich_pdv_data.sql`, para actualizar el esquema de la base de datos.
2.  **Ampliar la tabla `puntos_de_venta`:**
    * Se añadirán las siguientes columnas a la tabla `puntos_de_venta` para almacenar los datos clave del negocio proporcionados:
        * `cuota` (numérico)
        * `tipologia` (texto)
        * `frecuencia_mensual` (entero)
        * `minutos_servicio` (entero)
    * La interfaz de importación masiva se actualizará para mapear estas nuevas columnas desde el archivo CSV.

---

### **Tarea 2: Desarrollo del Núcleo de Inteligencia - Módulo de Planificación Automática**

Pasaremos de una creación de rutas manual a una planificación mensual asistida por inteligencia artificial, abordando la necesidad explícita del cliente de automatización.

1.  **Crear un nuevo endpoint de API:**
    * Se desarrollará `/api/planificar-rutas`, que contendrá la lógica para la generación automática de rutas.
2.  **Implementar el "Planificador Mensual" en la Interfaz:**
    * Los supervisores podrán seleccionar un mercaderista y un período de tiempo (ej. un mes).
    * El sistema analizará todos los puntos de venta, utilizando los datos de `frecuencia_mensual` y `minutos_servicio` para distribuir las visitas de manera óptima a lo largo del mes.
    * El algoritmo de planificación respetará la restricción de **40 horas laborales por semana** por mercaderista.
    * El resultado será un calendario de rutas diarias, pre-calculadas y optimizadas, que el supervisor podrá revisar, ajustar y aprobar.

---

### **Tarea 3: Optimización Avanzada - Rutas Multimodales**

Para que la optimización de rutas sea verdaderamente efectiva en el entorno urbano de Bogotá, el sistema debe calcular la mejor ruta considerando el medio de transporte más eficiente.

1.  **Mejorar la API de Optimización:**
    * El endpoint `/api/optimize-route` será modificado para aceptar un parámetro de `modo_transporte`.
2.  **Integración con IA para Selección de Transporte:**
    * El sistema utilizará la API de Google Maps para determinar la ruta óptima, no solo en distancia, sino también en tiempo, considerando modos como `driving` (vehículo), `walking` (a pie) y `transit` (transporte público).
    * El **Planificador Mensual** podrá sugerir el modo de transporte más eficiente para cada ruta generada, permitiendo al supervisor validarlo.

---

### **Tarea 4: Visibilidad Estratégica - Dashboard de Proyección de Recursos**

El dashboard evolucionará de un simple panel de métricas a una herramienta de análisis predictivo para la gestión de la fuerza de ventas.

1.  **Enriquecer el Dashboard de Operaciones:**
    * La página del dashboard se actualizará para incluir:
        * **Gráfico de Carga de Trabajo Semanal:** Visualizará las horas de servicio asignadas por mercaderista, con una alerta si se superan las 40 horas.
        * **Indicador de Cumplimiento de Frecuencia:** Un KPI que mostrará el porcentaje de visitas planificadas frente a las requeridas.
        * **Alertas Proactivas:** Notificaciones sobre mercaderistas con sobrecarga o puntos de venta críticos sin asignar.

---

### **Tarea 5: Mejora de la Experiencia de Usuario - Visualización de Datos Clave**

Para maximizar la eficiencia de los supervisores, la información más relevante debe ser visible de forma inmediata en las interfaces de gestión.

1.  **Actualizar las Vistas de Tablas:**
    * En las páginas de gestión de puntos de venta y rutas, se añadirá:
        * **Código de Colores por Tipología:** Se utilizarán colores para diferenciar visualmente la importancia de los puntos de venta (ej. A, B, C).
        * **Columnas de Frecuencia y Minutos:** La `frecuencia_mensual` y los `minutos_servicio` serán visibles directamente en las tablas para facilitar la toma de decisiones.

Una vez completadas estas tareas, el proyecto estará alineado con la visión del cliente y listo para un despliegue de producción exitoso.
