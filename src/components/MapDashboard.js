import { useRef, useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";
import axios from "axios";
import Sidebar from "./Sidebar";
import "mapbox-gl/dist/mapbox-gl.css";

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
    label: "City Limits",
    url: null,
    color: "#114b07",
    type: "line",
  },
  {
    id: "neighbourhoods",
    label: "Neighbourhoods",
    url: null,
    color: "#bbbbbb",
    type: "fill",
  },
  // ... (other point layers)
  {
    id: "convenience-stores",
    label: "Convenience Stores",
    url: "http://localhost:4000/api/geo/conveniencestores",
    color: "#e74c3c",
  },
  {
    id: "grocery-stores",
    label: "Grocery Stores",
    url: "http://localhost:4000/api/geo/grocerystores",
    color: "#3498db",
  },
  {
    id: "restaurants",
    label: "Restaurants",
    url: "http://localhost:4000/api/geo/restaurants",
    color: "#27ae60",
  },
  {
    id: "emergency-food",
    label: "Emergency Food",
    url: "http://localhost:4000/api/geo/emergencyfood",
    color: "#f1c40f",
  },
  {
    id: "speciality-stores",
    label: "Speciality Stores",
    url: "http://localhost:4000/api/geo/specialitystores",
    color: "#9b59b6",
  },
  {
    id: "transitstops",
    label: "Transit Stops",
    url: "http://localhost:4000/api/geo/transitstops",
    color: "#ff0080",
  }
];

export default function MapDashboard() {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const [visibleLayers, setVisibleLayers] = useState(LAYERS.map((l) => l.id));
  const [visibleHeatmaps, setVisibleHeatmaps] = useState([]);

  const [basemap, setBasemap] = useState(BASEMAPS[0].style);

  // Toggle layer visibility
  const handleToggleLayer = (layerId) => {
    setVisibleLayers((prev) =>
      prev.includes(layerId)
        ? prev.filter((id) => id !== layerId)
        : [...prev, layerId]
    );
  };
  const handleToggleHeatmap = (layerId) => {
  setVisibleHeatmaps((prev) =>
    prev.includes(layerId)
      ? prev.filter((id) => id !== layerId)
      : [...prev, layerId]
  );
};


  // Change basemap style
  const handleBasemapChange = (style) => {
    setBasemap(style);
  };

  // Initialize map and fetch data once
  useEffect(() => {
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      center: [-104.6189, 50.4452],
      zoom: 12,
      style: basemap,
    });
    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

map.on("load", async () => {
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
  } catch (error) { console.error("Error loading City Limits:", error); }

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
  } catch (error) { console.error("Error loading Neighbourhoods:", error); }

  // 3. Point Layers
const HEATMAP_LAYERS = ["convenience-stores", "grocery-stores"];

for (let layer of LAYERS) {
  if (["citylimits", "neighbourhoods"].includes(layer.id)) continue;
  try {
    const response = await axios.get(layer.url);
    map.addSource(layer.id, { type: "geojson", data: response.data });

    // Circle/point layer (default)
    map.addLayer({
      id: layer.id + "-layer",
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

    // HEATMAP LAYER (for grocery/convenience only)
    if (HEATMAP_LAYERS.includes(layer.id)) {
      map.addLayer({
        id: layer.id + "-heatmap",
        type: "heatmap",
        source: layer.id,
        maxzoom: 17,
        paint: {
          "heatmap-weight": 1,
          "heatmap-intensity": 1,
          "heatmap-radius": 20,
          "heatmap-opacity": 0.7,
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0, "rgba(33,102,172,0)",
            0.2, "rgb(103,169,207)",
            0.4, "rgb(209,229,240)",
            0.6, "rgb(253,219,199)",
            0.8, "rgb(239,138,98)",
            1, "rgb(178,24,43)"
          ]
        },
        layout: { visibility: "none" } // Heatmap initially hidden
      });
    }

    // ...popup/cursor code as before...

  } catch (error) {
    console.error(`Error loading ${layer.label}:`, error);
  }
}
});



// --- 4. Transit Stops from MVT --- //
try {
  map.addSource('transitstops', {
    type: 'vector',
    tiles: [
      'http://localhost:4000/api/mvt/transitstops/{z}/{x}/{y}.pbf'
    ],
    minzoom: 0,
    maxzoom: 22
  });

  map.addLayer({
    id: 'transitstops-mvt',
    type: 'circle',
    source: 'transitstops',
    'source-layer': 'transitstops', // must match the name in your SQL: ST_AsMVT(..., 'transitstops', ...)
    paint: {
      'circle-radius': 7,
      'circle-color': '#ff0080',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff',
    },
    layout: {
      visibility: visibleLayers.includes('transitstops') ? "visible" : "none",
    },
  });

  // Optional: add popup for transitstops
  map.on("click", "transitstops-mvt", (e) => {
    const feature = e.features[0];
    const { stop_id } = feature.properties;
    new mapboxgl.Popup()
      .setLngLat(feature.geometry.coordinates)
      .setHTML(`<b>Stop ID:</b> ${stop_id || "Unknown"}`)
      .addTo(map);
  });

  map.on("mouseenter", "transitstops-mvt", () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", "transitstops-mvt", () => {
    map.getCanvas().style.cursor = "";
  });

  

} catch (error) {
  console.error("Error adding Transit Stops MVT:", error);
}


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

  // For each heatmap-enabled layer
  ["convenience-stores", "grocery-stores"].forEach((layerId) => {
    const heatmapId = layerId + "-heatmap";
    if (map.getLayer(heatmapId)) {
      map.setLayoutProperty(
        heatmapId,
        "visibility",
        visibleHeatmaps.includes(layerId) ? "visible" : "none"
      );
    }
    // OPTIONAL: Hide points when heatmap is on (uncomment if you want this)
    // const pointId = layerId + "-layer";
    // if (map.getLayer(pointId)) {
    //   map.setLayoutProperty(
    //     pointId,
    //     "visibility",
    //     visibleHeatmaps.includes(layerId) ? "none" : (visibleLayers.includes(layerId) ? "visible" : "none")
    //   );
    // }
  });
}, [visibleHeatmaps, visibleLayers]);


  return (
    <div>
      {/* Sidebar for layer toggles */}
   <Sidebar
  layers={LAYERS}
  visibleLayers={visibleLayers}
  onToggle={handleToggleLayer}
  visibleHeatmaps={visibleHeatmaps}
  onToggleHeatmap={handleToggleHeatmap}
/>

      {/* Basemap Switcher */}
      <div
        style={{
          position: "absolute",
          top: 20,
          right: 70,
          zIndex: 2,
          background: "#fff",
          borderRadius: 8,
          boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
          padding: "6px 12px",
        }}
      >
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
        style={{ width: "100vw", height: "100vh" }}
      />
    </div>
  );
}
