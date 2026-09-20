<script lang="ts">
  import { onMount } from 'svelte';
  import { config } from '$lib/stores/config.svelte';
  import { viewStore } from '$lib/stores/view.svelte';
  import { Button } from '$components/ui/button';
  import { Input } from '$components/ui/input';
  import { Textarea } from '$components/ui/textarea';
  import { Card, CardHeader, CardTitle, CardContent } from '$components/ui/card';

  let playerName = $state('');
  let callMe = $state('');
  let birthday = $state('');
  let gender = $state('');
  let personality = $state('');
  let likes = $state('');
  let dislikes = $state('');
  let situation = $state('');
  let savedNotice = $state(false);

  onMount(() => {
    const p = config.section('profile') || {};
    const c = config.section('chara') || {};
    playerName = p.name || '';
    callMe = c.callMe || '';
    birthday = p.birthday || '';
    gender = p.gender || '';
    personality = c.personality || '';
    likes = c.likes || '';
    dislikes = c.dislikes || '';
    situation = c.situation || '';
  });

  function handleSave() {
    config.set('profile.name', playerName);
    config.set('profile.birthday', birthday);
    config.set('profile.gender', gender);
    config.set('chara.callMe', callMe);
    config.set('chara.personality', personality);
    config.set('chara.likes', likes);
    config.set('chara.dislikes', dislikes);
    config.set('chara.situation', situation);

    savedNotice = true;
    setTimeout(() => {
      savedNotice = false;
    }, 2000);
  }
</script>

<div class="h-full w-full flex flex-col bg-background/90 backdrop-blur-md overflow-hidden">
  <!-- View Header -->
  <div class="flex items-center justify-between p-4 border-b border-border/40">
    <div class="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        class="h-8 w-8 text-muted-foreground hover:text-foreground"
        onclick={() => viewStore.setView('talk')}>
        ✕
      </Button>
      <h2 class="text-lg font-bold text-gold">Character Profile</h2>
    </div>

    <Button
      variant="outline"
      size="sm"
      class="h-8 text-xs border-border/50 text-gold hover:bg-gold/10"
      onclick={() => viewStore.setView('skin')}>
      👗 Costumes
    </Button>
  </div>

  <!-- Form Content -->
  <div class="flex-1 overflow-y-auto p-4 space-y-4">
    <!-- Player Profile Card -->
    <Card class="border-border/50 bg-card/75 shadow-sm">
      <CardHeader>
        <CardTitle class="text-sm font-bold text-gold">Adventurer Profile</CardTitle>
      </CardHeader>
      <CardContent class="space-y-3">
        <div class="space-y-1">
          <label for="chara-player-name" class="text-xs font-medium text-foreground">Your Name</label>
          <Input
            id="chara-player-name"
            bind:value={playerName}
            placeholder="Adventurer"
            class="h-9 text-xs" />
        </div>

        <div class="space-y-1">
          <label for="chara-call-me" class="text-xs font-medium text-foreground">How Ryza Calls You</label>
          <Input id="chara-call-me" bind:value={callMe} placeholder="You / Senpai" class="h-9 text-xs" />
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div class="space-y-1">
            <label for="chara-birthday" class="text-xs font-medium text-foreground">Birthday</label>
            <Input id="chara-birthday" type="date" bind:value={birthday} class="h-9 text-xs" />
          </div>
          <div class="space-y-1">
            <label for="chara-gender" class="text-xs font-medium text-foreground">Gender</label>
            <Input
              id="chara-gender"
              bind:value={gender}
              placeholder="Male / Female / Other"
              class="h-9 text-xs" />
          </div>
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
          <label for="chara-personality" class="text-xs font-medium text-foreground">Personality</label>
          <Textarea
            id="chara-personality"
            bind:value={personality}
            rows={2}
            placeholder="Energetic, cheerful, loves alchemy..."
            class="text-xs resize-none" />
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div class="space-y-1">
            <label for="chara-likes" class="text-xs font-medium text-foreground">Likes</label>
            <Input
              id="chara-likes"
              bind:value={likes}
              placeholder="Alchemy, adventures"
              class="h-9 text-xs" />
          </div>
          <div class="space-y-1">
            <label for="chara-dislikes" class="text-xs font-medium text-foreground">Dislikes</label>
            <Input
              id="chara-dislikes"
              bind:value={dislikes}
              placeholder="Ghosts, boredom"
              class="h-9 text-xs" />
          </div>
        </div>

        <div class="space-y-1">
          <label for="chara-situation" class="text-xs font-medium text-foreground">Current Situation</label>
          <Textarea
            id="chara-situation"
            bind:value={situation}
            rows={2}
            placeholder="Living in the secret hideout on Kurken Island..."
            class="text-xs resize-none" />
        </div>
      </CardContent>
    </Card>

    {#if savedNotice}
      <div
        class="p-2.5 rounded-md bg-leaf/20 border border-leaf/40 text-xs text-foreground font-medium text-center">
        Settings saved successfully!
      </div>
    {/if}
  </div>

  <!-- Save Button Footer -->
  <div class="p-4 border-t border-border/40 bg-card/40">
    <Button class="w-full bg-gold text-background font-bold hover:bg-gold/90" onclick={handleSave}>
      Save Profile
    </Button>
  </div>
</div>
