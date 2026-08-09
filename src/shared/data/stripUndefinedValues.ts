export function stripUndefinedValues(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripUndefinedValues);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, nestedValue]) => nestedValue !== undefined)
        .map(([key, nestedValue]) => [key, stripUndefinedValues(nestedValue)]),
    );
  }
  return value;
}
