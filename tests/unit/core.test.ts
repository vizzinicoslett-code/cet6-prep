import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Word } from "../../src/types";
import {
  addDays,
  getDueWords,
  localDateKey,
  scheduleReview,
} from "../../src/lib/review";
import {
  normalizeEnglish,
  parseWordBatch,
  searchWords,
} from "../../src/lib/words";
import { gradeAnswers } from "../../src/lib/practice";
import {
  bulkImportWords,
  clearLearningData,
  createWord,
  db,
  DB_STORES,
  deleteWord,
  DuplicateWordError,
  openDatabase,
  reviewWord,
  saveWord,
  setWordMastered,
} from "../../src/storage/db";
import {
  exportBackup,
  restoreBackup,
  validateBackup,
} from "../../src/storage/backup";

const now = new Date(2026, 9, 20, 23, 45);
function word(overrides: Partial<Word> = {}): Word {
  return {
    ...createWord("obscure", "模糊的；晦涩的", "与 obscurely 区分", now),
    ...overrides,
  };
}

beforeEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(DB_STORES.map((store) => db.clear(store)));
});

describe("local calendar dates and spaced review", () => {
  it("new words are due on the local creation date with empty review counters", () => {
    const fresh = word();
    expect(fresh).toMatchObject({
      nextReviewDate: "2026-10-20",
      lastReviewedAt: null,
      totalReviews: 0,
      streak: 0,
      intervalDays: 0,
      mastered: false,
    });
    expect(getDueWords([fresh], "auto", "2026-10-20")).toEqual([fresh]);
  });

  it("uses the local date near midnight and preserves calendar date keys", () => {
    expect(localDateKey(now)).toBe("2026-10-20");
    expect(localDateKey(new Date(2026, 9, 21, 0, 5))).toBe("2026-10-21");
    expect(localDateKey("2026-10-20")).toBe("2026-10-20");
  });

  it("adds days across month/year boundaries and leap days", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 2)).toBe("2027-01-02");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-10-20", -1)).toBe("2026-10-19");
  });

  it("rejects impossible dates and invalid limits", () => {
    expect(() => addDays("2026-02-30", 1)).toThrow("日期无效");
    expect(() => addDays("2026-10-20", 0.5)).toThrow();
    expect(() => getDueWords([], -1)).toThrow();
    expect(() => getDueWords([], "auto", "bad")).toThrow();
  });

  it("extends consecutive known intervals and marks mastery only after six known reviews", () => {
    let current = word();
    [1, 2, 4, 7, 14, 30].forEach((interval, index) => {
      current = scheduleReview(current, "known", now);
      expect(current.intervalDays).toBe(interval);
      expect(current.nextReviewDate).toBe(addDays("2026-10-20", interval));
      expect(current.streak).toBe(index + 1);
      expect(current.mastered).toBe(index === 5);
    });
    expect(current).toMatchObject({
      totalReviews: 6,
      knownCount: 6,
      fuzzyCount: 0,
      unknownCount: 0,
    });
  });

  it("fuzzy reduces the streak and schedules a short interval", () => {
    const result = scheduleReview(
      word({
        streak: 4,
        intervalDays: 7,
        knownCount: 4,
        totalReviews: 4,
        mastered: true,
      }),
      "fuzzy",
      now,
    );
    expect(result).toMatchObject({
      streak: 3,
      intervalDays: 2,
      fuzzyCount: 1,
      totalReviews: 5,
      nextReviewDate: "2026-10-22",
      mastered: false,
    });
  });

  it("unknown clears the streak, reopens mastery, and makes the word due today", () => {
    const result = scheduleReview(
      word({
        streak: 6,
        intervalDays: 30,
        knownCount: 6,
        totalReviews: 6,
        mastered: true,
      }),
      "unknown",
      now,
    );
    expect(result).toMatchObject({
      streak: 0,
      intervalDays: 0,
      unknownCount: 1,
      totalReviews: 7,
      nextReviewDate: "2026-10-20",
      mastered: false,
    });
    expect(getDueWords([result], "auto", "2026-10-20")).toHaveLength(1);
  });

  it("tracks mixed results without mutating the input", () => {
    const original = word();
    const result = (
      ["known", "known", "fuzzy", "unknown", "known"] as const
    ).reduce(
      (current, rating) => scheduleReview(current, rating, now),
      original,
    );
    expect(result).toMatchObject({
      totalReviews: 5,
      knownCount: 3,
      fuzzyCount: 1,
      unknownCount: 1,
      streak: 1,
      intervalDays: 1,
    });
    expect(original.totalReviews).toBe(0);
  });

  it("schedules reviews using the review day rather than the creation day", () => {
    expect(
      scheduleReview(word(), "known", new Date(2026, 10, 2, 0, 10))
        .nextReviewDate,
    ).toBe("2026-11-03");
  });

  it("excludes future/mastered words and applies automatic or bounded selection", () => {
    const words = [
      word({ id: "today" }),
      word({ id: "future", nextReviewDate: "2026-10-21" }),
      word({ id: "mastered", mastered: true }),
      word({ id: "overdue", nextReviewDate: "2026-10-01" }),
    ];
    expect(
      getDueWords(words, "auto", "2026-10-20").map((item) => item.id),
    ).toEqual(["overdue", "today"]);
    expect(getDueWords(words, 1, "2026-10-20").map((item) => item.id)).toEqual([
      "overdue",
    ]);
    expect(getDueWords(words, 0, "2026-10-20")).toEqual([]);
    expect(words[0].id).toBe("today");
  });

  it("prioritizes unknown counts, fuzzy counts, overdue days, then new words", () => {
    const words = [
      word({ id: "new" }),
      word({ id: "old", totalReviews: 1 }),
      word({ id: "overdue", nextReviewDate: "2026-10-01" }),
      word({ id: "fuzzy", fuzzyCount: 2 }),
      word({ id: "unknown", unknownCount: 1 }),
    ];
    expect(
      getDueWords(words, "auto", "2026-10-20").map((item) => item.id),
    ).toEqual(["unknown", "fuzzy", "overdue", "new", "old"]);
  });
});

