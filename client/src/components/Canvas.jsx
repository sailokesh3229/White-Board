import { useImperativeHandle, useRef } from "react";
import { nanoid } from "nanoid";
import { BOARD_WIDTH, BOARD_HEIGHT } from "../lib/constants.js";
import { getBoardPoint, roundPoint } from "../lib/geometry.js";
import { drawDot, drawSegment, redrawAll } from "../lib/draw.js";

const CURSORS = { pen: "crosshair", eraser: "cell" };

export default function Canvas({ ref, tool, color, size }) {
  const canvasRef = useRef(null);
  // Board data lives in refs, not state: a stroke adds dozens of points per
  // second and we don't want React to re-render for each one.
  const elementsRef = useRef([]);
  const currentRef = useRef(null); // the stroke being drawn right now

  function getCtx() {
    return canvasRef.current.getContext("2d");
  }

  // Lets the parent (Board) act on the board data without owning it.
  useImperativeHandle(ref, () => ({
    clear() {
      elementsRef.current = [];
      currentRef.current = null;
      redrawAll(getCtx(), []);
    },
  }));

  function toPoint(event) {
    const { x, y } = getBoardPoint(event, canvasRef.current);
    return roundPoint([x, y]);
  }

  function handlePointerDown(event) {
    if (event.button !== 0) return; // only the main mouse button / a touch / a pen tip
    // Keep receiving moves even if the pointer leaves the canvas mid-stroke.
    event.currentTarget.setPointerCapture(event.pointerId);

    const point = toPoint(event);
    const stroke = {
      id: "el_" + nanoid(10),
      type: "stroke",
      tool,
      color,
      size,
      points: [point],
      createdBy: "local", // replaced by the real userId in Phase 9
      createdAt: Date.now(),
    };
    currentRef.current = stroke;
    drawDot(getCtx(), stroke, point);
  }

  function handlePointerMove(event) {
    const stroke = currentRef.current;
    if (!stroke) return; // not drawing: moving without pressing does nothing

    const point = toPoint(event);
    const previous = stroke.points[stroke.points.length - 1];
    if (point[0] === previous[0] && point[1] === previous[1]) return;

    stroke.points.push(point);
    drawSegment(getCtx(), stroke, previous, point);
  }

  function handlePointerUp() {
    const stroke = currentRef.current;
    if (!stroke) return;
    elementsRef.current.push(stroke);
    currentRef.current = null;
  }

  // Temporary (Phases 1–2): proves the saved element data reproduces the picture.
  function handleDebugRedraw() {
    redrawAll(getCtx(), elementsRef.current);
  }

  return (
    <>
      <div className="board-wrapper">
        <canvas
          ref={canvasRef}
          width={BOARD_WIDTH}
          height={BOARD_HEIGHT}
          style={{ cursor: CURSORS[tool] }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      </div>
      <button type="button" className="debug-button" onClick={handleDebugRedraw}>
        Redraw (debug)
      </button>
    </>
  );
}
