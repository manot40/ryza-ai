import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TalkLoopController } from './talk-loop.svelte';
import { config } from '$lib/stores/config.svelte';
import { game } from '$lib/stores/game.svelte';
import { memory } from '$lib/stores/memory.svelte';
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
    session.clearHistory();
    session.clearDiary();
    overlayStore.closeAllSheets();
    overlayStore.closeFaint();
    controller = new TalkLoopController();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('API Key and Stamina Guardrails', () => {
    it('blocks say() when apiKey is missing', async () => {
      config.set('llm.apiKey', '');
      await controller.say('Hello!');

      expect(api.chat).not.toHaveBeenCalled();
      expect(controller.displayText).toBe('');
      expect(session.history).toHaveLength(0);
    });

    it('blocks say() and opens faint overlay when stamina is depleted', async () => {
      config.set('llm.apiKey', 'test-key');
      game.spend(game.stamina, 'test');
      expect(game.faint()).toBe(true);

      await controller.say('Hello!');
      expect(api.chat).not.toHaveBeenCalled();
      expect(overlayStore.faintOpen).toBe(true);
    });
  });

  describe('Successful Talk Turn', () => {
    it('sends prompt, handles reply, applies delta and emotion, updates history and pages', async () => {
      config.set('llm.apiKey', 'test-key');
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
      expect(session.history[0]).toEqual({ role: 'user', content: 'Good morning!' });
      expect(session.history[1].role).toBe('assistant');

      // Verify diary
      expect(session.diary).toHaveLength(2);
      expect(session.diary[0].text).toBe('Good morning!');
      expect(session.diary[1].text).toBe(mockReply.text);

      // Verify game state delta application
      expect(game.money).toBe(40); // Initial 30 + 10

      // Verify emotion dispatch
      expect(setEmotionSpy).toHaveBeenCalledWith('happy', 'agree');

      // Verify recent pages
      expect(controller.recentPages).toContain(mockReply.text);
      expect(controller.displayText).toBe(mockReply.text);
    });
  });

  describe('Error Handling', () => {
    it('handles LLM error gracefully with fallback text and retry option', async () => {
      config.set('llm.apiKey', 'test-key');
      (api.chat as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network timeout'));

      await controller.say('Hello?');

      expect(controller.isThinking).toBe(false);
      expect(controller.retryVisible).toBe(true);
      expect(controller.displayText).toContain('うまく聞こえなかった');
    });
  });

  describe('Greetings and Scenes', () => {
    it('greets with day 1 line when day is 1', () => {
      config.set('state.day', 1);
      config.set('llm.lang', 'ja');
      controller.greet();
      expect(controller.displayText).toContain('やあ、会えたね');

      config.set('llm.lang', 'en');
      controller.greet();
      expect(controller.displayText).toContain('Hey, there you are');
    });

    it('greets with day N line when day > 1', () => {
      config.set('state.day', 5);
      config.set('llm.lang', 'ja');
      controller.greet();
      expect(controller.displayText).toContain('今日も、会えたね');

      config.set('llm.lang', 'en');
      controller.greet();
      expect(controller.displayText).toContain('There you are again today');
    });

    it('sleepHome refills stamina and returns to safe stage', () => {
      game.spend(40, 'test');
      expect(game.stamina).toBeLessThan(game.max());

      controller.sleepHome();

      expect(config.section('state').stage).toBe('stage_01_001_04');
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
});
