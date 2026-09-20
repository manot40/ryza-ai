<script lang="ts">
  import * as Dialog from '$components/ui/dialog';
  import { Button } from '$components/ui/button';
  import { modal } from '$lib/stores/modal.svelte';

  function handleOpenChange(open: boolean) {
    if (!open && modal.isOpen) {
      modal.closeModal();
    }
  }
</script>

<Dialog.Root bind:open={modal.isOpen} onOpenChange={handleOpenChange}>
  <Dialog.Content class="sm:max-w-md bg-card/95 border-border/60 text-card-foreground backdrop-blur-md">
    <Dialog.Header>
      <Dialog.Title class="text-gold text-lg font-semibold">{modal.title}</Dialog.Title>
      {#if modal.body}
        <Dialog.Description class="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
          {modal.body}
        </Dialog.Description>
      {/if}
    </Dialog.Header>
    <Dialog.Footer class="mt-4 flex flex-row justify-end gap-2">
      {#if modal.cancelText !== null}
        <Button
          variant="outline"
          class="border-border/60 hover:bg-muted/40"
          onclick={() => modal.handleCancel()}
        >
          {modal.cancelText}
        </Button>
      {/if}
      <Button
        class="bg-gold text-background font-medium hover:bg-gold/90"
        onclick={() => modal.handleOk()}
      >
        {modal.okText}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
