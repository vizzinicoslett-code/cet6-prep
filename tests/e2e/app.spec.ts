import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { practiceImportExample } from "../../src/data/practice";

const routes = [
  ["/", "首页", "把进步，留给每一天。"],
  ["/words", "单词", "我的单词本"],
  ["/listening", "听力", "听力"],
  ["/reading", "阅读", "阅读"],
  ["/writing", "作文", "让表达，更有分量"],
  ["/translation", "翻译", "在两种语言之间，准确传达"],
  ["/settings", "设置", "设置与数据管理"],
] as const;

async function go(page: Page, path: string) {
  await page.goto(`./#${path}`);
  await expect(page.locator("main")).toBeVisible();
}

async function addWord(
  page: Page,
  english = "obscure",
  chinese = "模糊的；晦涩的",
  notes = "",
) {
  await page.getByRole("button", { name: "新增单词", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "新增单词" });
  await dialog.getByLabel("英文单词").fill(english);
  await dialog.getByLabel("中文释义").fill(chinese);
  if (notes) await dialog.getByLabel("备注").fill(notes);
  await dialog.getByRole("button", { name: "保存单词", exact: true }).click();
}

async function addExpression(page: Page, english: string, chinese: string) {
  await page.getByRole("button", { name: "新增积累", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "新增个人积累" });
  await dialog.getByLabel("英文表达").fill(english);
  await dialog.getByLabel("中文释义").fill(chinese);
  await dialog.getByLabel(/^主题/).fill("个人成长");
  await dialog.getByLabel(/^类型/).fill("观点表达");
  await dialog.getByLabel("使用说明").fill("适用于学习与成长主题。");
  await dialog.getByRole("button", { name: "保存积累", exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

async function downloadBackup(page: Page) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出备份", exact: true }).click();
  const download = await pending;
  const path = await download.path();
  expect(download.suggestedFilename()).toMatch(
    /^cet6-backup-\d{4}-\d{2}-\d{2}\.json$/,
  );
  return { buffer: await readFile(path!), path: path! };
}

function wavBuffer() {
  const samples = 8000;
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(8000, 24);
  buffer.writeUInt32LE(16000, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++)
    buffer.writeInt16LE(
      Math.round(Math.sin((i / 8000) * Math.PI * 2 * 440) * 2000),
      44 + i * 2,
    );
  return buffer;
}

test("home and every navigation entry load without browser errors or failed local assets", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("response", (response) => {
    if (
      response.status() >= 400 &&
      new URL(response.url()).origin === new URL(page.url()).origin
    )
      errors.push(`${response.status()} ${response.url()}`);
  });
  await go(page, "/");
  await expect(page.getByRole("heading", { name: /今日学习/ })).toBeVisible();
  for (const [path, label, heading] of routes.slice(1)) {
    if (path === "/settings")
      await page
        .getByRole("link", { name: "设置与数据管理", exact: true })
        .click();
    else
      await page
        .getByRole("navigation", { name: "主要导航" })
        .getByRole("link", { name: label, exact: true })
        .click();
    await expect(
      page.getByRole("heading", { level: 1, name: heading, exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { level: 1, name: heading, exact: true }),
    ).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("word validation, normalized duplicate update, edit and reload preserve one record", async ({
  page,
}) => {
  await go(page, "/words");
  await page.getByRole("button", { name: "新增单词", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "保存单词" }).click();
  await expect(dialog).toBeVisible();
  expect(
    await dialog
      .getByLabel("英文单词")
      .evaluate((input: HTMLInputElement) => input.validity.valueMissing),
  ).toBe(true);
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await addWord(page, "  Obscure  ", "模糊的", "容易混淆");
  await expect(page.locator(".word-row")).toHaveCount(1);
  await addWord(page, "OBSCURE", "晦涩的", "更新备注");
  dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("alert")).toContainText("已在单词本中");
  await dialog.getByRole("button", { name: "更新已有释义" }).click();
  await expect(page.locator(".word-row")).toHaveCount(1);
  await expect(page.locator(".word-row")).toContainText("晦涩的");
  await page.getByRole("button", { name: "编辑 obscure", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("中文释义")
    .fill("不清楚的；晦涩的");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "保存单词" })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".word-row")).toContainText("不清楚的；晦涩的");
  await page.reload();
  await expect(page.locator(".word-row")).toHaveCount(1);
  await expect(page.locator(".word-row")).toContainText("不清楚的；晦涩的");
  await page.getByLabel("搜索单词").fill("更新备注");
  await expect(page.locator(".word-row")).toHaveCount(1);
});

test("word deletion can be cancelled and then confirmed", async ({ page }) => {
  await go(page, "/words");
  await addWord(page);
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "删除 obscure", exact: true }).click();
  await expect(page.locator(".word-row")).toHaveCount(1);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "删除 obscure", exact: true }).click();
  await expect(page.locator(".word-row")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "先留住一个总记错的单词" }),
  ).toBeVisible();
});

