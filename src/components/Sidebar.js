export default function Sidebar({
  layers = [],
  visibleLayers = [],
  onToggle,
  visibleHeatmaps = [],
  onToggleHeatmap
}) {
  // Add legend items for City Limits and Neighbourhoods
  const customLegend = [
    {
      id: "citylimits-line",
      label: "City Limits",
      render: (
        <span
          style={{
            display: "inline-block",
            width: 26,
            height: 0,
            borderTop: "5px solid #114b07",
            marginRight: 8,
            verticalAlign: "middle"
          }}
        />
      )
    },
    {
      id: "neighbourhoods-fill",
      label: "Neighbourhoods",
      render: (
        <span
          style={{
            display: "inline-block",
            width: 18,
            height: 18,
            background:
              "linear-gradient(135deg, #ffadad 0%, #ffd6a5 35%, #9bf6ff 70%, #bdb2ff 100%)", // indicates multi-color
            border: "2px solid #444",
            borderRadius: 4,
            marginRight: 8,
            verticalAlign: "middle"
          }}
        />
      )
    }
  ];

  // Utility: store layer IDs to show heatmap toggle for
  const HEATMAP_LAYERS = ["convenience-stores", "grocery-stores"];

  return (
    <div
      style={{
        position: "absolute",
        top: 20,
        left: 20,
        background: "#fff",
        padding: 16,
        zIndex: 100,
        borderRadius: 8,
        boxShadow: "0 2px 10px #0002",
        minWidth: 220
      }}
    >
      <b>Map Layers</b>
      <div>
        {layers.map((layer) => (
          <div key={layer.id} style={{ margin: "8px 0" }}>
            <input
              type="checkbox"
              checked={visibleLayers.includes(layer.id)}
              onChange={() => onToggle(layer.id)}
              id={`layer-toggle-${layer.id}`}
            />
            <label
              htmlFor={`layer-toggle-${layer.id}`}
              style={{
                marginLeft: 8,
                color: layer.color,
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              {layer.label}
            </label>
            {/* Heatmap toggle only for specified store layers */}
            {HEATMAP_LAYERS.includes(layer.id) && (
              <label style={{ marginLeft: 14, fontWeight: 400 }}>
                <input
                  type="checkbox"
                  checked={visibleHeatmaps.includes(layer.id)}
                  onChange={() => onToggleHeatmap(layer.id)}
                  style={{ marginRight: 4 }}
                />
                <span style={{ fontSize: 13, color: "#555" }}>Heatmap</span>
              </label>
            )}
          </div>
        ))}
      </div>
      <hr />
      <b>Legend</b>
      <div style={{ marginBottom: 10 }}>
        {/* Custom symbology for city limits and neighbourhoods */}
        {customLegend.map((item) => (
          <div
            key={item.id}
            style={{ display: "flex", alignItems: "center", marginTop: 4 }}
          >
            {item.render}
            <span>{item.label}</span>
          </div>
        ))}
        {/* Symbology for point layers */}
        {layers.map((layer) => (
          <div
            key={layer.id}
            style={{ display: "flex", alignItems: "center", marginTop: 4 }}
          >
            <span
              style={{
                display: "inline-block",
                width: 16,
                height: 16,
                background: layer.color,
                borderRadius: "50%",
                marginRight: 8,
                border: "2px solid #fff"
              }}
            ></span>
            {layer.label}
          </div>
        ))}
      </div>
    </div>
  );
}
