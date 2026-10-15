// The <canvas> always has a fixed internal size (1600 x 900 "board units"),
// but CSS stretches it to fit the screen. Pointer events give us screen pixels,
// so we scale them into board units. Everyone stores and sends board units,
// which is why a drawing lands in the same place on every screen size.
export function getBoardPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

// Round to 1 decimal place to keep stored and sent data small.
export function roundPoint([x, y]) {
  return [round1(x), round1(y)];
}

// Shapes are built from the drag start and the current/end point, both [x, y].
// The same helpers are used for the live preview and the final element, so
// what you see while dragging is exactly what gets saved.

// Normalized so width and height are always positive, whichever way you drag.
export function makeRect([x1, y1], [x2, y2]) {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: round1(Math.abs(x2 - x1)),
    height: round1(Math.abs(y2 - y1)),
  };
}

// The drag starts at the center; the radius is the distance dragged.
export function makeCircle([x1, y1], [x2, y2]) {
  return { cx: x1, cy: y1, r: round1(Math.hypot(x2 - x1, y2 - y1)) };
}

export function makeLine([x1, y1], [x2, y2]) {
  return { x1, y1, x2, y2 };
}

const MIN_SHAPE_SIZE = 3;

// Accidental clicks shouldn't create invisible elements.
export function isTooSmall(type, geom) {
  if (type === "rect") return geom.width < MIN_SHAPE_SIZE && geom.height < MIN_SHAPE_SIZE;
  if (type === "circle") return geom.r < MIN_SHAPE_SIZE;
  if (type === "line") return Math.hypot(geom.x2 - geom.x1, geom.y2 - geom.y1) < MIN_SHAPE_SIZE;
  return false;
}

function round1(value) {
  return Math.round(value * 10) / 10;
}
