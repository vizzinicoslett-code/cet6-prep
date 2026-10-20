import type { ReviewRating, Word, WordReview } from "../types";
import { localDateKey, scheduleReview } from "../lib/review";
import { normalizeEnglish, type WordBatchRow } from "../lib/words";

export const DATABASE_NAME = "cet6-prep";
export const DATABASE_VERSION = 1;
export const DB_STORES = [
  "words",
  "wordReviews",
  "writingExpressions",
  "translationExpressions",
  "favorites",
  "practiceRecords",
  "settings",
  "audioFiles",
] as const;
export type StoreName = (typeof DB_STORES)[number];
let connection: Promise<IDBDatabase> | undefined;

export function openDatabase(): Promise<IDBDatabase> {
  if (connection) return connection;
  connection = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(
        new Error(
          "此浏览器不支持 IndexedDB，无法保存学习数据。请使用现代浏览器。",
        ),
      );
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      for (const name of DB_STORES) {
        if (!database.objectStoreNames.contains(name))
          database.createObjectStore(name, { keyPath: "id" });
      }
      const words = request.transaction!.objectStore("words");
      if (!words.indexNames.contains("english"))
        words.createIndex("english", "english", { unique: true });
      if (!words.indexNames.contains("nextReviewDate"))
        words.createIndex("nextReviewDate", "nextReviewDate");
      const reviews = request.transaction!.objectStore("wordReviews");
      if (!reviews.indexNames.contains("wordId"))
        reviews.createIndex("wordId", "wordId");
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        connection = undefined;
      };
      resolve(database);
    };
    request.onerror = () => {
      connection = undefined;
      reject(request.error ?? new Error("无法打开本地数据库"));
    };
    request.onblocked = () => {
      connection = undefined;
      reject(
        new Error("数据库升级被其他页面阻挡，请关闭本网站其他标签页后重试。"),
      );
    };
  });
  return connection;
}

export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("本地数据操作失败"));
  });
}

export function transactionComplete(
  transaction: IDBTransaction,
): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(
        transaction.error ?? new Error("本地数据操作已取消，原有数据未更改"),
      );
    transaction.onerror = () =>
      reject(
        transaction.error ??
          new Error("本地数据写入失败，请检查浏览器存储空间"),
      );
  });
}

export const db = {
  async getAll<T>(store: StoreName): Promise<T[]> {
    const database = await openDatabase();
    return requestResult(
      database.transaction(store, "readonly").objectStore(store).getAll(),
    ) as Promise<T[]>;
  },
  async get<T>(store: StoreName, id: string): Promise<T | undefined> {
    const database = await openDatabase();
    return requestResult(
      database.transaction(store, "readonly").objectStore(store).get(id),
    ) as Promise<T | undefined>;
  },
  async put<T extends { id: string }>(
    store: StoreName,
    value: T,
  ): Promise<void> {
    const database = await openDatabase();
    const transaction = database.transaction(store, "readwrite");
    const complete = transactionComplete(transaction);
    transaction.objectStore(store).put(value);
    await complete;
  },
  async delete(store: StoreName, id: string): Promise<void> {
    const database = await openDatabase();
    const transaction = database.transaction(store, "readwrite");
    const complete = transactionComplete(transaction);
    transaction.objectStore(store).delete(id);
    await complete;
  },
  async clear(store: StoreName): Promise<void> {
    const database = await openDatabase();
    const transaction = database.transaction(store, "readwrite");
    const complete = transactionComplete(transaction);
    transaction.objectStore(store).clear();
    await complete;
  },
};

export class DuplicateWordError extends Error {
  readonly existingWord: Word;
  constructor(word: Word) {
    super(`「${word.english}」已有记录，可以选择更新释义。`);
    this.name = "DuplicateWordError";
    this.existingWord = word;
  }
}

export function createWord(
  english: string,
  chinese: string,
  notes = "",
  now = new Date(),
): Word {
  const normalized = normalizeEnglish(english);
  if (!normalized || !chinese.trim())
    throw new Error("英文单词和中文释义不能为空");
  if (!/[a-z]/i.test(normalized) || /[\u3400-\u9fff]/.test(normalized))
    throw new Error("英文单词格式不正确");
  return {
    id: crypto.randomUUID(),
    english: normalized,
    chinese: chinese.trim(),
    notes: notes.trim(),
    createdAt: now.toISOString(),
    lastReviewedAt: null,
    nextReviewDate: localDateKey(now),
    totalReviews: 0,
    knownCount: 0,
    fuzzyCount: 0,
    unknownCount: 0,
    streak: 0,
    intervalDays: 0,
    mastered: false,
  };
}

