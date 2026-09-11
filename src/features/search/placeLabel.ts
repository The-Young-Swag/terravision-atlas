// Short human label from a Nominatim display_name: the first comma
// segment, trimmed. One agreed behavior for every call site — trim is
// harmless for well-formed names and correct for padded ones — while
// each caller keeps its own fallback for missing input.
export function shortPlaceLabel(displayName: string | null | undefined, fallback = ''): string {
  const first = displayName?.split(',')[0]?.trim();
  return first || fallback;
}
