import { useRef, useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";
import axios from "axios";
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
    if (p) p.setData(emptyFC);
    if (b) b.setData(emptyFC);

    selectedPointRef.current = null;
    bufferRef.current = null;
  }

  function attachOneTimeClick() {
    const map = mapRef.current;
    if (!map) return;

    map.once("click", (e) => {
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
            "line-opacity": 1
          },
          layout: { visibility: visibleLayers.includes("citylimits") ? "visible" : "none" }
        });
      } catch (error) { 
        console.error("Error loading City Limits:", error); 
      }

      // 2. Neighbourhoods
      try {
        const hoodResponse = await axios.get("http://localhost:4000/api/geo/neighbourhoods");
        hoodResponse.data.features.forEach(f => {
          f.properties.color = "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
        });
        map.addSource("neighbourhoods", { type: "geojson", data: hoodResponse.data });
        map.addLayer({
          id: "neighbourhoods-fill",
          type: "fill",
          source: "neighbourhoods",
          paint: {
            "fill-color": ["get", "color"],
            "fill-opacity": 0.30,
            "fill-outline-color": "black"
          },
          layout: { visibility: visibleLayers.includes("neighbourhoods") ? "visible" : "none" }
        });

        // Add popup functionality for neighbourhoods
        map.on("click", "neighbourhoods-fill", (e) => {
          const feature = e.features[0];
          const properties = feature.properties;
          console.log("Neighbourhood properties:", properties);
          const name = properties["Name"]; // Access the correct property

          const popupContent = `
            <div style="font-family: Arial, sans-serif;">
              <h4 style="margin: 0 0 8px 0; color: #333;">Neighbourhood</h4>
              <p style="margin: 2px 0;"><strong>Name:</strong> ${name || "N/A"}</p>
            </div>
          `;

          new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(popupContent)
            .addTo(map);
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
      <div
        id="map-container"
        ref={mapContainerRef}
        className="map-dashboard-map-container"
      />
    </div>
  );
}