<script lang="ts">
import { world } from '$lib/stores/world.svelte';
import { config } from '$lib/stores/config.svelte';
import { avatarService } from '$lib/avatar/avatar-service.svelte';

import { Button } from '$components/ui/button';
import {cn} from '$lib/utils';

const {class:className}: {class?:string} = $props();
const appState = $derived(config.section('state') || {});


  const todNames: Record<string, string> = {
    mor: 'Morning',
    aft: 'Noon',
    eve: 'Evening',
    ngt: 'Night',
  };

  function handleAdvanceTod() {
    const next = world.nextTod(appState.tod);
    config.set('state.tod', next);
    avatarService.loadScene(appState.stage, next);
  }
</script>

<Button
        variant="outline"
        size="sm"
        class={cn("h-8 gap-1.5 border-border/50 text-xs text-foreground", className)}
        onclick={handleAdvanceTod}
      >
        <span>🌤</span>
        <span>{todNames[appState.tod] || 'Noon'}</span>
      </Button>