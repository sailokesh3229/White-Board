import { MIN_SIZE, MAX_SIZE } from "../lib/constants.js";

const TOOLS = [
  { id: "pen", label: "Pen" },
  { id: "eraser", label: "Eraser" },
];

const SWATCHES = [
  "#1e1e1e",
  "#e03131",
  "#f08c00",
  "#ffd43b",
  "#2f9e44",
  "#1971c2",
  "#7048e8",
  "#ffffff",
];

export default function Toolbar({ tool, color, size, onToolChange, onColorChange, onSizeChange, onClear }) {
  return (
    <div className="toolbar" role="toolbar" aria-label="Drawing tools">
      <div className="toolbar-group">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            className="tool-button"
            aria-pressed={tool === t.id}
            title={t.label}
            onClick={() => onToolChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="toolbar-group">
        <input
          type="color"
          value={color}
          title="Custom color"
          aria-label="Custom color"
          onChange={(e) => onColorChange(e.target.value)}
        />
        {SWATCHES.map((swatch) => (
          <button
            key={swatch}
            type="button"
            className="swatch"
            style={{ background: swatch }}
            aria-pressed={color === swatch}
            aria-label={`Color ${swatch}`}
            title={swatch}
            onClick={() => onColorChange(swatch)}
          />
        ))}
      </div>

      <label className="toolbar-group size-control" title="Brush size">
        Size
        <input
          type="range"
          min={MIN_SIZE}
          max={MAX_SIZE}
          value={size}
          onChange={(e) => onSizeChange(Number(e.target.value))}
        />
        <span className="size-value">{size}</span>
      </label>

      <button type="button" className="clear-button" title="Clear the whole board" onClick={onClear}>
        Clear board
      </button>
    </div>
  );
}
