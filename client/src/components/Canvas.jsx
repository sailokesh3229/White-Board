import { useImperativeHandle, useRef } from "react";
import { nanoid } from "nanoid";
import { BOARD_WIDTH, BOARD_HEIGHT } from "../lib/constants.js";
import { getBoardPoint, roundPoint, makeRect, makeCircle, makeLine, isTooSmall } from "../lib/geometry.js";
import { drawDot, drawElement, drawSegment, redrawAll } from "../lib/draw.js";

const CURSORS = { pen: "crosshair", eraser: "cell", rect: "crosshair", circle: "crosshair", line: "crosshair" };
const SHAPE_BUILDERS = { rect: makeRect, circle: makeCircle, line: makeLine };

export default function Canvas({ ref, tool, color, size, disabled, onElementCreated }) {
  const mainRef = useRef(null); // finished elements
  const previewRef = useRef(null); // only the shape being dragged right now
  // Board data lives in refs, not state: a stroke adds dozens of points per
  // second and we don't want React to re-render for each one.
  const elementsRef = useRef([]);
  const strokeRef = useRef(null); // the stroke being drawn right now
  const shapeRef = useRef(null); // { type, start } of the shape being dragged

  function mainCtx() {
    return mainRef.current.getContext("2d");
  }

  function previewCtx() {
    return previewRef.current.getContext("2d");
  }

  // Lets the parent (Board) act on the board data without owning it.
  // Remote updates only touch the finished elements on the main canvas; the
  // preview canvas and the stroke you are drawing right now are left alone.
  useImperativeHandle(ref, () => ({
    clear() {
      elementsRef.current = [];
      redrawAll(mainCtx(), []);
      // If someone else cleared while we're mid-stroke, keep our stroke visible.
      if (strokeRef.current) drawElement(mainCtx(), strokeRef.current);
    },
    // The server's copy is the truth: throw away ours and draw theirs.
    replaceAll(elements) {
      elementsRef.current = [...elements];
      redrawAll(mainCtx(), elementsRef.current);
      if (strokeRef.current) drawElement(mainCtx(), strokeRef.current);
    },
    addRemoteElement(element) {
      elementsRef.current.push(element);
      drawElement(mainCtx(), element);
    },
  }));

  function toPoint(event) {
    // Both canvases are the same size and position, so either can be used.
    const { x, y } = getBoardPoint(event, previewRef.current);
    return roundPoint([x, y]);
  }

  function newElement(fields) {
    return {
      id: "el_" + nanoid(10),
      color,
      size,
      createdBy: "local", // replaced by the real userId in Phase 9
      createdAt: Date.now(),
      ...fields,
    };
  }

  function buildShape(type, start, end) {
    return newElement({ type, ...SHAPE_BUILDERS[type](start, end) });
  }

  function finishElement(element) {
    drawElement(mainCtx(), element);
    commitElement(element);
  }

  // Draw locally first (so it feels instant), then tell everyone else.
  function commitElement(element) {
    elementsRef.current.push(element);
    onElementCreated?.(element);
  }

  function handlePointerDown(event) {
    if (disabled) return; // e.g. while the board is loading
    if (event.button !== 0) return; // only the main mouse button / a touch / a pen tip
    // Keep receiving moves even if the pointer leaves the canvas mid-drag.
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = toPoint(event);

    if (SHAPE_BUILDERS[tool]) {
      shapeRef.current = { type: tool, start: point };
      return;
    }

    const stroke = newElement({ type: "stroke", tool, points: [point] });
    strokeRef.current = stroke;
    drawDot(mainCtx(), stroke, point);
  }

  function handlePointerMove(event) {
    const shape = shapeRef.current;
    if (shape) {
      // Clearing first means old previews never leave a "trail".
      const ctx = previewCtx();
      ctx.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
      drawElement(ctx, buildShape(shape.type, shape.start, toPoint(event)));
      return;
    }

    const stroke = strokeRef.current;
    if (!stroke) return; // not drawing: moving without pressing does nothing

    const point = toPoint(event);
    const previous = stroke.points[stroke.points.length - 1];
    if (point[0] === previous[0] && point[1] === previous[1]) return;

    stroke.points.push(point);
    drawSegment(mainCtx(), stroke, previous, point);
  }

  function handlePointerUp(event) {
    const shape = shapeRef.current;
    if (shape) {
      shapeRef.current = null;
      previewCtx().clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
      const element = buildShape(shape.type, shape.start, toPoint(event));
      if (!isTooSmall(element.type, element)) finishElement(element);
      return;
    }

    const stroke = strokeRef.current;
    if (!stroke) return;
    strokeRef.current = null;
    commitElement(stroke); // already drawn segment by segment
  }

  return (
    <div className="board-wrapper">
      <canvas ref={mainRef} className="main-canvas" width={BOARD_WIDTH} height={BOARD_HEIGHT} />
      <canvas
        ref={previewRef}
        width={BOARD_WIDTH}
        height={BOARD_HEIGHT}
        style={{ cursor: disabled ? "wait" : CURSORS[tool] }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
      {disabled && <div className="board-overlay">Loading board…</div>}
    </div>
  );
}
