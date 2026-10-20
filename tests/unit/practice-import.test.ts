import { describe, expect, it } from "vitest";
import {
  parsePracticeImport,
  practiceImportExample,
  practiceItems,
  safeSourceUrl,
} from "../../src/data/practice";

const example = () =>
  structuredClone(practiceImportExample) as {
    version: number;
    practices: Record<string, any>[];
  };

describe("local practice JSON import boundary", () => {
  it("accepts complete reading data and always marks it as local and unverified", () => {
    const input = example();
    input.practices[0].origin = "verified-excerpt";
    const result = parsePracticeImport(input)[0];
    expect(result.id).toBe("local-my-reading-01");
    expect(result.origin).toBe("local");
    expect(result.sourceNote).toContain("未经本站核验");
  });

  it("does not mutate the input while normalizing data", () => {
    const input = example();
    input.practices[0].title = "  My reading  ";
    const before = structuredClone(input);
    expect(parsePracticeImport(input)[0].title).toBe("My reading");
    expect(input).toEqual(before);
  });

  it.each([
    null,
    [],
    {},
    { version: 2, practices: [] },
    { version: 1, practices: "x" },
    { version: 1, practices: [] },
  ])(
    "rejects malformed roots without producing a partial result (%j)",
    (input) => {
      expect(() => parsePracticeImport(input)).toThrow();
    },
  );

  it("accepts 50 unique practices and rejects 51", () => {
    const input = example();
    const item = input.practices[0];
    input.practices = Array.from({ length: 50 }, (_, i) => ({
      ...structuredClone(item),
      id: `item-${i}`,
    }));
    expect(parsePracticeImport(input)).toHaveLength(50);
    input.practices.push({ ...structuredClone(item), id: "item-50" });
    expect(() => parsePracticeImport(input)).toThrow("1–50");
  });

  it("rejects duplicate practice IDs, including surrounding whitespace", () => {
    const input = example();
    input.practices.push({
      ...structuredClone(input.practices[0]),
      id: " my-reading-01 ",
    });
    expect(() => parsePracticeImport(input)).toThrow("不得重复");
  });

  it.each(["../path", "<script>", "has space", ""])(
    "rejects an unsafe or empty practice ID (%s)",
    (id) => {
      const input = example();
      input.practices[0].id = id;
      expect(() => parsePracticeImport(input)).toThrow();
    },
  );

  it.each([1899, 2101, 2024.5, "2024", undefined])(
    "rejects invalid years (%s)",
    (year) => {
      const input = example();
      input.practices[0].year = year;
      expect(() => parsePracticeImport(input)).toThrow("year");
    },
  );

  it.each([0, 3, "6", undefined])("rejects invalid months (%s)", (month) => {
    const input = example();
    input.practices[0].month = month;
    expect(() => parsePracticeImport(input)).toThrow("month");
  });

  it("requires a passage for reading and a transcript for listening", () => {
    const input = example();
    delete input.practices[0].passage;
    expect(() => parsePracticeImport(input)).toThrow("文章");
    input.practices[0].module = "listening";
    input.practices[0].type = "长对话";
    expect(() => parsePracticeImport(input)).toThrow("听力原文");
    input.practices[0].transcript = "This is a locally supplied transcript.";
    expect(parsePracticeImport(input)[0].module).toBe("listening");
  });

  it("requires a kind belonging to the given module", () => {
    const input = example();
    input.practices[0].type = "长对话";
    expect(() => parsePracticeImport(input)).toThrow("题型");
    input.practices[0].module = "writing";
    expect(() => parsePracticeImport(input)).toThrow("module");
  });

  it("validates all questions before accepting the collection", () => {
    const input = example();
    input.practices.push({
      ...structuredClone(input.practices[0]),
      id: "invalid-second",
    });
    input.practices[1].questions[0].answer = "Z";
    expect(() => parsePracticeImport(input)).toThrow("答案");
  });

  it("requires 1–100 questions with unique IDs", () => {
    const input = example();
    const question = input.practices[0].questions[0];
    input.practices[0].questions = [];
    expect(() => parsePracticeImport(input)).toThrow("1–100");
    input.practices[0].questions = Array.from({ length: 100 }, (_, i) => ({
      ...structuredClone(question),
      id: `q-${i}`,
    }));
    expect(parsePracticeImport(input)[0].questions).toHaveLength(100);
    input.practices[0].questions.push({
      ...structuredClone(question),
      id: "q-100",
    });
    expect(() => parsePracticeImport(input)).toThrow("1–100");
    input.practices[0].questions = [question, structuredClone(question)];
    expect(() => parsePracticeImport(input)).toThrow("题目 ID");
  });

  it("requires 2–26 distinct alphabetic choices", () => {
    const input = example();
    input.practices[0].questions[0].options[1].key = "a";
    expect(() => parsePracticeImport(input)).toThrow("不重复");
    input.practices[0].questions[0].options = [
      { key: "1", text: "x" },
      { key: "B", text: "y" },
    ];
    expect(() => parsePracticeImport(input)).toThrow("A–Z");
    input.practices[0].questions[0].options = [{ key: "A", text: "x" }];
    expect(() => parsePracticeImport(input)).toThrow("2–26");
  });

  it("normalizes lower-case answer and option letters", () => {
    const input = example();
    input.practices[0].questions[0].options[0].key = "a";
    input.practices[0].questions[0].answer = "a";
    expect(parsePracticeImport(input)[0].questions[0].answer).toBe("A");
  });

  it.each(["stem", "explanation"])(
    "requires a nonempty question %s",
    (field) => {
      const input = example();
      input.practices[0].questions[0][field] = "  ";
      expect(() => parsePracticeImport(input)).toThrow();
    },
  );

  it("rejects oversized source lists and non-http source links", () => {
    const input = example();
    input.practices[0].sources = [
      { label: "Unsafe", url: "javascript:alert(1)" },
    ];
    expect(() => parsePracticeImport(input)).toThrow("http");
    input.practices[0].sources = Array.from({ length: 11 }, () => ({
      label: "Source",
      url: "https://example.com",
    }));
    expect(() => parsePracticeImport(input)).toThrow("10");
  });

  it("accepts source links as text data and discards injected remote media and extra fields", () => {
    const input = example();
    input.practices[0].sources = [
      { label: "Personal source", url: "https://example.com/item" },
    ];
    input.practices[0].audioSrc = "https://example.com/track.mp3";
    input.practices[0].html = "<script>alert(1)</script>";
    const result = parsePracticeImport(input)[0];
    expect(result.sources).toHaveLength(1);
    expect(result.audioSrc).toBeUndefined();
    expect(result).not.toHaveProperty("html");
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,test",
    "file:///private",
    "not a URL",
    null,
  ])("rejects an unsafe source protocol (%s)", (value) => {
    expect(safeSourceUrl(value)).toBe(false);
  });
});

