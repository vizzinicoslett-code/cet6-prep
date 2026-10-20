import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  ExternalLink,
  FileJson,
  Headphones,
  Import,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { db } from "../storage/db";
import type { AudioRecord, PracticeRecord, Setting } from "../types";
import { gradeAnswers } from "../lib/practice";
import {
  parsePracticeImport,
  practiceImportExample,
  practiceItems,
  safeSourceUrl,
  type PracticeItem,
  type PracticeModule,
} from "../data/practice";
import "./practice.css";

function downloadJson(value: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const originLabel = (item: PracticeItem) =>
  item.origin === "verified-excerpt"
    ? "真题节选 · 中文转述"
    : item.origin === "local"
      ? "本地题包 · 未核验"
      : "原创练习 · 非真题";
const dateLabel = (item: PracticeItem) =>
  item.year
    ? `${item.year} 年 ${item.month ? `${item.month} 月` : ""}`
    : item.origin === "local"
      ? "个人材料"
      : "基础练习";

export default function Practice({
  module,
  onChange,
}: {
  module: PracticeModule;
  onChange: () => void;
}) {
  const listening = module === "listening";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [localItems, setLocalItems] = useState<PracticeItem[]>([]);
  const [records, setRecords] = useState<PracticeRecord[]>([]);
  const [active, setActive] = useState<PracticeItem | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [year, setYear] = useState("all");
  const [month, setMonth] = useState("all");
  const [set, setSet] = useState("all");
  const [kind, setKind] = useState("all");
  const [pendingImport, setPendingImport] = useState<PracticeItem[] | null>(
    null,
  );
  const [audioFiles, setAudioFiles] = useState<AudioRecord[]>([]);
  const [audioId, setAudioId] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [rate, setRate] = useState("1");
  const [audioError, setAudioError] = useState("");
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioSaving, setAudioSaving] = useState(false);
  const [audioReload, setAudioReload] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const loadSequence = useRef(0);

  useEffect(() => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    setError("");
    setActive(null);
    setSubmitted(false);
    setYear("all");
    setMonth("all");
    setSet("all");
    setKind("all");
    void Promise.all([
      db.getAll<PracticeRecord>("practiceRecords"),
      db.get<Setting>("settings", "practice-imports"),
      db.getAll<AudioRecord>("audioFiles"),
      db.get<Setting>("settings", "practice-audio-selection"),
    ])
      .then(([savedRecords, imported, audios, selected]) => {
        if (sequence !== loadSequence.current) return;
        setRecords(savedRecords);
        setAudioFiles(audios);
        setAudioId(
          typeof selected?.value === "string" &&
            audios.some((a) => a.id === selected.value)
            ? selected.value
            : "",
        );
        if (Array.isArray(imported?.value) && imported.value.length) {
          const data = imported.value.map((item: PracticeItem) => ({
            ...item,
            id: String(item.id).replace(/^local-/, ""),
          }));
          setLocalItems(parsePracticeImport({ version: 1, practices: data }));
        } else setLocalItems([]);
      })
      .catch(() => {
        if (sequence === loadSequence.current)
          setError(
            "读取本地练习数据失败。请刷新重试；题包格式异常时可从设置恢复有效备份。",
          );
      })
      .finally(() => {
        if (sequence === loadSequence.current) setLoading(false);
      });
    return () => {
      loadSequence.current++;
    };
  }, [module]);

  useEffect(() => {
    const selected = audioFiles.find((file) => file.id === audioId);
    if (!selected) {
      setAudioUrl("");
      return;
    }
    const url = URL.createObjectURL(selected.blob);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audioId, audioFiles]);

  const sampleAudio = practiceItems.find(
    (item) => item.module === "listening" && item.audioSrc,
  );
  const audioPractice = active ?? sampleAudio;
  const src =
    audioUrl ||
    (audioPractice?.audioSrc
      ? `${import.meta.env.BASE_URL}${audioPractice.audioSrc}`
      : "");
  useEffect(() => {
    setAudioError("");
    setAudioLoading(Boolean(src));
  }, [src, audioReload]);
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = Number(rate);
  }, [rate, src, audioReload]);

  const items = useMemo(
    () =>
      [...practiceItems, ...localItems].filter(
        (item) => item.module === module,
      ),
    [localItems, module],
  );
  const availableYears = [
    ...new Set(items.map((item) => (item.year ? String(item.year) : "none"))),
  ]
    .sort()
    .reverse();
  const availableSets = [...new Set(items.map((item) => item.set))];
  const kinds = listening
    ? ["长对话", "短文听力", "讲座"]
    : ["选词填空", "长篇阅读", "仔细阅读"];
  const filtered = items.filter(
    (item) =>
      (year === "all" || (item.year ? String(item.year) : "none") === year) &&
      (month === "all" || String(item.month) === month) &&
      (set === "all" || item.set === set) &&
      (kind === "all" || item.type === kind),
  );
  const latestRecord = (id: string) =>
    records
      .filter((record) => record.practiceId === id)
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];
  const grade =
    active && submitted ? gradeAnswers(active.questions, answers) : null;

  function openPractice(item: PracticeItem) {
    setActive(item);
    setAnswers({});
    setSubmitted(false);
    setShowTranscript(false);
    setError("");
    setMessage("");
    audioRef.current?.pause();
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  async function submit() {
    if (!active || saving || submitted) return;
    if (
      active.questions.some(
        (question) =>
          !question.options.some(
            (option) => option.key === answers[question.id],
          ),
      )
    ) {
      setError("还有题目未作答，请为每道题选择一个答案后提交。");
      return;
    }
    setSaving(true);
    setError("");
    const result = gradeAnswers(active.questions, answers);
    const record: PracticeRecord = {
      id: crypto.randomUUID(),
      practiceId: active.id,
      module,
      answers: { ...answers },
      correct: result.correct,
      total: result.total,
      completedAt: new Date().toISOString(),
    };
    try {
      await db.put("practiceRecords", record);
      setRecords((previous) => [...previous, record]);
      setSubmitted(true);
      onChange();
    } catch {
      setError("保存答题记录失败，答案仍在当前页面，请重试。");
    } finally {
      setSaving(false);
    }
  }

  async function readImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setMessage("");
    setPendingImport(null);
    if (file.size > 5 * 1024 * 1024) {
      setError("题包超过 5 MB，请拆成较小的 JSON 文件。");
      return;
    }
    try {
      setPendingImport(parsePracticeImport(JSON.parse(await file.text())));
    } catch (problem) {
      setError(
        problem instanceof SyntaxError
          ? "文件不是有效 JSON，当前数据未修改。"
          : problem instanceof Error
            ? problem.message
            : "读取题包失败，当前数据未修改。",
      );
    }
  }

  async function confirmImport() {
    if (!pendingImport || saving) return;
    setSaving(true);
    setError("");
    try {
      const ids = new Set(pendingImport.map((item) => item.id));
      const merged = [
        ...localItems.filter((item) => !ids.has(item.id)),
        ...pendingImport,
      ];
      if (merged.length > 50)
        throw new Error("本地题包最多保存 50 篇，请先删除不需要的题包。");
      await db.put("settings", { id: "practice-imports", value: merged });
      setLocalItems(merged);
      setPendingImport(null);
      setMessage(`已导入 ${pendingImport.length} 篇练习，同 ID 题包已更新。`);
      onChange();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "保存题包失败。");
    } finally {
      setSaving(false);
    }
  }

  async function removeLocal(item: PracticeItem) {
    if (!window.confirm(`删除本地题包“${item.title}”？已完成的记录会保留。`))
      return;
    setError("");
    try {
      const next = localItems.filter((p) => p.id !== item.id);
      await db.put("settings", { id: "practice-imports", value: next });
      setLocalItems(next);
      onChange();
    } catch {
      setError("删除失败，请重试。");
    }
  }

  async function selectAudio(id: string) {
    try {
      await db.put("settings", { id: "practice-audio-selection", value: id });
      setAudioId(id);
    } catch {
      setAudioError("保存音频选择失败，请重试。");
    }
  }

  async function importAudio(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setAudioError("");
    setMessage("");
    if (!file.size || file.size > 100 * 1024 * 1024) {
      setAudioError("请选择 0–100 MB 的有效音频文件。");
      return;
    }
    if (
      !/^audio\//.test(file.type) &&
      !/\.(mp3|wav|m4a|ogg|oga|aac|flac|opus|mp4|webm)$/i.test(file.name)
    ) {
      setAudioError("请选择 MP3、WAV、M4A、OGG 等音频文件。");
      return;
    }
    setAudioSaving(true);
    const record: AudioRecord = {
      id: crypto.randomUUID(),
      name: file.name,
      blob: file,
      createdAt: new Date().toISOString(),
    };
    try {
      await db.put("audioFiles", record);
      await db.put("settings", {
        id: "practice-audio-selection",
        value: record.id,
      });
      setAudioFiles((previous) => [...previous, record]);
      setAudioId(record.id);
      setMessage("音频已保存在当前浏览器。请确认选中的音频与练习题对应。");
      onChange();
    } catch {
      setAudioError("音频保存失败，可能是浏览器存储空间不足。请尝试较小文件。");
    } finally {
      setAudioSaving(false);
    }
  }

  async function deleteAudio() {
    const file = audioFiles.find((a) => a.id === audioId);
    if (
      !file ||
      !window.confirm(
        `删除本地音频“${file.name}”？此操作不会删除你的原始文件。`,
      )
    )
      return;
    try {
      await db.delete("audioFiles", file.id);
      await db.put("settings", { id: "practice-audio-selection", value: "" });
      setAudioId("");
      setAudioFiles((previous) => previous.filter((a) => a.id !== file.id));
      onChange();
    } catch {
      setAudioError("删除本地音频失败。");
    }
  }

  return (
    <div className="practice-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {listening ? "LISTEN CLOSELY" : "READ WITH PURPOSE"}
          </p>
          <h1>{listening ? "听力" : "阅读"}</h1>
          <p className="muted">
            {listening
              ? "从听懂细节，到理解说话者的意图。"
              : "认真读一篇，理解每一个选择的依据。"}
          </p>
        </div>
        {!active && (
          <div className="toolbar">
            <button
              className="btn subtle"
              onClick={() =>
                downloadJson(
                  practiceImportExample,
                  "cet6-practice-example.json",
                )
              }
            >
              <Download size={16} />
              题包格式示例
            </button>
            <button className="btn" onClick={() => importRef.current?.click()}>
              <FileJson size={16} />
              导入题包
            </button>
          </div>
        )}
      </div>
      <input
        ref={importRef}
        type="file"
        accept=".json,application/json"
        onChange={readImport}
        hidden
        aria-label="导入本地练习 JSON"
      />
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {loading && (
        <div className="panel">
          <p role="status">正在读取本地练习…</p>
        </div>
      )}
      {pendingImport && (
        <section
          className="panel practice-import-preview"
          aria-label="题包导入预览"
        >
          <h2>确认导入题包</h2>
          <p>
            校验通过 {pendingImport.length} 篇，包含{" "}
            {pendingImport.reduce((n, item) => n + item.questions.length, 0)}{" "}
            道题。同 ID 题包{" "}
            {
              pendingImport.filter((item) =>
                localItems.some((local) => local.id === item.id),
              ).length
            }{" "}
            篇将更新。
          </p>
          <p className="muted">
            内容按用户材料保存，本站不会将它标为已核验真题。题包中的远程音频地址不会载入。
          </p>
          <ul>
            {pendingImport.map((item) => (
              <li key={item.id}>
                {item.title} · {item.module === "reading" ? "阅读" : "听力"} ·{" "}
                {item.questions.length} 题
              </li>
            ))}
          </ul>
          <div className="toolbar">
            <button
              className="btn primary"
              onClick={() => void confirmImport()}
              disabled={saving}
            >
              {saving ? "保存中…" : "确认导入"}
            </button>
            <button
              className="btn subtle"
              onClick={() => setPendingImport(null)}
            >
              取消
            </button>
          </div>
        </section>
      )}
      {listening && (
        <section className="panel audio-panel" aria-label="听力播放器">
          <div className="section-title">
            <h2>
              <Headphones size={18} /> 听力播放器
            </h2>
            <button
              className="btn subtle"
              onClick={() => audioInputRef.current?.click()}
              disabled={audioSaving}
            >
              <Import size={16} />
              {audioSaving ? "正在保存音频…" : "导入本地音频"}
            </button>
          </div>
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.flac,.opus"
            onChange={importAudio}
            hidden
            aria-label="选择本地音频文件"
          />
          <div className="toolbar audio-toolbar">
            <label className="field audio-selection">
              当前音频
              <select
                value={audioId}
                onChange={(event) => void selectAudio(event.target.value)}
              >
                <option value="">
                  {audioPractice?.audioSrc
                    ? "原创校园通知 · 系统合成音"
                    : "未选择本地音频"}
                </option>
                {audioFiles.map((file) => (
                  <option key={file.id} value={file.id}>
                    {file.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              播放速度
              <select
                aria-label="播放速度"
                value={rate}
                onChange={(event) => setRate(event.target.value)}
              >
                {["0.8", "1", "1.2", "1.5"].map((value) => (
                  <option key={value} value={value}>
                    {value}×
                  </option>
                ))}
              </select>
            </label>
            {audioId && (
              <button
                className="btn subtle"
                onClick={() => void deleteAudio()}
                aria-label="删除选中的本地音频"
              >
                <Trash2 size={16} />
                删除音频
              </button>
            )}
          </div>
          <audio
            key={`${src}-${audioReload}`}
            ref={audioRef}
            controls
            preload="metadata"
            src={src || undefined}
            onLoadStart={() => setAudioLoading(Boolean(src))}
            onLoadedMetadata={() => {
              setAudioLoading(false);
              if (audioRef.current)
                audioRef.current.playbackRate = Number(rate);
            }}
            onError={() => {
              if (src) {
                setAudioLoading(false);
                setAudioError(
                  "音频无法播放：文件可能损坏或浏览器不支持该格式。请重新导入 MP3 或 WAV。",
                );
              }
            }}
            aria-label="听力音频，支持播放、暂停与拖动进度"
          />
          {audioLoading && (
            <p className="muted" role="status">
              正在读取音频信息…
            </p>
          )}
          {!src && (
            <p className="muted">
              此真题未附转载音频，请打开来源收听或导入你拥有的对应文件。
            </p>
          )}
          {audioError && (
            <p className="notice" role="alert">
              {audioError}{" "}
              <button
                className="btn subtle"
                onClick={() => setAudioReload((n) => n + 1)}
              >
                重试加载
              </button>
            </p>
          )}
          <p className="muted">
            本地音频仅存于当前设备、当前浏览器的
            IndexedDB。刷新可恢复；清理网站数据、隐私模式或存储回收可能使文件丢失。JSON
            备份不包含音频，请保留原文件。
          </p>
        </section>
      )}
      {!loading && !active && (
        <>
          <section className="panel practice-filters" aria-label="练习筛选">
            <div className="toolbar">
              <label className="field">
                年份
                <select
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                >
                  <option value="all">全部年份</option>
                  {availableYears.map((value) => (
                    <option key={value} value={value}>
                      {value === "none" ? "原创 / 个人练习" : `${value} 年`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                月份
                <select
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                >
                  <option value="all">全部月份</option>
                  <option value="6">6 月</option>
                  <option value="12">12 月</option>
                </select>
              </label>
              <label className="field">
                套数
                <select
                  value={set}
                  onChange={(event) => setSet(event.target.value)}
                >
                  <option value="all">全部套数</option>
                  {availableSets.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                题型
                <select
                  value={kind}
                  onChange={(event) => setKind(event.target.value)}
                >
                  <option value="all">全部题型</option>
                  {kinds.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
          <p className="muted practice-coverage">
            真题仅收录可交叉核验的少量考点节选，完整原文通过来源访问。2021–2026
            其余阅读 / 听力原卷待补充；可导入自己的 JSON 题包进行完整训练。
          </p>
          {!filtered.length ? (
            <div className="empty">
              <p>没有符合条件的练习。</p>
              <button
                className="btn"
                onClick={() => {
                  setYear("all");
                  setMonth("all");
                  setSet("all");
                  setKind("all");
                }}
              >
                重置筛选
              </button>
            </div>
          ) : (
            <div className="practice-list">
              {filtered.map((item) => {
                const record = latestRecord(item.id);
                return (
                  <article className="panel practice-card" key={item.id}>
                    <div className="toolbar practice-meta">
                      <span className="tag">{item.type}</span>
                      <span className="chip">{originLabel(item)}</span>
                    </div>
                    <h2>{item.title}</h2>
                    <p className="muted">
                      {dateLabel(item)} · {item.set} · {item.questions.length}{" "}
                      题
                    </p>
                    <p>{item.intro}</p>
                    {record && (
                      <p className="muted">
                        <CheckCircle2 size={15} /> 已完成 · 最近正确{" "}
                        {record.correct}/{record.total} ·{" "}
                        {new Date(record.completedAt).toLocaleString("zh-CN")}
                      </p>
                    )}
                    <div className="toolbar practice-card-actions">
                      <button
                        className="btn primary"
                        onClick={() => openPractice(item)}
                      >
                        {record ? "重新训练" : "开始训练"}
                        <ArrowRight size={16} />
                      </button>
                      {item.origin === "local" && (
                        <button
                          className="btn subtle"
                          onClick={() => void removeLocal(item)}
                        >
                          <Trash2 size={16} />
                          删除题包
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
      {!loading && active && (
        <>
          <button
            className="btn subtle"
            onClick={() => {
              if (
                !submitted &&
                Object.keys(answers).length &&
                !window.confirm("返回列表将放弃本次未提交的答案，确定返回？")
              )
                return;
              setActive(null);
              setError("");
              audioRef.current?.pause();
            }}
          >
            <ArrowLeft size={16} />
            返回练习列表
          </button>
          <section className="panel practice-material">
            <div className="toolbar practice-meta">
              <span className="tag">{active.type}</span>
              <span className="chip">{originLabel(active)}</span>
            </div>
            <h2>{active.title}</h2>
            <p className="muted">
              {dateLabel(active)} · {active.set}
            </p>
            <p>{active.intro}</p>
            {active.passage && (
              <div className="practice-passage">{active.passage}</div>
            )}
            {active.sources.length > 0 && (
              <div className="toolbar practice-sources">
                {active.sources
                  .filter((source) => safeSourceUrl(source.url))
                  .map((source) => (
                    <a
                      className="btn subtle"
                      key={source.url}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {source.label}
                      <ExternalLink size={14} />
                    </a>
                  ))}
              </div>
            )}
            <p className="muted">{active.sourceNote}</p>
          </section>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
            aria-label="练习答题"
          >
            {active.questions.map((question, index) => (
              <fieldset
                className="panel practice-question"
                key={question.id}
                disabled={submitted || saving}
              >
                <legend>
                  {index + 1}. {question.stem}
                </legend>
                <div className="practice-options">
                  {question.options.map((option) => (
                    <label key={option.key} className="practice-option">
                      <input
                        type="radio"
                        name={`${active.id}-${question.id}`}
                        value={option.key}
                        checked={answers[question.id] === option.key}
                        onChange={() =>
                          setAnswers((previous) => ({
                            ...previous,
                            [question.id]: option.key,
                          }))
                        }
                      />
                      <span>
                        {option.key}. {option.text}
                      </span>
                    </label>
                  ))}
                </div>
                {submitted && (
                  <div
                    className={`practice-feedback ${answers[question.id] === question.answer ? "is-correct" : "is-incorrect"}`}
                  >
                    <p>
                      <strong>
                        {answers[question.id] === question.answer
                          ? "✓ 回答正确"
                          : "✕ 回答错误"}
                      </strong>{" "}
                      · 你的答案：{answers[question.id]} · 正确答案：
                      {question.answer}
                    </p>
                    <p>{question.explanation}</p>
                  </div>
                )}
              </fieldset>
            ))}
            {!submitted && (
              <div className="toolbar">
                <button className="btn primary" type="submit" disabled={saving}>
                  {saving ? "正在保存…" : "提交答案"}
                </button>
                <span className="muted">
                  已作答 {Object.keys(answers).length}/{active.questions.length}{" "}
                  · 提交后显示答案与解析
                </span>
              </div>
            )}
          </form>
          {grade && (
            <section className="panel" role="status">
              <h2>本次训练完成</h2>
              <p>
                答对 {grade.correct}/{grade.total} · 正确率 {grade.percentage}%
                · 记录已保存在本地
              </p>
              <button className="btn" onClick={() => openPractice(active)}>
                <RotateCcw size={16} />
                再练一次
              </button>
            </section>
          )}
          {listening && submitted && active.transcript && (
            <section className="panel">
              <button
                className="btn"
                onClick={() => setShowTranscript((value) => !value)}
              >
                {showTranscript ? "收起听力原文" : "查看听力原文"}
              </button>
              {showTranscript && (
                <p className="practice-transcript">{active.transcript}</p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
