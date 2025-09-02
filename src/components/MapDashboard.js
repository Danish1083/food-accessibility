import { useRef, useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";
import axios from "axios";
import * as turf from "@turf/turf";
import Sidebar from "./Sidebar";
import "mapbox-gl/dist/mapbox-gl.css";
import "./MapDashboard.css";

const PLUS_CURSOR =
  `url("data:image/svg+xml;utf8,` +
  `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'>` +
  `<line x1='12' y1='2' x2='12' y2='22' stroke='%23cc0000' stroke-width='3'/>` +
  `<line x1='2' y1='12' x2='22' y2='12' stroke='%23cc0000' stroke-width='3'/>` +
  `</svg>") 12 12, crosshair`;

mapboxgl.accessToken =
  "pk.eyJ1IjoiZGFuaXNoMTA4MyIsImEiOiJjbHh0eDJhOGYwYm1hMmlzYXBvNmhsdXk2In0.7-j8U59ERuj0A4oURgIh-g";

const BASEMAPS = [
  { label: "Streets", style: "mapbox://styles/mapbox/streets-v12" },
  { label: "Satellite", style: "mapbox://styles/mapbox/satellite-v9" },
  { label: "Outdoors", style: "mapbox://styles/mapbox/outdoors-v12" },
  { label: "Light", style: "mapbox://styles/mapbox/light-v11" },
  { label: "Dark", style: "mapbox://styles/mapbox/dark-v11" },
];

const LAYERS = [
  {
    id: "citylimits",
    label: "City Limits"
    // no shape, no color, no imagePath
  },
  {
    id: "neighbourhoods",
    label: "Neighbourhoods"
    // no shape, no color, no imagePath
  },
  {
    id: "convenience-stores",
    label: "Convenience Stores",
    url: "http://localhost:4000/api/geo/conveniencestores",
    color: "#f1c40f",
    shape: "circle", // Built-in circle shape
  },
  {
    id: "grocery-stores",
    label: "Grocery Stores",
    url: "http://localhost:4000/api/geo/grocerystores",
    color: "#3498db",
    shape: "square", // Built-in square shape
  },
  {
    id: "restaurants",
    label: "Restaurants",
    url: "http://localhost:4000/api/geo/restaurants",
    color: "#27ae60",
    shape: "triangle", // Built-in triangle shape
  },
  {
    id: "emergency-food",
    label: "Emergency Food",
    url: "http://localhost:4000/api/geo/emergencyfood",
    color: "#e74c3c",
    shape: "star", // Built-in star shape
  },
  {
    id: "speciality-stores",
    label: "Speciality Stores",
    url: "http://localhost:4000/api/geo/specialitystores",
    color: "#9b59b6",
    shape: "hexagon", // Built-in hexagon shape
  },
  {
    id: "transitstops",
    label: "Transit Stops",
    url: "http://localhost:4000/api/geo/transitstops",
    color: "#ff0080",
    shape: "custom-image", // Custom image
    imagePath: "./assets/bus-icon.png",
  }
];

// Function to create SVG shapes as data URLs
const createSVGShape = (shape, color, size = 20) => {
  let svgContent = '';
  const halfSize = size / 2;
  
  switch (shape) {
    case 'square':
      svgContent = `<rect x="2" y="2" width="${size-4}" height="${size-4}" fill="${color}" stroke="white" stroke-width="2"/>`;
      break;
    case 'triangle':
      svgContent = `<polygon points="${halfSize},2 ${size-2},${size-2} 2,${size-2}" fill="${color}" stroke="white" stroke-width="2"/>`;
      break;
    case 'star':
      const points = [];
      for (let i = 0; i < 10; i++) {
        const angle = (i * Math.PI) / 5;
        const radius = i % 2 === 0 ? halfSize - 2 : (halfSize - 2) * 0.5;
        const x = halfSize + radius * Math.cos(angle - Math.PI / 2);
        const y = halfSize + radius * Math.sin(angle - Math.PI / 2);
        points.push(`${x},${y}`);
      }
      svgContent = `<polygon points="${points.join(' ')}" fill="${color}" stroke="white" stroke-width="2"/>`;
      break;
    case 'hexagon':
      const hexPoints = [];
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const x = halfSize + (halfSize - 3) * Math.cos(angle);
        const y = halfSize + (halfSize - 3) * Math.sin(angle);
        hexPoints.push(`${x},${y}`);
      }
      svgContent = `<polygon points="${hexPoints.join(' ')}" fill="${color}" stroke="white" stroke-width="2"/>`;
      break;
    default: // circle
      svgContent = `<circle cx="${halfSize}" cy="${halfSize}" r="${halfSize-2}" fill="${color}" stroke="white" stroke-width="2"/>`;
  }
  
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">${svgContent}</svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

// Build a geodesic circle (buffer) polygon around [lng,lat].
function geodesicCircle(lng, lat, radiusMeters = 1000, steps = 64) {
  const R = 6371000; // Earth radius in meters
  const centerLat = (lat * Math.PI) / 180;
  const centerLng = (lng * Math.PI) / 180;
  const dByR = radiusMeters / R;

  const coords = [];
  for (let i = 0; i <= steps; i++) {
    const bearing = (i * 2 * Math.PI) / steps;
    const sinLat = Math.sin(centerLat) * Math.cos(dByR) +
                   Math.cos(centerLat) * Math.sin(dByR) * Math.cos(bearing);
    const lat2 = Math.asin(sinLat);

    const y = Math.sin(bearing) * Math.sin(dByR) * Math.cos(centerLat);
    const x = Math.cos(dByR) - Math.sin(centerLat) * Math.sin(lat2);
    const lng2 = centerLng + Math.atan2(y, x);

    coords.push([(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI]);
  }

  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [coords] },
    properties: { radius_m: radiusMeters },
  };
}

