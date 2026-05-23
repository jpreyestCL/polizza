import { describe, it, expect } from "vitest";
import {
  isWeekend,
  isBusinessDay,
  businessDaysBetween,
  addBusinessDays,
  dayKey,
} from "@/lib/working-days";

// 18 y 19 de septiembre de 2026 son feriados (Fiestas Patrias).
const holidays = new Set(["2026-09-18", "2026-09-19"]);

describe("días hábiles", () => {
  it("detecta fines de semana", () => {
    expect(isWeekend(new Date("2026-09-19T00:00:00Z"))).toBe(true); // sábado
    expect(isWeekend(new Date("2026-09-20T00:00:00Z"))).toBe(true); // domingo
    expect(isWeekend(new Date("2026-09-21T00:00:00Z"))).toBe(false); // lunes
  });

  it("excluye feriados", () => {
    expect(isBusinessDay(new Date("2026-09-18T00:00:00Z"), holidays)).toBe(
      false,
    );
    expect(isBusinessDay(new Date("2026-09-17T00:00:00Z"), holidays)).toBe(
      true,
    );
  });

  it("cuenta días hábiles entre fechas", () => {
    const from = new Date("2026-09-14T00:00:00Z"); // lunes
    const to = new Date("2026-09-21T00:00:00Z"); // lunes siguiente
    // 15, 16, 17 hábiles; 18 feriado, 19-20 fin de semana; 21 hábil → 4
    expect(businessDaysBetween(from, to, holidays)).toBe(4);
  });

  it("devuelve 0 cuando el rango no avanza", () => {
    const day = new Date("2026-09-14T00:00:00Z");
    expect(businessDaysBetween(day, day, holidays)).toBe(0);
  });

  it("suma días hábiles saltando feriados y fines de semana", () => {
    const from = new Date("2026-09-17T00:00:00Z"); // jueves
    // +1 hábil = lunes 21 (viernes 18 feriado, sáb/dom)
    expect(dayKey(addBusinessDays(from, 1, holidays))).toBe("2026-09-21");
  });
});
