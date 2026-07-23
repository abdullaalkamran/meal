import { addDays } from "./utils/date";

function shuffle<T>(list: T[]): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function datesBetween(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let d = startDate;
  while (d <= endDate) {
    dates.push(d);
    d = addDays(d, 1);
  }
  return dates;
}

export interface DutyBlock {
  userIds: string[];
  dates: string[];
}

/** Splits a date range into equal (remainder-distributed) consecutive
 * blocks across a randomly-ordered set of members — used for Shopping duty.
 * groupSize 2 pairs members up as shopping companions (last group may be a
 * lone member when the roster is odd); groupSize 1 is individual duty. */
export function buildEqualBlocks(
  startDate: string,
  endDate: string,
  memberIds: string[],
  groupSize: 1 | 2 = 1
): DutyBlock[] {
  const dates = datesBetween(startDate, endDate);
  const order = shuffle(memberIds);
  const groups: string[][] = [];
  for (let i = 0; i < order.length; i += groupSize) {
    groups.push(order.slice(i, i + groupSize));
  }
  const n = groups.length;
  if (n === 0) return [];
  const base = Math.floor(dates.length / n);
  let extra = dates.length % n;
  let cursor = 0;

  return groups.map((userIds) => {
    const count = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra--;
    const blockDates = dates.slice(cursor, cursor + count);
    cursor += count;
    return { userIds, dates: blockDates };
  });
}

/** Splits a date range into `blockCount` equal (remainder-distributed)
 * consecutive date slots with NO members assigned — used for the shopping
 * spin rotation, where members claim a slot by spinning the wheel rather than
 * being pre-assigned. */
export function buildOpenBlocks(
  startDate: string,
  endDate: string,
  blockCount: number
): DutyBlock[] {
  const dates = datesBetween(startDate, endDate);
  const n = Math.max(1, blockCount);
  const base = Math.floor(dates.length / n);
  let extra = dates.length % n;
  let cursor = 0;
  const blocks: DutyBlock[] = [];
  for (let i = 0; i < n; i += 1) {
    const count = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra -= 1;
    blocks.push({ userIds: [], dates: dates.slice(cursor, cursor + count) });
    cursor += count;
  }
  // Drop trailing empty slots when there are fewer dates than blocks.
  return blocks.filter((b) => b.dates.length > 0);
}

/** Splits a fixed number of days-per-member sequentially across a
 * randomly-ordered set of members — used for Cleaning duty (no spin). */
export function buildFixedBlocks(
  startDate: string,
  daysPerMember: number,
  memberIds: string[]
): DutyBlock[] {
  const order = shuffle(memberIds);
  let cursor = startDate;

  return order.map((userId) => {
    const blockDates: string[] = [];
    for (let i = 0; i < daysPerMember; i++) {
      blockDates.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return { userIds: [userId], dates: blockDates };
  });
}
