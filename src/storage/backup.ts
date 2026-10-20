import type {
  Favorite,
  PersonalExpression,
  PracticeRecord,
  Setting,
  Word,
  WordReview,
} from "../types";
import { isDateKey } from "../lib/review";
import { normalizeEnglish } from "../lib/words";
import { openDatabase, requestResult, transactionComplete } from "./db";

export const BACKUP_STORES = [
  "words",
  "wordReviews",
  "writingExpressions",
  "translationExpressions",
  "favorites",
  "practiceRecords",
  "settings",
] as const;
export const BACKUP_VERSION = 1;
export interface BackupData {
  words: Word[];
  wordReviews: WordReview[];
  writingExpressions: PersonalExpression[];
  translationExpressions: PersonalExpression[];
  favorites: Favorite[];
  practiceRecords: PracticeRecord[];
  settings: Setting[];
}

export interface LearningBackup {
  app: "cet6-prep";
  version: 1;
  exportedAt: string;
  audioExcluded: true;
  data: BackupData;
}

function invalid(reason: string): never {
  throw new Error(`备份格式无效：${reason}。当前数据未更改。`);
}
function object(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  );
}
function string(value: unknown, nonempty = true): value is string {
  return typeof value === "string" && (!nonempty || value.trim().length > 0);
}
function integer(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function timestamp(value: unknown): value is string {
  return (
    string(value) &&
    /^\d{4}-\d\d-\d\dT/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}
function jsonSafe(value: unknown, depth = 0): boolean {
  if (depth > 30) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value))
    return value.every((item) => jsonSafe(item, depth + 1));
  return (
    object(value) &&
    Object.entries(value).every(
      ([key, item]) =>
        !["__proto__", "prototype", "constructor"].includes(key) &&
        jsonSafe(item, depth + 1),
    )
  );
}

function validateExpression(row: Record<string, unknown>): boolean {
  return (
    ["english", "chinese", "topic", "category", "sourceType"].every((key) =>
      string(row[key]),
    ) &&
    string(row.usage, false) &&
    timestamp(row.createdAt) &&
    timestamp(row.updatedAt) &&
    (row.example === undefined || string(row.example, false)) &&
    (row.keywords === undefined ||
      (Array.isArray(row.keywords) &&
        row.keywords.every((keyword) => string(keyword))))
  );
}

/** Validate every row before any database operation. Strings may be passed directly from File.text(). */
export function validateBackup(input: unknown): LearningBackup {
  let value: unknown = input;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      invalid("文件不是合法 JSON");
    }
  }
  if (
    !object(value) ||
    value.app !== "cet6-prep" ||
    value.version !== BACKUP_VERSION ||
    !timestamp(value.exportedAt) ||
    value.audioExcluded !== true ||
    !object(value.data)
  )
    invalid("应用标识或版本不匹配");
  const data = value.data;
  for (const name of BACKUP_STORES) {
    const rows = data[name];
    if (!Array.isArray(rows)) invalid(`缺少 ${name} 数据表`);
    const ids = new Set<string>();
    const englishWords = new Set<string>();
    for (const row of rows) {
      if (!object(row) || !string(row.id) || ids.has(row.id) || !jsonSafe(row))
        invalid(`${name} 存在无效或重复记录`);
      ids.add(row.id);
      if (name === "words") {
        if (
          !string(row.english) ||
          normalizeEnglish(row.english) !== row.english ||
          !/[a-z]/i.test(row.english) ||
          /[\u3400-\u9fff]/.test(row.english) ||
          !string(row.chinese) ||
          !string(row.notes, false) ||
          !timestamp(row.createdAt) ||
          !(row.lastReviewedAt === null || timestamp(row.lastReviewedAt)) ||
          !isDateKey(row.nextReviewDate) ||
          ![
            "totalReviews",
            "knownCount",
            "fuzzyCount",
            "unknownCount",
            "streak",
            "intervalDays",
          ].every((key) => integer(row[key])) ||
          typeof row.mastered !== "boolean"
        )
          invalid("单词记录字段错误");
        if (
          Number(row.knownCount) +
            Number(row.fuzzyCount) +
            Number(row.unknownCount) !==
            row.totalReviews ||
          Number(row.streak) > Number(row.knownCount)
        )
          invalid("单词复习计数错误");
        if (englishWords.has(row.english)) invalid("英文单词重复");
        englishWords.add(row.english);
      } else if (name === "wordReviews") {
        if (
          !string(row.wordId) ||
          !string(row.rating) ||
          !["known", "fuzzy", "unknown"].includes(row.rating) ||
          !timestamp(row.reviewedAt)
        )
          invalid("单词复习记录字段错误");
      } else if (
        name === "writingExpressions" ||
        name === "translationExpressions"
      ) {
        if (!validateExpression(row)) invalid("个人积累字段错误");
      } else if (name === "favorites") {
        if (
          !string(row.module) ||
          !["writing", "translation"].includes(row.module) ||
          !string(row.expressionId) ||
          !timestamp(row.createdAt)
        )
          invalid("收藏记录字段错误");
      } else if (name === "practiceRecords") {
        if (
          !string(row.practiceId) ||
          !string(row.module) ||
          !["reading", "listening", "writing", "translation"].includes(
            row.module,
          ) ||
          !object(row.answers) ||
          !Object.values(row.answers).every((answer) =>
            string(answer, false),
          ) ||
          !integer(row.correct) ||
          !integer(row.total) ||
          Number(row.correct) > Number(row.total) ||
          !timestamp(row.completedAt)
        )
          invalid("练习记录字段错误");
      } else if (name === "settings" && !Object.hasOwn(row, "value"))
        invalid("设置字段错误");
    }
  }
  return value as unknown as LearningBackup;
}

/** Audio blobs are intentionally excluded from JSON. Users retain/re-import their original audio files. */
export async function exportBackup(): Promise<LearningBackup> {
  const database = await openDatabase();
  const transaction = database.transaction([...BACKUP_STORES], "readonly");
  const complete = transactionComplete(transaction);
  const tables = await Promise.all(
    BACKUP_STORES.map(
      async (name) =>
        [
          name,
          await requestResult(transaction.objectStore(name).getAll()),
        ] as const,
    ),
  );
  await complete;
  return validateBackup({
    app: "cet6-prep",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    audioExcluded: true,
    data: Object.fromEntries(tables),
  });
}

/** Caller obtains explicit confirmation. All seven tables are replaced in one all-or-nothing transaction. */
export async function restoreBackup(input: unknown): Promise<void> {
  const backup = structuredClone(validateBackup(input));
  const database = await openDatabase();
  const transaction = database.transaction([...BACKUP_STORES], "readwrite");
  const complete = transactionComplete(transaction);
  try {
    for (const name of BACKUP_STORES) {
      const store = transaction.objectStore(name);
      store.clear();
      for (const row of backup.data[name]) store.put(row);
    }
    await complete;
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      /* An IndexedDB error already aborted the transaction. */
    }
    await complete.catch(() => undefined);
    throw error;
  }
}