test("batch preview isolates malformed and duplicate rows before importing valid words", async ({
  page,
}) => {
  await go(page, "/words");
  await addWord(page);
  await page.getByRole("button", { name: "批量添加", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("粘贴单词")
    .fill("ABANDON 放弃\nobscure: 已有\ninvalid\ncompulsory\t必修的");
  await dialog.getByRole("button", { name: "解析并预览" }).click();
  await expect(dialog.locator(".batch-counts")).toContainText("识别成功 2");
  await expect(dialog.locator(".batch-counts")).toContainText("失败 1");
  await expect(dialog.locator(".batch-counts")).toContainText("重复 1");
  await expect(page.locator(".word-row")).toHaveCount(1);
  await dialog.getByRole("button", { name: "确认导入 2 个" }).click();
  await expect(page.locator(".word-row")).toHaveCount(3);
  await expect(
    page.locator(".word-row").filter({ hasText: "obscure" }),
  ).toContainText("模糊的；晦涩的");
});

test("review hides answers, records all three ratings and finishes a fixed daily round", async ({
  page,
}) => {
  await go(page, "/words");
  await addWord(page, "obscure", "独特释义甲");
  await addWord(page, "abandon", "独特释义乙");
  await addWord(page, "compulsory", "独特释义丙");
  await expect(page.getByLabel("复习模式")).toHaveValue("mixed");
  await page.getByLabel("复习模式").selectOption("forward");
  await page.getByRole("link", { name: "开始复习", exact: true }).click();
  for (const [index, rating] of ["认识", "模糊", "不认识"].entries()) {
    await expect(page.locator(".review-top")).toContainText(`${index + 1} / 3`);
    await expect(page.locator(".review-answer")).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText("独特释义");
    await page.getByRole("button", { name: "显示答案", exact: true }).click();
    await expect(page.locator(".review-answer")).toContainText("独特释义");
    await page.getByRole("button", { name: rating, exact: true }).click();
  }
  await expect(
    page.getByRole("heading", { name: "今日复习完成", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".review-results > div")).toHaveText([
    "1认识",
    "1模糊",
    "1不认识",
  ]);
  await page.getByRole("link", { name: "回到单词本", exact: true }).click();
  await expect(page.locator(".review-banner")).toContainText("1 个待复习");
  await page.reload();
  await expect(page.locator(".word-details summary")).toHaveText([
    "复习记录 · 1 次",
    "复习记录 · 1 次",
    "复习记录 · 1 次",
  ]);
});

test("reverse review hides the English answer until reveal", async ({
  page,
}) => {
  await go(page, "/words");
  await addWord(page, "indispensable", "不可或缺的");
  await page.getByLabel("复习模式").selectOption("reverse");
  await page.getByRole("link", { name: "开始复习", exact: true }).click();
  await expect(page.locator(".review-prompt")).toHaveText("不可或缺的");
  await expect(page.locator("main")).not.toContainText("indispensable");
  await page.getByRole("button", { name: "显示答案" }).click();
  await expect(page.locator(".review-answer")).toContainText("indispensable");
  await page.getByRole("button", { name: "认识", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "今日复习完成" }),
  ).toBeVisible();
});

test("mixed review changes direction and honors the selected daily cap", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let calls = 0;
    Math.random = () => (++calls % 2 ? 0.25 : 0.75);
  });
  await go(page, "/words");
  await page.getByRole("button", { name: "批量添加", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("粘贴单词")
    .fill(
      Array.from(
        { length: 12 },
        (_, index) => `vocabulary${index} 测试释义${index}`,
      ).join("\n"),
    );
  await dialog.getByRole("button", { name: "解析并预览" }).click();
  await dialog.getByRole("button", { name: "确认导入 12 个" }).click();
  await expect(page.locator(".word-row")).toHaveCount(12);
  await page.getByLabel("每轮数量").selectOption("10");
  await page.getByRole("link", { name: "开始复习", exact: true }).click();
  await expect(page.locator(".review-top")).toContainText("1 / 10");
  const firstLanguage = await page
    .locator(".review-prompt")
    .getAttribute("lang");
  await page.getByRole("button", { name: "显示答案" }).click();
  await page.getByRole("button", { name: "认识", exact: true }).click();
  await expect(page.locator(".review-top")).toContainText("2 / 10");
  await expect(page.locator(".review-answer")).toHaveCount(0);
  expect(await page.locator(".review-prompt").getAttribute("lang")).not.toBe(
    firstLanguage,
  );
});

test("manual mastery removes a word from due reviews and can restore it", async ({
  page,
}) => {
  await go(page, "/words");
  await addWord(page);
  await page
    .getByRole("button", { name: "标记已掌握 obscure", exact: true })
    .click();
  await expect(page.locator(".review-banner")).toContainText("0 个待复习");
  await page.getByRole("button", { name: "已掌握", exact: true }).click();
  await expect(page.locator(".word-row")).toHaveCount(1);
  await page
    .getByRole("button", { name: "恢复复习 obscure", exact: true })
    .click();
  await expect(page.locator(".word-row")).toHaveCount(0);
  await page.getByRole("button", { name: "待复习", exact: true }).click();
  await expect(page.locator(".word-row")).toHaveCount(1);
});

test("writing favorites persist and can be removed from My Collection", async ({
  page,
}) => {
  await go(page, "/writing");
  const first = page.locator(".expression-card").first();
  const english = await first.getByRole("heading").innerText();
  await first.getByRole("button", { name: "收藏表达", exact: true }).click();
  await page.getByRole("tab", { name: /我的积累/ }).click();
  await expect(page.locator(".expression-card")).toHaveCount(1);
  await expect(page.locator(".expression-card")).toContainText(english);
  await page.reload();
  await page.getByRole("tab", { name: /我的积累/ }).click();
  await expect(page.locator(".expression-card")).toHaveCount(1);
  await page.getByRole("button", { name: "取消收藏表达", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "把值得记住的表达，留在这里" }),
  ).toBeVisible();
});

