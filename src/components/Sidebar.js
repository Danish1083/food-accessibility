import { useState } from "react";
import "./Sidebar.css";

// Dummy icons (SVGs). Replace with real ones or use Material UI if you want.
function IconVisualization() {
  return (
    <svg width="22" height="22" fill="none">
      <rect x="4" y="4" width="14" height="14" rx="3" fill="#175194"/>
      <rect x="7" y="7" width="8" height="8" rx="1.8" fill="#f7f8fa"/>
    </svg>
  );
}
function IconHeatmap() {
  return (
    <svg width="22" height="22" fill="none">
      <circle cx="11" cy="11" r="8" fill="url(#heatmapGradient)" />
      <defs>
        <radialGradient id="heatmapGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fd8d3c" />
          <stop offset="50%" stopColor="#feb24c" />
          <stop offset="100%" stopColor="#ffffb2" />
        </radialGradient>
      </defs>
    </svg>
  );
}
function IconDemographics() {
  return (
    <svg width="22" height="22" fill="none">
      <rect x="3" y="13" width="5" height="6" rx="1.5" fill="#4682B4"/>
      <rect x="9" y="9" width="5" height="10" rx="1.5" fill="#90caf9"/>
      <rect x="15" y="5" width="4" height="14" rx="1.5" fill="#1976d2"/>
    </svg>
  );
}
  
