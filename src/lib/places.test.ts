import { describe, expect, it } from "vitest";
import { POINTS } from "@/data/points";
import { placeMapUrl, placeReviewUrl } from "./places";

describe("ссылки Google по Place ID", () => {
  it("карта и отзыв — по форматам из задания", () => {
    expect(placeMapUrl("ChIJO-lRcwDrzEAR53WfxGtH6CA")).toBe(
      "https://www.google.com/maps/place/?q=place_id:ChIJO-lRcwDrzEAR53WfxGtH6CA",
    );
    expect(placeReviewUrl("ChIJO-lRcwDrzEAR53WfxGtH6CA")).toBe(
      "https://search.google.com/local/writereview?placeid=ChIJO-lRcwDrzEAR53WfxGtH6CA",
    );
  });

  it("у каждой точки свой Place ID нужного вида", () => {
    const ids = POINTS.map((p) => p.placeId);
    expect(new Set(ids).size).toBe(POINTS.length);
    for (const id of ids) expect(id).toMatch(/^ChIJ[\w-]{23}$/);
  });
});