export default function MapDashboard() {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const [visibleLayers, setVisibleLayers] = useState(LAYERS.map((l) => l.id));
  const [basemap, setBasemap] = useState(BASEMAPS[0].style);

  const [accessibilityActive, setAccessibilityActive] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState(null); // {lng, lat} | null
  const selectedPointRef = useRef(null);  // FeatureCollection for point
  const bufferRef = useRef(null);         // FeatureCollection for buffer
  const cursorLockedRef = useRef(false);
  const [accessibilityResults, setAccessibilityResults] = useState([]);
 const [selectedDemographic, setSelectedDemographic] = useState(null);
  const demographicsFCRef = useRef(null); // cache FeatureCollection from endpoint
  const LEGEND_ID = "legend-box";
    function quantileBreaks(values, k = 5) {
    if (!values.length) return [];
    const sorted = [...values].sort((a, b) => a - b);
    const qs = [];
    for (let i = 1; i < k; i++) {
      const pos = (i * (sorted.length - 1)) / k;
      const base = Math.floor(pos);
      const rest = pos - base;
      const val =
        sorted[base] + (rest > 0 ? (sorted[base + 1] - sorted[base]) * rest : 0);
      qs.push(val);
    }
    return qs; // k-1 thresholds
  }
  function formatNum(n) {
  if (!Number.isFinite(n)) return String(n);
  const abs = Math.abs(n);
  if (abs >= 1000) return n.toFixed(0);
  if (abs >= 100)  return n.toFixed(1);
  if (abs >= 10)   return n.toFixed(2);
  if (abs >= 1)    return n.toFixed(2);
  return n.toFixed(3);
}
function jenksBreaks(values, k = 5) {
  const data = [...values].sort((a, b) => a - b);
  const n = data.length;
  if (n === 0) return [];
  if (k <= 1) return [data[0], data[n - 1]];
  if (k > n) k = n;

  // matrices
  const mat1 = Array(n + 1).fill(0).map(() => Array(k + 1).fill(0));
  const mat2 = Array(n + 1).fill(0).map(() => Array(k + 1).fill(Infinity));

  // init
  for (let j = 1; j <= k; j++) {
    mat1[0][j] = 1;
    mat2[0][j] = 0;
  }

  for (let i = 1; i <= n; i++) {
    let s1 = 0, s2 = 0, w = 0;
    for (let m = 1; m <= i; m++) {
      const i3 = i - m + 1;
      const val = data[i3 - 1];
      s1 += val;
      s2 += val * val;
      w += 1;
      const variance = s2 - (s1 * s1) / w;
      if (i3 > 1) {
        for (let j = 2; j <= k; j++) {
          if (mat2[i][j] >= variance + mat2[i3 - 2][j - 1]) {
            mat1[i][j] = i3;
            mat2[i][j] = variance + mat2[i3 - 2][j - 1];
          }
        }
      }
    }
    mat1[i][1] = 1;
    mat2[i][1] = s2 - (s1 * s1) / w;
  }

  const breaks = Array(k + 1).fill(0);
  breaks[k] = data[n - 1];
  breaks[0] = data[0];

  let countK = k;
  let idx = n;
  while (countK > 1) {
    const id = mat1[idx][countK] - 1;
    breaks[countK - 1] = data[id];
    idx = id;
    countK--;
  }
  return breaks;
}
function buildJenksRanges(values, k = 5) {
  const brks = jenksBreaks(values, k);         // length k+1
  const ranges = [];
  for (let i = 0; i < brks.length - 1; i++) {
    ranges.push({ lower: brks[i], upper: brks[i + 1] });
  }
  return ranges;
}

function buildJenksCaseExpression(field, ranges) {
  const v = ["to-number", ["get", field]];
  const expr = ["case",
    ["==", v, -99], NODATA_COLOR
  ];
  ranges.forEach((r, i) => {
    expr.push(["<=", v, r.upper]);
    expr.push(CLASS_COLORS[i]);
  });
  // fallback (shouldn't hit unless FP round): darkest
  expr.push(CLASS_COLORS[CLASS_COLORS.length - 1]);
  return expr;
}

// ===== Legend that mirrors EXACT ranges used on the map =====
function labelsFromRanges(ranges) {
  if (!ranges || !ranges.length) return [];
  const lbls = [];
  // 1st bin: [min, upper1]  (inclusive)
  lbls.push(`[${formatNum(ranges[0].lower)}, ${formatNum(ranges[0].upper)}]`);
  for (let i = 1; i < ranges.length; i++) {
    // next bins: (prevUpper, upper]  (exclusive lower, inclusive upper)
    lbls.push(`(${formatNum(ranges[i - 1].upper)}, ${formatNum(ranges[i].upper)}]`);
  }
  return lbls;
}

    const CLASS_COLORS = ["#f7fbff","#c6dbef","#6baed6","#3182bd","#08519c"];
  const NODATA_COLOR = "#9e9e9e";
 function buildChoroplethExpression(field, breaks) {
    // style: step(expression, color for < firstBreak, firstBreak, nextColor, ...)
    // Values come in as strings; coerce with to-number
    const expr = ["step", ["to-number", ["get", field]], CLASS_COLORS[0]];

    breaks.forEach((t, i) => {
      expr.push(t);
      expr.push(CLASS_COLORS[i + 1]);
    });

    // Special color for -99
    // We’ll wrap the whole thing with a conditional: if value == -99 use gray else use step()
    return [
      "case",
      ["==", ["to-number", ["get", field]], -99],
      NODATA_COLOR,
      expr
    ];
  }

  function formatRange(n) {
    // compact pretty print
    const x = Math.abs(n) >= 100 ? n.toFixed(0) : Math.abs(n) >= 10 ? n.toFixed(1) : n.toFixed(2);
    return x.replace(/\.00$/, "");
  }

 function updateLegendExact(field, ranges) {
  const box = document.getElementById("legend-box");
  if (!box) return;

  if (!ranges || !ranges.length) {
    box.innerHTML = "";
    return;
  }
  const labels = labelsFromRanges(ranges);

  box.innerHTML = `
    <div class="legend-title">${field}</div>
    <div class="legend-rows">
      ${labels.map((txt, i) => `
        <div class="legend-row">
          <span class="legend-swatch" style="background:${CLASS_COLORS[i]}"></span>
          <span class="legend-text">${txt}</span>
        </div>`).join("")}
      <div class="legend-row">
        <span class="legend-swatch" style="background:${NODATA_COLOR}"></span>
        <span class="legend-text">No data (-99)</span>
      </div>
    </div>
    <div style="font-size:11px;color:#5c6a7b;margin-top:6px;">
      Binning: Natural Breaks (Jenks). Ranges are exact and match the map.
    </div>
  `;
}
   async function ensureDemographicsSource(map) {
    if (map.getSource("demographics")) return;
    // Fetch once and cache
    if (!demographicsFCRef.current) {
      const res = await axios.get("http://localhost:4000/api/geo/nbcensus6factors");
      demographicsFCRef.current = res.data; // FeatureCollection
    }
    map.addSource("demographics", { type: "geojson", data: demographicsFCRef.current });
  }

async function drawChoropleth(field) {
  const map = mapRef.current;
  if (!map) return;
  await ensureDemographicsSource(map);

  // Gather values; ignore -99 for classification
  const values = [];
  const features = demographicsFCRef.current.features || [];

  // Debug arrays (so you can verify in console)
  const rawAudit = [];

  for (const f of features) {
    const raw = f?.properties?.[field];
    const num = Number(raw);
    rawAudit.push({
      neighborhood: f?.properties?.neighborhood ?? f?.properties?.name ?? "",
      raw,
      num
    });
    if (Number.isFinite(num) && num !== -99) values.push(num);
  }

  // Edge: no valid values
  if (!values.length) {
    if (map.getLayer("demographics-fill")) map.removeLayer("demographics-fill");
    if (map.getLayer("demographics-outline")) map.removeLayer("demographics-outline");
    updateLegendExact(field, []);
    console.warn(`[${field}] No valid (non -99) values found.`);
    return;
  }

  // Build Jenks ranges
  const ranges = buildJenksRanges(values, 5); // 5 classes
  const fillExpr = buildJenksCaseExpression(field, ranges);

  // Add/update layers
  if (!map.getLayer("demographics-fill")) {
    map.addLayer({
      id: "demographics-fill",
      type: "fill",
      source: "demographics",
      paint: {
        "fill-color": fillExpr,
        "fill-opacity": 0.72,
        "fill-outline-color": "#444"
      }
    });
  } else {
    map.setPaintProperty("demographics-fill", "fill-color", fillExpr);
  }

  if (!map.getLayer("demographics-outline")) {
    map.addLayer({
      id: "demographics-outline",
      type: "line",
      source: "demographics",
      paint: {
        "line-color": "#555",
        "line-width": 0.8,
        "line-opacity": 0.9
      }
    });
  }

  // ======= DEBUG / VERIFICATION you asked for =======
  // Count how many features land in each bin (exactly like the map)
  const counts = new Array(ranges.length).fill(0);
  for (const f of features) {
    const v = Number(f?.properties?.[field]);
    if (!Number.isFinite(v) || v === -99) continue;
    for (let i = 0; i < ranges.length; i++) {
      const isInBin = i === 0
        ? (v >= ranges[i].lower && v <= ranges[i].upper)                // [lower, upper]
        : (v > ranges[i - 1].upper && v <= ranges[i].upper);            // (prevUpper, upper]
      if (isInBin) { counts[i]++; break; }
    }
  }

  // Print an audit table you can trust
  const table = ranges.map((r, idx) => ({
    class: idx + 1,
    interval: idx === 0
      ? `[${formatNum(r.lower)}, ${formatNum(r.upper)}]`
      : `(${formatNum(ranges[idx - 1].upper)}, ${formatNum(r.upper)}]`,
    count: counts[idx]
  }));
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  console.groupCollapsed(`Choropleth (${field}) — Jenks audit`);
  console.log("Min:", minVal, "Max:", maxVal);
  console.table(table);
  // If you want to inspect original rows:
  // console.log("Raw audit (first 50):", rawAudit.slice(0, 50));
  console.groupEnd();

  // Update legend so it matches EXACTLY what the map uses
  updateLegendExact(field, ranges);
}


  function clearChoropleth() {
    const map = mapRef.current;
    if (!map) return;
    if (map.getLayer("demographics-fill")) map.removeLayer("demographics-fill");
    if (map.getLayer("demographics-outline")) map.removeLayer("demographics-outline");
    const container = document.getElementById(LEGEND_ID);
    if (container) container.innerHTML = "";
  }
  function lockCursorToPlus() {
    const map = mapRef.current;
    if (!map) return;
    const canvas = map.getCanvas();
    cursorLockedRef.current = true;
    canvas.classList.add("cursor-plus"); // CSS wins with !important
  }

  function unlockCursor() {
    const map = mapRef.current;
    if (!map) return;
    const canvas = map.getCanvas();
    cursorLockedRef.current = false;
    canvas.classList.remove("cursor-plus");
    canvas.style.cursor = ""; // restore default
  }

  const HEATMAP_CATEGORIES = [
    {
      id: "convenience-stores",
      label: "Convenience Stores",
      color: "#f1c40f",
      shape: "circle",
      desc: "Show density of convenience stores.",
    },
    {
      id: "grocery-stores",
      label: "Grocery Stores",
      color: "#3498db",
      shape: "square",
      desc: "Show density of grocery stores.",
    },
    {
      id: "restaurants",
      label: "Restaurants",
      color: "#27ae60",
      shape: "triangle",
      desc: "Show density of restaurants.",
    },
    {
      id: "emergency-food",
      label: "Emergency Food",
      color: "#e74c3c",
      shape: "star",
      desc: "Show density of emergency food locations.",
    },
    {
      id: "speciality-stores",
      label: "Speciality Stores",
      color: "#9b59b6",
      shape: "hexagon",
      desc: "Show density of speciality food stores.",
    },
  ];

  const [activeHeatmaps, setActiveHeatmaps] = useState([]);

  // Toggle layer visibility
  const handleToggleLayer = (layerId) => {
    setVisibleLayers((prev) =>
      prev.includes(layerId)
        ? prev.filter((id) => id !== layerId)
        : [...prev, layerId]
    );
  };

  // Change basemap style
  const handleBasemapChange = (style) => {
    setBasemap(style);
  };

  function clearUserGraphics() {
    const map = mapRef.current;
    if (!map) return;

    const emptyFC = { type: "FeatureCollection", features: [] };
    const p = map.getSource("user-point");
    const b = map.getSource("user-buffer");
    const r = map.getSource("user-route");
    if (p) p.setData(emptyFC);
    if (b) b.setData(emptyFC);
    if (r) r.setData(emptyFC);

    selectedPointRef.current = null;
    bufferRef.current = null;
    setAccessibilityResults([]);
  }

  function attachOneTimeClick() {
    const map = mapRef.current;
    if (!map) return;

    map.once("click", async (e) => {
      const { lng, lat } = e.lngLat;
      setSelectedCoords({ lng, lat });

      // Build point FC
      const pointFC = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [lng, lat] },
            properties: {},
          },
        ],
      };
      selectedPointRef.current = pointFC;

      // Build 1 km geodesic buffer polygon
      const circle = geodesicCircle(lng, lat, 1000, 96);
      const bufferFC = { type: "FeatureCollection", features: [circle] };
      bufferRef.current = bufferFC;

      // Push to map
      const ps = map.getSource("user-point");
      const bs = map.getSource("user-buffer");
      if (ps) ps.setData(pointFC);
      if (bs) bs.setData(bufferFC);

      // Optionally revert cursor to default after capture
      map.getCanvas().style.cursor = "";
      // Keep button in "Reset" state until user clicks Reset

      // Collect intersecting points
      const intersectingPoints = [];
      const bufferPolygon = bufferRef.current.features[0].geometry; // Polygon
      const center = [lng, lat];

      LAYERS.forEach(layer => {
        if (!visibleLayers.includes(layer.id)) return;
        if (["citylimits", "neighbourhoods"].includes(layer.id)) return;

        const source = map.getSource(layer.id);
        if (!source) return;
        const data = source._data; // GeoJSON

        data.features.forEach(feature => {
          const pointCoords = feature.geometry.coordinates;
          if (turf.booleanPointInPolygon(pointCoords, bufferPolygon)) {
            const props = feature.properties;
            const name = props.Name || props.name || props.store_name || props.stop_name || "Unknown";
            intersectingPoints.push({
              layer: layer.label,
              name,
              coords: pointCoords,
              properties: props
            });
          }
        });
      });

      // Get walking distances and routes
      const promises = intersectingPoints.map(async (point) => {
        const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${center[0]},${center[1]};${point.coords[0]},${point.coords[1]}?geometries=geojson&access_token=${mapboxgl.accessToken}`;
        try {
          const res = await axios.get(url);
          const route = res.data.routes[0];
          const distanceMeters = route.distance;
          return { ...point, distance: Math.round(distanceMeters), routeGeometry: route.geometry };
        } catch (err) {
          console.error(err);
          return { ...point, distance: 'Error', routeGeometry: null };
        }
      });

      const results = await Promise.all(promises);
      setAccessibilityResults(results);
    });
  }

  function handleToggleAccessibility() {
    const map = mapRef.current;
    if (!map) return;

    if (!accessibilityActive) {
      // Going from idle -> active
      setAccessibilityActive(true);
      setSelectedCoords(null);
      clearUserGraphics();
      map.getCanvas().style.cursor = PLUS_CURSOR;
      attachOneTimeClick(); // wait for one click
    } else {
      // Reset
      setAccessibilityActive(false);
      setSelectedCoords(null);
      clearUserGraphics();
      map.getCanvas().style.cursor = "";
    }
  }

  const showRoute = (result) => {
    const map = mapRef.current;
    if (!map || !result.routeGeometry) return;

    const routeFeature = {
      type: 'Feature',
      geometry: result.routeGeometry,
      properties: {}
    };

    const routeSource = map.getSource('user-route');
    if (routeSource) {
      routeSource.setData({
        type: 'FeatureCollection',
        features: [routeFeature]
      });
    }

    // Zoom to the route
    const bbox = turf.bbox(routeFeature);
    map.fitBounds(bbox, { padding: 50 });
  };

  // Initialize map and fetch data once
  useEffect(() => {
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      center: [-104.6189, 50.4452],
      zoom: 10.5,
      style: basemap,
    });
    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", async () => {
      // Load custom images first
      const loadCustomImages = async () => {
        for (let layer of LAYERS) {
          if (layer.shape === 'custom-image' && layer.imagePath) {
            try {
              // Load image from local path
              const image = new Image();
              image.crossOrigin = 'anonymous';
              
              await new Promise((resolve, reject) => {
                image.onload = () => {
                  // Add image to map
                  if (!map.hasImage(layer.id + '-icon')) {
                    map.addImage(layer.id + '-icon', image);
                  }
                  resolve();
                };
                image.onerror = reject;
                image.src = layer.imagePath;
              });
            } catch (error) {
              console.error(`Error loading custom image for ${layer.label}:`, error);
              console.log(`Make sure your image is in the public folder: public/assets/bus-icon.png`);
            }
          } else if (layer.shape && layer.shape !== 'circle') {
            // Create SVG shapes for built-in shapes
            try {
              const svgDataUrl = createSVGShape(layer.shape, layer.color);
              const image = new Image();
              
              await new Promise((resolve, reject) => {
                image.onload = () => {
                  if (!map.hasImage(layer.id + '-shape')) {
                    map.addImage(layer.id + '-shape', image);
                  }
                  resolve();
                };
                image.onerror = reject;
                image.src = svgDataUrl;
              });
            } catch (error) {
              console.error(`Error creating shape for ${layer.label}:`, error);
            }
          }
        }
      };

      // Load all custom images and shapes
      await loadCustomImages();

      // 1. City Limits
      try {
        const cityResponse = await axios.get("http://localhost:4000/api/geo/citylimits");
        map.addSource("citylimits", { type: "geojson", data: cityResponse.data });

        map.addLayer({
          id: "citylimits-line",
          type: "line",
          source: "citylimits",
          paint: {
            "line-color": "#114b07",
            "line-width": 3,
            "line-opacity": 0.85,
          },
          layout: {
            visibility: visibleLayers.includes("citylimits") ? "visible" : "none",
          },
        });
      } catch (error) {
        console.error("Error loading City Limits:", error);
      }

      // 2. Neighbourhoods
      try {
      const neighResponse = await axios.get("http://localhost:4000/api/geo/neighbourhoods");

// stable color from a string (name) so colors don't shuffle every reload
function stableColorFromString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 70%)`;
}

// choose a name key (fallbacks)
const NAME_KEYS = [
  "Boundary_Name","BOUNDARY_NAME","BOUNDARY_N","NSA_NA","NSA_NAME",
  "Name","NAME","name","neighbourhood","neighborhood","NB_NAME","NBNAME"
];

const neighData = neighResponse.data; // FeatureCollection
neighData.features.forEach(f => {
  const p = f.properties || {};
  let nm = "Unknown";
  for (const k of NAME_KEYS) {
    if (p[k] !== undefined && p[k] !== null && `${p[k]}`.trim() !== "") { nm = `${p[k]}`.trim(); break; }
  }
  f.properties = { ...p, fillClr: stableColorFromString(nm) };
});

map.addSource("neighbourhoods", { type: "geojson", data: neighData });


        map.addLayer({
          id: "neighbourhoods-fill",
          type: "fill",
          source: "neighbourhoods",
          paint: {
       "fill-color": ["get", "fillClr"],
            "fill-opacity": 0.4,
            "fill-outline-color": "#444",
          },
          layout: {
            visibility: visibleLayers.includes("neighbourhoods") ? "visible" : "none",
          },
        });

        // Add popup for neighbourhoods
      map.on("click", "neighbourhoods-fill", (e) => {
  const props = e.features[0].properties;

  // Try multiple likely property names
  const neighName =
    props.Boundary_Name ||
    props.BOUNDARY_N ||
    props.NSA_NA ||
    props.Name ||
    props.name ||
    "Unknown";

  const popupContent = `
    <div style="font-family: Arial, sans-serif;">
      <h4 style="margin: 0 0 8px 0; color: #333;">Neighbourhood</h4>
      <p style="margin: 2px 0;"><strong>Name:</strong> ${neighName}</p>
    </div>
  `;

  new mapboxgl.Popup().setLngLat(e.lngLat).setHTML(popupContent).addTo(map);
});


        // Change cursor on hover for neighbourhoods
        map.on("mouseenter", "neighbourhoods-fill", () => {
          map.getCanvas().style.cursor = "pointer";
        });

        map.on("mouseleave", "neighbourhoods-fill", () => {
          map.getCanvas().style.cursor = "";
        });
      } catch (error) { 
        console.error("Error loading Neighbourhoods:", error); 
      }

      // 3. Point Layers with Custom Shapes
      for (let layer of LAYERS) {
        if (["citylimits", "neighbourhoods"].includes(layer.id)) continue;
        
        try {
          const response = await axios.get(layer.url);
          map.addSource(layer.id, { type: "geojson", data: response.data });
          
          const layerId = layer.id + "-layer";
          
          // Determine layer type and styling based on shape
          if (layer.shape === 'custom-image') {
            // Use symbol layer for custom images
            map.addLayer({
              id: layerId,
              type: "symbol",
              source: layer.id,
              layout: {
                "icon-image": layer.id + '-icon',
                "icon-size": 0.07,
                "icon-allow-overlap": true,
                visibility: visibleLayers.includes(layer.id) ? "visible" : "none",
              },
            });
          } else if (layer.shape && layer.shape !== 'circle') {
            // Use symbol layer for custom SVG shapes
            map.addLayer({
              id: layerId,
              type: "symbol",
              source: layer.id,
              layout: {
                "icon-image": layer.id + '-shape',
             "icon-size": 
  layer.shape === 'star' ? 1.3 :         // bigger star
  layer.shape === 'triangle' ? 0.9 :     // smaller triangle
  layer.shape === 'square' ? 0.9 :       // smaller square
  1,                                     // all others normal

                "icon-allow-overlap": true,
                visibility: visibleLayers.includes(layer.id) ? "visible" : "none",
              },
            });
          } else {
            // Use circle layer for default circles
            map.addLayer({
              id: layerId,
              type: "circle",
              source: layer.id,
              paint: {
                "circle-radius": 7,
                "circle-color": layer.color,
                "circle-stroke-width": 2,
                "circle-stroke-color": "#fff",
              },
              layout: {
                visibility: visibleLayers.includes(layer.id) ? "visible" : "none",
              },
            });
          }

          // Add popup functionality for each point layer
      map.on("click", layerId, (e) => {
  const feature = e.features[0];
  const coordinates = feature.geometry.coordinates.slice();
  const properties = feature.properties;

  // helper to read the first available key
  const getProp = (obj, keys, fallback = "N/A") => {
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
    }
    return fallback;
  };

  let popupContent = `<div style="font-family: Arial, sans-serif;">`;

  if (layer.id === "transitstops") {
    // Fixed black heading "Transit Stop" and only 3 fields
    const name = getProp(properties, ["Name", "stop_name", "name"]);
    const onstreet = getProp(properties, ["onstreet", "on_street", "onStreet"]);
    const atstreet = getProp(properties, ["atstreet", "at_street", "atStreet"]);

    popupContent += `<h4 style="margin:0 0 8px 0; color:#000;">Transit Stop</h4>`;
    popupContent += `<p style="margin:2px 0;"><strong>Name:</strong> ${name}</p>`;
    popupContent += `<p style="margin:2px 0;"><strong>onstreet:</strong> ${onstreet}</p>`;
    popupContent += `<p style="margin:2px 0;"><strong>atstreet:</strong> ${atstreet}</p>`;
  } else {
    // For all other store layers: only Name & Address
    const name = getProp(properties, ["Name", "name", "store_name", "stop_name"]);
    const address = getProp(properties, ["Address", "address", "street_address", "addr", "Street", "street"]);

    popupContent += `<h4 style="margin:0 0 8px 0; color:#000;">${layer.label}</h4>`;
    popupContent += `<p style="margin:2px 0;"><strong>Name:</strong> ${name}</p>`;
    popupContent += `<p style="margin:2px 0;"><strong>Address:</strong> ${address}</p>`;
  }

  popupContent += `</div>`;

  // keep popup over the copy being clicked
  while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
    coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
  }

  new mapboxgl.Popup().setLngLat(coordinates).setHTML(popupContent).addTo(map);
});


          // Change cursor on hover
          map.on("mouseenter", layerId, () => {
            map.getCanvas().style.cursor = "pointer";
          });

          map.on("mouseleave", layerId, () => {
            map.getCanvas().style.cursor = "";
          });

        } catch (error) {
          console.error(`Error loading ${layer.label}:`, error);
        }
      }

      // FIXED: Moved user-point and user-buffer sources/layers outside the for loop to prevent duplicate source errors
      // --- User selection sources (empty to start) ---
      map.addSource("user-point", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "user-point-circle",
        type: "circle",
        source: "user-point",
        paint: {
          "circle-radius": 7,
          "circle-color": "#0ea5e9",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
        layout: { visibility: "visible" },
      });

      map.addSource("user-buffer", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "user-buffer-fill",
        type: "fill",
        source: "user-buffer",
        paint: {
          "fill-color": "#1976d2",
          "fill-opacity": 0.18,
        },
        layout: { visibility: "visible" },
      });
      map.addLayer({
        id: "user-buffer-outline",
        type: "line",
        source: "user-buffer",
        paint: {
          "line-color": "#1976d2",
          "line-width": 2,
        },
        layout: { visibility: "visible" },
      });

      // Add user-route source and layer
      map.addSource("user-route", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "user-route-line",
        type: "line",
        source: "user-route",
        paint: {
          "line-color": "#3887be",
          "line-width": 5,
          "line-opacity": 0.8,
        },
        layout: { visibility: "visible" },
      });

      // If we already had a selection before a basemap change, re-apply it
      if (selectedPointRef.current) {
        const src = map.getSource("user-point");
        if (src) src.setData(selectedPointRef.current);
      }
      if (bufferRef.current) {
        const src = map.getSource("user-buffer");
        if (src) src.setData(bufferRef.current);
      }

      // If user left the CTA active during a basemap switch, restore crosshair + click-once.
      if (accessibilityActive && !selectedCoords) {
        map.getCanvas().style.cursor = PLUS_CURSOR;
        attachOneTimeClick();
      }
         if (selectedDemographic) {
        await drawChoropleth(selectedDemographic);
      }
    });

    return () => map.remove();
  }, [basemap]); // re-run only if basemap changes

  // Toggle visibility when visibleLayers changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Toggle citylimits
    if (map.getLayer("citylimits-line")) {
      map.setLayoutProperty(
        "citylimits-line",
        "visibility",
        visibleLayers.includes("citylimits") ? "visible" : "none"
      );
    }

    // Toggle neighbourhoods
    if (map.getLayer("neighbourhoods-fill")) {
      map.setLayoutProperty(
        "neighbourhoods-fill",
        "visibility",
        visibleLayers.includes("neighbourhoods") ? "visible" : "none"
      );
    }

    // Toggle all point layers
    LAYERS.forEach((layer) => {
      if (["citylimits", "neighbourhoods"].includes(layer.id)) return;
      
      // Toggle regular GeoJSON layers
      if (map.getLayer(layer.id + "-layer")) {
        map.setLayoutProperty(
          layer.id + "-layer",
          "visibility",
          visibleLayers.includes(layer.id) ? "visible" : "none"
        );
      }
    });
  }, [visibleLayers]);
 useEffect(() => {
    if (!mapRef.current) return;
    if (selectedDemographic) {
      drawChoropleth(selectedDemographic);
    } else {
      clearChoropleth();
    }
  }, [selectedDemographic]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove any heatmap layers that are not active
    HEATMAP_CATEGORIES.forEach(layer => {
      const heatmapId = layer.id + "-heatmap";
      if (map.getLayer(heatmapId) && !activeHeatmaps.includes(layer.id)) {
        map.removeLayer(heatmapId);
        // do NOT remove the source; just the layer
      }
    });

    // Add or show heatmap layers for each activeHeatmap
    activeHeatmaps.forEach(layerId => {
      const heatmapId = layerId + "-heatmap";
      // Add heatmap layer if not already present
      if (!map.getLayer(heatmapId)) {
        map.addLayer({
          id: heatmapId,
          type: "heatmap",
          source: layerId, // reuse the existing GeoJSON source for the points!
          maxzoom: 16,
          paint: {
            // You can tweak these to adjust heatmap style
            "heatmap-weight": [
              "interpolate",
              ["linear"],
              ["get", "weight"], // Use "weight" property if you have one; else set all to 1
              0, 0,
              6, 1
            ],
            "heatmap-intensity": 0.6,
            "heatmap-radius": 28,
            "heatmap-opacity": 0.55,
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0, "rgba(0,0,0,0)",
              0.15, layerId === "convenience-stores" ? "#f1c40f" :
                    layerId === "grocery-stores" ? "#3498db" :
                    layerId === "restaurants" ? "#27ae60" :
                    "#e74c3c",
              0.4, "#feb24c",
              0.7, "#fd8d3c",
              1, "#b10026"
            ]
          }
        });
      }
    });
  }, [activeHeatmaps]);

  return (
    <div className="map-dashboard-root">
      <div className="map-dashboard-title">
        Food Accessibility in Regina <span role="img" aria-label="Canada">🇨🇦</span>
      </div>

      {/* Sidebar for layer toggles */}
       <Sidebar
        layers={LAYERS}
        visibleLayers={visibleLayers}
        onToggle={handleToggleLayer}
        heatmapCategories={HEATMAP_CATEGORIES}
        activeHeatmaps={activeHeatmaps}
        onHeatmapChange={setActiveHeatmaps}
        accessibilityActive={accessibilityActive}
        onToggleAccessibility={handleToggleAccessibility}
        selectedCoords={selectedCoords}
        // NEW: demographics selection
        selectedDemographic={selectedDemographic}
        onSelectDemographic={setSelectedDemographic}
      />

      {/* Basemap Switcher */}
      <div className="map-dashboard-basemap-switcher">
        <span style={{ fontWeight: "bold" }}>Basemap: </span>
        {BASEMAPS.map((b) => (
          <button
            key={b.style}
            onClick={() => handleBasemapChange(b.style)}
            style={{
              margin: "0 4px",
              padding: "4px 10px",
              background: basemap === b.style ? "#1976d2" : "#eee",
              color: basemap === b.style ? "#fff" : "#222",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: basemap === b.style ? "bold" : "normal",
            }}
          >
            {b.label}
          </button>
        ))}
      </div>

 {/* Map container */}
      <div id="map-container" ref={mapContainerRef} className="map-dashboard-map-container" />

      {/* ===== NEW: Legend box for demographics ===== */}
      <div id={LEGEND_ID} className="legend-box" />

      {/* Accessibility Results (unchanged) */}
      {accessibilityResults.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "white",
            padding: "20px",
            zIndex: 200,
            borderRadius: "10px",
            maxHeight: "80vh",
            overflow: "auto",
            boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
            maxWidth: "400px",
            fontFamily: "Arial, sans-serif",
          }}
        >
          <button
            onClick={() => setAccessibilityResults([])}
            style={{
              float: "right",
              background: "none",
              border: "none",
              fontSize: "20px",
              cursor: "pointer",
              color: "#333",
            }}
          >
            ×
          </button>
          <h3 style={{ margin: "0 0 15px 0", color: "#1976d2" }}>Points within 1km Buffer</h3>
          <ul style={{ listStyleType: "none", padding: 0 }}>
            {accessibilityResults.map((res, i) => (
              <li
                key={i}
                onClick={() => showRoute(res)}
                style={{
                  marginBottom: "10px",
                  borderBottom: "1px solid #eee",
                  paddingBottom: "10px",
                  cursor: "pointer"
                }}
              >
                <strong>{res.layer}:</strong> {res.name} - Walking Distance: {res.distance} meters
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}