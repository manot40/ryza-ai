<script lang="ts">
  import { onMount } from 'svelte';
  import { alarm, type AlarmItem, TYPES, STYLES } from '$lib/stores/alarm.svelte';
  import { viewStore } from '$lib/stores/view.svelte';
  import Header from './Header.svelte';
  import { Button } from '$components/ui/button';
  import { Switch } from '$components/ui/switch';
  import { Input } from '$components/ui/input';
  import * as Dialog from '$components/ui/dialog';
  import { Card, CardContent } from '$components/ui/card';

  let dialogOpen = $state(false);
  let editId = $state<string | null>(null);

  // Form state
  let formTime = $state('07:30');
  let formType = $state<string>('goodMorning');
  let formStyle = $state<string>('normal');
  let formDays = $state<number[]>([1, 2, 3, 4, 5]);

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const typeLabels: Record<string, string> = {
    goodMorning: 'Good Morning',
    playWithMe: 'Play with Me',
    task: 'Task Reminder',
    wellDone: 'Well Done',
  };

  const styleLabels: Record<string, string> = {
    normal: 'Normal Tone',
    whisper: 'Whisper Tone',
  };

  onMount(() => {
    alarm.load();
  });

  function openCreateDialog() {
    editId = null;
    formTime = '07:30';
    formType = 'goodMorning';
    formStyle = 'normal';
    formDays = [1, 2, 3, 4, 5];
    dialogOpen = true;
  }

  function toggleDay(day: number) {
    if (formDays.includes(day)) {
      formDays = formDays.filter((d) => d !== day);
    } else {
      formDays = [...formDays, day].sort();
    }
  }

  function handleSave() {
    if (editId) {
      alarm.update(editId, {
        time: formTime,
        type: formType,
        style: formStyle,
        days: formDays,
      });
    } else {
      alarm.add({
        id: `alarm_${Date.now()}`,
        time: formTime,
        enabled: true,
        type: formType,
        style: formStyle,
        days: formDays,
      });
    }
    dialogOpen = false;
  }

  function handleDelete(id: string) {
    alarm.remove(id);
  }
</script>

<!-- View Header -->
<Header title="Alarm Clock">
  <Button
    size="sm"
    class="h-8 text-xs bg-gold text-background hover:bg-gold/90 font-semibold"
    onclick={openCreateDialog}>
    + New Alarm
  </Button>
</Header>

<!-- Alarms List -->
<div class="flex-1 overflow-y-auto p-4 space-y-3 max-h-[70vh]">
  {#if alarm.items.length === 0}
    <div class="text-center py-12 text-sm text-muted-foreground">
      No alarms set yet. Tap + New Alarm to add one!
    </div>
  {:else}
    {#each alarm.items as item}
      <Card class="border-border/50 bg-card/75 shadow-sm">
        <CardContent class="p-3.5 flex items-center justify-between">
          <div class="flex flex-col gap-1">
            <div class="flex items-baseline gap-2">
              <span class="text-2xl font-bold font-mono text-foreground">{item.time}</span>
              <span class="text-xs font-semibold text-gold px-2 py-0.5 rounded-full bg-gold/15">
                {typeLabels[item.type] || item.type}
              </span>
            </div>

            <!-- Days chips -->
            <div class="flex items-center gap-1 mt-1">
              {#each dayLabels as day, idx}
                <span
                  class="text-[10px] px-1.5 py-0.5 rounded {item.days?.includes(idx)
                    ? 'bg-gold/20 text-gold font-bold'
                    : 'text-muted-foreground/50'}">
                  {day}
                </span>
              {/each}
            </div>
          </div>

          <div class="flex items-center gap-3">
            <Switch checked={item.enabled} onCheckedChange={() => alarm.toggle(item.id)} />
            <Button
              variant="ghost"
              size="icon"
              class="h-8 w-8 text-muted-foreground hover:text-destructive"
              onclick={() => handleDelete(item.id)}>
              ✕
            </Button>
          </div>
        </CardContent>
      </Card>
    {/each}
  {/if}
</div>

<!-- Create/Edit Alarm Dialog -->
<Dialog.Root bind:open={dialogOpen}>
  <Dialog.Content class="sm:max-w-md bg-card/95 border-border/60 text-card-foreground backdrop-blur-md">
    <Dialog.Header>
      <Dialog.Title class="text-gold font-bold">
        {editId ? 'Edit Alarm' : 'New Alarm'}
      </Dialog.Title>
      <Dialog.Description class="text-xs text-muted-foreground">
        Set the wake-up time and Ryza's voiced greeting style
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-4 py-2">
      <!-- Time picker -->
      <div class="space-y-1.5">
        <label for="alarm-time-input" class="block text-xs font-medium text-foreground">Time</label>
        <Input
          id="alarm-time-input"
          type="time"
          bind:value={formTime}
          class="h-10 text-center font-mono text-lg font-bold" />
      </div>

      <!-- Alarm Type -->
      <div class="space-y-1.5">
        <span class="block text-xs font-medium text-foreground">Greeting Type</span>
        <div class="grid grid-cols-2 gap-2">
          {#each TYPES as t}
            <Button
              variant={formType === t ? 'secondary' : 'outline'}
              class="text-xs h-9 justify-start {formType === t ? 'border-gold text-gold font-semibold' : ''}"
              onclick={() => (formType = t)}>
              {typeLabels[t] || t}
            </Button>
          {/each}
        </div>
      </div>

      <!-- Voice Style -->
      <div class="space-y-1.5">
        <span class="block text-xs font-medium text-foreground">Voice Style</span>
        <div class="grid grid-cols-2 gap-2">
          {#each STYLES as s}
            <Button
              variant={formStyle === s ? 'secondary' : 'outline'}
              class="text-xs h-9 justify-start {formStyle === s ? 'border-gold text-gold font-semibold' : ''}"
              onclick={() => (formStyle = s)}>
              {styleLabels[s] || s}
            </Button>
          {/each}
        </div>
      </div>

      <!-- Repeat Days -->
      <div class="space-y-1.5">
        <span class="block text-xs font-medium text-foreground">Repeat Days</span>
        <div class="flex items-center justify-between gap-1">
          {#each dayLabels as day, idx}
            <Button
              variant={formDays.includes(idx) ? 'default' : 'secondary'}
              size="icon"
              class="w-8 h-8 rounded-full text-xs font-bold {formDays.includes(idx)
                ? 'bg-gold text-background hover:bg-gold/90'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'}"
              onclick={() => toggleDay(idx)}>
              {day[0]}
            </Button>
          {/each}
        </div>
      </div>
    </div>

    <Dialog.Footer class="flex flex-row justify-end gap-2">
      <Button variant="outline" onclick={() => (dialogOpen = false)}>Cancel</Button>
      <Button class="bg-gold text-background hover:bg-gold/90" onclick={handleSave}>Save Alarm</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
