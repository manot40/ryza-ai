import { debounce, type DebounceOptions } from 'es-toolkit/function';

export type DebounceRef<T> = { value: T };

export function useDebounceState<T>(
  getter: () => T,
  delay = 300,
  edges?: DebounceOptions['edges']
): DebounceRef<T> {
  let debounced = $state<T>(getter());

  // prettier-ignore
  const fn = debounce((val: T) => {
    debounced = val;
  }, delay, { edges });

  $effect(() => fn(getter()));

  return {
    get value() {
      return debounced;
    },
  };
}
