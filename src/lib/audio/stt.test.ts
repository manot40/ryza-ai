import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Stt, frameLevel, int16, wavBlob, feedLevel } from './stt';

describe('Stt Audio & VAD Engine', () => {
  beforeEach(() => {
    Stt._reset();
  });

  it('calculates frame level RMS correctly', () => {
    const silent = new Float32Array(100);
    expect(frameLevel(silent)).toBe(0);

    const fullScale = new Float32Array(100).fill(1.0);
    expect(frameLevel(fullScale)).toBe(1.0);
  });

  it('converts Float32 frames to Int16', () => {
    const float = new Float32Array([0, 1.0, -1.0, 0.5]);
    const i16 = int16(float);
    expect(i16[0]).toBe(0);
    expect(i16[1]).toBe(0x7fff);
    expect(i16[2]).toBe(-0x8000);
    expect(i16[3]).toBe(Math.floor(0.5 * 0x7fff));
  });

  it('constructs a valid WAV Blob header and payload', async () => {
    const frame = new Int16Array([0, 100, 200, 300]);
    const blob = wavBlob([frame], 16000);
    expect(blob.type).toBe('audio/wav');
    expect(blob.size).toBe(44 + frame.length * 2);

    const buf = await blob.arrayBuffer();
    const view = new DataView(buf);
    // 'RIFF'
    expect(view.getUint8(0)).toBe(0x52);
    expect(view.getUint8(1)).toBe(0x49);
    expect(view.getUint8(2)).toBe(0x46);
    expect(view.getUint8(3)).toBe(0x46);
    // 'WAVE'
    expect(view.getUint8(8)).toBe(0x57);
    expect(view.getUint8(9)).toBe(0x41);
    expect(view.getUint8(10)).toBe(0x56);
    expect(view.getUint8(11)).toBe(0x45);
    // sample rate
    expect(view.getUint32(24, true)).toBe(16000);
  });

  it('triggers speech confirmation and closes utterance after silence', () => {
    const mockTranscribe = vi.fn().mockResolvedValue('こんにちは');
    const mockSink = vi.fn();
    const mockOnset = vi.fn();

    Stt.setTranscriber(mockTranscribe);
    Stt.setSink(mockSink);
    Stt.setOnset(mockOnset);

    // Bootstrap baseline
    feedLevel(0.01, 1000);
    feedLevel(0.01, 1050);

    // Speech burst
    feedLevel(0.5, 1100);
    feedLevel(0.5, 1200);
    feedLevel(0.5, 1350); // > 200ms -> confirms speech!
    expect(mockOnset).toHaveBeenCalledTimes(1);

    // Silence
    feedLevel(0.01, 1400);
    feedLevel(0.01, 1750); // > 300ms silence -> close utterance
    expect(Stt._state().speaking).toBe(false);
  });
});
