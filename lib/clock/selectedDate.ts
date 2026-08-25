// Lets a page announce which date it's currently showing (e.g. the meals
// calendar's selected day) so the global sticky clock can display it
// alongside today's real date. Purely in-memory, no persistence — resets
// the moment the announcing page unmounts (see hooks/useAnnounceClockDate).

let label: string | null = null;
const listeners = new Set<() => void>();

export function setClockSelectedDate(next: string | null) {
  if (label === next) return;
  label = next;
  listeners.forEach((l) => l());
}

export function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function getSnapshot() {
  return label;
}

export function getServerSnapshot() {
  return null;
}
