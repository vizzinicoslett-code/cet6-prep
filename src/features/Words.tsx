import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Plus,
  Upload,
  ArrowRight,
  Pencil,
  Trash2,
  Check,
  RotateCcw,
  ChevronRight,
  BookOpen,
  Eye,
  CheckCircle2,
  CircleHelp,
  XCircle,
} from "lucide-react";
import {
  db,
  saveWord,
  DuplicateWordError,
  bulkImportWords,
  reviewWord,
  setWordMastered,
  deleteWord,
} from "../storage/db";
import { getDueWords, localDateKey } from "../lib/review";
import {
  parseWordBatch,
  searchWords,
  type WordBatchResult,
} from "../lib/words";
import type { ReviewRating, Word } from "../types";
import {
  Empty,
  Modal,
  PageHeading,
  SearchInput,
  errorMessage,
} from "../components/ui";

type Props = {
  reviewing: boolean;
  onChange: () => void;
  notify: (v: string) => void;
};
type Mode = "mixed" | "forward" | "reverse";
type Limit = "auto" | 10 | 20 | 30 | 50 | 100;
const modeLabels = {
  mixed: "随机混合",
  forward: "英文 → 中文",
  reverse: "中文 → 英文",
};

export default function Words({ reviewing, onChange, notify }: Props) {
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("new");
  const [visible, setVisible] = useState(30);
  const [editor, setEditor] = useState<Word | "new" | null>(null);
  const [batch, setBatch] = useState(false);
  const [mode, setMode] = useState<Mode>("mixed");
  const [limit, setLimit] = useState<Limit>("auto");
  const [loadedSettings, setLoadedSettings] = useState(false);
  const load = async () => {
    try {
      setWords(await db.getAll<Word>("words"));
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
    void Promise.all([
      db.get<{ id: string; value: Mode }>("settings", "reviewMode"),
      db.get<{ id: string; value: Limit }>("settings", "reviewLimit"),
    ])
      .then(([m, l]) => {
        if (
          m &&
          typeof m.value === "string" &&
          Object.hasOwn(modeLabels, m.value)
        )
          setMode(m.value);
        if (l && ["auto", 10, 20, 30, 50, 100].includes(l.value))
          setLimit(l.value);
        setLoadedSettings(true);
      })
      .catch((e) => {
        setError(errorMessage(e));
        setLoadedSettings(true);
      });
  }, []);
  const changed = () => {
    void load();
    onChange();
  };
  const due = getDueWords(words);
  const listed = useMemo(() => {
    const today = localDateKey(new Date());
    const results = searchWords(words, search).filter(
      (w) =>
        filter === "all" ||
        (filter === "due" && !w.mastered && w.nextReviewDate <= today) ||
        (filter === "difficult" && w.unknownCount + w.fuzzyCount > 0) ||
        (filter === "mastered" && w.mastered),
    );
    return results.sort((a, b) =>
      sort === "old"
        ? a.createdAt.localeCompare(b.createdAt)
        : sort === "errors"
          ? b.unknownCount - a.unknownCount
          : sort === "fuzzy"
            ? b.fuzzyCount - a.fuzzyCount
            : sort === "reviews"
              ? b.totalReviews - a.totalReviews
              : b.createdAt.localeCompare(a.createdAt),
    );
  }, [words, search, filter, sort]);
  if (reviewing)
    return (
      <ReviewSession
        key={`${loadedSettings}-${mode}-${limit}`}
        words={words}
        loading={loading || !loadedSettings}
        error={error}
        mode={mode}
        limit={limit}
        onChange={changed}
      />
    );
  return (
    <>
      <PageHeading
        eyebrow="WORDS · LITTLE BY LITTLE"
        title="我的单词本"
        description="把总是记错的词留在这里，让每一次重逢都更熟悉。"
      >
        <button className="btn" onClick={() => setBatch(true)}>
          <Upload size={16} />
          批量添加
        </button>
        <button className="btn primary" onClick={() => setEditor("new")}>
          <Plus size={17} />
          新增单词
        </button>
      </PageHeading>
      {error && (
        <p role="alert" className="notice error">
          {error}
          <button className="btn small" onClick={() => void load()}>
            重试
          </button>
        </p>
      )}
      <section className="review-banner">
        <span className="review-banner-icon">
          <BookOpen size={27} strokeWidth={1.4} />
        </span>
        <div className="review-banner-copy">
          <h2>今天，和单词再见一面</h2>
          <p>
            <strong>{due.length}</strong> 个待复习 <span>·</span> 共{" "}
            {words.length} 个错词 <span>·</span>{" "}
            {words.filter((w) => w.mastered).length} 个已掌握
          </p>
        </div>
        <div className="review-options">
          <label>
            <span className="sr-only">复习模式</span>
            <select
              aria-label="复习模式"
              value={mode}
              onChange={(e) => {
                const v = e.target.value as Mode;
                setMode(v);
                void db
                  .put("settings", { id: "reviewMode", value: v })
                  .catch((e) => notify(errorMessage(e)));
              }}
            >
              {Object.entries(modeLabels).map(([v, l]) => (
                <option value={v} key={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">每轮数量</span>
            <select
              aria-label="每轮数量"
              value={limit}
              onChange={(e) => {
                const v =
                  e.target.value === "auto"
                    ? "auto"
                    : (Number(e.target.value) as Limit);
                setLimit(v);
                void db
                  .put("settings", { id: "reviewLimit", value: v })
                  .catch((e) => notify(errorMessage(e)));
              }}
            >
              <option value="auto">自动 · 全部到期</option>
              {[10, 20, 30, 50, 100].map((n) => (
                <option value={n} key={n}>
                  {n} 个
                </option>
              ))}
            </select>
          </label>
        </div>
        <a href="#/words/review" className="btn primary">
          开始复习
          <ArrowRight size={16} />
        </a>
      </section>
      <div className="toolbar word-toolbar">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setVisible(30);
          }}
          placeholder="搜索英文、释义或备注"
          label="搜索单词"
        />
        <label className="sort-control">
          <span>排序</span>
          <select
            aria-label="单词排序"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="new">最近添加</option>
            <option value="old">最早添加</option>
            <option value="errors">错误最多</option>
            <option value="fuzzy">模糊最多</option>
            <option value="reviews">复习次数最多</option>
          </select>
        </label>
      </div>
      <div className="filter-row" aria-label="单词筛选">
        {[
          ["all", "全部"],
          ["due", "待复习"],
          ["difficult", "易错"],
          ["mastered", "已掌握"],
        ].map(([v, l]) => (
          <button
            key={v}
            className={`chip ${filter === v ? "active" : ""}`}
            aria-pressed={filter === v}
            onClick={() => {
              setFilter(v);
              setVisible(30);
            }}
          >
            {l}
            {v === "all" && <span>{words.length}</span>}
          </button>
        ))}
        <span className="result-count">{listed.length} 个单词</span>
      </div>
      {loading ? (
        <div className="panel empty" role="status">
          正在读取单词本…
        </div>
      ) : listed.length ? (
        <div className="word-list">
          {listed.slice(0, visible).map((word) => (
            <article className="word-row panel" key={word.id}>
              <div className="word-main">
                <div className="word-title">
                  <h3 lang="en">{word.english}</h3>
                  {word.mastered ? (
                    <span className="tag mastered">
                      <Check size={12} />
                      已掌握
                    </span>
                  ) : word.nextReviewDate <= localDateKey(new Date()) ? (
                    <span className="tag">待复习</span>
                  ) : (
                    <span className="tag neutral">
                      {word.nextReviewDate} 复习
                    </span>
                  )}
                </div>
                <p>{word.chinese}</p>
                {word.notes && <p className="word-note">{word.notes}</p>}
                <details className="word-details">
                  <summary>复习记录 · {word.totalReviews} 次</summary>
                  <div>
                    认识 {word.knownCount} · 模糊 {word.fuzzyCount} · 不认识{" "}
                    {word.unknownCount} · 连续认识 {word.streak}
                    <br />
                    当前间隔 {word.intervalDays} 天 · 最后复习{" "}
                    {word.lastReviewedAt
                      ? new Date(word.lastReviewedAt).toLocaleDateString(
                          "zh-CN",
                        )
                      : "尚未复习"}
                    <br />
                    添加于{" "}
                    {new Date(word.createdAt).toLocaleDateString("zh-CN")}
                  </div>
                </details>
              </div>
              <div className="word-actions">
                <button
                  className="icon-button"
                  aria-label={`编辑 ${word.english}`}
                  title="编辑"
                  onClick={() => setEditor(word)}
                >
                  <Pencil size={17} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`${word.mastered ? "恢复复习" : "标记已掌握"} ${word.english}`}
                  title={word.mastered ? "恢复复习" : "标记已掌握"}
                  onClick={async () => {
                    try {
                      await setWordMastered(word, !word.mastered);
                      changed();
                      notify(word.mastered ? "已恢复复习" : "已标记掌握");
                    } catch (e) {
                      notify(errorMessage(e));
                    }
                  }}
                >
                  {word.mastered ? (
                    <RotateCcw size={17} />
                  ) : (
                    <Check size={18} />
                  )}
                </button>
                <button
                  className="icon-button danger-text"
                  aria-label={`删除 ${word.english}`}
                  title="删除"
                  onClick={async () => {
                    if (confirm(`删除单词「${word.english}」及其复习记录？`)) {
                      try {
                        await deleteWord(word.id);
                        changed();
                        notify("单词已删除");
                      } catch (e) {
                        notify(errorMessage(e));
                      }
                    }
                  }}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </article>
          ))}
          {visible < listed.length && (
            <button
              className="btn load-more"
              onClick={() => setVisible((v) => v + 30)}
            >
              再显示 30 个
            </button>
          )}
        </div>
      ) : (
        <div className="panel">
          <Empty
            title={
              words.length ? "没有找到匹配的单词" : "先留住一个总记错的单词"
            }
            detail={
              words.length
                ? "试试其他关键词或筛选条件。"
                : "英文、中文，再加一点自己的理解。新词当天就可以复习。"
            }
          >
            {!words.length && (
              <button className="btn primary" onClick={() => setEditor("new")}>
                <Plus size={16} />
                添加单词
              </button>
            )}
          </Empty>
        </div>
      )}
      <p className="section-footnote">
        认识后间隔逐步增加；模糊和不认识的词，会更早回来。复习随你的掌握程度调整。
      </p>
      {editor && (
        <WordEditor
          word={editor === "new" ? undefined : editor}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            changed();
            notify("单词已保存");
          }}
        />
      )}
      {batch && (
        <BatchEditor
          words={words}
          onClose={() => setBatch(false)}
          onSaved={(count) => {
            setBatch(false);
            changed();
            notify(`已导入 ${count} 个单词`);
          }}
        />
      )}
    </>
  );
}

