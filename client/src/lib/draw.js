// Draws one complete element. save()/restore() around every element makes sure
// settings like color or line width never leak into the next element.
export function drawElement(ctx, element) {
  ctx.save();
  if (element.type === "stroke") drawStroke(ctx, element);
  ctx.restore();
}

// Clears the canvas and draws every element in order. Order matters: later
// elements are painted on top of earlier ones.
export function redrawAll(ctx, elements) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const element of elements) drawElement(ctx, element);
}

// Draws only the newest piece of an in-progress stroke, so we don't have to
// redraw the whole board on every pointer move.
export function drawSegment(ctx, element, from, to) {
  ctx.save();
  applyStrokeStyle(ctx, element);
  ctx.beginPath();
  ctx.moveTo(from[0], from[1]);
  ctx.lineTo(to[0], to[1]);
  ctx.stroke();
  ctx.restore();
}

// A stroke with a single point (a click without dragging) is drawn as a dot.
export function drawDot(ctx, element, [x, y]) {
  ctx.save();
  ctx.fillStyle = element.color;
  ctx.beginPath();
  ctx.arc(x, y, element.size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawStroke(ctx, element) {
  const [first, ...rest] = element.points;
  if (rest.length === 0) {
    drawDot(ctx, element, first);
    return;
  }
  applyStrokeStyle(ctx, element);
  ctx.beginPath();
  ctx.moveTo(first[0], first[1]);
  for (const [x, y] of rest) ctx.lineTo(x, y);
  ctx.stroke();
}

function applyStrokeStyle(ctx, element) {
  ctx.strokeStyle = element.color;
  ctx.lineWidth = element.size;
  // Round caps and joins make strokes look smooth instead of jagged.
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}