test("writing personal expressions support create, filters, search, edit and delete", async ({
  page,
}) => {
  await go(page, "/writing");
  await addExpression(
    page,
    "Progress begins with careful practice.",
    "进步始于认真练习。",
  );
  await page.getByRole("tab", { name: /我的积累/ }).click();
  await page.getByLabel("主题筛选").selectOption("个人成长");
  await page.getByLabel("类型筛选").selectOption("观点表达");
  await page.getByLabel("搜索表达或真题").fill("careful");
  await expect(page.locator(".expression-card")).toHaveCount(1);
  await page.getByRole("button", { name: "编辑个人表达" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("英文表达")
    .fill("Progress begins with deliberate practice.");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "保存积累" })
    .click();
  await page.getByLabel("搜索表达或真题").fill("deliberate");
  await expect(page.locator(".expression-card")).toHaveCount(1);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "删除个人表达" }).click();
  await expect(page.locator(".expression-card")).toHaveCount(0);
});

test("translation favorites and personal expressions stay independent from writing", async ({
  page,
}) => {
  await go(page, "/translation");
  await page
    .locator(".expression-card")
    .first()
    .getByRole("button", { name: "收藏表达", exact: true })
    .click();
  await addExpression(page, "community-based care services", "社区养老服务");
  await page.getByRole("tab", { name: /我的积累/ }).click();
  await expect(page.locator(".expression-card")).toHaveCount(2);
  await page.reload();
  await page.getByRole("tab", { name: /我的积累/ }).click();
  await page.getByLabel("搜索表达或真题").fill("社区养老");
  await expect(page.locator(".expression-card")).toHaveCount(1);
  await go(page, "/writing");
  await page.getByRole("tab", { name: /我的积累/ }).click();
  await expect(page.locator(".expression-card")).toHaveCount(0);
});