describe("word parsing and searching", () => {
  it("normalizes English whitespace, fullwidth characters and case", () => {
    expect(normalizeEnglish("  ＡＢＡＮＤＯＮ  ")).toBe("abandon");
    expect(normalizeEnglish("  In   spite OF  ")).toBe("in spite of");
    expect(normalizeEnglish("one’s")).toBe("one's");
  });

  it("supports all four batch separators and English hyphens", () => {
    const result = parseWordBatch(
      "abandon 放弃；抛弃\nobscure - 模糊的；晦涩的\ncompulsory: 强制的\nwell-being\t幸福",
    );
    expect(result).toMatchObject({ valid: 4, invalid: 0, duplicates: 0 });
    expect(result.rows[3]).toMatchObject({
      english: "well-being",
      chinese: "幸福",
      line: 4,
    });
  });

  it("retains valid rows alongside invalid rows and ignores blank lines", () => {
    const result = parseWordBatch(
      "abandon 放弃\n\nmissing\n中文 中文\n : 空\ncompulsory 必修的",
    );
    expect(result).toMatchObject({ valid: 2, invalid: 3, duplicates: 0 });
    expect(result.rows.at(-1)?.line).toBe(6);
    expect(
      result.rows.find((row) => row.status === "invalid")?.message,
    ).toBeTruthy();
  });

  it("detects duplicates against the database and within the same paste", () => {
    const result = parseWordBatch(
      "ABANDON 放弃\nobscure 模糊的\nObscure: 晦涩的",
      [word({ english: "abandon" })],
    );
    expect(result).toMatchObject({ valid: 1, invalid: 0, duplicates: 2 });
  });

  it("supports English phrases without splitting an internal hyphen", () => {
    expect(parseWordBatch("in spite of 尽管").rows[0]).toMatchObject({
      english: "in spite of",
      chinese: "尽管",
      status: "valid",
    });
  });

  it("searches English, Chinese, and notes without changing the original list", () => {
    const words = [
      word(),
      word({ english: "compulsory", chinese: "强制的", notes: "教育主题" }),
    ];
    expect(searchWords(words, "OBSCURE")).toHaveLength(1);
    expect(searchWords(words, "晦涩")).toHaveLength(1);
    expect(searchWords(words, "教育")).toHaveLength(1);
    expect(searchWords(words, "absent")).toEqual([]);
    expect(searchWords(words, "")).toEqual(words);
    expect(searchWords(words, "")).not.toBe(words);
  });
});

