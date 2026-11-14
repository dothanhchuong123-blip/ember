export type Box = { x0: number; x1: number; y0: number; y1: number }
export type Point = { x: number; y: number }

export function boxAt(x: number, y: number, width: number, height: number): Box {
  return { x0: x, x1: x + width, y0: y, y1: y + height }
}

export function inset(box: Box, amount: number): Box {
  return boxAt(box.x0 + amount, box.y0 + amount, box.x1 - box.x0 - 2 * amount, box.y1 - box.y0 - 2 * amount)
}

export function overlaps(a: Box, b: Box) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

// Each obstacle leaves up to four rectangles where a label or inspector can fit.
function freeRegions(bounds: Box, obstacles: Box[], minWidth: number, minHeight: number) {
  return obstacles.reduce((regions, obstacle) => {
    const next = new Map<string, Box>()
    for (const region of regions) {
      const pieces = overlaps(region, obstacle) ? [
        { ...region, x1: obstacle.x0 },
        { ...region, x0: obstacle.x1 },
        { ...region, y1: obstacle.y0 },
        { ...region, y0: obstacle.y1 },
      ] : [region]
      for (const box of pieces) {
        if (box.x1 - box.x0 >= minWidth && box.y1 - box.y0 >= minHeight) {
          next.set(`${box.x0},${box.x1},${box.y0},${box.y1}`, box)
        }
      }
    }
    return [...next.values()]
  }, [bounds])
}

export function placeLabel(
  bounds: Box, obstacles: Box[], dots: Point[], anchor: Point, size: Point, offset?: Point,
) {
  const preferred = offset
    ? { x: anchor.x + offset.x, y: anchor.y + offset.y }
    : { x: anchor.x + 16, y: anchor.y - size.y - 10 }
  let best: Box | undefined
  let bestScore = Infinity
  for (const region of freeRegions(bounds, obstacles, size.x, size.y)) {
    const x = clamp(preferred.x, region.x0, region.x1 - size.x)
    const y = clamp(preferred.y, region.y0, region.y1 - size.y)
    const label = boxAt(x, y, size.x, size.y)
    const distance = Math.hypot(x - preferred.x, y - preferred.y)
    // Keep manually moved labels close to the pointer. Automatic labels prefer clear space.
    const covered = offset ? 0 : dots.reduce((count, dot) => count + Number(
      dot.x >= x - 5 && dot.x <= label.x1 + 5 && dot.y >= y - 5 && dot.y <= label.y1 + 5
    ), 0)
    const score = distance + covered * 16
    if (score < bestScore) {
      best = label
      bestScore = score
    }
  }
  return best
}

export function placeInspector(bounds: Box, obstacles: Box[], dot: Point) {
  let best = { left: bounds.x0, top: bounds.y0, width: 0, maxHeight: 0 }
  let bestScore = -Infinity
  for (const area of freeRegions(bounds, obstacles, 1, 1)) {
    const width = Math.min(326, area.x1 - area.x0)
    const maxHeight = Math.min(270, area.y1 - area.y0)
    const left = clamp(dot.x + 16, area.x0, area.x1 - width)
    const top = clamp(dot.y - maxHeight / 2, area.y0, area.y1 - maxHeight)
    // Prefer a region that fits the full record, then one close to the test.
    const capacity = Math.min(width / 285, 1) * Math.min(maxHeight / 220, 1)
    const score = capacity * 1000 - Math.hypot(left + width / 2 - dot.x, top + maxHeight / 2 - dot.y) / 4
    if (score > bestScore) {
      best = { left, top, width, maxHeight }
      bestScore = score
    }
  }
  return best
}
