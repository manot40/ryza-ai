import { twMerge } from 'tailwind-merge';
import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const pluralify = (word: string, count: number, withCount = true) =>
  `${withCount && count ? count : ''} ${word}${count <= 1 ? '' : 's'}`.trim();

export function getNthLine(str: string, n: number) {
  let startIdx = 0;

  for (let i = 1; i < n; i++) {
    const nextNewline = str.indexOf('\n', startIdx);
    if (nextNewline === -1) return undefined;
    startIdx = nextNewline + 1;
  }

  const endIdx = str.indexOf('\n', startIdx);
  const line = endIdx === -1 ? str.slice(startIdx) : str.slice(startIdx, endIdx);
  return line.replace(/\r$/, '');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };
