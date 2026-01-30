export const hasAnyActiveFilters = (values: Array<unknown>): boolean =>
  values.some((value) => (Array.isArray(value) ? value.length > 0 : Boolean(value)));

export const clearStringFilters = (...setters: Array<(value: string) => void>): void => {
  setters.forEach((set) => set(''));
};
