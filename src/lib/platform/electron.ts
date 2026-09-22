export interface RyzaShell {
  setTopmost(topmost: boolean): Promise<boolean>;
  isTopmost(): Promise<boolean>;
  minimize(): void;
  close(): void;
}

declare global {
  interface Window {
    ryzaShell?: RyzaShell;
  }
}

export function getRyzaShell(): RyzaShell | null {
  if (typeof window === 'undefined') return null;
  return window.ryzaShell ?? null;
}

export function isElectron(): boolean {
  return getRyzaShell() !== null;
}

export async function isTopmost(): Promise<boolean> {
  const shell = getRyzaShell();
  if (!shell) return false;
  try {
    return await shell.isTopmost();
  } catch {
    return false;
  }
}

export async function setTopmost(topmost: boolean): Promise<boolean> {
  const shell = getRyzaShell();
  if (!shell) return false;
  try {
    return await shell.setTopmost(topmost);
  } catch {
    return false;
  }
}

export function minimizeWindow(): void {
  const shell = getRyzaShell();
  if (shell) {
    shell.minimize();
  }
}

export function closeWindow(): void {
  const shell = getRyzaShell();
  if (shell) {
    shell.close();
  }
}

export function initElectronShell(): void {
  if (typeof document === 'undefined') return;
  if (isElectron()) {
    document.body.classList.add('shell-electron');
  }
}
