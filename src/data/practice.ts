export type PracticeModule = "reading" | "listening";
export type PracticeKind =
  "仔细阅读" | "长篇阅读" | "选词填空" | "长对话" | "短文听力" | "讲座";
export interface PracticeQuestion {
  id: string;
  stem: string;
  options: { key: string; text: string }[];
  answer: string;
  explanation: string;
}
export interface PracticeItem {
  id: string;
  module: PracticeModule;
  title: string;
  year: number | null;
  month: 6 | 12 | null;
  set: string;
  type: PracticeKind;
  origin: "verified-excerpt" | "original" | "local";
  intro: string;
  passage?: string;
  transcript?: string;
  audioSrc?: string;
  questions: PracticeQuestion[];
  sources: { label: string; url: string }[];
  sourceNote: string;
}

const choices = (...texts: string[]) =>
  texts.map((text, index) => ({ key: String.fromCharCode(65 + index), text }));

/** Question texts and answers were checked against both linked pages on 2026-10-20.
 * Only brief stems and original Chinese summaries are bundled; full third-party texts are external.
 * Source set labels conflict, so the subject and question number identify these excerpts. */
export const practiceItems: PracticeItem[] = [
  {
    id: "original-reading-library",
    module: "reading",
    title: "A quieter way to learn",
    year: null,
    month: null,
    set: "原创 01",
    type: "仔细阅读",
    origin: "original",
    intro: "从文章中寻找证据，区分结论与推测。约 3 分钟 · 2 题。",
    passage: `When a university library extended its opening hours, staff expected students to stay longer. Instead, many students began visiting for shorter, more focused sessions. They arrived with one specific task, put their phones away, and left when the task was finished. The change surprised the library manager, who had assumed that more time in the building would mean more learning.

A student survey offered a different explanation. Knowing that the library would remain open reduced the pressure to complete everything in one visit. Students could plan several manageable sessions instead of one exhausting evening. The quiet environment mattered, but so did the freedom to return later.

These observations do not prove that shorter sessions improve everyone's grades. The survey recorded students' experiences rather than measuring academic results. However, it suggests that a useful learning space offers more than desks and books: it gives students control over how they work. The library now plans to study whether this pattern continues during examination weeks.`,
    questions: [
      {
        id: "library-1",
        stem: "What surprised the library manager?",
        options: choices(
          "Students preferred shorter visits after opening hours were extended.",
          "Students demanded fewer quiet areas.",
          "The building became less popular with all students.",
          "Students completed all tasks in one evening.",
        ),
        answer: "A",
        explanation:
          "第一段指出，延长开放时间后，许多学生反而选择更短且更专注的学习时段。管理者原本预期他们会待得更久。",
      },
      {
        id: "library-2",
        stem: "What limitation of the survey does the author acknowledge?",
        options: choices(
          "It included no university students.",
          "It did not measure academic performance.",
          "It focused only on examination weeks.",
          "It proved that long study sessions are harmful.",
        ),
        answer: "B",
        explanation:
          "第三段区分了学生的主观体验与实际成绩：调查没有测量学业结果，因此不能据此断言短时学习会提高所有人的成绩。",
      },
    ],
    sources: [],
    sourceNote: "本站原创练习 · 非历年真题；文章、题目和解析均为原创。",
  },
  {
    id: "verified-reading-2024-06-safety",
    module: "reading",
    title: "职场安全与及时干预 · 真题节选",
    year: 2024,
    month: 6,
    set: "题材定位 · 套号见来源",
    type: "仔细阅读",
    origin: "verified-excerpt",
    intro:
      "2024 年 6 月第 47、50 题考点。英文题干节选；选项为本站中文转述。请先在来源阅读原文。",
    passage:
      "文章讨论员工面对危险行为时不出面干预的原因，以及管理者如何创造支持及时干预的环境。完整英文文章请打开下方来源。本页仅收录考点节选，不构成完整真题试卷。",
    questions: [
      {
        id: "safety-47",
        stem: "47. What does the author mean by “diffusion of responsibility” (Para. 3)?",
        options: choices(
          "人越多，越担忧自己的安全。",
          "目击者越多，越不可能冒险。",
          "街上的人越多，越需要照料。",
          "周围人越多，越少有人主动干预。",
        ),
        answer: "D",
        explanation:
          "责任分散意味着个人期待他人采取行动，结果无人出面。两份来源均将此题答案指向“周围人越多，干预概率越低”。中文选项是本站转述。",
      },
      {
        id: "safety-50",
        stem: "50. What is critical to ensuring workplace safety?",
        options: choices(
          "训练工人正确操作设备。",
          "严惩危险行为。",
          "管理者营造可及时干预的安全氛围。",
          "管理者与一线工人有效沟通。",
        ),
        answer: "C",
        explanation:
          "题目强调支持及时干预的环境。两份来源在此答案内容上吻合；其余措施不能替代该题原文所强调的关键条件。解析为本站编写。",
      },
    ],
    sources: [
      {
        label: "原文与题目 · 懒笔记",
        url: "https://english-exam.lazynote.cn/cet6/sections/2024-06-1/part3-section-c-1/",
      },
      {
        label: "答案交叉核验 · 环球青藤",
        url: "https://mjineng.hqqt.com/news/2024-6/17187597821374.html",
      },
    ],
    sourceNote:
      "两来源对同篇文章的套号分别标为第 1、3 套，故不冒称统一官方套号。47、50 题答案内容已交叉核对；中文选项为转述，非原卷排版。核验：2026-10-20。",
  },
  {
    id: "original-reading-matching",
    module: "reading",
    title: "Small changes, shared spaces",
    year: null,
    month: null,
    set: "原创 02",
    type: "长篇阅读",
    origin: "original",
    intro: "将陈述与段落匹配。练习定位同义表达 · 3 题。",
    passage: `[A] A student group wanted to reduce waste in the campus café. Rather than buying new equipment immediately, members first watched how people used the existing recycling bins. Many students hesitated because the labels were difficult to read.

[B] The group tested clearer labels for two weeks. Each label used a short description and a picture of an everyday item. Staff counted incorrectly sorted items each evening. Mistakes became less common, although the experiment could not separate the effect of pictures from that of simpler wording.

[C] Some students suggested placing bins near every seat. Café workers explained that this would leave too little room for people using wheelchairs. The final plan kept wide paths open and placed fewer bins beside the exits.

[D] The group published its results along with the limits of the experiment. It invited other cafés to test the idea rather than promising that the same design would work everywhere.`,
    questions: [
      {
        id: "matching-1",
        stem: "The plan was adjusted to protect access for people with mobility needs.",
        options: choices("段落 A", "段落 B", "段落 C", "段落 D"),
        answer: "C",
        explanation:
          "段落 C 提到轮椅使用者需要足够通道空间，因此减少垃圾桶数量并调整位置。",
      },
      {
        id: "matching-2",
        stem: "The researchers could not tell which part of the change produced the improvement.",
        options: choices("段落 A", "段落 B", "段落 C", "段落 D"),
        answer: "B",
        explanation: "段落 B 指出，实验不能区分图片与简化文字各自的作用。",
      },
      {
        id: "matching-3",
        stem: "Observation came before a decision to purchase more equipment.",
        options: choices("段落 A", "段落 B", "段落 C", "段落 D"),
        answer: "A",
        explanation: "段落 A 先观察学生如何使用现有设施，没有立即购置新设备。",
      },
    ],
    sources: [],
    sourceNote:
      "本站原创练习 · 非历年真题。此短篇用于熟悉匹配方式，不代表正式试卷长度或难度。",
  },
  {
    id: "original-reading-cloze",
    module: "reading",
    title: "Learning from a failed experiment",
    year: null,
    month: null,
    set: "原创 03",
    type: "选词填空",
    origin: "original",
    intro: "结合句意和词性选择最合适的词 · 3 题。",
    passage: `A failed experiment can still provide useful evidence. Researchers need to [1] their observations carefully, including results that contradict their expectations. Otherwise, later studies may repeat the same mistakes.

Sharing such results also makes scientific work more [2]. Other teams can see how a conclusion was reached and decide whether a different method is needed. Failure is therefore not always the opposite of progress; it may be a valuable [3] of it.

词库：A record · B transparent · C component · D abandon · E identical · F temporarily`,
    questions: [
      {
        id: "cloze-1",
        stem: "空格 [1]",
        options: choices(
          "record",
          "transparent",
          "component",
          "abandon",
          "identical",
          "temporarily",
        ),
        answer: "A",
        explanation:
          "need to 后接动词原形；record observations 表示记录观察结果，符合下文保留意外结果的语境。",
      },
      {
        id: "cloze-2",
        stem: "空格 [2]",
        options: choices(
          "record",
          "transparent",
          "component",
          "abandon",
          "identical",
          "temporarily",
        ),
        answer: "B",
        explanation:
          "make work more transparent 表示让研究工作更加透明，后一句说明其他团队能核查结论如何得出。",
      },
      {
        id: "cloze-3",
        stem: "空格 [3]",
        options: choices(
          "record",
          "transparent",
          "component",
          "abandon",
          "identical",
          "temporarily",
        ),
        answer: "C",
        explanation:
          "a valuable 后需要可数名词，component of progress 表示进步的组成部分。",
      },
    ],
    sources: [],
    sourceNote:
      "本站原创练习 · 非历年真题。正式六级题型规模请参照考试机构说明。",
  },
  {
    id: "original-listening-campus",
    module: "listening",
    title: "A change to the campus workshop",
    year: null,
    month: null,
    set: "原创 01",
    type: "短文听力",
    origin: "original",
    intro: "听一则校园通知，记录时间、原因与行动要求。约 1 分钟 · 2 题。",
    transcript:
      "Good afternoon, everyone. This is a notice about the bicycle repair workshop. We originally planned to meet in the courtyard on Saturday morning, but heavy rain is expected. The workshop will now take place in room twelve of the student centre at two in the afternoon. You do not need to bring your own tools. Our volunteers will provide everything required for basic repairs. However, please bring your student card, because we need to check how many people attend. If you have already registered online, there is no need to register again. We look forward to seeing you on Saturday.",
    audioSrc: "audio/original-campus.wav",
    questions: [
      {
        id: "workshop-1",
        stem: "Why has the location of the workshop changed?",
        options: choices(
          "The original venue is being repaired.",
          "Bad weather is expected.",
          "More people registered than expected.",
          "The volunteers requested a larger room.",
        ),
        answer: "B",
        explanation:
          "通知说明原定在庭院举办，但预计有大雨，因此改到室内。注意原因是天气，时间同时也从上午改到下午。",
      },
      {
        id: "workshop-2",
        stem: "What are participants asked to bring?",
        options: choices(
          "A complete set of tools.",
          "A printed registration form.",
          "Their student cards.",
          "An umbrella for every volunteer.",
        ),
        answer: "C",
        explanation:
          "工具由志愿者提供，已线上报名的人无需再次报名；参加者应带学生证，用于统计出席人数。",
      },
    ],
    sources: [],
    sourceNote:
      "本站原创练习 · 非历年真题。音频由系统语音合成，非真人或考试录音；文稿、题目、解析均为原创。",
  },
  {
    id: "verified-listening-2024-06-blender",
    module: "listening",
    title: "购买搅拌机 · 真题考点节选",
    year: 2024,
    month: 6,
    set: "题材定位 · 套号见来源",
    type: "长对话",
    origin: "verified-excerpt",
    intro:
      "2024 年 6 月长对话第 1 题。中文转述题目与选项；请从来源收听，或导入你拥有的对应音频。",
    transcript:
      "本站未转载完整听力稿。请在原始来源核对搅拌机对话；两来源对第 1 题正确选项的内容一致，但选项字母不同。",
    questions: [
      {
        id: "blender-1",
        stem: "男士购买搅拌机之前做了什么？（中文转述）",
        options: choices(
          "浏览了大量用户网上评价。",
          "不用机器把全部食物搅拌好。",
          "寻找技术最先进的型号。",
          "详细调查所有厨房电器的价格。",
        ),
        answer: "A",
        explanation:
          "两份来源均将正确内容指向“阅读网上大量用户评论”。本页按当前选项顺序记为 A；环球页面记为 D，不能仅凭花卷字母核对。解析为本站编写。",
      },
    ],
    sources: [
      {
        label: "听力与原文来源 · 欧路词典",
        url: "https://dict.eudic.net/Examination/CetExam?mediaid=2b20fbb1-cdb6-11ef-810e-005056866eda",
      },
      {
        label: "答案内容交叉核验 · 环球青藤",
        url: "https://mjineng.hqqt.com/news/2024-6/17187597821374.html",
      },
    ],
    sourceNote:
      "完整 MP3、原文未转载。两来源均称第 1 套，但卷面字母不同；以题材和答案内容核对。本页为中文转述考点，不是完整原卷。核验：2026-10-20。",
  },
];

