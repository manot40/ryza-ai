import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OnboardingStore, ONBOARDING_QUESTIONS, TUTORIAL_LINES } from './onboarding.svelte';
import { config } from './config.svelte';
import { LocalStorageMock } from '../../../tests/utils';

describe('OnboardingStore', () => {
  let mockStorage: LocalStorageMock;
  let store: OnboardingStore;

  beforeEach(() => {
    mockStorage = new LocalStorageMock();
    vi.stubGlobal('localStorage', mockStorage);
    config._resetForTest();
    store = new OnboardingStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('initializes with title stage when onboarding is not done', () => {
    expect(store.stage).toBe('title');
    expect(store.isDone).toBe(false);
    expect(store.questionIndex).toBe(0);
    expect(store.prologueIndex).toBe(1);
    expect(store.tutorialIndex).toBe(0);
  });

  it('starts questions when start() is called', () => {
    store.start();
    expect(store.stage).toBe('questions');
    expect(store.questionIndex).toBe(0);
  });

  it('skips onboarding and marks onboardingDone', () => {
    store.skip();
    expect(store.stage).toBe('done');
    expect(config.get('state').onboardingDone).toBe(true);
    expect(store.isDone).toBe(true);
  });

  it('saves identity and advances questions', () => {
    store.start();
    store.saveIdentity({
      name: 'Adventurer',
      birthday: '2000-01-01',
      gender: 'other',
    });

    expect(config.get('profile').name).toBe('Adventurer');
    expect(config.get('profile').birthday).toBe('2000-01-01');
    expect(config.get('profile').gender).toBe('other');
    expect(config.get('chara').callMe).toBe('Adventurer');

    store.nextQuestion();
    expect(store.questionIndex).toBe(1);
  });

  it('saves text answers and choice answers', () => {
    store.saveTextAnswer('profile.appearance', 'Red coat and hat');
    expect(config.get('profile').appearance).toBe('Red coat and hat');

    store.saveChoiceAnswer('profile.interest', ['Gathering', 'Exploring']);
    expect(config.get('profile').interest).toBe('Gathering、Exploring');
  });

  it('advances through questions into prologue', () => {
    store.start();
    store.questionIndex = ONBOARDING_QUESTIONS.length - 1;
    store.nextQuestion();

    expect(store.stage).toBe('prologue');
    expect(store.prologueIndex).toBe(1);
  });

  it('advances through prologue into tutorial', () => {
    store.startPrologue();
    for (let i = 1; i <= 8; i++) {
      store.nextPrologue();
      expect(store.prologueIndex).toBe(i + 1);
    }
    // Step 9 -> next moves to tutorial
    store.nextPrologue();
    expect(store.stage).toBe('tutorial');
    expect(store.tutorialIndex).toBe(0);
  });

  it('advances through tutorial lines and completes onboarding', () => {
    store.startTutorial();
    for (let i = 0; i < TUTORIAL_LINES.length - 1; i++) {
      store.nextTutorial();
      expect(store.tutorialIndex).toBe(i + 1);
    }
    // Final tutorial line advances to finish
    store.nextTutorial();
    expect(store.stage).toBe('done');
    expect(config.get('state').onboardingDone).toBe(true);
  });
});