/** Existing IDs explicitly authorize editing; an unqualified duplicate never overwrites data. */
export async function saveWord(
  english: string,
  chinese: string,
  notes = "",
  existingId?: string,
): Promise<Word> {
  const candidate = createWord(english, chinese, notes);
  const database = await openDatabase();
  const transaction = database.transaction("words", "readwrite");
  const complete = transactionComplete(transaction);
  const store = transaction.objectStore("words");
  try {
    const duplicate = await requestResult<Word | undefined>(
      store.index("english").get(candidate.english),
    );
    if (duplicate && duplicate.id !== existingId)
      throw new DuplicateWordError(duplicate);
    const existing = existingId
      ? await requestResult<Word | undefined>(store.get(existingId))
      : undefined;
    if (existingId && !existing)
      throw new Error("该单词已被删除，请刷新列表后重试。");
    const word = existing
      ? {
          ...existing,
          english: candidate.english,
          chinese: candidate.chinese,
          notes: candidate.notes,
        }
      : candidate;
    store.put(word);
    await complete;
    return word;
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      /* A completed transaction needs no rollback. */
    }
    await complete.catch(() => undefined);
    throw error;
  }
}

/** Persist the new schedule and its audit record together, reading current data to avoid stale UI writes. */
export async function reviewWord(
  word: Word,
  rating: ReviewRating,
  now = new Date(),
): Promise<Word> {
  const database = await openDatabase();
  const transaction = database.transaction(
    ["words", "wordReviews"],
    "readwrite",
  );
  const complete = transactionComplete(transaction);
  try {
    const stored = await requestResult<Word | undefined>(
      transaction.objectStore("words").get(word.id),
    );
    if (!stored) throw new Error("该单词已被删除，无法保存此次复习。");
    const updated = scheduleReview(stored, rating, now);
    const record: WordReview = {
      id: crypto.randomUUID(),
      wordId: word.id,
      rating,
      reviewedAt: now.toISOString(),
    };
    transaction.objectStore("words").put(updated);
    transaction.objectStore("wordReviews").put(record);
    await complete;
    return updated;
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      /* Already completed. */
    }
    await complete.catch(() => undefined);
    throw error;
  }
}

export async function setWordMastered(
  word: Word,
  mastered: boolean,
): Promise<Word> {
  const database = await openDatabase();
  const transaction = database.transaction("words", "readwrite");
  const complete = transactionComplete(transaction);
  try {
    const current = await requestResult<Word | undefined>(
      transaction.objectStore("words").get(word.id),
    );
    if (!current) throw new Error("该单词已被删除");
    const updated = {
      ...current,
      mastered,
      ...(mastered
        ? {}
        : { streak: 0, intervalDays: 0, nextReviewDate: localDateKey() }),
    };
    transaction.objectStore("words").put(updated);
    await complete;
    return updated;
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      /* Already completed. */
    }
    await complete.catch(() => undefined);
    throw error;
  }
}

/** Delete the word and its history together; neither half survives a failed transaction. */
export async function deleteWord(wordId: string): Promise<void> {
  if (!wordId.trim()) throw new Error("单词标识不能为空");
  const database = await openDatabase();
  const transaction = database.transaction(
    ["words", "wordReviews"],
    "readwrite",
  );
  const complete = transactionComplete(transaction);
  try {
    const reviews = transaction.objectStore("wordReviews");
    const reviewIds = await requestResult(
      reviews.index("wordId").getAllKeys(wordId),
    );
    transaction.objectStore("words").delete(wordId);
    for (const reviewId of reviewIds) reviews.delete(reviewId);
    await complete;
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      /* Already aborted or completed. */
    }
    await complete.catch(() => undefined);
    throw error;
  }
}

/** Duplicate checks run again at commit time because another tab may have added a previewed word. */
export async function bulkImportWords(
  rows: WordBatchRow[],
): Promise<{ imported: number; duplicates: number }> {
  const candidates = rows
    .filter((row) => row.status === "valid")
    .map((row) => createWord(row.english, row.chinese));
  const database = await openDatabase();
  const transaction = database.transaction("words", "readwrite");
  const complete = transactionComplete(transaction);
  let imported = 0;
  let duplicates = 0;
  try {
    const store = transaction.objectStore("words");
    for (const word of candidates) {
      if (await requestResult(store.index("english").getKey(word.english))) {
        duplicates++;
        continue;
      }
      store.put(word);
      imported++;
    }
    await complete;
    return { imported, duplicates };
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      /* Already completed. */
    }
    await complete.catch(() => undefined);
    throw error;
  }
}

/** Keep preferences; remove every personal learning record, including locally imported audio. */
export async function clearLearningData(): Promise<void> {
  const names = DB_STORES.filter((name) => name !== "settings");
  const database = await openDatabase();
  const transaction = database.transaction([...names, "settings"], "readwrite");
  const complete = transactionComplete(transaction);
  for (const name of names) transaction.objectStore(name).clear();
  // These settings contain personal materials rather than UI preferences.
  transaction.objectStore("settings").delete("practice-imports");
  transaction.objectStore("settings").delete("practice-audio-selection");
  await complete;
}