describe("bundled practice data integrity and source status", () => {
  it("uses unique stable practice and question IDs and valid answer choices", () => {
    expect(new Set(practiceItems.map((item) => item.id)).size).toBe(
      practiceItems.length,
    );
    for (const item of practiceItems) {
      expect(item.questions.length).toBeGreaterThan(0);
      expect(new Set(item.questions.map((question) => question.id)).size).toBe(
        item.questions.length,
      );
      for (const question of item.questions) {
        expect(
          question.options.some((option) => option.key === question.answer),
        ).toBe(true);
        expect(question.explanation.trim()).not.toBe("");
      }
    }
  });

  it("gives each true-exam excerpt at least two cross-checkable source URLs and no bundled third-party audio", () => {
    const verified = practiceItems.filter(
      (item) => item.origin === "verified-excerpt",
    );
    expect(verified).toHaveLength(2);
    for (const item of verified) {
      expect(item.year).toBe(2024);
      expect(item.month).toBe(6);
      expect(item.sources.length).toBeGreaterThanOrEqual(2);
      expect(item.sources.every((source) => safeSourceUrl(source.url))).toBe(
        true,
      );
      expect(item.audioSrc).toBeUndefined();
      expect(item.sourceNote).toContain("2026-10-20");
    }
  });

  it("keeps original material separate from dated true exams", () => {
    const originals = practiceItems.filter(
      (item) => item.origin === "original",
    );
    expect(originals).toHaveLength(4);
    for (const item of originals) {
      expect(item.year).toBeNull();
      expect(item.month).toBeNull();
      expect(item.sourceNote).toContain("非历年真题");
    }
    expect(
      originals
        .filter((item) => item.module === "reading")
        .map((item) => item.type)
        .sort(),
    ).toEqual(["仔细阅读", "选词填空", "长篇阅读"].sort());
  });

  it("has one original listening sample with its own audio and transcript", () => {
    const listening = practiceItems.filter(
      (item) => item.origin === "original" && item.module === "listening",
    );
    expect(listening).toHaveLength(1);
    expect(listening[0].audioSrc).toBe("audio/original-campus.wav");
    expect(listening[0].transcript).toContain("bicycle repair workshop");
    expect(listening[0].sourceNote).toContain("系统语音合成");
  });
});