export function safeSourceUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2000) return false;
  try {
    return ["https:", "http:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/** Strict import boundary: local JSON is data, never executable HTML or remote media. */
export function parsePracticeImport(input: unknown): PracticeItem[] {
  if (
    !input ||
    typeof input !== "object" ||
    !("version" in input) ||
    input.version !== 1 ||
    !("practices" in input) ||
    !Array.isArray(input.practices)
  )
    throw new Error("题包格式错误：需要 version: 1 与 practices 数组。");
  if (input.practices.length < 1 || input.practices.length > 50)
    throw new Error("每次请导入 1–50 篇练习。");
  const string = (v: unknown, label: string, max = 20000) => {
    if (typeof v !== "string" || !v.trim() || v.length > max)
      throw new Error(`${label}不能为空或超过 ${max} 字符。`);
    return v.trim();
  };
  const ids = new Set<string>();
  return input.practices.map((raw: unknown, index: number) => {
    if (!raw || typeof raw !== "object")
      throw new Error(`第 ${index + 1} 篇不是有效对象。`);
    const p = raw as Record<string, unknown>;
    const id = string(p.id, "练习 ID", 100);
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || ids.has(id))
      throw new Error("练习 ID 仅限字母、数字、下划线、短横线，并且不得重复。");
    ids.add(id);
    if (p.module !== "reading" && p.module !== "listening")
      throw new Error("module 只能是 reading 或 listening。");
    const kinds =
      p.module === "reading"
        ? ["仔细阅读", "长篇阅读", "选词填空"]
        : ["长对话", "短文听力", "讲座"];
    if (!kinds.includes(String(p.type)))
      throw new Error("题型与练习模块不一致。");
    if (
      p.year !== null &&
      (!Number.isInteger(p.year) ||
        Number(p.year) < 1900 ||
        Number(p.year) > 2100)
    )
      throw new Error("year 应为 1900–2100 的整数或 null。");
    if (p.month !== null && p.month !== 6 && p.month !== 12)
      throw new Error("month 应为 6、12 或 null。");
    if (
      !Array.isArray(p.questions) ||
      p.questions.length < 1 ||
      p.questions.length > 100
    )
      throw new Error("每篇需要 1–100 道题。");
    const questionIds = new Set<string>();
    const questions = p.questions.map((unknownQuestion: unknown) => {
      if (!unknownQuestion || typeof unknownQuestion !== "object")
        throw new Error("题目格式错误。");
      const q = unknownQuestion as Record<string, unknown>;
      const qid = string(q.id, "题目 ID", 100);
      if (questionIds.has(qid))
        throw new Error("同一练习内的题目 ID 不得重复。");
      questionIds.add(qid);
      if (
        !Array.isArray(q.options) ||
        q.options.length < 2 ||
        q.options.length > 26
      )
        throw new Error("每题需要 2–26 个选项。");
      const keys = new Set<string>();
      const options = q.options.map((unknownOption: unknown) => {
        if (!unknownOption || typeof unknownOption !== "object")
          throw new Error("选项格式错误。");
        const o = unknownOption as Record<string, unknown>;
        const key = string(o.key, "选项字母", 1).toUpperCase();
        if (!/^[A-Z]$/.test(key) || keys.has(key))
          throw new Error("选项必须使用不重复的 A–Z 字母。");
        keys.add(key);
        return { key, text: string(o.text, "选项", 3000) };
      });
      const answer = string(q.answer, "答案", 1).toUpperCase();
      if (!keys.has(answer)) throw new Error("答案必须是现有选项的字母。");
      return {
        id: qid,
        stem: string(q.stem, "题干", 3000),
        options,
        answer,
        explanation: string(q.explanation, "解析", 6000),
      };
    });
    const sources: { label: string; url: string }[] = [];
    if (p.sources !== undefined) {
      if (!Array.isArray(p.sources) || p.sources.length > 10)
        throw new Error("sources 必须是最多 10 项的数组。");
      for (const rawSource of p.sources) {
        if (
          !rawSource ||
          typeof rawSource !== "object" ||
          !safeSourceUrl(rawSource.url)
        )
          throw new Error("来源链接必须使用 http 或 https。");
        sources.push({
          label: string(rawSource.label, "来源名称", 100),
          url: rawSource.url,
        });
      }
    }
    return {
      id: `local-${id}`,
      module: p.module,
      title: string(p.title, "标题", 200),
      year: p.year as number | null,
      month: p.month as 6 | 12 | null,
      set: string(p.set, "套数标识", 100),
      type: p.type as PracticeKind,
      origin: "local",
      intro:
        typeof p.intro === "string"
          ? p.intro.slice(0, 2000)
          : "用户导入题包，题目与答案未经本站核验。",
      ...(p.module === "reading"
        ? { passage: string(p.passage, "文章", 100000) }
        : { transcript: string(p.transcript, "听力原文", 100000) }),
      questions,
      sources,
      sourceNote:
        "用户本地导入 · 未经本站核验；请自行核对年份、原题、答案及使用权限。",
    };
  });
}

export const practiceImportExample = {
  version: 1,
  practices: [
    {
      id: "my-reading-01",
      module: "reading",
      title: "我的本地阅读",
      year: null,
      month: null,
      set: "个人练习",
      type: "仔细阅读",
      intro: "请将示例内容替换为你有权使用的材料。",
      passage: "The library opens at nine every morning.",
      questions: [
        {
          id: "q1",
          stem: "When does the library open?",
          options: [
            { key: "A", text: "At nine." },
            { key: "B", text: "At ten." },
          ],
          answer: "A",
          explanation: "原文说明图书馆每天九点开门。",
        },
      ],
      sources: [],
    },
  ],
};
