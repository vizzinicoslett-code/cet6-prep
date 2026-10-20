import type { Word } from "../types";

export function normalizeEnglish(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[’‘]/g, "'")
    .toLocaleLowerCase("en-US");
}

export interface WordBatchRow {
  line: number;
  english: string;
  chinese: string;
  status: "valid" | "invalid" | "duplicate";
  message?: string;
}

export interface WordBatchResult {
  rows: WordBatchRow[];
  valid: number;
  invalid: number;
  duplicates: number;
}

export function parseWordBatch(
  text: string,
  existingWords: Pick<Word, "english">[] = [],
): WordBatchResult {
  const seen = new Set(
    existingWords.map((word) => normalizeEnglish(word.english)),
  );
  const rows: WordBatchRow[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;
    const match =
      line.match(/^(.+?)\t+\s*(.+)$/) ??
      line.match(/^(.+?)\s*[:：]\s*(.+)$/) ??
      line.match(/^(.+?)\s+[-–—]\s*(.+)$/) ??
      line.match(/^(.+?)\s+([\u3400-\u9fff].*)$/) ??
      line.match(/^(\S+)\s+(.+)$/);
    const english = normalizeEnglish(match?.[1] ?? line);
    const chinese = (match?.[2] ?? "").trim();
    const row: WordBatchRow = {
      line: index + 1,
      english,
      chinese,
      status: "valid",
    };
    if (
      !match ||
      !english ||
      !/[a-z]/i.test(english) ||
      /[\u3400-\u9fff]/.test(english) ||
      !chinese
    ) {
      row.status = "invalid";
      row.message =
        "请使用「英文 中文」「英文 - 中文」「英文: 中文」或制表符分隔";
    } else if (seen.has(english)) {
      row.status = "duplicate";
      row.message = "单词本或本次粘贴中已有此词";
    } else {
      seen.add(english);
    }
    rows.push(row);
  });
  return {
    rows,
    valid: rows.filter((row) => row.status === "valid").length,
    invalid: rows.filter((row) => row.status === "invalid").length,
    duplicates: rows.filter((row) => row.status === "duplicate").length,
  };
}

export function searchWords(words: Word[], query: string): Word[] {
  const normalized = normalizeEnglish(query);
  if (!normalized) return [...words];
  return words.filter((word) =>
    [word.english, word.chinese, word.notes].some((value) =>
      normalizeEnglish(value).includes(normalized),
    ),
  );
}
