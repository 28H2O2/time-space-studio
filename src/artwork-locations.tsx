import { ArrowUpRight, MapPin } from 'lucide-react';
import type { ArtworkLocation, ArtworkLocations as Locations } from './lib/types';
import { locationMapUrl } from './lib/locations';
import { useLang } from './lib/lang';

export default function ArtworkLocations({ locations }: { locations?: Locations }) {
  const { c } = useLang();
  if (!locations?.collection && !locations?.depicted?.length) return null;

  function placeDetails(place: ArtworkLocation) {
    const mapUrl = locationMapUrl(place.mapQuery);
    return <dd key={place.id}>
        <a className="location-name" href={place.sourceUrl} target="_blank" rel="noreferrer" aria-label={`${place.name}${c.colon}${c.locationSource}`}>{place.name}</a>
        {place.region && <span className="location-region"> · {place.region}</span>}
        {mapUrl && <a className="location-map" href={mapUrl} target="_blank" rel="noreferrer" aria-label={`${c.viewMap}${c.colon}${place.name} (Google Maps)`}>{c.viewMap}<ArrowUpRight size={14} aria-hidden="true" /></a>}
        {place.note && <p className="location-note">{place.note}</p>}
      </dd>;
  }

  function group(places: ArtworkLocation[], label: string, key: string) {
    return <div className="artwork-location" key={key}>
      <dt><MapPin size={16} aria-hidden="true" /><span>{label}</span></dt>
      {places.map(placeDetails)}
    </div>;
  }

  return <dl className="artwork-locations">
    {locations.collection && group([locations.collection], locations.collection.isImpression ? c.impressionLocation : c.collectionLocation, 'collection')}
    {!!locations.depicted?.length && group(locations.depicted, c.depictedLocation, 'depicted')}
  </dl>;
}
