import { generateMonthlyPlan } from '../pages/api/planificar-rutas';

describe('generateMonthlyPlan', () => {
  it('creates a plan within working days limits', () => {
    const puntos = [
      { id: 1, nombre: 'A', frecuencia_mensual: 2, minutos_servicio: 60 },
      { id: 2, nombre: 'B', frecuencia_mensual: 1, minutos_servicio: 30 },
    ];
    const plan = generateMonthlyPlan(puntos, '2024-01-01', '2024-01-10');
    expect(plan.summary.totalVisitsToPlan).toBe(3);
    expect(plan.summary.totalVisitsPlanned).toBeGreaterThan(0);
    expect(plan.dailyRoutes.length).toBeGreaterThan(0);
  });

  it('returns error when no working days', () => {
    const puntos = [
      { id: 1, nombre: 'A', frecuencia_mensual: 1, minutos_servicio: 60 },
    ];
    const plan = generateMonthlyPlan(puntos, '2024-06-08', '2024-06-09');
    expect(plan.error).toBeDefined();
  });
});
