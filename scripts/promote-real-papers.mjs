import fs from "node:fs/promises";

const examsPath = "src/data/exams.ts";
const expressionsPath = "src/features/Expressions.tsx";

function replaceOnce(source, from, to, label) {
  if (!source.includes(from)) {
    throw new Error(`Patch target not found: ${label}`);
  }
  return source.replace(from, to);
}

let exams = await fs.readFile(examsPath, "utf8");

const helperNeedle = `const nju = (session: string, set: number) =>\n  \`https://eol.nju.edu.cn/cet6/papers/\${session}-\${set}.html\`;\n`;
const helperReplacement = `${helperNeedle}\nconst njuPaperInfo = (sources: string[]) => {\n  const fullPaperUrl = sources.find((url) =>\n    /eol\\.nju\\.edu\\.cn\\/cet6\\/papers\\/\\d{6}-[123]\\.html$/.test(url),\n  );\n  const match = fullPaperUrl?.match(/\\/papers\\/\\d{6}-(\\d)\\.html$/);\n  return match\n    ? { set: \`第\${match[1]}套\`, status: \"verified\" as const }\n    : { set: \"待核定\", status: \"partial\" as const };\n};\n`;
exams = replaceOnce(exams, helperNeedle, helperReplacement, "add Nanjing paper metadata helper");

const writingOld = `export const writingExams: Exam[] = writingRows.map(\n  ([id, year, month, title, topic, keywords, summary, outline, sources]) => ({\n    id,\n    year,\n    month,\n    set: \"待核定\",\n    title,\n    topic,\n    keywords,\n    prompt: \`主题摘要（本站转述，非完整原题）：\${summary}\`,\n    outline: [\"以下为本站原创写作思路，不是官方评分答案。\", ...outline],\n    sources,\n    status: \"partial\",\n  }),\n);`;
const writingNew = `export const writingExams: Exam[] = writingRows.map(\n  ([id, year, month, title, topic, keywords, summary, outline, sources]) => {\n    const paper = njuPaperInfo(sources);\n    return {\n      id,\n      year,\n      month,\n      set: paper.set,\n      title,\n      topic,\n      keywords,\n      prompt: \`主题索引：\${summary}\`,\n      outline: [\"以下为本站原创写作思路，不是官方评分答案。\", ...outline],\n      sources,\n      status: paper.status,\n    };\n  },\n);`;
exams = replaceOnce(exams, writingOld, writingNew, "promote verified writing paper sets");

const translationOld = `export const translationExams: Exam[] = translationRows.map(\n  ([\n    id,\n    year,\n    month,\n    title,\n    topic,\n    keywords,\n    summary,\n    chinese,\n    english,\n    sources,\n  ]) => ({\n    id,\n    year,\n    month,\n    set: \"待核定\",\n    title,\n    topic,\n    keywords,\n    status: \"partial\",\n    sources,\n    prompt: \`主题摘要（本站转述，非中文原题）：\${summary}完整原题请查阅来源。\`,\n    outline: [\n      \"先确定句子主干，再处理时间、地点和修饰语。\",\n      \"下方短句由本站原创，仅练习同主题表达，不是原题节选。\",\n    ],\n    reference: \`原创短句练习参考译法（并非原题译文或官方唯一答案）：\${english}\`,\n    sentences: [{ chinese: \`原创练习：\${chinese}\`, english }],\n  }),\n);`;
const translationNew = `export const translationExams: Exam[] = translationRows.map(\n  ([\n    id,\n    year,\n    month,\n    title,\n    topic,\n    keywords,\n    summary,\n    chinese,\n    english,\n    sources,\n  ]) => {\n    const paper = njuPaperInfo(sources);\n    return {\n      id,\n      year,\n      month,\n      set: paper.set,\n      title,\n      topic,\n      keywords,\n      status: paper.status,\n      sources,\n      prompt: \`主题索引：\${summary}\`,\n      outline: [\n        \"先确定句子主干，再处理时间、地点和修饰语。\",\n        \"下方短句由本站原创，仅练习同主题表达，不是原题节选。\",\n      ],\n      reference: \`原创短句练习参考译法（并非原题译文或官方唯一答案）：\${english}\`,\n      sentences: [{ chinese: \`原创练习：\${chinese}\`, english }],\n    };\n  },\n);`;
exams = replaceOnce(exams, translationOld, translationNew, "promote verified translation paper sets");

await fs.writeFile(examsPath, exams);

let expressions = await fs.readFile(expressionsPath, "utf8");
expressions = replaceOnce(expressions, `            \"历年真题\",`, `            \"真题原题\",`, "rename exam tab");

