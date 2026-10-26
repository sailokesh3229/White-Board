export function bounds(el) {
  if (el.type === "stroke") {
    const xs = el.points.map(p => p[0]), ys = el.points.map(p => p[1]);
    return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(1, Math.max(...xs) - Math.min(...xs)), height: Math.max(1, Math.max(...ys) - Math.min(...ys)) };
  }
  if (["line", "arrow"].includes(el.type)) return { x: Math.min(el.x1, el.x2), y: Math.min(el.y1, el.y2), width: Math.max(1, Math.abs(el.x2 - el.x1)), height: Math.max(1, Math.abs(el.y2 - el.y1)) };
  if (el.type === "circle") return { x: el.cx - el.r, y: el.cy - el.r, width: el.r * 2, height: el.r * 2 };
  return { x: el.x, y: el.y, width: el.width, height: el.height };
}
export function transformObject(el, box) {
  const old = bounds(el), sx = box.width / old.width, sy = box.height / old.height;
  const pt = (x, y) => [box.x + (x - old.x) * sx, box.y + (y - old.y) * sy];
  if (el.type === "stroke") return { ...el, points: el.points.map(p => pt(...p)) };
  if (["line", "arrow"].includes(el.type)) { const [x1, y1] = pt(el.x1, el.y1), [x2, y2] = pt(el.x2, el.y2); return { ...el, x1, y1, x2, y2 }; }
  if (el.type === "circle") return { ...el, cx: box.x + box.width / 2, cy: box.y + box.height / 2, r: Math.max(1, Math.min(box.width, box.height) / 2) };
  return { ...el, ...box };
}
const distance = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0]-a[0])*dx + (p[1]-a[1])*dy) / (dx*dx+dy*dy || 1)));
  return Math.hypot(p[0]-a[0]-t*dx, p[1]-a[1]-t*dy);
};
export function hitObject(el, point) {
  if (el.tool === "eraser") return false;
  if (el.type === "stroke") return el.points.some((p, i) => distance(point, p, el.points[Math.max(0, i-1)]) < Math.max(10, el.size));
  if (["line", "arrow"].includes(el.type)) return distance(point, [el.x1,el.y1], [el.x2,el.y2]) < Math.max(10,el.size);
  const b = bounds(el), pad = 8;
  return point[0] >= b.x-pad && point[0] <= b.x+b.width+pad && point[1] >= b.y-pad && point[1] <= b.y+b.height+pad;
}
