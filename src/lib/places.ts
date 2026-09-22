// Ссылки Google по Place ID точки (страница контактов): открыть на карте и
// оставить отзыв. Виджетов карт на сайте нет (SPEC §6.5) — только ссылки.

export function placeMapUrl(placeId: string): string {
  return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`;
}

export function placeReviewUrl(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}
