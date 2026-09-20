<script lang="ts">
  import type { Snippet } from 'svelte';

  import { cn } from '$lib/utils';

  import { XIcon } from '@lucide/svelte';
  import { Button } from '$components/ui/button';
  import SheetClose from '$components/ui/sheet/sheet-close.svelte';
  import SheetHeader from '$components/ui/sheet/sheet-header.svelte';

  type Props = { title: string; children?: Snippet };
  const { title, children }: Props = $props();
</script>

<SheetHeader class={cn('flex-row justify-between px-4 pt-4 pb-2 rounded-t-lg')}>
  <div class="flex items-center gap-2">
    <SheetClose>
      <Button variant="ghost" size="icon" class="size-8">
        <XIcon class="size-5" />
      </Button>
    </SheetClose>
    <h2 class="text-lg font-bold text-gold">{title}</h2>
  </div>

  {#if children}
    <div class="flex items-center gap-2">
      {@render children()}
    </div>
  {/if}
</SheetHeader>
