import type { ReviewRating, Word } from "../types";

export const REVIEW_INTERVALS = [1, 2, 4, 7, 14, 30] as const;

/** Local calendar dates are deliberate: UTC conversion would move late-night reviews to another day. */
export function localDateKey(value: Date | string = new Date()): string {
  if (typeof value === "string" && isDateKey(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("日期无效");
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function addDays(value: string | Date, days: number): string {
  if (!Number.isInteger(days)) throw new Error("复习间隔必须为整数");
  if (typeof value === "string" && !isDateKey(value))
    throw new Error("日期无效");
  const date =
    value instanceof Date ? new Date(value) : new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error("日期无效");
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

/** Pure scheduling function. New words start due today; a failed review is due again today. */
export function scheduleReview(
  word: Word,
  rating: ReviewRating,
  now: Date = new Date(),
): Word {
  if (!(["known", "fuzzy", "unknown"] as const).includes(rating))
    throw new Error("复习评分无效");
  const today = localDateKey(now);
  const streak =
    rating === "known"
      ? word.streak + 1
      : rating === "fuzzy"
        ? Math.max(0, word.streak - 1)
        : 0;
  const intervalDays =
    rating === "known"
      ? REVIEW_INTERVALS[Math.min(streak - 1, REVIEW_INTERVALS.length - 1)]
      : rating === "fuzzy"
        ? Math.max(1, Math.min(2, Math.floor(word.intervalDays / 2)))
        : 0;
  return {
    ...word,
    totalReviews: word.totalReviews + 1,
    knownCount: word.knownCount + Number(rating === "known"),
    fuzzyCount: word.fuzzyCount + Number(rating === "fuzzy"),
    unknownCount: word.unknownCount + Number(rating === "unknown"),
    streak,
    intervalDays,
    lastReviewedAt: now.toISOString(),
    nextReviewDate: addDays(today, intervalDays),
    mastered: rating === "known" && streak >= REVIEW_INTERVALS.length,
  };
}

export type ReviewLimit = "auto" | number;

export function getDueWords(
  words: Word[],
  limit: ReviewLimit = "auto",
  today = localDateKey(),
): Word[] {
  if (!isDateKey(today)) throw new Error("日期无效");
  if (limit !== "auto" && (!Number.isInteger(limit) || limit < 0))
    throw new Error("每日复习数量无效");
  const due = words.filter(
    (word) => !word.mastered && word.nextReviewDate <= today,
  );
  due.sort(
    (a, b) =>
      b.unknownCount - a.unknownCount ||
      b.fuzzyCount - a.fuzzyCount ||
      a.nextReviewDate.localeCompare(b.nextReviewDate) ||
      Number(a.totalReviews > 0) - Number(b.totalReviews > 0) ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id),
  );
  return limit === "auto" ? due : due.slice(0, limit);
}
