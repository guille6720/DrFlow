export type FloatingAnchorRect = {
  top: number;
  bottom: number;
  left: number;
  width: number;
};

export type FloatingAnchorBox = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

const VIEWPORT_PADDING = 8;

/** Positions a panel below an anchor, or above if there is more room. */
export function computeFloatingAnchorBox(
  rect: FloatingAnchorRect,
  viewport: { width: number; height: number },
  preferredMaxHeight = 360,
  gap = 4
): FloatingAnchorBox {
  const spaceBelow = viewport.height - rect.bottom - gap - VIEWPORT_PADDING;
  const spaceAbove = rect.top - gap - VIEWPORT_PADDING;
  const openBelow = spaceBelow >= 140 || spaceBelow >= spaceAbove;
  const available = openBelow ? spaceBelow : spaceAbove;
  const maxHeight = Math.min(preferredMaxHeight, Math.max(120, available));
  const width = Math.min(rect.width, Math.max(160, viewport.width - VIEWPORT_PADDING * 2));
  const left = Math.min(
    Math.max(VIEWPORT_PADDING, rect.left),
    Math.max(VIEWPORT_PADDING, viewport.width - width - VIEWPORT_PADDING)
  );

  return {
    top: openBelow ? rect.bottom + gap : Math.max(VIEWPORT_PADDING, rect.top - gap - maxHeight),
    left,
    width,
    maxHeight,
  };
}
