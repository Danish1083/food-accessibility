import { useRef, useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";
import axios from "axios";
import Sidebar from "./Sidebar";
import "mapbox-gl/dist/mapbox-gl.css";
import "./MapDashboard.css";

mapboxgl.accessToken =
  "pk teniendoJ1IjoiZGFuaXNoMTA4MyIsImEiOiJjbHh0eDJhOGYwYm1hMmlzYXBvNmhsdXk2In0.7-j8U59ERuj0A4oURgIh-g";

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
  },
  {
    id: "neighbourhoods",
    label: "Neighbourhoods",
    url: "https://7ab5756294d9.ngrok-free.app/api/geo/neighbourhoods",
  },
  {
    id: "convenience-stores",
    label: "Convenience Stores",
    url: "https://7ab5756294d9.ngrok-free.app/api/geo/conveniencestores",
    color: "#f1c40f",
    shape: "circle",
  },
  {
    id: "grocery-stores",
    label: "Grocery Stores",
    url: "https://7ab5756294d9.ngrok-free.app/api/geo/grocerystores",
    color: "#3498db",
    shape: "square",
  },
  {
    id: "restaurants",
    label: "Restaurants",
    url: "https://7ab5756294d9.ngrok-free.app/api/geo/restaurants",
    color: "#27ae60",
    shape: "triangle",
  },
  {
    id: "emergency-food",
    label: "Emergency Food",
    url: "https://7ab5756294d9.ngrok-free.app/api/geo/emergencyfood",
    color: "#e74c3c",
    shape: "star",
  },
  {
    id: "speciality-stores",
    label: "Speciality Stores",
    url: "https://7ab5756294d9.ngrok-free.app/api/geo/specialitystores",
    color: "#9b59b6",
    shape: "hexagon",
  },
  {
    id: "transitstops",
    label: "Transit Stops",
    url: "https://7ab5756294d9.ngrok-free.app/api/geo/transitstops",
    color: "#ff0080",
    shape: "custom-image",
    imagePath: "/assets/bus-icon.png",
  },
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

