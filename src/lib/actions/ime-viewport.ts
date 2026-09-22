export interface ImeAdjustment {
  isImeOpen: boolean;
  height: string;
  top: string;
  bottom: string;
}

export function isAndroid(userAgent?: string): boolean {
  const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  return /Android/i.test(ua || '');
}

export function computeImeAdjustment(
  fullHeight: number,
  currentHeight: number,
  threshold = 40
): ImeAdjustment {
  const isImeOpen = fullHeight > 0 && currentHeight < fullHeight - threshold;
  if (isImeOpen) {
    return {
      isImeOpen: true,
      height: `${fullHeight}px`,
      top: 'auto',
      bottom: '0px',
    };
  }
  return {
    isImeOpen: false,
    height: '',
    top: '',
    bottom: '',
  };
}

export class ImeViewportTracker {
  lastW = 0;
  fullH = 0;

  constructor(initialWidth = 0, initialHeight = 0) {
    this.lastW = initialWidth;
    this.fullH = initialHeight;
  }

  handleResize(newW: number, newH: number): { changedBaseline: boolean; adjustment: ImeAdjustment } {
    let changedBaseline = false;
    if (newW !== this.lastW) {
      this.lastW = newW;
      this.fullH = newH;
      changedBaseline = true;
    } else if (newH >= this.fullH) {
      this.fullH = newH;
    }

    const adjustment = computeImeAdjustment(this.fullH, newH);
    return { changedBaseline, adjustment };
  }
}

export function imeViewport(node: HTMLElement) {
  if (typeof window === 'undefined' || !isAndroid()) {
    return {
      destroy() {},
    };
  }

  const tracker = new ImeViewportTracker(window.innerWidth, window.innerHeight);

  function applyAdjustment() {
    const { adjustment } = tracker.handleResize(window.innerWidth, window.innerHeight);
    node.style.height = adjustment.height;
    node.style.top = adjustment.top;
    node.style.bottom = adjustment.bottom;
  }

  window.addEventListener('resize', applyAdjustment);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', applyAdjustment);
  }

  return {
    destroy() {
      window.removeEventListener('resize', applyAdjustment);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', applyAdjustment);
      }
    },
  };
}
