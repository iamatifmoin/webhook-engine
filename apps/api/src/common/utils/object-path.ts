export function getValueByPath(
  payload: Record<string, unknown>,
  path: string,
): unknown {
  const segments = path
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return undefined;
  }

  return segments.reduce<unknown>((current, segment) => {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, payload);
}
