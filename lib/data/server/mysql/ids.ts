// Application-generated row ids, matching the format the JSON store used
// ("user_m1a2b3_7") so ids stay stable and readable across backends.

let counter = 0;

export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}
