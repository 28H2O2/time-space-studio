import type { ArtworkLocation, ArtworkLocations } from './types.ts';

export type LocationText = Partial<Pick<ArtworkLocation, 'name' | 'region' | 'note'>>;
export interface LocationOverlay {
  collection?: LocationText;
  depicted?: Record<string, LocationText>;
}

// Explicitly select translated text: sources and map targets belong to the base record.
function localizePlace<T extends ArtworkLocation>(place: T, text?: LocationText): T {
  if (!text) return place;
  const result = { ...place };
  for (const key of ['name', 'region', 'note'] as const) {
    if (text[key] !== undefined) result[key] = text[key];
  }
  return result;
}

export function localizeLocations(locations?: ArtworkLocations, overlay?: LocationOverlay): ArtworkLocations | undefined {
  if (!locations || !overlay) return locations;
  return {
    ...locations,
    collection: locations.collection && localizePlace(locations.collection, overlay.collection),
    depicted: locations.depicted?.map(place => localizePlace(place, overlay.depicted?.[place.id])),
  };
}

export function locationMapUrl(query?: string): string | undefined {
  if (!query?.trim()) return undefined;
  const params = new URLSearchParams({ api: '1', query });
  return `https://www.google.com/maps/search/?${params}`;
}
