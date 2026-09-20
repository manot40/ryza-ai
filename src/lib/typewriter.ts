export interface TypewriterOptions {
  speed?: number;
  onUpdate?: (partialText: string) => void;
  onDone?: () => void;
}

export class TypewriterController {
  private _speed: number;
  private _onUpdate?: (partialText: string) => void;
  private _onDone?: () => void;

  private _timer: ReturnType<typeof setTimeout> | null = null;
  private _generation = 0;
  private _fullText = '';
  private _currentText = '';
  private _index = 0;
  private _isTyping = false;

  constructor(options: TypewriterOptions = {}) {
    this._speed = Math.max(1, options.speed ?? 28);
    this._onUpdate = options.onUpdate;
    this._onDone = options.onDone;
  }

  get speed(): number {
    return this._speed;
  }

  set speed(ms: number) {
    this._speed = Math.max(1, ms);
  }

  get isTyping(): boolean {
    return this._isTyping;
  }

  get currentText(): string {
    return this._currentText;
  }

  get fullText(): string {
    return this._fullText;
  }

  start(text: string): void {
    this.cancel();
    const gen = ++this._generation;
    this._fullText = text;
    this._currentText = '';
    this._index = 0;
    this._isTyping = true;

    if (!text) {
      this._isTyping = false;
      this._onUpdate?.('');
      this._onDone?.();
      return;
    }

    const step = () => {
      if (gen !== this._generation) return;

      if (this._index >= this._fullText.length) {
        this._isTyping = false;
        this._onDone?.();
        return;
      }

      this._index++;
      this._currentText = this._fullText.slice(0, this._index);
      this._onUpdate?.(this._currentText);

      if (this._index < this._fullText.length) {
        this._timer = setTimeout(step, this._speed);
      } else {
        this._isTyping = false;
        this._onDone?.();
      }
    };

    this._timer = setTimeout(step, this._speed);
  }

  finish(): void {
    if (!this._isTyping) return;
    this.cancel();
    this._currentText = this._fullText;
    this._index = this._fullText.length;
    this._isTyping = false;
    this._onUpdate?.(this._currentText);
    this._onDone?.();
  }

  cancel(): void {
    this._generation++;
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this._isTyping = false;
  }
}
