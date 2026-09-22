<script lang="ts">
  import { Button } from '$components/ui/button';
  import { Input } from '$components/ui/input';
  import { Textarea } from '$components/ui/textarea';
  import { onboarding, ONBOARDING_QUESTIONS, type OnboardingQuestion } from '$lib/stores/onboarding.svelte';
  import { config } from '$lib/stores/config.svelte';

  let currentQ = $derived<OnboardingQuestion>(
    ONBOARDING_QUESTIONS[onboarding.questionIndex] || ONBOARDING_QUESTIONS[0]
  );

  // Identity state
  let idName = $state('');
  let idBirthday = $state('');
  let idGender = $state('female');

  // Text response state
  let textAnswer = $state('');

  // Choices state
  let selectedChoices = $state<string[]>([]);

  $effect(() => {
    // Sync current values when question index changes
    const profile = config.get('profile');
    if (currentQ.type === 'identity') {
      idName = profile.name || '';
      idBirthday = profile.birthday || '';
      idGender = profile.gender || 'female';
    } else if (currentQ.type === 'text') {
      textAnswer = (profile[currentQ.field?.replace('profile.', '') as keyof typeof profile] as string) || '';
    } else {
      selectedChoices = [];
    }
  });

  const questionPrompts: Record<
    string,
    { prompt: string; sub: string; ph?: string; choices?: Record<string, string> }
  > = {
    identity: {
      prompt: "First, let's get to know you",
      sub: 'Your name, birthday, and gender will help Ryza address you properly.',
    },
    appearance: {
      prompt: 'What do you look like?',
      sub: 'Give Ryza a hint so she can picture you.',
      ph: 'e.g. Dark hair, wearing a travel coat...',
    },
    background: {
      prompt: 'What kind of journey brought you here?',
      sub: 'Your background, hometown, or whatever comes to mind.',
    },
    hobby: {
      prompt: 'What do you enjoy doing in your free time?',
      sub: 'Hobbies and pastimes.',
    },
    activities: {
      prompt: 'What would you most like to do with Ryza?',
      sub: 'Select all that appeal to you.',
      choices: {
        'onb.q04.c1': 'Adventuring and treasure hunting',
        'onb.q04.c2': 'Running an atelier shop together',
        'onb.q04.c3': 'Synthesizing items',
        'onb.q04.c4': 'Relaxing and chatting',
        'onb.q04.c5': 'Listening to her stories',
      },
    },
    alchemy: {
      prompt: 'What interests you about alchemy?',
      sub: 'Select all that apply.',
      choices: {
        'onb.q05.c1': 'Gathering materials',
        'onb.q05.c2': 'Learning recipes',
        'onb.q05.c3': 'Fun experiments even if they fail',
        'onb.q05.c4': 'Enhancing equipment',
        'onb.q05.c5': 'Brewing recovery potions',
        'onb.q05.c6': 'Still new to it, want to learn',
      },
    },
    story: {
      prompt: 'Where would you like our story to begin?',
      sub: 'Choose a starting point.',
      choices: {
        'onb.q06.c1': 'Daily life on Kurken Island',
        'onb.q06.c2': 'Having known each other for a long time',
      },
    },
    goals: {
      prompt: 'What goals do you hope to achieve?',
      sub: 'For yourself, and to share with Ryza.',
    },
    personality: {
      prompt: 'How would you describe your personality?',
      sub: 'Your temperament and way of getting along.',
    },
  };

  function handleNext() {
    if (currentQ.type === 'identity') {
      onboarding.saveIdentity({
        name: idName,
        birthday: idBirthday,
        gender: idGender,
      });
    } else if (currentQ.type === 'text' && currentQ.field) {
      onboarding.saveTextAnswer(currentQ.field, textAnswer);
    } else if ((currentQ.type === 'multi' || currentQ.type === 'single') && currentQ.field) {
      onboarding.saveChoiceAnswer(currentQ.field, selectedChoices);
    }
    onboarding.nextQuestion();
  }

  function toggleChoice(key: string, label: string) {
    if (currentQ.type === 'single') {
      selectedChoices = [label];
    } else {
      if (selectedChoices.includes(label)) {
        selectedChoices = selectedChoices.filter((c) => c !== label);
      } else {
        selectedChoices = [...selectedChoices, label];
      }
    }
  }
