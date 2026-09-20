<script lang="ts">
  import { onMount } from 'svelte';
  import { config } from '$lib/stores/config.svelte';
  import { viewStore } from '$lib/stores/view.svelte';
  import { session } from '$lib/stores/session.svelte';
  import Header from './Header.svelte';
  import { Button } from '$components/ui/button';
  import { Input } from '$components/ui/input';
  import { Textarea } from '$components/ui/textarea';
  import { Card, CardHeader, CardTitle, CardContent } from '$components/ui/card';

  let playerName = $state('');
  let callMe = $state('');
  let birthday = $state('');
  let gender = $state('');
  let appearance = $state('');
  let background = $state('');
  let hobby = $state('');
  let interest = $state('');
  let futureGoals = $state('');

  let personality = $state('');
  let likes = $state('');
  let dislikes = $state('');
  let situation = $state('');
  let extra = $state('');
  let savedNotice = $state(false);

  onMount(() => {
    const p = config.section('profile') || {};
    const c = config.section('chara') || {};
    playerName = p.name || '';
    callMe = c.callMe || '';
    birthday = p.birthday || '';
    gender = p.gender || '';
    appearance = p.appearance || '';
    background = p.background || '';
    hobby = p.hobby || '';
    interest = p.interest || '';
    futureGoals = p.futureGoals || '';

    personality = c.personality || '';
    likes = c.likes || '';
    dislikes = c.dislikes || '';
    situation = c.situation || '';
    extra = c.extra || '';
  });

  function handleSave() {
    config.set('profile.name', playerName);
    config.set('profile.birthday', birthday);
    config.set('profile.gender', gender);
    config.set('profile.appearance', appearance);
    config.set('profile.background', background);
    config.set('profile.hobby', hobby);
    config.set('profile.interest', interest);
    config.set('profile.futureGoals', futureGoals);

    config.set('chara.callMe', callMe);
    config.set('chara.personality', personality);
    config.set('chara.likes', likes);
    config.set('chara.dislikes', dislikes);
    config.set('chara.situation', situation);
    config.set('chara.extra', extra);

    savedNotice = true;
    setTimeout(() => {
      savedNotice = false;
    }, 2000);
  }
</script>

<!-- View Header -->
<Header title="Character Profile">
  <Button
    variant="outline"
    size="sm"
    class="h-8 text-xs border-border/50 text-gold hover:bg-gold/10"
    onclick={() => viewStore.setView('skin')}>
    👗 Costumes
  </Button>
</Header>