test("reading blocks incomplete submission, reveals verified feedback only after submit, saves progress", async ({
  page,
}) => {
  await go(page, "/reading");
  await page
    .locator(".practice-card")
    .filter({ hasText: "A quieter way to learn" })
    .getByRole("button", { name: "开始训练" })
    .click();
  await expect(page.locator(".practice-feedback")).toHaveCount(0);
  await page.getByRole("button", { name: "提交答案", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("还有题目未作答");
  const questions = page.locator(".practice-question");
  await questions.nth(0).getByRole("radio").nth(0).check();
  await questions.nth(1).getByRole("radio").nth(0).check();
  await expect(page.locator(".practice-feedback")).toHaveCount(0);
  await page.getByRole("button", { name: "提交答案", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "本次训练完成" }),
  ).toBeVisible();
  await expect(page.locator(".practice-feedback")).toHaveCount(2);
  await expect(page.locator(".practice-feedback").nth(0)).toContainText(
    "回答正确",
  );
  await expect(page.locator(".practice-feedback").nth(1)).toContainText(
    "回答错误",
  );
  await expect(page.locator(".practice-feedback").nth(1)).toContainText(
    "正确答案：B",
  );
  await page.reload();
  await expect(
    page
      .locator(".practice-card")
      .filter({ hasText: "A quieter way to learn" }),
  ).toContainText("最近正确 1/2");
});

test("local practice JSON requires preview and remains available after reload", async ({
  page,
}) => {
  await go(page, "/reading");
  await page
    .getByLabel("导入本地练习 JSON")
    .setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from("{}"),
    });
  await expect(page.getByRole("alert")).toContainText("题包格式错误");
  await page
    .getByLabel("导入本地练习 JSON")
    .setInputFiles({
      name: "practice.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(practiceImportExample)),
    });
  await expect(
    page.getByRole("region", { name: "题包导入预览" }),
  ).toBeVisible();
  await expect(
    page.locator(".practice-card").filter({ hasText: "我的本地阅读" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "确认导入", exact: true }).click();
  await page.reload();
  const card = page
    .locator(".practice-card")
    .filter({ hasText: "我的本地阅读" });
  await expect(card).toContainText("本地题包 · 未核验");
  await card.getByRole("button", { name: "开始训练" }).click();
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "提交答案" }).click();
  await expect(
    page.getByRole("heading", { name: "本次训练完成" }),
  ).toBeVisible();
});

test("listening audio import persists with playback speed and answer-gated transcript", async ({
  page,
}) => {
  await go(page, "/listening");
  await page
    .getByLabel("选择本地音频文件")
    .setInputFiles({
      name: "personal-listening.wav",
      mimeType: "audio/wav",
      buffer: wavBuffer(),
    });
  await expect(page.getByLabel("当前音频")).toContainText(
    "personal-listening.wav",
  );
  await page.getByLabel("播放速度").selectOption("1.2");
  await expect
    .poll(() =>
      page
        .locator("audio")
        .evaluate((audio: HTMLAudioElement) => audio.playbackRate),
    )
    .toBe(1.2);
  await expect
    .poll(() =>
      page
        .locator("audio")
        .evaluate(
          (audio: HTMLAudioElement) =>
            Number.isFinite(audio.duration) && audio.duration > 0,
        ),
    )
    .toBe(true);
  await page.reload();
  await expect(
    page.getByLabel("当前音频").locator("option:checked"),
  ).toHaveText("personal-listening.wav");
  await page
    .locator(".practice-card")
    .filter({ hasText: "A change to the campus workshop" })
    .getByRole("button", { name: "开始训练" })
    .click();
  await expect(page.getByRole("button", { name: "查看听力原文" })).toHaveCount(
    0,
  );
  await page
    .locator(".practice-question")
    .nth(0)
    .getByRole("radio")
    .nth(1)
    .check();
  await page
    .locator(".practice-question")
    .nth(1)
    .getByRole("radio")
    .nth(2)
    .check();
  await page.getByRole("button", { name: "提交答案" }).click();
  await page.getByRole("button", { name: "查看听力原文" }).click();
  await expect(page.locator("main")).toContainText("Good afternoon, everyone.");
  await expect(page.locator("main")).toContainText("答对 2/2");
});

