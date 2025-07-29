import "./Sidebar.css";

export default function Sidebar({ layers = [], visibleLayers = [], onToggle }) {
function getLegendSymbol(layer) {
    if (layer.id === "citylimits" || layer.id === "neighbourhoods") {
    return null;
  }
 
  switch (layer.shape) {
    case "circle":
      return <span className="legend-symbol circle" style={{ background: layer.color }} />;
    case "square":
      return <span className="legend-symbol square" style={{ background: layer.color, border: layer.border || "2px solid #444" }} />;
    case "triangle":
      return <span className="legend-symbol triangle" style={{ borderBottomColor: layer.color }} />;
    case "star":
      return <span className="legend-symbol star" style={{ color: layer.color }}>★</span>;
    case "hexagon":
      return (
        <svg width="18" height="16" className="legend-symbol hexagon">
          <polygon points="9,1 17,5 17,13 9,16 1,13 1,5" fill={layer.color} stroke="#444" strokeWidth="1.5"/>
        </svg>
      );
    case "custom-image":
      return (
        <img
          src={layer.imagePath}
          alt={layer.label}
          className="legend-symbol custom-image"
        />
      );
    default:
      return <span className="legend-symbol circle" style={{ background: layer.color }} />;
  }
}


  
  return (
    <div className="sidebar-container">
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
    </div>
  );
}
