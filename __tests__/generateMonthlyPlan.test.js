jest.mock('../lib/logger.server', () => ({
  warn: jest.fn(),
}));

import { generateMonthlyPlan } from '../pages/api/planificar-rutas';
import logger from '../lib/logger.server';

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

  it('logs unplanned visits when capacity exceeded', () => {
    const puntos = Array.from({ length: 10 }).map((_, i) => ({
      id: i + 1,
      nombre: `P${i + 1}`,
      frecuencia_mensual: 1,
      minutos_servicio: 480,
    }));
    const plan = generateMonthlyPlan(puntos, '2024-01-01', '2024-01-05');
    expect(plan.summary.totalVisitsPlanned).toBeLessThan(plan.summary.totalVisitsToPlan);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('handles empty points array', () => {
    const plan = generateMonthlyPlan([], '2024-01-01', '2024-01-31');
    expect(plan.summary.totalVisitsToPlan).toBe(0);
    expect(plan.summary.totalVisitsPlanned).toBe(0);
  });

  it('handles long planning periods', () => {
    const puntos = [
      { id: 1, nombre: 'A', frecuencia_mensual: 1, minutos_servicio: 60 },
    ];
    const plan = generateMonthlyPlan(puntos, '2024-01-01', '2024-03-31');
    expect(plan.summary.workingDays).toBeGreaterThan(40);
  });
});
