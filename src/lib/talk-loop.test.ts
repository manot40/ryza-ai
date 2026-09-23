import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TalkLoopController } from './talk-loop.svelte';
import { config } from '$lib/stores/config.svelte';
import { game } from '$lib/stores/game.svelte';
import { memory } from '$lib/stores/memory.svelte';
import { longMem } from '$lib/stores/longmem.svelte';
import { quests } from '$lib/stores/quests.svelte';
import { session } from '$lib/stores/session.svelte';
import { overlayStore } from '$lib/stores/overlay.svelte';
import { avatarService } from '$lib/avatar/avatar-service.svelte';
import { voiceBank } from '$lib/audio/voicebank';
import * as api from '$lib/api';

vi.mock('$lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api')>();
  return {
    ...actual,
    chat: vi.fn(),
    speak: vi.fn(),
    translate: vi.fn(),
  };
});

describe('TalkLoopController', () => {
  let controller: TalkLoopController;

  beforeEach(() => {
    vi.clearAllMocks();
    config._resetForTest();
    game.reset();
    memory.reset();
    longMem.reset();
    session.clearHistory();
    overlayStore.closeAllSheets();
    overlayStore.closeFaint();
    controller = new TalkLoopController();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('API Key and Stamina Guardrails', () => {
    it('blocks say() when apiKey is missing', async () => {
      config.setLLM('apiKey', '');
      await controller.say('Hello!');

      expect(api.chat).not.toHaveBeenCalled();
      expect(controller.displayText).toBe('');
      expect(session.history).toHaveLength(0);
    });

    it('blocks say() and opens faint overlay when stamina is depleted', async () => {
      config.setLLM('apiKey', 'test-key');
      game.spend(game.stamina, 'test');
      expect(game.faint()).toBe(true);

      await controller.say('Hello!');
      expect(api.chat).not.toHaveBeenCalled();
      expect(overlayStore.faintOpen).toBe(true);
    });
  });

  describe('Successful Talk Turn', () => {
    it('sends prompt, handles reply, applies delta and emotion, updates history and pages', async () => {
      config.setLLM('apiKey', 'test-key');
      const setEmotionSpy = vi.spyOn(avatarService, 'setEmotion');

      const mockReply = {
        text: 'Hello adventurer! Let us gather some apples.',
        emotion: 'happy',
        attitude: 'agree',
        state: { exp: 20, money: 10 },
      };
      (api.chat as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockReply);

      await controller.say('Good morning!');

      expect(api.chat).toHaveBeenCalledTimes(1);

      // Verify history
      expect(session.history).toHaveLength(2);
      expect(session.history[0]).toMatchObject({ role: 'user', content: 'Good morning!' });
      expect(session.history[1].role).toBe('assistant');

      // Verify memory pending ingestion
      expect(memory.pending).toHaveLength(2);
      expect(memory.pending[0].text).toBe('Good morning!');
      expect(memory.pending[1].text).toBe(mockReply.text);

      // Verify game state delta application
      expect(game.money).toBe(40); // Initial 30 + 10

      // Verify emotion dispatch
      expect(setEmotionSpy).toHaveBeenCalledWith('happy', 'agree');

      // Verify recent pages
      expect(controller.recentPages).toContain(mockReply.text);
      expect(controller.displayText).toBe(mockReply.text);
    });

    it('passes memory.toChatHistory() to apiChat on ongoing turns when memory is enabled', async () => {
      config.setLLM('apiKey', 'test-key');
      memory.ingest('Prior question', 'Prior reply');

      const mockReply = { text: 'New reply', emotion: 'smile', attitude: 'agree' };
      (api.chat as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockReply);

      await controller.say('Followup question');

      expect(api.chat).toHaveBeenCalledWith(
        [
          { role: 'user', content: 'Prior question' },
          { role: 'assistant', content: 'Prior reply' },
        ],
        'Followup question',
        expect.any(Object)
      );
    });

    it('falls back to sliced session.history when memory is disabled', async () => {
      config.setLLM('apiKey', 'test-key');
      config.setMemory('enabled', false);

      session.pushHistory({ role: 'user', content: 'History turn 1' });
      session.pushHistory({ role: 'assistant', content: 'History turn 2' });

      const mockReply = { text: 'Turn 3 reply' };
      (api.chat as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockReply);

      await controller.say('Turn 3 question');

      expect(api.chat).toHaveBeenCalledWith(
        [
          expect.objectContaining({ role: 'user', content: 'History turn 1' }),
          expect.objectContaining({ role: 'assistant', content: 'History turn 2' }),
        ],
        'Turn 3 question',
        expect.any(Object)
      );
    });
  });

  describe('Error Handling', () => {
    it('handles generic LLM error gracefully with fallback text and retry option', async () => {
      config.setLLM('apiKey', 'test-key');
      (api.chat as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Internal server error 500')
      );

      await controller.say('Hello?');

      expect(controller.isThinking).toBe(false);
      expect(controller.retryVisible).toBe(true);
      expect(controller.displayText).toContain('繋がらないみたい');
    });

    it('handles timeout error with specific settings advice', async () => {
      config.setLLM('apiKey', 'test-key');
      const err = new Error('Timed out');
      (err as unknown as { code: string }).code = 'timeout';
      (api.chat as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(err);

      await controller.say('Hello?');

      expect(controller.isThinking).toBe(false);
      expect(controller.retryVisible).toBe(true);
      expect(controller.displayText).toContain('返事を待ってるのに');
    });

    it('handles network error with specific URL advice', async () => {
      config.setLLM('apiKey', 'test-key');
      const err = new Error('Failed to fetch');
      (err as unknown as { code: string }).code = 'net';
      (api.chat as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(err);

      await controller.say('Hello?');

      expect(controller.isThinking).toBe(false);
      expect(controller.retryVisible).toBe(true);
      expect(controller.displayText).toContain('そのアドレスに辿り着けないみたい');
    });
  });

  describe('Greetings and Scenes', () => {
    it('greets with day 1 line when day is 1', () => {
      config.setState('day', 1);
      config.setLLM('lang', 'ja');
      controller.greet();
      expect(controller.displayText).toContain('やあ、会えたね');

      config.setLLM('lang', 'en');
      controller.greet();
      expect(controller.displayText).toContain('Hey, there you are');
    });

    it('greets with day N line when day > 1', () => {
      config.setState('day', 5);
      config.setLLM('lang', 'ja');
      controller.greet();
      expect(controller.displayText).toContain('今日も、会えたね');

      config.setLLM('lang', 'en');
      controller.greet();
      expect(controller.displayText).toContain('There you are again today');
    });

    it('sleepHome refills stamina and returns to safe stage', () => {
      game.spend(40, 'test');
      expect(game.stamina).toBeLessThan(game.max());

      controller.sleepHome();

      expect(config.get('state').stage).toBe('stage_01_001_04');
      expect(game.stamina).toBe(game.max());
      expect(overlayStore.faintOpen).toBe(false);
    });

    it('playWellDone triggers playFile with wellDone voice clip', async () => {
      const playFileSpy = vi.spyOn(controller, 'playFile').mockImplementation(() => {});
      vi.spyOn(voiceBank, 'pick').mockReturnValue('assets/audio/alarm/ja/normal/wellDone/daytime/1.m4a');
      vi.useFakeTimers();

      await controller.playWellDone();
      vi.advanceTimersByTime(600);

      expect(playFileSpy).toHaveBeenCalled();
      expect(playFileSpy.mock.calls[0][0]).toContain('wellDone');

      vi.useRealTimers();
    });
  });

  describe('Speech Synthesis Emotion Propagation', () => {
    it('passes reply.emotion to api.speak during say()', async () => {
      config.setLLM('apiKey', 'test-key');
      config.setLLM('lang', 'ja');
      config.setTTS('lang', 'ja');
      config.setApp('voice', true);
      config.setTTS('mode', 'preset');

      const mockReply = {
        text: 'こんにちは！元気だよ！',
        emotion: 'happy',
        attitude: 'agree',
      };
      (api.chat as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockReply);
      (api.speak as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce('blob:mock-voice-url');

      await controller.say('こんにちは！');

      expect(api.speak).toHaveBeenCalledWith('こんにちは！元気だよ！', 'ja', 'chat', 'happy');
    });

    it('passes explicit emotion to api.speak during speakThen()', async () => {
      config.setLLM('lang', 'ja');
      config.setTTS('lang', 'ja');
      config.setApp('voice', true);
      config.setTTS('mode', 'preset');
      (api.speak as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce('blob:mock-voice-url');

      await controller.speakThen('えへへ、照れるな', 'shy');

      expect(api.speak).toHaveBeenCalledWith('えへへ、照れるな', 'ja', 'chat', 'shy');
    });

    it('falls back to avatarService.currentEmotion if emotion omitted in speakThen()', async () => {
      config.setLLM('lang', 'ja');
      config.setTTS('lang', 'ja');
      config.setApp('voice', true);
      config.setTTS('mode', 'preset');
      avatarService.setEmotion('sad', 'agree');
      (api.speak as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce('blob:mock-voice-url');

      await controller.speakThen('悲しいよ…');

      expect(api.speak).toHaveBeenCalledWith('悲しいよ…', 'ja', 'chat', 'sad');
    });
  });
});
