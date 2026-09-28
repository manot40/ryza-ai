import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { voicePlayer } from './voice-player.svelte';
import { config } from '$lib/stores/config.svelte';
import { avatarService } from '$lib/avatar/avatar-service.svelte';
import { voiceBank } from '$lib/audio/voicebank';
import { LocalStorageMock } from '../../../tests/utils';
import * as api from '$lib/api';

vi.mock('$lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api')>();
  return {
    ...actual,
    speak: vi.fn(),
  };
});

vi.mock('$lib/api/translator', () => ({
  translate: vi.fn(),
}));

describe('VoicePlayer', () => {
  let mockStorage: LocalStorageMock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage = new LocalStorageMock();
    vi.stubGlobal('localStorage', mockStorage);
    config._resetForTest();
    voicePlayer.stop();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('prepareSpeech', () => {
    it('returns null when app voice is disabled', async () => {
      config.setApp('voice', false);
      const url = await voicePlayer.prepareSpeech('Hello');
      expect(url).toBeNull();
      expect(api.speak).not.toHaveBeenCalled();
    });

    it('returns null when style is text mode', async () => {
      config.setState('style', 'text');
      const url = await voicePlayer.prepareSpeech('Hello');
      expect(url).toBeNull();
      expect(api.speak).not.toHaveBeenCalled();
    });

    it('returns null when TTS mode is off', async () => {
      config.setTTS('mode', 'off');
      const url = await voicePlayer.prepareSpeech('Hello');
      expect(url).toBeNull();
      expect(api.speak).not.toHaveBeenCalled();
    });

    it('synthesizes speech and stores in voicePlayer state', async () => {
      config.setApp('voice', true);
      config.setTTS('mode', 'preset');
      config.setTTS('lang', 'ja');
      config.setLLM('lang', 'ja');

      (api.speak as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce('blob:test-url');

      const url = await voicePlayer.prepareSpeech('こんにちは', 'happy');
      expect(url).toBe('blob:test-url');
      expect(voicePlayer.lastVoiceUrl).toBe('blob:test-url');
      expect(voicePlayer.lastVoiceKey).toMatch(/^v\d+_/);
    });

    it('translates speech when tts language differs from reply language', async () => {
      config.setApp('voice', true);
      config.setTTS('mode', 'preset');
      config.setLLM('lang', 'ja');
      config.setTTS('lang', 'en');

      (api.translate as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce('Hello there!');
      (api.speak as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce('blob:translated-url');

      const url = await voicePlayer.prepareSpeech('こんにちは', 'happy');
      expect(api.translate).toHaveBeenCalledWith({
        text: 'こんにちは',
        toLang: 'en',
        emotion: 'happy',
      });
      expect(api.speak).toHaveBeenCalledWith('Hello there!', 'en', 'chat', 'happy');
      expect(url).toBe('blob:translated-url');
    });

    it('aborts speech preparation when signal is aborted', async () => {
      config.setApp('voice', true);
      config.setTTS('mode', 'preset');

      const abortController = new AbortController();
      abortController.abort();

      const url = await voicePlayer.prepareSpeech('こんにちは', 'happy', {
        signal: abortController.signal,
      });
      expect(url).toBeNull();
      expect(api.speak).not.toHaveBeenCalled();
    });
  });

  describe('playWellDone', () => {
    it('picks clip from voiceBank and plays file', async () => {
      const playFileSpy = vi.spyOn(voicePlayer, 'playFile').mockResolvedValue();
      vi.spyOn(voiceBank, 'pick').mockReturnValue('assets/audio/alarm/ja/normal/wellDone/daytime/1.m4a');
      vi.useFakeTimers();

      await voicePlayer.playWellDone();
      vi.advanceTimersByTime(600);

      expect(playFileSpy).toHaveBeenCalledWith('assets/audio/alarm/ja/normal/wellDone/daytime/1.m4a');
      vi.useRealTimers();
    });
  });

  describe('stop and favorites', () => {
    it('stop resets speaking state and avatar talking state', () => {
      const setTalkingSpy = vi.spyOn(avatarService.engine, 'setTalking');
      voicePlayer.speaking = true;

      voicePlayer.stop();

      expect(voicePlayer.speaking).toBe(false);
      expect(setTalkingSpy).toHaveBeenCalledWith(false);
    });

    it('favLastVoice toggles favorite for active voice key', () => {
      voicePlayer.lastVoiceKey = 'test-key-1';
      expect(voicePlayer.isLastVoiceFav()).toBe(false);

      voicePlayer.favLastVoice();
      expect(voicePlayer.isLastVoiceFav()).toBe(true);

      voicePlayer.favLastVoice();
      expect(voicePlayer.isLastVoiceFav()).toBe(false);
    });
  });

  describe('speakThen', () => {
    it('passes explicit emotion to api.speak during speakThen()', async () => {
      config.setLLM('lang', 'ja');
      config.setTTS('lang', 'ja');
      config.setApp('voice', true);
      config.setTTS('mode', 'preset');
      (api.speak as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce('blob:mock-voice-url');

      const playUrlSpy = vi.spyOn(voicePlayer, 'playUrl').mockResolvedValue();
      await voicePlayer.speakThen('えへへ、照れるな', 'shy');

      expect(api.speak).toHaveBeenCalledWith('えへへ、照れるな', 'ja', 'chat', 'shy');
      expect(playUrlSpy).toHaveBeenCalledWith('blob:mock-voice-url', null);
    });

    it('falls back to avatarService.currentEmotion if emotion omitted in speakThen()', async () => {
      config.setLLM('lang', 'ja');
      config.setTTS('lang', 'ja');
      config.setApp('voice', true);
      config.setTTS('mode', 'preset');
      avatarService.setEmotion('sad', 'agree');
      (api.speak as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce('blob:mock-voice-url');

      const playUrlSpy = vi.spyOn(voicePlayer, 'playUrl').mockResolvedValue();
      await voicePlayer.speakThen('悲しいよ…');

      expect(api.speak).toHaveBeenCalledWith('悲しいよ…', 'ja', 'chat', 'sad');
      expect(playUrlSpy).toHaveBeenCalledWith('blob:mock-voice-url', null);
    });
  });
});
