// @wc-ignore-file

import { config } from './config.svelte';
import { sound } from '../audio/sound';

export type OnboardingStage = 'title' | 'questions' | 'prologue' | 'tutorial' | 'done';

export interface OnboardingQuestion {
  id: string;
  type: 'identity' | 'text' | 'multi' | 'single';
  field?: string;
  promptKey: string;
  subKey: string;
  phKey?: string;
  choices?: string[];
}

export interface TutorialLine {
  emotion: string;
  attitude: string;
  ja: string;
}

export const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  {
    id: 'identity',
    type: 'identity',
    promptKey: 'onb.identity.prompt',
    subKey: 'onb.identity.sub',
  },
  {
    id: 'appearance',
    type: 'text',
    field: 'profile.appearance',
    promptKey: 'onb.q01.prompt',
    subKey: 'onb.q01.sub',
    phKey: 'onb.q01.ph',
  },
  {
    id: 'background',
    type: 'text',
    field: 'profile.background',
    promptKey: 'onb.q02.prompt',
    subKey: 'onb.q02.sub',
  },
  {
    id: 'hobby',
    type: 'text',
    field: 'profile.hobby',
    promptKey: 'onb.q03.prompt',
    subKey: 'onb.q03.sub',
  },
  {
    id: 'activities',
    type: 'multi',
    field: 'profile.interest',
    promptKey: 'onb.q04.prompt',
    subKey: 'onb.q04.sub',
    choices: ['onb.q04.c1', 'onb.q04.c2', 'onb.q04.c3', 'onb.q04.c4', 'onb.q04.c5'],
  },
  {
    id: 'alchemy',
    type: 'multi',
    field: 'profile.interestExtra',
    promptKey: 'onb.q05.prompt',
    subKey: 'onb.q05.sub',
    choices: ['onb.q05.c1', 'onb.q05.c2', 'onb.q05.c3', 'onb.q05.c4', 'onb.q05.c5', 'onb.q05.c6'],
  },
  {
    id: 'story',
    type: 'single',
    field: 'profile.storyStart',
    promptKey: 'onb.q06.prompt',
    subKey: 'onb.q06.sub',
    choices: ['onb.q06.c1', 'onb.q06.c2'],
  },
  {
    id: 'goals',
    type: 'text',
    field: 'profile.futureGoals',
    promptKey: 'onb.q07.prompt',
    subKey: 'onb.q07.sub',
  },
  {
    id: 'personality',
    type: 'text',
    field: 'profile.personality',
    promptKey: 'onb.q08.prompt',
    subKey: 'onb.q08.sub',
  },
];

export const TUTORIAL_LINES: TutorialLine[] = [
  { emotion: 'happy', attitude: 'agree', ja: 'やあ、会えたね。あたし、ライザ。これからよろしくね。' },
  { emotion: 'happy', attitude: 'agree', ja: '画面の見方を説明するね。' },
  {
    emotion: 'neutral',
    attitude: 'agree',
    ja: '上のほうのリンゴはあたしのスタミナ。無くなると気絶しちゃうから、気をつけて。安全な場所で寝ると回復するよ。',
  },
  {
    emotion: 'laughing',
    attitude: 'agree',
    ja: '手に入れたアイテムは、ここにしまわれるよ。この世界のお金だよ——これも。',
  },
  {
    emotion: 'tease',
    attitude: 'question',
    ja: 'なんでも聞いてね。困ったときは、まずは船を手に入れて、船で自由に旅へ出ようとあたしは思ってる！',
  },
  {
    emotion: 'happy',
    attitude: 'agree',
    ja: '迷ったら、クエストを進めてみて。君だけの自由な発想で、クエストをクリアしていくのを、楽しみにしてるよ。',
  },
  { emotion: 'laughing', attitude: 'agree', ja: 'まずはあたしとお喋りでもしてリフレッシュしよっ' },
];

export interface IdentityAnswer {
  name: string;
  birthday: string;
  gender: string;
}

export class OnboardingStore {
  stage = $state<OnboardingStage>('title');
  questionIndex = $state(0);
  prologueIndex = $state(1);
  tutorialIndex = $state(0);

  isDone = $derived(Boolean(this.state.onboardingDone));

  constructor() {
    if (typeof window !== 'undefined' && this.isDone) {
      this.stage = 'done';
    }
  }

  private get state() {
    return config.section('state') || {};
  }

  start(): void {
    sound.unlock().catch(() => {});
    sound.setRoute('title');
    this.stage = 'questions';
    this.questionIndex = 0;
  }

  skip(): void {
    config.set('state.onboardingDone', true);
    this.stage = 'done';
    sound.setRoute(this.state.onboardingDone ? 'talk' : 'title');
  }

  saveIdentity(identity: IdentityAnswer): void {
    const trimmed = identity.name.trim();
    config.set('profile.name', trimmed);
    config.set('profile.birthday', identity.birthday);
    config.set('profile.gender', identity.gender);
    if (trimmed) {
      config.set('chara.callMe', trimmed);
    }
  }

  saveTextAnswer(field: string, text: string): void {
    config.set(field, text.trim());
  }

  saveChoiceAnswer(field: string, choices: string[]): void {
    config.set(field, choices.join('、'));
  }

  nextQuestion(): void {
    if (this.questionIndex + 1 < ONBOARDING_QUESTIONS.length) {
      this.questionIndex++;
    } else {
      this.startPrologue();
    }
  }

  startPrologue(): void {
    this.stage = 'prologue';
    this.prologueIndex = 1;
    sound.setRoute('prologue');
  }

  nextPrologue(): void {
    if (this.prologueIndex < 9) {
      this.prologueIndex++;
    } else {
      this.startTutorial();
    }
  }

  startTutorial(): void {
    this.stage = 'tutorial';
    this.tutorialIndex = 0;
    sound.setRoute('talk');
  }

  nextTutorial(): void {
    if (this.tutorialIndex + 1 < TUTORIAL_LINES.length) {
      this.tutorialIndex++;
    } else {
      this.stage = 'done';
      config.set('state.onboardingDone', true);
    }
  }
}

export const onboarding = new OnboardingStore();
export default onboarding;
