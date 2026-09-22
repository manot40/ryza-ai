// @wc-ignore-file

export interface ModalOptions {
  title: string;
  body?: string;
  okText?: string;
  cancelText?: string;
  onOk?: () => void | Promise<void>;
  onCancel?: () => void;
}

export class ModalStore {
  isOpen = $state(false);
  title = $state('');
  body = $state('');
  okText = $state('OK');
  cancelText = $state<string | null>('Cancel');
  private _onOk?: () => void | Promise<void>;
  private _onCancel?: () => void;

  openModal(options: ModalOptions): void {
    this.title = options.title;
    this.body = options.body ?? '';
    this.okText = options.okText ?? 'OK';
    this.cancelText = options.cancelText === undefined ? 'Cancel' : options.cancelText;
    this._onOk = options.onOk;
    this._onCancel = options.onCancel;
    this.isOpen = true;
  }

  closeModal(): void {
    this.isOpen = false;
    this._onCancel?.();
    this._onOk = undefined;
    this._onCancel = undefined;
  }

  async handleOk(): Promise<void> {
    const fn = this._onOk;
    this.isOpen = false;
    this._onOk = undefined;
    this._onCancel = undefined;
    if (fn) {
      await fn();
    }
  }

  handleCancel(): void {
    this.closeModal();
  }

  confirm(title: string, body?: string, okText = 'OK', cancelText = 'Cancel'): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.openModal({
        title,
        body,
        okText,
        cancelText,
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
  }

  alert(title: string, body?: string, okText = 'OK'): Promise<void> {
    return new Promise<void>((resolve) => {
      this.openModal({
        title,
        body,
        okText,
        cancelText: null as unknown as string, // no cancel button
        onOk: () => resolve(),
        onCancel: () => resolve(),
      });
    });
  }
}

export const modal = new ModalStore();
export default modal;
