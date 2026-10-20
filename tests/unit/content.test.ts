import { describe, expect, it } from "vitest";
import {
  expressionCategories,
  translationExpressions,
  translationTopics,
  writingExpressions,
  writingTopics,
} from "../../src/data/expressions";
import { translationExams, writingExams } from "../../src/data/exams";

describe("预置学习内容的完整性", () => {
  it("每条表达可独立收藏，检索结果没有重复卡片", () => {
    const all = [...writingExpressions, ...translationExpressions];
    expect(new Set(all.map((item) => item.id)).size).toBe(all.length);
    for (const group of [writingExpressions, translationExpressions]) {
      const normalized = group.map((item) =>
        item.english.normalize("NFKC").trim().toLocaleLowerCase(),
      );
      expect(new Set(normalized).size).toBe(group.length);
      for (const item of group) {
        for (const field of [
          "english",
          "chinese",
          "topic",
          "category",
          "usage",
          "sourceType",
        ] as const) {
          expect(
            item[field].trim().length,
            `${item.id}.${field}`,
          ).toBeGreaterThan(0);
        }
        expect(expressionCategories).toContain(item.category);
      }
    }
  });

  it("主题筛选能覆盖每条预置表达，且保留可迁移的用法说明", () => {
    for (const [items, topics] of [
      [writingExpressions, writingTopics],
      [translationExpressions, translationTopics],
    ] as const) {
      for (const item of items) {
        expect(topics).toContain(item.topic);
        expect(item.usage.length).toBeGreaterThan(10);
      }
    }
    expect(writingExpressions.length).toBeGreaterThanOrEqual(100);
    expect(translationExpressions.length).toBeGreaterThanOrEqual(150);
    expect(writingExpressions.every((item) => Boolean(item.example))).toBe(
      true,
    );
  });
});

describe("真题目录的事实与标签边界", () => {
  const exams = [...writingExams, ...translationExams];

  it("日期不包含未来考题，作文与翻译条目拥有稳定且唯一的标识", () => {
    expect(new Set(exams.map((item) => item.id)).size).toBe(exams.length);
    for (const exam of exams) {
      expect(exam.year).toBeGreaterThanOrEqual(2021);
      expect(exam.year * 100 + exam.month).toBeLessThanOrEqual(202610);
      expect([6, 12]).toContain(exam.month);
      expect(exam.title.trim()).not.toBe("");
      expect(exam.keywords.length).toBeGreaterThan(0);
      expect(exam.sources.length).toBeGreaterThan(0);
      for (const source of exam.sources) {
        const url = new URL(source);
        expect(url.protocol).toBe("https:");
        expect(url.hostname).not.toMatch(/^(localhost|127\.)/);
      }
    }
  });

  it("未确认套号与摘要不会显示成完整核验的官方原卷", () => {
    for (const exam of exams) {
      if (exam.set === "待核定") expect(exam.status).not.toBe("verified");
      expect(exam.prompt).toContain("主题摘要");
      expect(exam.prompt).toContain("本站转述");
    }
  });

  it("翻译短句与译文明确标明原创练习身份，避免误认成真题", () => {
    for (const exam of translationExams) {
      expect(exam.prompt).toContain("非中文原题");
      expect(exam.reference).toContain("并非原题译文或官方唯一答案");
      expect(exam.sentences?.length).toBeGreaterThan(0);
      for (const sentence of exam.sentences ?? []) {
        expect(sentence.chinese).toMatch(/^原创练习：/);
        expect(sentence.english.trim()).not.toBe("");
      }
    }
  });
});
