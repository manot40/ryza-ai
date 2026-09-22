// @wc-ignore-file

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

export class ConfirmStore {
  isOpen = $state(false);
  title = $state('');
  description = $state('');
  confirmText = $state('Confirm');
  cancelText = $state('Cancel');
  destructive = $state(false);

  private _resolver: ((val: boolean) => void) | null = null;

  ask(options: ConfirmOptions | string, description?: string): Promise<boolean> {
    if (this._resolver) {
      this._resolver(false);
    }

    if (typeof options === 'string') {
      this.title = options;
      this.description = description || '';
      this.confirmText = 'Confirm';
      this.cancelText = 'Cancel';
      this.destructive = false;
    } else {
      this.title = options.title;
      this.description = options.description || '';
      this.confirmText = options.confirmText || 'Confirm';
      this.cancelText = options.cancelText || 'Cancel';
      this.destructive = options.destructive ?? false;
    }

    this.isOpen = true;

    return new Promise<boolean>((resolve) => {
      this._resolver = resolve;
    });
  }

  confirm(): void {
    this.isOpen = false;
    if (this._resolver) {
      this._resolver(true);
      this._resolver = null;
    }
  }

  cancel(): void {
    this.isOpen = false;
    if (this._resolver) {
      this._resolver(false);
      this._resolver = null;
    }
  }
}

export const confirmDialog = new ConfirmStore();
export default confirmDialog;