describe("IndexedDB atomic data operations", () => {
  it("creates versioned stores and unique word index", async () => {
    const database = await openDatabase();
    expect(database.version).toBe(1);
    for (const store of DB_STORES)
      expect(database.objectStoreNames.contains(store)).toBe(true);
    expect(
      database.transaction("words").objectStore("words").index("english")
        .unique,
    ).toBe(true);
  });

  it("rejects blanks and duplicates, then explicitly updates an existing definition", async () => {
    await expect(saveWord(" ", "释义")).rejects.toThrow("不能为空");
    await expect(saveWord("word", " ")).rejects.toThrow("不能为空");
    const original = await saveWord("  Obscure ", "模糊的", "备注");
    await expect(saveWord("OBSCURE", "晦涩的")).rejects.toBeInstanceOf(
      DuplicateWordError,
    );
    const updated = await saveWord("OBSCURE", "晦涩的", "新备注", original.id);
    expect(updated).toMatchObject({
      id: original.id,
      english: "obscure",
      chinese: "晦涩的",
      createdAt: original.createdAt,
    });
    expect(await db.getAll("words")).toHaveLength(1);
  });

  it("does not overwrite another word when an edited spelling collides", async () => {
    const first = await saveWord("obscure", "模糊的");
    await saveWord("abandon", "放弃");
    await expect(
      saveWord("abandon", "更新", "", first.id),
    ).rejects.toBeInstanceOf(DuplicateWordError);
    expect((await db.get<Word>("words", first.id))?.english).toBe("obscure");
  });

  it("atomically updates review counters and audit records even with a stale UI word", async () => {
    const original = await saveWord("obscure", "模糊的");
    await reviewWord(original, "known", now);
    const second = await reviewWord(original, "unknown", now);
    expect(second).toMatchObject({
      totalReviews: 2,
      knownCount: 1,
      unknownCount: 1,
      streak: 0,
    });
    expect(await db.getAll("wordReviews")).toHaveLength(2);
  });

  it("cannot review a deleted word or create a dangling audit record", async () => {
    const removed = await saveWord("obscure", "模糊的");
    await db.delete("words", removed.id);
    await expect(reviewWord(removed, "known", now)).rejects.toThrow("已被删除");
    expect(await db.getAll("wordReviews")).toEqual([]);
  });

  it("deletes one word and all its reviews while retaining other words and history", async () => {
    const removed = await saveWord("obscure", "模糊的");
    const retained = await saveWord("abandon", "放弃");
    await reviewWord(removed, "known", now);
    await reviewWord(removed, "fuzzy", now);
    await reviewWord(retained, "unknown", now);
    await deleteWord(removed.id);
    expect(await db.getAll("words")).toEqual([
      expect.objectContaining({ id: retained.id }),
    ]);
    expect(await db.getAll("wordReviews")).toEqual([
      expect.objectContaining({ wordId: retained.id }),
    ]);
    await deleteWord(removed.id); // Retrying a successful deletion is harmless.
    expect(await db.getAll("wordReviews")).toHaveLength(1);
  });

  it("rolls back word deletion if removing its history fails", async () => {
    const saved = await saveWord("obscure", "模糊的");
    await reviewWord(saved, "known", now);
    const nativeDelete = IDBObjectStore.prototype.delete;
    vi.spyOn(IDBObjectStore.prototype, "delete").mockImplementation(function (
      this: IDBObjectStore,
      key: IDBValidKey | IDBKeyRange,
    ) {
      if (this.name === "wordReviews")
        throw new DOMException("Simulated failure", "UnknownError");
      return nativeDelete.call(this, key);
    });
    await expect(deleteWord(saved.id)).rejects.toThrow("Simulated failure");
    vi.restoreAllMocks();
    expect(await db.get("words", saved.id)).toBeDefined();
    expect(await db.getAll("wordReviews")).toHaveLength(1);
  });

  it("serializes a concurrent review and deletion without orphaned review records", async () => {
    const saved = await saveWord("obscure", "模糊的");
    await Promise.all([reviewWord(saved, "known", now), deleteWord(saved.id)]);
    expect(await db.get("words", saved.id)).toBeUndefined();
    expect(await db.getAll("wordReviews")).toEqual([]);
  });

  it("restores a mastered word to today’s review", async () => {
    const original = await saveWord("obscure", "模糊的");
    const mastered = await setWordMastered(original, true);
    expect(mastered.mastered).toBe(true);
    const restored = await setWordMastered(mastered, false);
    expect(restored).toMatchObject({
      mastered: false,
      nextReviewDate: localDateKey(),
      streak: 0,
    });
  });

  it("imports only valid preview rows and rechecks duplicates at commit time", async () => {
    const preview = parseWordBatch("obscure 模糊的\nbad\nabandon 放弃");
    await saveWord("obscure", "已有释义");
    expect(await bulkImportWords(preview.rows)).toEqual({
      imported: 1,
      duplicates: 1,
    });
    expect(await db.getAll("words")).toHaveLength(2);
    expect(
      (await db.getAll<Word>("words")).find(
        (item) => item.english === "obscure",
      )?.chinese,
    ).toBe("已有释义");
  });

  it("clears learning data and local audio while preserving settings", async () => {
    await saveWord("obscure", "模糊的");
    await db.put("settings", { id: "theme", value: "dark" });
    await db.put("settings", {
      id: "practice-imports",
      value: [{ id: "personal-reading" }],
    });
    await db.put("settings", {
      id: "practice-audio-selection",
      value: { "personal-reading": "audio" },
    });
    await db.put("audioFiles", {
      id: "audio",
      name: "local.mp3",
      blob: new Blob(["audio"]),
      createdAt: now.toISOString(),
    });
    await clearLearningData();
    expect(await db.getAll("words")).toEqual([]);
    expect(await db.getAll("audioFiles")).toEqual([]);
    expect(await db.get("settings", "theme")).toEqual({
      id: "theme",
      value: "dark",
    });
    expect(await db.get("settings", "practice-imports")).toBeUndefined();
    expect(
      await db.get("settings", "practice-audio-selection"),
    ).toBeUndefined();
  });
});