const noticeOld = `              这里整理的是真题主题目录，部分场次仍缺独立交叉核验；完整原题和套号待补充，请结合来源使用。题干以摘要呈现，不作为原题全文。\n              {writing\n                ? \"写作思路为自主整理。\"\n                : \"参考译文为自主整理，并非官方唯一答案。\"}`;
const noticeNew = `              真题区不再把本站主题摘要当作原题。2024—2026 已接入南京大学公开的 15 套完整六级自测原题页，含写作、听力、阅读和翻译；旧年份保留原题来源索引，未核验完整题面的内容不会标成“完整原题”。\n              {writing\n                ? \"写作思路仍为本站自主整理。\"\n                : \"同主题练习仍为本站自主整理，并非官方唯一答案。\"}\n              {\" \"}\n              <a\n                className=\"text-link\"\n                href=\"https://eol.nju.edu.cn/cet6/index.html\"\n                target=\"_blank\"\n                rel=\"noopener noreferrer\"\n              >\n                打开 2024—2026 完整原题总目录\n                <ArrowUpRight size={13} />\n              </a>`;
expressions = replaceOnce(expressions, noticeOld, noticeNew, "replace exam notice");

const cardStartOld = `function ExamCard({ exam, writing }: { exam: Exam; writing: boolean }) {\n  const [reference, setReference] = useState(false);\n  const [sentences, setSentences] = useState<Set<number>>(new Set());\n  return (`;
const cardStartNew = `function ExamCard({ exam, writing }: { exam: Exam; writing: boolean }) {\n  const [reference, setReference] = useState(false);\n  const [sentences, setSentences] = useState<Set<number>>(new Set());\n  const fullPaperUrl = exam.sources.find((url) =>\n    /eol\\.nju\\.edu\\.cn\\/cet6\\/papers\\/\\d{6}-[123]\\.html$/.test(url),\n  );\n  const olderArchiveUrl =\n    !fullPaperUrl && exam.year <= 2023\n      ? exam.year === 2023 && exam.month === 12\n        ? \"https://eol.nju.edu.cn/courses/cet6-dongfang.html\"\n        : \"https://eol.nju.edu.cn/courses/cet-zhenti.html\"\n      : undefined;\n  const paperUrl = fullPaperUrl || olderArchiveUrl;\n  return (`;
expressions = replaceOnce(expressions, cardStartOld, cardStartNew, "add real paper source detection");

const metaOld = `        <span>{exam.set}</span>\n        <span className=\"tag neutral\">{exam.topic}</span>\n        {exam.status === \"pending\" && (\n          <span className=\"tag error-tag\">待补充</span>\n        )}\n        {exam.status === \"partial\" && (\n          <span className=\"tag\">部分核验 · 原文 / 套数待补</span>\n        )}`;
const metaNew = `        <span>{exam.set}</span>\n        <span className=\"tag neutral\">{exam.topic}</span>\n        {fullPaperUrl ? (\n          <span className=\"tag\">完整原题已核验</span>\n        ) : exam.status === \"pending\" ? (\n          <span className=\"tag error-tag\">待补充</span>\n        ) : exam.status === \"partial\" ? (\n          <span className=\"tag\">原题来源索引 · 待完整核验</span>\n        ) : null}`;
expressions = replaceOnce(expressions, metaOld, metaNew, "show verified full paper status");

const promptOld = `      {exam.prompt && (\n        <p className=\"exam-prompt\">\n          <span className=\"small-text muted\">题目主题摘要</span>\n          <br />\n          {exam.prompt}\n        </p>\n      )}`;
const promptNew = `      {fullPaperUrl ? (\n        <p className=\"exam-prompt\">\n          <span className=\"small-text muted\">完整原题已接入</span>\n          <br />\n          该套写作、听力、阅读和翻译均可从原题页直接练习；本站不再用转述摘要冒充题干。\n        </p>\n      ) : exam.prompt ? (\n        <p className=\"exam-prompt\">\n          <span className=\"small-text muted\">主题索引 · 非原题题干</span>\n          <br />\n          {exam.prompt}\n        </p>\n      ) : null}\n      {paperUrl && (\n        <a\n          className=\"btn primary small\"\n          href={paperUrl}\n          target=\"_blank\"\n          rel=\"noopener noreferrer\"\n          style={{ marginBottom: 14 }}\n        >\n          {fullPaperUrl ? \"打开完整原题\" : \"打开南大原题合集\"}\n          <ArrowUpRight size={14} />\n        </a>\n      )}`;
expressions = replaceOnce(expressions, promptOld, promptNew, "replace summary-first prompt with real paper action");

await fs.writeFile(expressionsPath, expressions);
console.log("Real-paper integration patch applied.");