export default function MapDashboard() {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const [visibleLayers, setVisibleLayers] = useState(LAYERS.map((l) => l.id));
  const [basemap, setBasemap] = useState(BASEMAPS[0].style);
  const [error, setError] = useState(null);
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
              const image = new Image();
              image.crossOrigin = 'anonymous';
              
              await new Promise((resolve, reject) => {
                image.onload = () => {
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
              console.log(`Ensure the image is accessible at: ${layer.imagePath}`);
            }
          } else if (layer.shape && layer.shape !== 'circle') {
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

      await loadCustomImages();

      // Helper function to fetch and validate GeoJSON
      const fetchGeoJSON = async (url, layerLabel) => {
        try {
          const response = await axios.get(url, {
            validateStatus: (status) => status >= 200 && status < 300,
          });
          
          // Log raw response for debugging
          console.log(`${layerLabel} raw response:`, response.data);

          // Check if response is valid JSON
          if (typeof response.data !== 'object' || response.data === null) {
            throw new Error(`${layerLabel} response is not valid JSON`);
          }

          // Ensure it's a GeoJSON object
          if (response.data.type !== 'FeatureCollection' && !Array.isArray(response.data.features)) {
            throw new Error(`${layerLabel} response is not a valid GeoJSON FeatureCollection`);
          }

          return response.data;
        } catch (error) {
          console.error(`Error fetching ${layerLabel}:`, error.message);
          if (error.response) {
            console.error(`Response status: ${error.response.status}`);
            console.error(`Response data:`, error.response.data);
          }
          setError(`Failed to load ${layerLabel} data: ${error.message}`);
          return { type: 'FeatureCollection', features: [] }; // Fallback
        }
      };

      // 1. City Limits
      try {
        const cityData = await fetchGeoJSON(
          "https://7ab5756294d9.ngrok-free.app/api/geo/citylimits",
          "City Limits"
        );
        map.addSource("citylimits", { type: "geojson", data: cityData });
        map.addLayer({
          id: "citylimits-line",
          type: "line",
          source: "citylimits",
          paint: {
            "line-color": "#114b07",
            "line-width": 3,
            "line-opacity": 1,
          },
          layout: { visibility: visibleLayers.includes("citylimits") ? "visible" : "none" },
        });
      } catch (error) {
        console.error("Error loading City Limits:", error);
        setError("Failed to load City Limits data");
      }

      // 2. Neighbourhoods
      try {
        const hoodData = await fetchGeoJSON(
          "https://7ab5756294d9.ngrok-free.app/api/geo/neighbourhoods",
          "Neighbourhoods"
        );
        const features = hoodData.features || [];
        features.forEach((f) => {
          f.properties = f.properties || {};
          f.properties.color = "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
        });
        map.addSource("neighbourhoods", { type: "geojson", data: hoodData });
        map.addLayer({
          id: "neighbourhoods-fill",
          type: "fill",
          source: "neighbourhoods",
          paint: {
            "fill-color": ["get", "color"],
            "fill-opacity": 0.30,
            "fill-outline-color": "black",
          },
          layout: { visibility: visibleLayers.includes("neighbourhoods") ? "visible" : "none" },
        });

        map.on("click", "neighbourhoods-fill", (e) => {
          const feature = e.features[0];
          const properties = feature.properties || {};
          const name = properties["Name"] || "Unknown";

          const popupContent = `
            <div style="font-family: Arial, sans-serif;">
              <h4 style="margin: 0 0 8px 0; color: #333;">Neighbourhood</h4>
              <p style="margin: 2px 0;"><strong>Name:</strong> ${name}</p>
            </div>
          `;

          new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(popupContent)
            .addTo(map);
        });

        map.on("mouseenter", "neighbourhoods-fill", () => {
          map.getCanvas().style.cursor = "pointer";
        });

        map.on("mouseleave", "neighbourhoods-fill", () => {
          map.getCanvas().style.cursor = "";
        });
      } catch (error) {
        console.error("Error loading Neighbourhoods:", error);
        setError("Failed to load Neighbourhoods data");
      }

      // 3. Point Layers with Custom Shapes
      for (let layer of LAYERS) {
        if (["citylimits", "neighbourhoods"].includes(layer.id)) continue;
        
        try {
          const layerData = await fetchGeoJSON(layer.url, layer.label);
          map.addSource(layer.id, { type: "geojson", data: layerData });
          
          const layerId = layer.id + "-layer";
          
          if (layer.shape === 'custom-image') {
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
            map.addLayer({
              id: layerId,
              type: "symbol",
              source: layer.id,
              layout: {
                "icon-image": layer.id + '-shape',
                "icon-size": 1,
                "icon-allow-overlap": true,
                visibility: visibleLayers.includes(layer.id) ? "visible" : "none",
              },
            });
          } else {
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

          map.on("click", layerId, (e) => {
            const feature = e.features[0];
            const coordinates = feature.geometry.coordinates.slice();
            const properties = feature.properties || {};
            
            let popupContent = `<div style="font-family: Arial, sans-serif;">`;
            popupContent += `<h4 style="margin: 0 0 8px 0; color: ${layer.color};">${layer.label}</h4>`;
            
            Object.keys(properties).forEach(key => {
              if (properties[key] !== null && properties[key] !== undefined) {
                popupContent += `<p style="margin: 2px 0;"><strong>${key.replace(/_/g, ' ')}:</strong> ${properties[key]}</p>`;
              }
            });
            popupContent += `</div>`;

            while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
              coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
            }

            new mapboxgl.Popup()
              .setLngLat(coordinates)
              .setHTML(popupContent)
              .addTo(map);
          });

          map.on("mouseenter", layerId, () => {
            map.getCanvas().style.cursor = "pointer";
          });

          map.on("mouseleave", layerId, () => {
            map.getCanvas().style.cursor = "";
          });

        } catch (error) {
          console.error(`Error loading ${layer.label}:`, error);
          setError(`Failed to load ${layer.label} data: ${error.message}`);
        }
      }
    });

    return () => map.remove();
  }, [basemap]);

  // Toggle visibility when visibleLayers changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (map.getLayer("citylimits-line")) {
      map.setLayoutProperty(
        "citylimits-line",
        "visibility",
        visibleLayers.includes("citylimits") ? "visible" : "none"
      );
    }

    if (map.getLayer("neighbourhoods-fill")) {
      map.setLayoutProperty(
        "neighbourhoods-fill",
        "visibility",
        visibleLayers.includes("neighbourhoods") ? "visible" : "none"
      );
    }

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

  // Handle heatmap layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    HEATMAP_CATEGORIES.forEach(layer => {
      const heatmapId = layer.id + "-heatmap";
      if (map.getLayer(heatmapId) && !activeHeatmaps.includes(layer.id)) {
        map.removeLayer(heatmapId);
      }
    });

    activeHeatmaps.forEach(layerId => {
      const heatmapId = layerId + "-heatmap";
      if (!map.getLayer(heatmapId)) {
        map.addLayer({
          id: heatmapId,
          type: "heatmap",
          source: layerId,
          maxzoom: 16,
          paint: {
            "heatmap-weight": [
              "interpolate",
              ["linear"],
              ["get", "weight"],
              0, 0,
              6, 1,
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
              1, "#b10026",
            ],
          },
        });
      }
    });
  }, [activeHeatmaps]);

  return (
    <div className="map-dashboard-root">
      {error && <div style={{ color: 'red', padding: '10px' }}>{error}</div>}
      <div className="map-dashboard-title">
        Food Accessibility in Regina <span role="img" aria-label="Canada">🇨🇦</span>
      </div>
      <Sidebar
        layers={LAYERS}
        visibleLayers={visibleLayers}
        onToggle={handleToggleLayer}
        heatmapCategories={HEATMAP_CATEGORIES}
        activeHeatmaps={activeHeatmaps}
        onHeatmapChange={setActiveHeatmaps}
      />
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
      <div
        id="map-container"
        ref={mapContainerRef}
        className="map-dashboard-map-container"
      />
    </div>
  );
}