describe("validated backup and atomic restore", () => {
  async function seed() {
    const saved = await saveWord("obscure", "模糊的");
    await reviewWord(saved, "known", now);
    const expression = {
      id: "mine",
      english: "learn from experience",
      chinese: "从经验中学习",
      topic: "个人成长",
      category: "观点表达",
      usage: "用于讨论学习",
      sourceType: "个人积累",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    await db.put("writingExpressions", expression);
    await db.put("translationExpressions", {
      ...expression,
      id: "translation",
    });
    await db.put("favorites", {
      id: "writing:mine",
      module: "writing",
      expressionId: "mine",
      createdAt: now.toISOString(),
    });
    await db.put("practiceRecords", {
      id: "record",
      practiceId: "reading-1",
      module: "reading",
      answers: { q1: "A" },
      correct: 1,
      total: 1,
      completedAt: now.toISOString(),
    });
    await db.put("settings", { id: "theme", value: "dark" });
    return exportBackup();
  }

  it("exports all seven JSON stores, roundtrips a backup, and excludes audio blobs", async () => {
    const backup = await seed();
    await db.put("audioFiles", {
      id: "local",
      name: "private.mp3",
      blob: new Blob(["audio"]),
      createdAt: now.toISOString(),
    });
    expect(validateBackup(JSON.stringify(backup))).toEqual(backup);
    expect(backup.audioExcluded).toBe(true);
    expect(Object.keys(backup.data)).toHaveLength(7);
    expect(JSON.stringify(await exportBackup())).not.toContain("private.mp3");
    await clearLearningData();
    await restoreBackup(backup);
    expect((await exportBackup()).data).toEqual(backup.data);
  });

  it("rejects malformed JSON, unsupported versions and missing tables without changing data", async () => {
    const backup = await seed();
    await expect(restoreBackup("{broken")).rejects.toThrow("格式无效");
    await expect(restoreBackup({ ...backup, version: 99 })).rejects.toThrow(
      "版本",
    );
    await expect(restoreBackup({ ...backup, data: {} })).rejects.toThrow(
      "数据表",
    );
    expect((await exportBackup()).data).toEqual(backup.data);
  });

  it("rejects duplicate words, malformed dates and inconsistent counts", async () => {
    const backup = await seed();
    const original = backup.data.words[0];
    expect(() =>
      validateBackup({
        ...backup,
        data: {
          ...backup.data,
          words: [original, { ...original, id: "second" }],
        },
      }),
    ).toThrow("单词重复");
    expect(() =>
      validateBackup({
        ...backup,
        data: {
          ...backup.data,
          words: [{ ...original, nextReviewDate: "2026-02-30" }],
        },
      }),
    ).toThrow("字段错误");
    expect(() =>
      validateBackup({
        ...backup,
        data: { ...backup.data, words: [{ ...original, totalReviews: 999 }] },
      }),
    ).toThrow("计数错误");
  });

  it("rejects unsafe settings, invalid practice grades, and duplicate record IDs", async () => {
    const backup = await seed();
    const unsafe = JSON.parse(
      '{"id":"unsafe","value":{"__proto__":{"polluted":true}}}',
    );
    expect(() =>
      validateBackup({
        ...backup,
        data: { ...backup.data, settings: [unsafe] },
      }),
    ).toThrow();
    expect(() =>
      validateBackup({
        ...backup,
        data: {
          ...backup.data,
          practiceRecords: [{ ...backup.data.practiceRecords[0], correct: 2 }],
        },
      }),
    ).toThrow();
    expect(() =>
      validateBackup({
        ...backup,
        data: {
          ...backup.data,
          favorites: [...backup.data.favorites, ...backup.data.favorites],
        },
      }),
    ).toThrow("重复");
  });

  it("rejects enum arrays that could otherwise masquerade as valid strings", async () => {
    const backup = await seed();
    expect(() =>
      validateBackup({
        ...backup,
        data: {
          ...backup.data,
          wordReviews: [{ ...backup.data.wordReviews[0], rating: ["known"] }],
        },
      }),
    ).toThrow("字段错误");
    expect(() =>
      validateBackup({
        ...backup,
        data: {
          ...backup.data,
          favorites: [{ ...backup.data.favorites[0], module: ["writing"] }],
        },
      }),
    ).toThrow("字段错误");
    expect(() =>
      validateBackup({
        ...backup,
        data: {
          ...backup.data,
          practiceRecords: [
            { ...backup.data.practiceRecords[0], module: ["reading"] },
          ],
        },
      }),
    ).toThrow("字段错误");
  });

  it("rolls back already-scheduled clears when a database write fails mid-restore", async () => {
    const original = await seed();
    const replacement = structuredClone(original);
    replacement.data.words[0].chinese = "待恢复数据";
    const nativePut = IDBObjectStore.prototype.put;
    let calls = 0;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      calls++;
      if (calls === 2)
        throw new DOMException("Storage full", "QuotaExceededError");
      return nativePut.apply(this, args);
    });
    await expect(restoreBackup(replacement)).rejects.toThrow("Storage full");
    vi.restoreAllMocks();
    expect((await exportBackup()).data).toEqual(original.data);
  });

  it("preserves local audio during JSON restore", async () => {
    const backup = await seed();
    await db.put("audioFiles", {
      id: "local",
      name: "private.mp3",
      blob: new Blob(["audio"]),
      createdAt: now.toISOString(),
    });
    await restoreBackup(backup);
    expect(await db.getAll("audioFiles")).toHaveLength(1);
  });
});

describe("practice submission grading", () => {
  const questions = [
    { id: "q1", answer: "A" },
    { id: "q2", answer: "C" },
    { id: "q3", answer: "D" },
  ];
  it("grades selected and unanswered questions with per-question states", () => {
    const result = gradeAnswers(questions, { q1: "a", q2: "B" });
    expect(result).toMatchObject({ correct: 1, total: 3, percentage: 33 });
    expect(result.results).toEqual([
      { questionId: "q1", selected: "a", answer: "A", correct: true },
      { questionId: "q2", selected: "B", answer: "C", correct: false },
      { questionId: "q3", selected: "", answer: "D", correct: false },
    ]);
  });

  it("does not mutate answer state and handles an empty question set", () => {
    const answers = { q1: "A" };
    gradeAnswers(questions, answers);
    expect(answers).toEqual({ q1: "A" });
    expect(gradeAnswers([], {})).toEqual({
      correct: 0,
      total: 0,
      percentage: 0,
      results: [],
    });
  });
});