test("backup downloads, rejects invalid files safely, requires restore confirmation and two-step clear", async ({
  page,
}) => {
  await go(page, "/words");
  await addWord(page, "resilient", "有韧性的");
  await go(page, "/writing");
  await addExpression(page, "Learn through reflection.", "在反思中学习。");
  await go(page, "/settings");
  await page.getByRole("button", { name: "深色", exact: true }).click();
  const backup = await downloadBackup(page);
  const parsed = JSON.parse(backup.buffer.toString("utf8"));
  expect(parsed.data.words).toHaveLength(1);
  expect(parsed.data.writingExpressions).toHaveLength(1);
  expect(parsed.audioExcluded).toBe(true);
  await page
    .getByLabel("选择备份文件")
    .setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from("{broken"),
    });
  await expect(page.getByRole("alert")).toContainText("当前数据未更改");
  await go(page, "/words");
  await expect(page.locator(".word-row")).toContainText("resilient");
  await go(page, "/settings");
  await page.getByRole("button", { name: "清空学习数据", exact: true }).click();
  const clear = page.getByRole("dialog", { name: "确认清空学习数据" });
  await expect(
    clear.getByRole("button", { name: "永久清空学习数据" }),
  ).toBeDisabled();
  await clear.getByRole("button", { name: "取消", exact: true }).click();
  await page.getByRole("button", { name: "清空学习数据", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("输入“清空”进行第二次确认")
    .fill("清空");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "永久清空学习数据" })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await go(page, "/words");
  await expect(page.locator(".word-row")).toHaveCount(0);
  await go(page, "/settings");
  await page.getByLabel("选择备份文件").setInputFiles(backup.path);
  let restore = page.getByRole("dialog", { name: "确认恢复备份" });
  await expect(restore).toContainText("单词 1");
  await restore.getByRole("button", { name: "取消", exact: true }).click();
  await go(page, "/words");
  await expect(page.locator(".word-row")).toHaveCount(0);
  await go(page, "/settings");
  await page.getByLabel("选择备份文件").setInputFiles(backup.path);
  restore = page.getByRole("dialog", { name: "确认恢复备份" });
  await restore.getByRole("button", { name: "确认替换并恢复" }).click();
  await expect(restore).not.toBeVisible();
  await go(page, "/words");
  await expect(page.locator(".word-row")).toContainText("resilient");
  await go(page, "/writing");
  await page.getByRole("tab", { name: /我的积累/ }).click();
  await expect(page.locator(".expression-card")).toContainText(
    "Learn through reflection.",
  );
});

test("320px dialogs and long personal text fit without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await go(page, "/words");
  const english = "pneumonoultramicroscopicsilicovolcanoconiosis".repeat(3);
  await addWord(
    page,
    english,
    "需要反复积累的中文释义。".repeat(30),
    "长文本备注。".repeat(30),
  );
  await expect(page.locator(".word-row")).toHaveCount(1);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await page
    .getByRole("button", { name: `编辑 ${english}`, exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const box = await page.getByRole("dialog").boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "取消", exact: true })
    .click();
  await go(page, "/writing");
  await addExpression(
    page,
    "exceptionallylongexpression".repeat(25),
    "长中文表达。".repeat(50),
  );
  await page.getByRole("tab", { name: /我的积累/ }).click();
  await expect(page.locator(".expression-card")).toHaveCount(1);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});

