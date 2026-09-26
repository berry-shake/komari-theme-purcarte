// One-off asset generation; no map library or external tiles are needed at runtime.
// Usage: node scripts/generate-world-map.mjs source.geojson /path/to/d3-geo/src/index.js
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
const { geoEquirectangular, geoPath, geoArea } = await import(pathToFileURL(process.argv[3]).href);
const collection = JSON.parse(readFileSync(process.argv[2], "utf8"));
// Natural Earth GeoJSON uses RFC 7946 winding; d3's spherical polygons use
// clockwise exteriors for areas smaller than a hemisphere. Normalize each
// polygon before projection, otherwise a country paints the entire globe.
for (const feature of collection.features) {
  const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  for (const polygon of polygons) {
    if (geoArea({ type: "Polygon", coordinates: polygon }) > 2 * Math.PI) {
      for (const points of polygon) points.reverse();
    }
  }
}
const projection = geoEquirectangular().rotate([-12, 0, 0]).fitExtent([[12, 12], [988, 496]], collection);
const path = geoPath(projection).digits(1);
const displayNames = { CN: "中国", HK: "中国香港", MO: "中国澳门", TW: "中国台湾" };

// Simplify in geographic coordinates before projection; preserve small polygons.
function simplify(points, tolerance = 0.08) {
  if (points.length <= 4) return points;
  const first = points[0], last = points[points.length - 1];
  const dx = last[0] - first[0], dy = last[1] - first[1];
  let index = 0, max = tolerance * tolerance;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const t = dx || dy ? Math.max(0, Math.min(1, ((p[0] - first[0]) * dx + (p[1] - first[1]) * dy) / (dx * dx + dy * dy))) : 0;
    const distance = (p[0] - first[0] - t * dx) ** 2 + (p[1] - first[1] - t * dy) ** 2;
    if (distance > max) { index = i; max = distance; }
  }
  if (!index) return [first, last];
  return [...simplify(points.slice(0, index + 1), tolerance).slice(0, -1), ...simplify(points.slice(index), tolerance)];
}
function ring(points) {
  const simplified = simplify(points);
  return simplified.length >= 4 ? simplified : points;
}
function simplifyPolygon(polygon) {
  const simplified = polygon.map(ring);
  // Very small/coastal rings can become degenerate or flip spherical winding
  // after simplification. Keep those original polygons instead of the complement.
  const area = geoArea({ type: "Polygon", coordinates: simplified });
  return area > 0 && area < 2 * Math.PI ? simplified : polygon;
}
const pieces = collection.features.map(f => {
  const p = f.properties;
  const code = p.ISO_A2_EH !== "-99" ? p.ISO_A2_EH : p.ISO_A2;
  const area = geoArea(f);
  const small = area < 0.0001;
  if (f.geometry.type === "Polygon") f.geometry.coordinates = simplifyPolygon(f.geometry.coordinates);
  else f.geometry.coordinates = f.geometry.coordinates.map(simplifyPolygon);
  if (geoArea(f) > 2 * Math.PI) throw new Error(`Invalid spherical polygon: ${p.NAME}`);
  return {
    code: code === "-99" ? p.ADM0_A3 : code,
    name: displayNames[code] || p.NAME_ZH || p.NAME_EN || p.NAME,
    path: path(f),
    marker: projection([p.LABEL_X, p.LABEL_Y]).map(n => Math.round(n * 10) / 10),
    small,
    area,
  };
});
const grouped = new Map();
for (const piece of pieces) {
  const previous = grouped.get(piece.code);
  grouped.set(piece.code, previous ? {
    ...(piece.area > previous.area ? piece : previous),
    path: previous.path + piece.path,
  } : piece);
}
const paths = [...grouped.values()].sort((a, b) => a.code.localeCompare(b.code)).map(({ area: _area, ...region }) => region);
const dir = new URL("../src/assets/", import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL("world-map.json", dir), JSON.stringify({ width: 1000, height: 508, regions: paths }) + "\n");
// A separate tiny index keeps the large geometry out of the initial bundle.
writeFileSync(new URL("world-regions.json", dir), JSON.stringify(Object.fromEntries(paths.filter(p => /^[A-Z]{2}$/.test(p.code)).map(p => [p.code, p.name]))) + "\n");
console.log(`Generated ${paths.length} regions`);
