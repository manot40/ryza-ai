// @wc-ignore-file

export interface ToastItem {
  id: number;
  message: string;
  isErr: boolean;
}

export class ToastStore {
  items = $state<ToastItem[]>([]);
  private _nextId = 1;

  show(message: string, isErr = false): number {
    const id = this._nextId++;
    this.items = [...this.items, { id, message, isErr }];

    const dur = isErr ? 4200 : 2400;
    setTimeout(() => {
      this.dismiss(id);
    }, dur);

    return id;
  }

  err(message: string): number {
    return this.show(message, true);
  }

  dismiss(id: number): void {
    this.items = this.items.filter((t) => t.id !== id);
  }

  clear(): void {
    this.items = [];
  }
}

export const toast = new ToastStore();
export default toast;
