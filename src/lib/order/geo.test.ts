import { describe, expect, it } from "vitest";
import { distanceKm, formatKm } from "./geo";

describe("расстояние до точки", () => {
  it("по формуле гаверсинуса: 0,01° широты ≈ 1,11 km", () => {
    const d = distanceKm(
      { lat: 48.15, lng: 28.29 },
      { lat: 48.16, lng: 28.29 },
    );
    expect(d).toBeCloseTo(1.112, 2);
  });

  it("«~1,2 km» / «~1,2 км», меньше 100 м — «~0,1»", () => {
    expect(formatKm("ro", 1.234, "km")).toBe("~1,2 km");
    expect(formatKm("ru", 1.234, "км")).toBe("~1,2 км");
    expect(formatKm("ro", 0.02, "km")).toBe("~0,1 km");
    expect(formatKm("ro", 12.46, "km")).toBe("~12 km");
  });
});