for (const width of [320, 390, 768, 1280]) {
  for (const theme of ["light", "dark"]) {
    test(`all routes fit ${width}px in ${theme} mode with legible text`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(
        (theme) => localStorage.setItem("cet6-theme", theme),
        theme,
      );
      for (const [path, , heading] of routes) {
        await go(page, path);
        await expect(
          page.getByRole("heading", { level: 1, name: heading, exact: true }),
        ).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const dimensions = await page.evaluate(() => ({
          width: innerWidth,
          page: document.documentElement.scrollWidth,
          body: document.body.scrollWidth,
        }));
        expect(dimensions.page, path).toBeLessThanOrEqual(dimensions.width + 1);
        expect(dimensions.body, path).toBeLessThanOrEqual(dimensions.width + 1);
        const contrast = await page.locator("main h1").evaluate((element) => {
          const rgb = (color: string) =>
            (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
          const luminance = (channels: number[]) =>
            channels
              .map((value) => {
                const unit = value / 255;
                return unit <= 0.04045
                  ? unit / 12.92
                  : Math.pow((unit + 0.055) / 1.055, 2.4);
              })
              .reduce(
                (total, value, index) =>
                  total + value * [0.2126, 0.7152, 0.0722][index],
                0,
              );
          let ancestor: Element | null = element;
          let background = "rgb(255, 255, 255)";
          while (ancestor) {
            const color = getComputedStyle(ancestor).backgroundColor;
            if (color !== "rgba(0, 0, 0, 0)" && color !== "transparent") {
              background = color;
              break;
            }
            ancestor = ancestor.parentElement;
          }
          const foreground = luminance(rgb(getComputedStyle(element).color));
          const behind = luminance(rgb(background));
          return (
            (Math.max(foreground, behind) + 0.05) /
            (Math.min(foreground, behind) + 0.05)
          );
        });
        expect(contrast, `${path} heading contrast`).toBeGreaterThanOrEqual(3);
        if (width < 768)
          await expect(
            page.getByRole("navigation", { name: "手机导航" }),
          ).toBeVisible();
      }
      if (width === 390 || width === 1280) {
        await go(page, "/");
        await page.screenshot({
          path: testInfo.outputPath(`home-${width}-${theme}.png`),
          fullPage: true,
        });
      }
    });
  }
}

test("production PWA stays within deployment scope and supports offline words and expressions", async ({
  page,
  context,
}) => {
  test.setTimeout(60_000);
  await go(page, "/words");
  await addWord(page, "persistent", "持久的");
  await go(page, "/writing");
  await addExpression(
    page,
    "Keep learning at your own pace.",
    "按照自己的节奏学习。",
  );
  await page.getByRole("tab", { name: /我的积累/ }).click();
  await expect(page.locator(".expression-card")).toHaveCount(1);
  const registration = await page.evaluate(async () => {
    const ready = await navigator.serviceWorker.ready;
    return {
      scope: ready.scope,
      active: ready.active?.scriptURL,
      controller: Boolean(navigator.serviceWorker.controller),
    };
  });
  expect(registration.scope).toBe(new URL("./", page.url()).href);
  expect(registration.active).toBe(new URL("sw.js", registration.scope).href);
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);
  const manifest = await page
    .locator('link[rel="manifest"]')
    .getAttribute("href");
  const response = await page.request.get(new URL(manifest!, page.url()).href);
  expect(response.ok()).toBe(true);
  const data = await response.json();
  expect(data.display).toBe("standalone");
  expect(new URL(data.start_url, response.url()).href).toBe(registration.scope);
  for (const icon of data.icons)
    expect(
      (await page.request.get(new URL(icon.src, response.url()).href)).ok(),
    ).toBe(true);
  await context.setOffline(true);
  try {
    await go(page, "/words");
    await page.reload();
    await expect(page.locator(".word-row")).toContainText("persistent");
    await expect(page.locator("main")).toContainText("当前离线");
    await page.getByLabel("复习模式").selectOption("forward");
    await page.getByRole("link", { name: "开始复习", exact: true }).click();
    await page.getByRole("button", { name: "显示答案" }).click();
    await expect(page.locator(".review-answer")).toContainText("持久的");
    await page.getByRole("button", { name: "认识", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "今日复习完成" }),
    ).toBeVisible();
    await go(page, "/writing");
    await page.getByRole("tab", { name: /我的积累/ }).click();
    await expect(page.locator(".expression-card")).toContainText(
      "Keep learning at your own pace.",
    );
  } finally {
    await context.setOffline(false);
  }
});