</script>

{#if !onboarding.isDone && onboarding.stage === 'questions'}
  <div
    class="fixed inset-0 z-40 flex items-center justify-center bg-background/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
    <div
      class="w-full max-w-md rounded-2xl bg-card/95 border border-border/60 shadow-2xl p-6 flex flex-col gap-4">
      <!-- Step Progress -->
      <div class="flex items-center justify-between text-xs text-muted-foreground font-mono">
        <span>Question</span>
        <span>{onboarding.questionIndex + 1} / {ONBOARDING_QUESTIONS.length}</span>
      </div>

      <!-- Question Title & Subtitle -->
      <div class="flex flex-col gap-1">
        <h2 class="text-lg font-bold text-gold">
          {questionPrompts[currentQ.id]?.prompt || currentQ.promptKey}
        </h2>
        <p class="text-xs text-muted-foreground">
          {questionPrompts[currentQ.id]?.sub || currentQ.subKey}
        </p>
      </div>

      <!-- Question Body -->
      <div class="flex flex-col gap-3 my-2">
        {#if currentQ.type === 'identity'}
          <div class="flex flex-col gap-1.5">
            <label for="onb-name" class="text-xs font-semibold text-foreground">Name</label>
            <Input id="onb-name" bind:value={idName} placeholder="Your name" class="h-9 text-xs" />
          </div>

          <div class="flex flex-col gap-1.5">
            <label for="onb-bday" class="text-xs font-semibold text-foreground">Birthday</label>
            <Input id="onb-bday" type="date" bind:value={idBirthday} class="h-9 text-xs" />
          </div>

          <div class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-foreground">Gender</span>
            <div class="flex gap-2">
              {#each ['female', 'male', 'other'] as g}
                <Button
                  variant={idGender === g ? 'default' : 'outline'}
                  size="sm"
                  class="flex-1 h-8 text-xs capitalize {idGender === g
                    ? 'bg-gold text-background font-semibold'
                    : 'border-border/40 text-foreground/80'}"
                  onclick={() => (idGender = g)}>
                  {g}
                </Button>
              {/each}
            </div>
          </div>
        {:else if currentQ.type === 'text'}
          <Textarea
            bind:value={textAnswer}
            placeholder={questionPrompts[currentQ.id]?.ph || ''}
            rows={4}
            class="text-xs" />
        {:else if currentQ.type === 'multi' || currentQ.type === 'single'}
          {@const choiceMap = questionPrompts[currentQ.id]?.choices || {}}
          <div class="flex flex-col gap-2">
            {#each currentQ.choices || [] as k}
              {@const label = choiceMap[k] || k}
              {@const isSelected = selectedChoices.includes(label)}
              <Button
                variant={isSelected ? 'default' : 'outline'}
                size="sm"
                class="justify-start h-9 px-3 text-xs text-left rounded-xl {isSelected
                  ? 'bg-gold text-background font-semibold'
                  : 'border-border/40 text-foreground/80'}"
                onclick={() => toggleChoice(k, label)}>
                <span>{label}</span>
              </Button>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Action Buttons (Skip & Next) -->
      <div class="flex items-center justify-between pt-2 border-t border-border/40">
        <Button
          variant="ghost"
          size="sm"
          class="text-xs text-muted-foreground"
          onclick={() => onboarding.skip()}>
          Skip
        </Button>
        <Button
          size="sm"
          class="h-9 px-5 text-xs font-semibold bg-gold text-background hover:bg-gold/90"
          onclick={handleNext}>
          {onboarding.questionIndex + 1 >= ONBOARDING_QUESTIONS.length ? 'Finish' : 'Next'}
        </Button>
      </div>
    </div>
  </div>
{/if}
