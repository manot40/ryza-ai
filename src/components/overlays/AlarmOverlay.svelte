<script lang="ts">
  import { Button } from '$components/ui/button';
  import { overlayStore } from '$lib/stores/overlay.svelte';
  import { alarm, type AlarmItem } from '$lib/stores/alarm.svelte';

  const alarmData = $derived(overlayStore.alarmData);

  function handleSnooze() {
    if (alarmData) {
      const item = alarm.items.find((a: AlarmItem) => a.time === alarmData.time);
      if (item) {
        alarm.snooze(item);
      }
    }
    overlayStore.closeAlarm();
  }

  function handleDismiss() {
    overlayStore.closeAlarm();
  }
</script>

{#if overlayStore.alarmOpen && alarmData}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
    <div
      class="w-full max-w-xs rounded-2xl bg-card border border-gold/40 shadow-2xl p-6 flex flex-col items-center text-center gap-4 animate-in zoom-in-95 duration-200">
      <div class="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center text-2xl animate-bounce">
        ⏰
      </div>

      <div class="flex flex-col gap-1">
        <span class="text-4xl font-extrabold text-gold tracking-tight font-mono">
          {alarmData.time}
        </span>
        <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {alarmData.type}
        </span>
      </div>

      <div class="flex w-full gap-2 mt-2">
        <Button
          variant="outline"
          class="flex-1 h-10 text-xs border-border/50 text-foreground"
          onclick={handleSnooze}>
          Snooze
        </Button>
        <Button
          class="flex-1 h-10 text-xs font-bold bg-gold text-background hover:bg-gold/90"
          onclick={handleDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  </div>
{/if}
