/**
 * Map style for all of NearDear's live maps (tracking, driver, pickup picker).
 *
 * A clean, modern LIGHT theme tuned for a medical app — legible at a glance, not a
 * flat white sheet:
 *   - Soft blue-grey land (not stark white), so the map reads as a map.
 *   - White roads with a clearly visible grey OUTLINE (geometry.stroke) — this is
 *     what makes the road network show up; white-on-white with no stroke looked
 *     blank, which was the problem before.
 *   - Amber highways so main routes stand out.
 *   - Clear blue water, green parks.
 *   - POI clutter hidden — EXCEPT hospitals / medical places, which stay visible in
 *     red. For an ambulance app the nearest hospital is the one landmark worth
 *     keeping on the map.
 *
 * Passed to <MapView customMapStyle={...} /> (Google provider only). Tweak the
 * `color` values to taste, or regenerate at https://mapstyle.withgoogle.com/.
 */
export const LIGHT_MAP_STYLE = [
  // Base land + labels
  { elementType: 'geometry', stylers: [{ color: '#e9eef3' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#3c4043' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }, { weight: 2 }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },

  // Administrative — keep a faint boundary, drop parcel/neighbourhood noise
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#c9d2db' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', stylers: [{ visibility: 'off' }] },

  // POI — hidden, except medical (hospitals) which we highlight, and parks
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.medical', elementType: 'geometry', stylers: [{ visibility: 'on' }, { color: '#f8dedb' }] },
  { featureType: 'poi.medical', elementType: 'labels.text', stylers: [{ visibility: 'on' }] },
  { featureType: 'poi.medical', elementType: 'labels.text.fill', stylers: [{ color: '#c5221f' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }, { color: '#c9e6c9' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#4e7d4e' }] },

  // Roads — white fill + visible grey stroke so the network reads clearly
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#c3ccd6' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'geometry.stroke', stylers: [{ color: '#b7c1cc' }] },

  // Highways — warm amber accent so main routes pop
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#ffd08a' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#eab766' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#7a5a1e' }] },

  // Transit — off (noise for a tracking map)
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },

  // Water — clear blue
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#9ec9e8' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#43698a' }] },
];

export default LIGHT_MAP_STYLE;
