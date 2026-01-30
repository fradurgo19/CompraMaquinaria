export const hasAnyActiveFilters = (values: Array<unknown>): boolean =>
  values.some((value) => (Array.isArray(value) ? value.length > 0 : Boolean(value)));

export const clearStringFilters = (...setters: Array<(value: string) => void>): void => {
  setters.forEach((set) => set(''));
};

export const getUniqueSortedValues = <T, V extends string | number>(
  items: T[],
  selector: (item: T) => V | null | undefined,
  sortFn?: (a: V, b: V) => number
): V[] => {
  const values = items.map(selector).filter((value): value is V => Boolean(value));
  const unique = Array.from(new Set(values));
  const defaultCompare = (a: V, b: V) => {
    if (typeof a === 'number' && typeof b === 'number') {
      return a - b;
    }
    return String(a).localeCompare(String(b), 'es', { sensitivity: 'base' });
  };
  return unique.sort(sortFn ?? defaultCompare);
};