function WordEditor({
  word,
  onClose,
  onSaved,
}: {
  word?: Word;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [english, setEnglish] = useState(word?.english || "");
  const [chinese, setChinese] = useState(word?.chinese || "");
  const [notes, setNotes] = useState(word?.notes || "");
  const [error, setError] = useState("");
  const [duplicate, setDuplicate] = useState<Word>();
  const [saving, setSaving] = useState(false);
  const save = async (id?: string) => {
    setSaving(true);
    setError("");
    try {
      await saveWord(english, chinese, notes, id || word?.id);
      onSaved();
    } catch (e) {
      if (e instanceof DuplicateWordError) {
        setDuplicate(e.existingWord);
        setError(
          "这个单词已在单词本中。可以更新原记录的释义和备注，保留复习进度。",
        );
      } else setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title={word ? "编辑单词" : "新增单词"} onClose={onClose}>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void save();
        }}
        className="form-stack"
      >
        <label className="field">
          英文单词
          <input
            autoFocus
            value={english}
            onChange={(e) => {
              setEnglish(e.target.value);
              setDuplicate(undefined);
            }}
            placeholder="例如 obscure"
            required
            maxLength={150}
            autoComplete="off"
            lang="en"
          />
        </label>
        <label className="field">
          中文释义
          <input
            value={chinese}
            onChange={(e) => setChinese(e.target.value)}
            placeholder="例如 模糊的；晦涩的"
            required
            maxLength={1000}
          />
        </label>
        <label className="field">
          备注 <span className="muted">（可选）</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="记忆线索、易混词，或自己的例句"
            rows={3}
            maxLength={3000}
          />
        </label>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          {duplicate ? (
            <button
              type="button"
              className="btn primary"
              disabled={saving}
              onClick={() => void save(duplicate.id)}
            >
              更新已有释义
            </button>
          ) : (
            <button className="btn primary" type="submit" disabled={saving}>
              {saving ? "保存中…" : "保存单词"}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

function BatchEditor({
  words,
  onClose,
  onSaved,
}: {
  words: Word[];
  onClose: () => void;
  onSaved: (count: number) => void;
}) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<WordBatchResult>();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <Modal title="批量添加单词" wide onClose={onClose}>
      <p className="muted">
        每行一个单词，支持空格、短横线、冒号或 Tab
        分隔。重复项会跳过，可在单词本中编辑。
      </p>
      <label className="field">
        粘贴单词
        <textarea
          rows={7}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPreview(undefined);
          }}
          placeholder={
            "abandon 放弃；抛弃\nobscure - 模糊的；晦涩的\ncompulsory: 强制的；必修的"
          }
          maxLength={300000}
        />
      </label>
      {preview && (
        <div className="batch-preview">
          <div className="batch-counts">
            <span>
              识别成功 <strong>{preview.valid}</strong>
            </span>
            <span>
              失败 <strong>{preview.invalid}</strong>
            </span>
            <span>
              重复 <strong>{preview.duplicates}</strong>
            </span>
          </div>
          <div className="preview-scroll">
            {preview.rows.map((r) => (
              <div key={r.line} className="preview-row">
                <span className="muted">{r.line}</span>
                <span>
                  <strong>{r.english}</strong>
                  <small>{r.chinese}</small>
                  {r.message && <small className="muted">{r.message}</small>}
                </span>
                <span
                  className={`tag ${r.status === "invalid" ? "error-tag" : ""}`}
                >
                  {r.status === "valid"
                    ? "可导入"
                    : r.status === "duplicate"
                      ? "重复"
                      : "格式错误"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          取消
        </button>
        {!preview ? (
          <button
            className="btn primary"
            disabled={!text.trim()}
            onClick={() => setPreview(parseWordBatch(text, words))}
          >
            解析并预览
          </button>
        ) : (
          <button
            className="btn primary"
            disabled={!preview.valid || saving}
            onClick={async () => {
              setSaving(true);
              try {
                const r = await bulkImportWords(preview.rows);
                onSaved(r.imported);
              } catch (e) {
                setError(errorMessage(e));
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "导入中…" : `确认导入 ${preview.valid} 个`}
          </button>
        )}
      </div>
    </Modal>
  );
}

function ReviewSession({
  words,
  loading,
  error,
  mode,
  limit,
  onChange,
}: {
  words: Word[];
  loading: boolean;
  error: string;
  mode: Mode;
  limit: Limit;
  onChange: () => void;
}) {
  const [queue, setQueue] = useState<{ word: Word; reverse: boolean }[] | null>(
    null,
  );
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [results, setResults] = useState({ known: 0, fuzzy: 0, unknown: 0 });
  useEffect(() => {
    if (!loading && queue === null)
      setQueue(
        getDueWords(words, limit).map((word) => ({
          word,
          reverse:
            mode === "reverse" || (mode === "mixed" && Math.random() < 0.5),
        })),
      );
  }, [loading, queue, words, mode, limit]);
  const rate = async (rating: ReviewRating) => {
    if (!queue || saving || !revealed) return;
    setSaving(true);
    setSaveError("");
    try {
      await reviewWord(queue[index].word, rating);
      setResults((r) => ({ ...r, [rating]: r[rating] + 1 }));
      setIndex((i) => i + 1);
      setRevealed(false);
      onChange();
    } catch (e) {
      setSaveError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  if (loading || !queue)
    return (
      <div className="panel empty" role="status">
        正在准备今日复习…{error && <p role="alert">{error}</p>}
      </div>
    );
  if (!queue.length)
    return (
      <>
        <PageHeading
          eyebrow="WORDS · DAILY REVIEW"
          title="今日没有待复习单词"
          description="可以添加新词，或恢复已经掌握的单词。"
        />
        <div className="panel">
          <Empty
            title="今天的单词已安排妥当"
            detail="到期单词会自动出现在这里。"
          >
            <a className="btn primary" href="#/words">
              回到单词本
            </a>
          </Empty>
        </div>
      </>
    );
  if (index >= queue.length)
    return (
      <div className="review-complete panel">
        <span className="completion-icon">
          <CheckCircle2 size={42} strokeWidth={1.4} />
        </span>
        <span className="eyebrow">A LITTLE PROGRESS, EVERY DAY</span>
        <h1>今日复习完成</h1>
        <p className="muted">
          这一轮，共复习了 {queue.length} 个单词。辛苦了。
        </p>
        <div className="review-results">
          <div>
            <strong>{results.known}</strong>
            <span>认识</span>
          </div>
          <div>
            <strong>{results.fuzzy}</strong>
            <span>模糊</span>
          </div>
          <div>
            <strong>{results.unknown}</strong>
            <span>不认识</span>
          </div>
        </div>
        {results.unknown > 0 && (
          <p className="muted small-text">
            不认识的词已重新加入今日待复习，休息片刻后可以再来一轮。
          </p>
        )}
        <a href="#/words" className="btn primary">
          回到单词本
          <ArrowRight size={16} />
        </a>
      </div>
    );
  const { word, reverse } = queue[index];
  return (
    <>
      <div className="review-top">
        <a href="#/words" className="text-link">
          ← 返回单词本
        </a>
        <span>{modeLabels[mode]}</span>
        <strong>
          {index + 1} / {queue.length}
        </strong>
      </div>
      <div className="progress-track">
        <div style={{ width: `${(index / queue.length) * 100}%` }} />
      </div>
      <section className="review-card panel">
        <span className="eyebrow">
          {reverse ? "想一想，对应的英文是？" : "想一想，这个词是什么意思？"}
        </span>
        <h1
          className={reverse ? "review-prompt chinese" : "review-prompt"}
          lang={reverse ? "zh-CN" : "en"}
        >
          {reverse ? word.chinese : word.english}
        </h1>
        {!revealed ? (
          <>
            <p className="muted">给自己一点回想的时间。</p>
            <button
              className="btn primary reveal-button"
              onClick={() => setRevealed(true)}
            >
              <Eye size={17} />
              显示答案
            </button>
          </>
        ) : (
          <>
            <div className="review-answer" aria-live="polite">
              <span className="muted small-text">参考答案</span>
              <h2 lang={reverse ? "en" : "zh-CN"}>
                {reverse ? word.english : word.chinese}
              </h2>
              {word.notes && <p className="muted">{word.notes}</p>}
            </div>
            <p className="muted small-text">
              刚才想起来了吗？如实选择，让下次复习更合适。
            </p>
            <div className="rating-buttons">
              <button
                className="btn known"
                disabled={saving}
                onClick={() => void rate("known")}
              >
                <CheckCircle2 size={19} />
                认识
              </button>
              <button
                className="btn fuzzy"
                disabled={saving}
                onClick={() => void rate("fuzzy")}
              >
                <CircleHelp size={19} />
                模糊
              </button>
              <button
                className="btn unknown"
                disabled={saving}
                onClick={() => void rate("unknown")}
              >
                <XCircle size={19} />
                不认识
              </button>
            </div>
          </>
        )}
        {saveError && (
          <p className="notice error" role="alert">
            {saveError} 请再次选择。
          </p>
        )}
      </section>
      <p className="section-footnote">
        先回忆，再看答案。每次选择后会立即保存进度。
        <ChevronRight size={13} />
      </p>
    </>
  );
}
