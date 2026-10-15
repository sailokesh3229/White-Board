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

function round1(value) {
  return Math.round(value * 10) / 10;
}
