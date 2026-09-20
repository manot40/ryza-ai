export interface FitUiZoomResult {
  zoom: number;
  changed: boolean;
}

/**
 * Calculates desktop/shell scale zoom based on viewport dimensions.
 * Bounded between 0.8 and 1.25.
 * Only applies if in shell (or forced); otherwise returns zoom 1.0.
 */
export function computeFitUiZoom(
  width: number,
  height: number,
  isShell: boolean,
  currentZoom: number = 1
): FitUiZoomResult {
  if (!isShell) {
    return {
      zoom: 1,
      changed: currentZoom !== 1,
    };
  }

  if (!width || !height) {
    return {
      zoom: currentZoom,
      changed: false,
    };
  }

  const raw = Math.min(width / 420, height / 860);
  const clamped = Math.max(0.8, Math.min(1.25, raw));

  // Threshold check to avoid feedback oscillation (same as legacy abs(z - current) > 0.02)
  if (Math.abs(clamped - currentZoom) > 0.02) {
    return {
      zoom: clamped,
      changed: true,
    };
  }

  return {
    zoom: currentZoom,
    changed: false,
  };
}

/**
 * Computes panel height fraction relative to viewport height.
 * Bounded by min 240px, max 340px, capped at 55% vh.
 */
export function computePanelFrac(viewportHeight: number): number {
  const vh = Math.max(1, viewportHeight);
  const targetPx = Math.min(340, Math.max(240, 0.34 * vh));
  return Math.min(0.55, targetPx / vh);
}
