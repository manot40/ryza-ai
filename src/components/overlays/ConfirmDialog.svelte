<script lang="ts">
  import * as AlertDialog from '$components/ui/alert-dialog';
  import { confirmDialog } from '$lib/stores/confirm.svelte';

  function handleOpenChange(open: boolean) {
    if (!open && confirmDialog.isOpen) {
      confirmDialog.cancel();
    }
  }
</script>

<AlertDialog.Root bind:open={confirmDialog.isOpen} onOpenChange={handleOpenChange}>
  <AlertDialog.Content class="sm:max-w-md bg-card/95 border-border/60 text-card-foreground backdrop-blur-md">
    <AlertDialog.Header>
      <AlertDialog.Title class="text-gold text-lg font-semibold">
        {confirmDialog.title}
      </AlertDialog.Title>
      {#if confirmDialog.description}
        <AlertDialog.Description class="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
          {confirmDialog.description}
        </AlertDialog.Description>
      {/if}
    </AlertDialog.Header>
    <AlertDialog.Footer class="mt-4 flex flex-row justify-end gap-2">
      <AlertDialog.Cancel
        variant="outline"
        class="border-border/60 hover:bg-muted/40 text-xs font-semibold px-3"
        onclick={() => confirmDialog.cancel()}>
        {confirmDialog.cancelText}
      </AlertDialog.Cancel>
      <AlertDialog.Action
        variant={confirmDialog.destructive ? 'destructive' : 'default'}
        class={confirmDialog.destructive
          ? 'text-xs font-semibold px-3'
          : 'bg-gold text-background font-medium hover:bg-gold/90 text-xs px-3'}
        onclick={() => confirmDialog.confirm()}>
        {confirmDialog.confirmText}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
