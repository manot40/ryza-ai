import { describe, it, expect } from 'vitest';
import { safeName, skeletonVersionOk, pngSize, validateCrf, readZip } from './crfstore';

describe('crfstore', () => {
  describe('safeName', () => {
    it('extracts filename and protects against traversal', () => {
      expect(safeName('foo/bar/baz.png')).toBe('baz.png');
      expect(safeName('normal.atlas')).toBe('normal.atlas');
      expect(() => safeName('/absolute/path.png')).toThrow('ZIP contains absolute path');
      expect(() => safeName('C:/path.png')).toThrow('ZIP contains absolute path');
      expect(() => safeName('foo/../bar.png')).toThrow('ZIP contains parent path traversal');
    });
  });

  describe('skeletonVersionOk', () => {
    it('validates Spine 4.2 binary header', () => {
      // 8 bytes hash + varint length 4 + '4.2.'
      const valid = new Uint8Array([
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        4,
        0x34,
        0x2e,
        0x32,
        0x2e, // "4.2."
        0,
        0,
      ]);
      expect(skeletonVersionOk(valid)).toBe(true);

      const invalid = new Uint8Array([
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        4,
        0x33,
        0x2e,
        0x38,
        0x2e, // "3.8."
        0,
        0,
      ]);
      expect(skeletonVersionOk(invalid)).toBe(false);
      expect(skeletonVersionOk(new Uint8Array([]))).toBe(false);
    });
  });

  describe('pngSize', () => {
    it('reads PNG width and height from IHDR', () => {
      const pngHeader = new Uint8Array([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a, // PNG magic
        0x00,
        0x00,
        0x00,
        0x0d, // IHDR length (13)
        0x49,
        0x48,
        0x44,
        0x52, // "IHDR"
        0x00,
        0x00,
        0x04,
        0x00, // width: 1024
        0x00,
        0x00,
        0x08,
        0x00, // height: 2048
        0x08,
        0x06,
        0x00,
        0x00,
        0x00,
      ]);
      const size = pngSize(pngHeader);
      expect(size).toEqual({ w: 1024, h: 2048 });
    });
  });

  describe('validateCrf', () => {
    it('validates complete skin set', () => {
      const base = 'crf_custom_01';
      const atlasText = `${base}.png\nsize: 1024, 2048\nformat: RGBA8888\nfilter: Linear, Linear\nrepeat: none\n`;
      const pngHeader = new Uint8Array([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a,
        0x00,
        0x00,
        0x00,
        0x0d,
        0x49,
        0x48,
        0x44,
        0x52,
        0x00,
        0x00,
        0x04,
        0x00, // 1024
        0x00,
        0x00,
        0x08,
        0x00, // 2048
        0x08,
        0x06,
        0x00,
        0x00,
        0x00,
      ]);
      const skelHeader = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 4, 0x34, 0x2e, 0x32, 0x2e, 0, 0]);
      const gestureJson = JSON.stringify({
        emotionalGesture: { smile: 'agree' },
      });

      const files: Record<string, Uint8Array> = {
        [`${base}.atlas`]: new TextEncoder().encode(atlasText),
        [`${base}.png`]: pngHeader,
        [`${base}.skel`]: skelHeader,
        [`${base}_gesture.json`]: new TextEncoder().encode(gestureJson),
      };

      const result = validateCrf(files);
      expect(result.id).toBe(base);
      expect(result.base).toBe(base);
      expect(result.gesture).toBeDefined();
    });

    it('rejects missing files or invalid headers', () => {
      expect(() => validateCrf({})).toThrow('Must contain exactly 1 .atlas file');
    });
  });
});