<!-- Form Content -->
<div class="flex-1 overflow-y-auto p-4 space-y-4 max-h-[70vh]">
  <!-- Player Profile Card -->
  <Card class="border-border/50 bg-card/75 shadow-sm">
    <CardHeader>
      <CardTitle class="text-sm font-bold text-gold">Adventurer Profile</CardTitle>
    </CardHeader>
    <CardContent class="space-y-3">
      <div class="space-y-1">
        <label for="chara-player-name" class="block text-xs font-medium text-foreground">Your Name</label>
        <Input id="chara-player-name" bind:value={playerName} placeholder="Adventurer" class="h-9 text-xs" />
      </div>

      <div class="space-y-1">
        <label for="chara-call-me" class="block text-xs font-medium text-foreground">
          How Ryza Calls You
        </label>
        <Input id="chara-call-me" bind:value={callMe} placeholder="You / Senpai" class="h-9 text-xs" />
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div class="space-y-1">
          <label for="chara-birthday" class="block text-xs font-medium text-foreground">Birthday</label>
          <Input id="chara-birthday" type="date" bind:value={birthday} class="h-9 text-xs" />
        </div>
        <div class="space-y-1">
          <label for="chara-gender" class="block text-xs font-medium text-foreground">Gender</label>
          <Input
            id="chara-gender"
            bind:value={gender}
            placeholder="Male / Female / Other"
            class="h-9 text-xs" />
        </div>
      </div>

      <div class="space-y-1">
        <label for="chara-appearance" class="block text-xs font-medium text-foreground">Appearance</label>
        <Input
          id="chara-appearance"
          bind:value={appearance}
          placeholder="Casual adventurer outfit..."
          class="h-9 text-xs" />
      </div>

      <div class="space-y-1">
        <label for="chara-background" class="block text-xs font-medium text-foreground">Background</label>
        <Input
          id="chara-background"
          bind:value={background}
          placeholder="Traveled from the mainland..."
          class="h-9 text-xs" />
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div class="space-y-1">
          <label for="chara-hobby" class="block text-xs font-medium text-foreground">Hobby</label>
          <Input id="chara-hobby" bind:value={hobby} placeholder="Fishing, crafting" class="h-9 text-xs" />
        </div>
        <div class="space-y-1">
          <label for="chara-interest" class="block text-xs font-medium text-foreground">Interest</label>
          <Input
            id="chara-interest"
            bind:value={interest}
            placeholder="Alchemy, ruins exploration"
            class="h-9 text-xs" />
        </div>
      </div>

      <div class="space-y-1">
        <label for="chara-future-goals" class="block text-xs font-medium text-foreground">Future Goals</label>
        <Input
          id="chara-future-goals"
          bind:value={futureGoals}
          placeholder="Become a renowned explorer..."
          class="h-9 text-xs" />
      </div>
    </CardContent>
  </Card>

  <!-- Ryza Persona Card -->
  <Card class="border-border/50 bg-card/75 shadow-sm">
    <CardHeader>
      <CardTitle class="text-sm font-bold text-gold">Ryza's Persona & Setting</CardTitle>
    </CardHeader>
    <CardContent class="space-y-3">
      <div class="space-y-1">
        <label for="chara-personality" class="block text-xs font-medium text-foreground">Personality</label>
        <Textarea
          id="chara-personality"
          bind:value={personality}
          rows={2}
          placeholder="Energetic, cheerful, loves alchemy..."
          class="text-xs resize-none" />
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div class="space-y-1">
          <label for="chara-likes" class="block text-xs font-medium text-foreground">Likes</label>
          <Input id="chara-likes" bind:value={likes} placeholder="Alchemy, adventures" class="h-9 text-xs" />
        </div>
        <div class="space-y-1">
          <label for="chara-dislikes" class="block text-xs font-medium text-foreground">Dislikes</label>
          <Input
            id="chara-dislikes"
            bind:value={dislikes}
            placeholder="Ghosts, boredom"
            class="h-9 text-xs" />
        </div>
      </div>

      <div class="space-y-1">
        <label for="chara-situation" class="block text-xs font-medium text-foreground">
          Current Situation
        </label>
        <Textarea
          id="chara-situation"
          bind:value={situation}
          rows={2}
          placeholder="Living in the secret hideout on Kurken Island..."
          class="text-xs resize-none" />
      </div>

      <div class="space-y-1">
        <label for="chara-extra" class="block text-xs font-medium text-foreground">
          Additional Prompt Instructions
        </label>
        <Textarea
          id="chara-extra"
          bind:value={extra}
          rows={3}
          placeholder="Extra context or custom directives appended to system prompt..."
          class="text-xs resize-none font-mono" />
      </div>
    </CardContent>
  </Card>

  <!-- Save Data Card (3 Slots) -->
  <Card class="border-border/50 bg-card/75 shadow-sm">
    <CardHeader>
      <CardTitle class="text-sm font-bold text-gold">Save Data (3 Slots)</CardTitle>
    </CardHeader>
    <CardContent class="space-y-2.5">
      {#each session.slots as slot, i}
        <div
          class="flex items-center justify-between p-2.5 rounded-lg bg-background/60 border border-border/40 text-xs gap-2">
          <div class="flex flex-col min-w-0 flex-1">
            <span class="font-bold text-foreground truncate">
              {i + 1}. {slot ? slot.label : 'Empty Slot'}
            </span>
            {#if slot}
              <span class="text-[10px] text-muted-foreground mt-0.5">
                Day {slot.day} · Lv.{slot.game
                  ? 1 + Math.floor(Math.sqrt(((slot.game as { exp_total?: number }).exp_total || 0) / 30))
                  : '?'} · {new Date(slot.at).toLocaleDateString()}
                {new Date(slot.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            {/if}
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              class="h-7 px-2.5 text-[11px] font-bold border-gold/40 text-gold hover:bg-gold/10"
              onclick={() => session.saveSlot(i)}>
              Save
            </Button>
            <Button
              variant="secondary"
              size="sm"
              class="h-7 px-2.5 text-[11px] font-bold"
              disabled={!slot}
              onclick={() => {
                session.loadSlot(i);
                viewStore.setView('talk');
              }}>
              Load
            </Button>
          </div>
        </div>
      {/each}
    </CardContent>
  </Card>

  {#if savedNotice}
    <div
      class="p-2.5 rounded-md bg-leaf/20 border border-leaf/40 text-xs text-foreground font-medium text-center">
      Settings saved successfully!
    </div>
  {/if}
</div>

<div class="p-4 border-t border-border/40 bg-card/40">
  <Button class="w-full bg-gold text-background font-bold hover:bg-gold/90" onclick={handleSave}>
    Save Profile
  </Button>
</div>