export default function Sidebar(
  {
  layers = [],
  visibleLayers = [],
  onToggle,
  heatmapCategories = [],
  activeHeatmaps = [],
  onHeatmapChange,
  // NEW props from MapDashboard
  accessibilityActive,
  onToggleAccessibility,
  selectedCoords
})  {
  const [open, setOpen] = useState(true);
  const [sidebarMode, setSidebarMode] = useState("visualization"); // "visualization" | "heatmap" | "demographics"
  const [activeHeatmap, setActiveHeatmap] = useState(null);

  function handleHeatmapCheckbox(id) {
    if (activeHeatmaps.includes(id)) {
      onHeatmapChange(activeHeatmaps.filter(hm => hm !== id));
    } else {
      onHeatmapChange([...activeHeatmaps, id]);
    }
  }

  function getLegendSymbol(layer) {
    if (layer.id === "citylimits" || layer.id === "neighbourhoods") return null;
    const stroke = "#000";
    const strokeWidth = 1.8;

    switch (layer.shape) {
      case "circle":
        return (
          <span
            className="legend-symbol circle"
            style={{ background: layer.color, border: "2px solid #000" }}
          />
        );
      case "square":
        return (
          <span
            className="legend-symbol square"
            style={{ background: layer.color, border: "2px solid #000" }}
          />
        );
      case "triangle":
        return (
          <svg width="22" height="22" className="legend-symbol" aria-hidden="true">
            <polygon points="11,4 19,18 3,18" fill={layer.color} stroke="#000" strokeWidth="1.8" />
          </svg>
        );
      case "star":
        return (
          <svg width="22" height="22" className="legend-symbol" aria-hidden="true">
            {(() => {
              const cx = 11, cy = 11, outer = 8.5, inner = 4.2;
              const pts = [];
              for (let i = 0; i < 10; i++) {
                const ang = (Math.PI / 5) * i - Math.PI / 2;
                const r = i % 2 === 0 ? outer : inner;
                pts.push(`${cx + r * Math.cos(ang)},${cy + r * Math.sin(ang)}`);
              }
              return (
                <polygon
                  points={pts.join(" ")}
                  fill={layer.color}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                />
              );
            })()}
          </svg>
        );
      case "hexagon":
        return (
          <svg width="22" height="22" className="legend-symbol" aria-hidden="true">
            <polygon
              points="11,3 18,7.5 18,14.5 11,19 4,14.5 4,7.5"
              fill={layer.color}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
          </svg>
        );
      case "custom-image":
        return (
          <img
            src={layer.imagePath}
            alt=""
            className="legend-symbol custom-image"
          />
        );
      default:
        return (
          <span
            className="legend-symbol circle"
            style={{ background: layer.color, border: "2px solid #000" }}
          />
        );
    }
  }

  return (
    <>
      {/* Toggle Button - top left, floats */}
      <button
        className={`sidebar-toggle-btn${open ? " open" : ""}`}
        onClick={() => setOpen(o => !o)}
        aria-label={open ? "Close sidebar" : "Open sidebar"}
      >
        <span className="sidebar-toggle-icon">
          <svg width="30" height="30">
            {open ? (
              <polyline points="18,7 11,15 18,23" fill="none" stroke="#246" strokeWidth="3" strokeLinecap="round"/>
            ) : (
              <>
                <rect x="7" y="9" width="16" height="3" rx="1.5" fill="#246"/>
                <rect x="7" y="14" width="16" height="3" rx="1.5" fill="#246"/>
                <rect x="7" y="19" width="16" height="3" rx="1.5" fill="#246"/>
              </>
            )}
          </svg>
        </span>
      </button>

      <div className={`sidebar-container${open ? "" : " sidebar-hidden"}`}>
        {/* ACCESSIBILITY CTA */}
        <button
          className={`access-btn ${accessibilityActive ? "clear" : ""}`}
          onClick={onToggleAccessibility}
        >
          {accessibilityActive ? "Clear" : "Check Accessibility"}
        </button>
        {accessibilityActive && !selectedCoords && (
          <div className="access-hint">Click anywhere on the map to drop a point and build a 1 km buffer.</div>
        )}
        {accessibilityActive && selectedCoords && (
          <div className="access-hint">Point selected: {selectedCoords.lat.toFixed(5)}, {selectedCoords.lng.toFixed(5)}</div>
        )}

        {/* ---- Sidebar modes ---- */}
        {sidebarMode === "visualization" && (
          <>
            <div className="sidebar-title">Map Layers</div>
            <div>
              {layers.map(layer => (
                <div
                  key={layer.id}
                  className={
                    "layer-row" + (visibleLayers.includes(layer.id) ? " active" : "")
                  }
                >
                  <input
                    type="checkbox"
                    checked={visibleLayers.includes(layer.id)}
                    onChange={() => onToggle(layer.id)}
                    id={`layer-toggle-${layer.id}`}
                    className="layer-checkbox"
                  />
                  <label htmlFor={`layer-toggle-${layer.id}`} className="layer-label">
                    {getLegendSymbol(layer)}
                    <span className="layer-text">{layer.label}</span>
                  </label>
                </div>
              ))}
            </div>
          </>
        )}

        {sidebarMode === "heatmap" && (
          <div className="sidebar-heatmap-list">
            <div className="sidebar-heatmap-title">Heatmaps</div>
            <div className="sidebar-heatmap-desc">
              Select categories to visualize as heatmaps.
            </div>
            <div className="heatmap-btn-grid">
              {heatmapCategories.map(item => (
                <label key={item.id} className="heatmap-row" style={{cursor: "pointer", alignItems: "center", display: "flex", gap: "10px", padding: "6px 0"}}>
                  <input
                    type="checkbox"
                    checked={activeHeatmaps.includes(item.id)}
                    onChange={() => handleHeatmapCheckbox(item.id)}
                    className="heatmap-checkbox"
                  />
                  <span className="heatmap-icon">{getLegendSymbol(item)}</span>
                  <span>
                    <span className="heatmap-label" style={{fontWeight: 600}}>{item.label}</span>
                    <span className="heatmap-desc" style={{display: "block", fontSize: "0.85em", color: "#5c6a7b", fontWeight: 400}}>{item.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {sidebarMode === "demographics" && (
          <div className="sidebar-demographics-empty" />
        )}

        <div className="sidebar-mode-row">
          <label className={`mode-radio${sidebarMode === "visualization" ? " active" : ""}`}>
            <input
              type="radio"
              name="sidebar-mode"
              value="visualization"
              checked={sidebarMode === "visualization"}
              onChange={() => setSidebarMode("visualization")}
            />
            <span className="icon-holder"><IconVisualization /></span>
            <span className="mode-label">Visualization</span>
          </label>
          <label className={`mode-radio${sidebarMode === "heatmap" ? " active" : ""}`}>
            <input
              type="radio"
              name="sidebar-mode"
              value="heatmap"
              checked={sidebarMode === "heatmap"}
              onChange={() => setSidebarMode("heatmap")}
            />
            <span className="icon-holder"><IconHeatmap /></span>
            <span className="mode-label">Heatmap</span>
          </label>
          <label className={`mode-radio${sidebarMode === "demographics" ? " active" : ""}`}>
            <input
              type="radio"
              name="sidebar-mode"
              value="demographics"
              checked={sidebarMode === "demographics"}
              onChange={() => setSidebarMode("demographics")}
            />
            <span className="icon-holder"><IconDemographics /></span>
            <span className="mode-label">Demographics</span>
          </label>
        </div>
      </div>
    </>
  );
}
