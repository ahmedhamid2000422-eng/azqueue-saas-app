/**
 * Arrival tracking — distance & ETA helpers used by both the customer page
 * (which posts location) and the staff dashboard (which reads arrival status).
 *
 * Strategy:
 *   - Compute great-circle distance via the haversine formula (no Maps API needed)
 *   - Estimate ETA assuming 30 km/h average urban speed (good enough; we can swap
 *     in a real Directions API later without changing the consumer code)
 *   - Three states: "en_route" (>200m), "approaching" (200–30m), "arrived" (≤30m)
 */

const ARRIVED_M     = 30;    // within 30m of branch = arrived
const APPROACHING_M = 200;   // within 200m = at the door
const AVG_KMH       = 30;    // urban driving baseline

export function distanceMeters(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some((v) => v == null || isNaN(v))) return null;
  const R = 6371000; // earth radius in m
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function estimateEtaSec(distanceMeters) {
  if (distanceMeters == null) return null;
  if (distanceMeters < ARRIVED_M) return 0;
  return Math.round((distanceMeters / 1000) / AVG_KMH * 3600);
}

export function arrivalState(distanceMeters) {
  if (distanceMeters == null) return "unknown";
  if (distanceMeters <= ARRIVED_M)     return "arrived";
  if (distanceMeters <= APPROACHING_M) return "approaching";
  return "en_route";
}

export function formatDistance(meters) {
  if (meters == null) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatEta(sec) {
  if (sec == null) return "—";
  if (sec === 0) return "arrived";
  if (sec < 60) return "<1 min";
  return `${Math.round(sec / 60)} min`;
}
