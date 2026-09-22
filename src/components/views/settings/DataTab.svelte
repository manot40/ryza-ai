<script lang="ts">
  import { config } from '$lib/stores/config.svelte';
  import { modal } from '$lib/stores/modal.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { Button } from '$components/ui/button';
  import { Textarea } from '$components/ui/textarea';
  import * as Dialog from '$components/ui/dialog';
  import { Card, CardHeader, CardTitle, CardContent } from '$components/ui/card';

  let importDialogOpen = $state(false);
  let importJsonText = $state('');

  function handleExportConfig() {
    const data = config.exportJSON();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(data);
      toast.show('Configuration copied to clipboard!');
    }
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ryza-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportSubmit() {
    if (!importJsonText.trim()) return;
    try {
      config.importJSON(importJsonText.trim());
      importDialogOpen = false;
      importJsonText = '';
      toast.show('Settings imported successfully!');
    } catch (e: unknown) {
      toast.err(`Import failed: ${(e as Error)?.message || 'Invalid JSON'}`);
    }
  }

  async function handleResetAll() {
    const ok = await modal.confirm(
      'Reset All Settings',
      'Are you sure you want to reset all settings to defaults? Your game progress will be preserved.',
      'Reset Settings',
      'Cancel'
    );
    if (ok) {
      config.reset();
      window.location.reload();
    }
  }
</script>

<Card class="border-border/50 bg-card/75">
  <CardHeader class="pb-2">
    <CardTitle class="text-sm font-bold text-gold">Data Management</CardTitle>
  </CardHeader>
  <CardContent class="space-y-3">
    <Button
      variant="outline"
      class="w-full text-xs h-9 justify-start border-border/50"
      onclick={handleExportConfig}>
      📥 Export Settings JSON (Copy & Download)
    </Button>

    <Button
      variant="outline"
      class="w-full text-xs h-9 justify-start border-border/50"
      onclick={() => {
        importJsonText = '';
        importDialogOpen = true;
      }}>
      📤 Import Settings JSON...
    </Button>

    <Button
      variant="outline"
      class="w-full text-xs h-9 justify-start border-destructive/40 text-destructive hover:bg-destructive/10"
      onclick={handleResetAll}>
      ⚠️ Reset All Settings to Defaults
    </Button>
  </CardContent>
</Card>

<!-- Import JSON Dialog -->
<Dialog.Root bind:open={importDialogOpen}>
  <Dialog.Content class="sm:max-w-md bg-card/95 border-border/60">
    <Dialog.Header>
      <Dialog.Title class="text-sm font-bold text-gold">Import Configuration JSON</Dialog.Title>
      <Dialog.Description class="text-xs text-muted-foreground">
        Paste exported configuration JSON below to restore settings.
      </Dialog.Description>
    </Dialog.Header>
    <div class="py-2">
      <Textarea
        bind:value={importJsonText}
        placeholder={'{ "llm": { ... }, "tts": { ... } }'}
        rows={8}
        class="text-xs font-mono resize-none" />
    </div>
    <Dialog.Footer class="gap-2 sm:gap-0">
      <Button variant="outline" size="sm" class="text-xs" onclick={() => (importDialogOpen = false)}>
        Cancel
      </Button>
      <Button
        size="sm"
        class="text-xs bg-gold text-background hover:bg-gold/90 font-semibold"
        onclick={handleImportSubmit}>
        Apply Configuration
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
