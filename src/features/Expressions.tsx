import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Bookmark,
  Plus,
  Pencil,
  Trash2,
  ArrowUpRight,
  ChevronDown,
  Check,
  BookOpen,
} from "lucide-react";
import { db } from "../storage/db";
import {
  writingExpressions,
  translationExpressions,
} from "../data/expressions";
import { writingExams, translationExams, type Exam } from "../data/exams";
import type { Expression, Favorite, PersonalExpression } from "../types";
import {
  Empty,
  Modal,
  PageHeading,
  SearchInput,
  errorMessage,
} from "../components/ui";

type Module = "writing" | "translation";
export default function Expressions({
  module,
  onChange,
  notify,
}: {
  module: Module;
  onChange: () => void;
  notify: (v: string) => void;
}) {
  const writing = module === "writing";
  const preset = writing ? writingExpressions : translationExpressions;
  const exams = writing ? writingExams : translationExams;
  const store = writing ? "writingExpressions" : "translationExpressions";
  const [tab, setTab] = useState("library");
  const [personal, setPersonal] = useState<PersonalExpression[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("all");
  const [category, setCategory] = useState("all");
  const [year, setYear] = useState("all");
  const [month, setMonth] = useState("all");
  const [setNumber, setSetNumber] = useState("all");
  const [editor, setEditor] = useState<PersonalExpression | "new" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(24);
  const load = async () => {
    try {
      const [p, f] = await Promise.all([
        db.getAll<PersonalExpression>(store),
        db.getAll<Favorite>("favorites"),
      ]);
      setPersonal(p);
      setFavorites(f.filter((v) => v.module === module));
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [module]);
  const favoriteIds = new Set(favorites.map((f) => f.expressionId));
  const items =
    tab === "mine"
      ? [...personal, ...preset.filter((e) => favoriteIds.has(e.id))]
      : preset;
  const topics = Array.from(
    new Set([...preset, ...personal].map((e) => e.topic)),
  ).sort();
  const categories = Array.from(
    new Set([...preset, ...personal].map((e) => e.category)),
  );
  const filtered = useMemo(
    () =>
      items.filter(
        (e) =>
          (topic === "all" || e.topic === topic) &&
          (category === "all" || e.category === category) &&
          [e.english, e.chinese, e.usage, e.keywords?.join(" ") || ""].some(
            (v) =>
              v.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()),
          ),
      ),
    [items, topic, category, query],
  );
  const toggle = async (expression: Expression) => {
    const found = favorites.find((f) => f.expressionId === expression.id);
    try {
      if (found) await db.delete("favorites", found.id);
      else
        await db.put("favorites", {
          id: `${module}:${expression.id}`,
          expressionId: expression.id,
          module,
          createdAt: new Date().toISOString(),
        });
      await load();
      onChange();
      notify(found ? "已取消收藏" : "已加入我的积累");
    } catch (e) {
      notify(errorMessage(e));
    }
  };
  const filteredExams = exams.filter(
    (e) =>
      (year === "all" || String(e.year) === year) &&
      (month === "all" || String(e.month) === month) &&
      (setNumber === "all" || e.set === setNumber) &&
      (topic === "all" || e.topic === topic) &&
      [e.title, e.topic, ...e.keywords, e.prompt || ""].some((v) =>
        v.toLowerCase().includes(query.toLowerCase().trim()),
      ),
  );
  const switchTab = (value: string) => {
    setTab(value);
    setQuery("");
    setTopic("all");
    setCategory("all");
    setVisible(24);
  };
  return (
    <>
      <PageHeading
        eyebrow={
          writing
            ? "WRITING · FIND YOUR VOICE"
            : "TRANSLATION · BRIDGE TWO LANGUAGES"
        }
        title={writing ? "让表达，更有分量" : "在两种语言之间，准确传达"}
        description={
          writing
            ? "积累自然、清晰、能真正用进文章的表达。"
            : "从高频词组开始，慢慢建立自己的翻译语料库。"
        }
      >
        <button className="btn primary" onClick={() => setEditor("new")}>
          <Plus size={17} />
          新增积累
        </button>
      </PageHeading>
      <div
        className="tabs"
        role="tablist"
        aria-label={writing ? "作文内容" : "翻译内容"}
      >
        {[
          ["library", "表达库", preset.length],
          ["mine", "我的积累", personal.length + favorites.length],
          [
            "exams",
            "历年真题",
            exams.filter((e) => e.status !== "pending").length,
          ],
        ].map(([v, label, count]) => (
          <button
            role="tab"
            aria-selected={tab === v}
            className={tab === v ? "active" : ""}
            key={String(v)}
            onClick={() => switchTab(String(v))}
          >
            {label}
            <span>{count}</span>
          </button>
        ))}
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="toolbar">
        <SearchInput
          value={query}
          onChange={(v) => {
            setQuery(v);
            setVisible(24);
          }}
          label="搜索表达或真题"
          placeholder={
            tab === "exams"
              ? "搜索题目、主题、关键词"
              : "搜索中文、英文或使用说明"
          }
        />
        <label className="filter-select">
          <span className="sr-only">主题筛选</span>
          <select
            value={topic}
            aria-label="主题筛选"
            onChange={(e) => {
              setTopic(e.target.value);
              setVisible(24);
            }}
          >
            <option value="all">全部主题</option>
            {Array.from(
              new Set(tab === "exams" ? exams.map((e) => e.topic) : topics),
            ).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        {tab !== "exams" ? (
          <label className="filter-select">
            <span className="sr-only">类型筛选</span>
            <select
              aria-label="类型筛选"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setVisible(24);
              }}
            >
              <option value="all">全部类型</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <select
              aria-label="真题年份"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            >
              <option value="all">全部年份</option>
              {Array.from(new Set(exams.map((e) => e.year)))
                .sort((a, b) => b - a)
                .map((y) => (
                  <option key={y}>{y}</option>
                ))}
            </select>
            <select
              aria-label="考试月份"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            >
              <option value="all">全部月份</option>
              <option value="6">6 月</option>
              <option value="12">12 月</option>
            </select>
            <select
              aria-label="真题套数"
              value={setNumber}
              onChange={(e) => setSetNumber(e.target.value)}
            >
              <option value="all">全部套数</option>
              {Array.from(new Set(exams.map((e) => e.set))).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </>
        )}
      </div>
      {tab === "exams" ? (
        <>
          <div className="notice subtle-notice">
            <BookOpen size={17} />
            <span>
              这里整理的是真题主题目录，部分场次仍缺独立交叉核验；完整原题和套号待补充，请结合来源使用。题干以摘要呈现，不作为原题全文。
              {writing
                ? "写作思路为自主整理。"
                : "参考译文为自主整理，并非官方唯一答案。"}
            </span>
          </div>
          {filteredExams.length ? (
            <div className="exam-list">
              {filteredExams.map((exam) => (
                <ExamCard key={exam.id} exam={exam} writing={writing} />
              ))}
            </div>
          ) : (
            <div className="panel">
              <Empty title="没有匹配的真题" detail="试试其他年份或关键词。" />
            </div>
          )}
        </>
      ) : (
        <>
          <div className="library-caption">
            <span>
              {tab === "mine"
                ? "每一句积累，都在慢慢成为你的表达。"
                : "自主整理 · 从理解语境开始，避免生搬硬套。"}
            </span>
            <span>{filtered.length} 条表达</span>
          </div>
          {loading ? (
            <div className="panel empty" role="status">
              正在读取你的积累…
            </div>
          ) : filtered.length ? (
            <div className="expression-grid">
              {filtered.slice(0, visible).map((expression) => {
                const own = personal.some((p) => p.id === expression.id);
                return (
                  <article
                    className="expression-card panel"
                    key={expression.id}
                  >
                    <div className="expression-meta">
                      <span className="tag neutral">{expression.topic}</span>
                      <span className="small-text muted">
                        {expression.category}
                      </span>
                      {own ? (
                        <div className="expression-actions">
                          <button
                            className="icon-button"
                            aria-label="编辑个人表达"
                            onClick={() =>
                              setEditor(expression as PersonalExpression)
                            }
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="icon-button danger-text"
                            aria-label="删除个人表达"
                            onClick={async () => {
                              if (confirm("删除这条个人积累？")) {
                                try {
                                  await db.delete(store, expression.id);
                                  await load();
                                  onChange();
                                  notify("已删除积累");
                                } catch (e) {
                                  notify(errorMessage(e));
                                }
                              }
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ) : (
                        <button
                          className={`icon-button bookmark ${favoriteIds.has(expression.id) ? "saved" : ""}`}
                          aria-label={
                            favoriteIds.has(expression.id)
                              ? "取消收藏表达"
                              : "收藏表达"
                          }
                          aria-pressed={favoriteIds.has(expression.id)}
                          onClick={() => void toggle(expression)}
                        >
                          <Bookmark
                            size={18}
                            fill={
                              favoriteIds.has(expression.id)
                                ? "currentColor"
                                : "none"
                            }
                          />
                        </button>
                      )}
                    </div>
                    <h3
                      lang={writing ? "en" : "zh-CN"}
                      className={writing ? "english-expression" : ""}
                    >
                      {writing ? expression.english : expression.chinese}
                    </h3>
                    <p
                      className={
                        writing
                          ? "expression-translation"
                          : "expression-translation english-expression"
                      }
                      lang={writing ? "zh-CN" : "en"}
                    >
                      {writing ? expression.chinese : expression.english}
                    </p>
                    {expression.usage && (
                      <div className="expression-usage">
                        <span>怎么用</span>
                        <p>{expression.usage}</p>
                      </div>
                    )}
                    {expression.example && (
                      <details className="example-details">
                        <summary>
                          查看例句
                          <ChevronDown size={14} />
                        </summary>
                        <p lang="en">{expression.example}</p>
                      </details>
                    )}
                    <span className="expression-source">
                      {own ? "个人积累" : expression.sourceType}
                    </span>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="panel">
              <Empty
                title={
                  tab === "mine"
                    ? "把值得记住的表达，留在这里"
                    : "没有找到相关表达"
                }
                detail={
                  tab === "mine"
                    ? "收藏表达库中的句子，或者添加自己的学习积累。"
                    : "换一个主题或关键词试试看。"
                }
              >
                {tab === "mine" && (
                  <button className="btn" onClick={() => switchTab("library")}>
                    浏览表达库
                    <ArrowUpRight size={15} />
                  </button>
                )}
              </Empty>
            </div>
          )}
          {visible < filtered.length && (
            <button
              className="btn load-more"
              onClick={() => setVisible((v) => v + 24)}
            >
              显示更多表达
            </button>
          )}
        </>
      )}
      {editor && (
        <ExpressionEditor
          expression={editor === "new" ? undefined : editor}
          module={module}
          topics={topics}
          categories={categories}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            void load();
            onChange();
            notify("个人积累已保存");
          }}
        />
      )}
    </>
  );
}

function ExpressionEditor({
  expression,
  module,
  topics,
  categories,
  onClose,
  onSaved,
}: {
  expression?: PersonalExpression;
  module: Module;
  topics: string[];
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [english, setEnglish] = useState(expression?.english || "");
  const [chinese, setChinese] = useState(expression?.chinese || "");
  const [topic, setTopic] = useState(
    expression?.topic || topics[0] || "个人积累",
  );
  const [category, setCategory] = useState(
    expression?.category || categories[0] || "主题词组",
  );
  const [usage, setUsage] = useState(expression?.usage || "");
  const [example, setExample] = useState(expression?.example || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (
      !english.trim() ||
      !chinese.trim() ||
      !topic.trim() ||
      !category.trim()
    ) {
      setError("请填写英文、中文、主题和类型。");
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await db.put(
        module === "writing" ? "writingExpressions" : "translationExpressions",
        {
          id: expression?.id || crypto.randomUUID(),
          english: english.trim(),
          chinese: chinese.trim(),
          topic: topic.trim(),
          category: category.trim(),
          usage: usage.trim(),
          example: example.trim(),
          sourceType: "个人积累",
          createdAt: expression?.createdAt || now,
          updatedAt: now,
        },
      );
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      title={expression ? "编辑个人积累" : "新增个人积累"}
      onClose={onClose}
    >
      <form className="form-stack" onSubmit={submit}>
        <label className="field">
          英文表达
          <textarea
            autoFocus
            required
            value={english}
            onChange={(e) => setEnglish(e.target.value)}
            rows={2}
            maxLength={5000}
            lang="en"
            placeholder="写下你想记住的英文"
          />
        </label>
        <label className="field">
          中文释义
          <textarea
            required
            value={chinese}
            onChange={(e) => setChinese(e.target.value)}
            rows={2}
            maxLength={5000}
          />
        </label>
        <div className="form-columns">
          <label className="field">
            主题
            <input
              required
              list="expression-topic-options"
              aria-label="主题"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={50}
            />
            <datalist id="expression-topic-options">
              {topics.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </datalist>
          </label>
          <label className="field">
            类型
            <input
              required
              list="expression-category-options"
              aria-label="类型"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              maxLength={50}
            />
            <datalist id="expression-category-options">
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </datalist>
          </label>
        </div>
        <label className="field">
          使用说明 <span className="muted">（可选）</span>
          <textarea
            value={usage}
            onChange={(e) => setUsage(e.target.value)}
            rows={2}
            maxLength={3000}
          />
        </label>
        <label className="field">
          例句 <span className="muted">（可选）</span>
          <textarea
            value={example}
            onChange={(e) => setExample(e.target.value)}
            rows={2}
            maxLength={5000}
          />
        </label>
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? "保存中…" : "保存积累"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ExamCard({ exam, writing }: { exam: Exam; writing: boolean }) {
  const [reference, setReference] = useState(false);
  const [sentences, setSentences] = useState<Set<number>>(new Set());
  return (
    <article className="exam-card panel">
      <div className="exam-meta">
        <span>
          {exam.year} 年 {exam.month} 月
        </span>
        <span>{exam.set}</span>
        <span className="tag neutral">{exam.topic}</span>
        {exam.status === "pending" && (
          <span className="tag error-tag">待补充</span>
        )}
        {exam.status === "partial" && (
          <span className="tag">部分核验 · 原文 / 套数待补</span>
        )}
      </div>
      <h3>{exam.title}</h3>
      {exam.prompt && (
        <p className="exam-prompt">
          <span className="small-text muted">题目主题摘要</span>
          <br />
          {exam.prompt}
        </p>
      )}
      <div className="keyword-list">
        {exam.keywords.map((k) => (
          <span key={k}>{k}</span>
        ))}
      </div>
      {exam.outline?.length ? (
        <details className="exam-details">
          <summary>
            查看{writing ? "写作" : "翻译"}思路 <ChevronDown size={15} />
          </summary>
          <ul>
            {exam.outline.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </details>
      ) : null}
      {exam.reference && (
        <>
          <button
            className="btn subtle small"
            onClick={() => setReference((v) => !v)}
          >
            {reference ? "收起" : "显示"}
            {writing ? "参考范文" : "参考译文"}
          </button>
          {reference && (
            <div className="reference-answer">
              <p className="small-text muted">
                自主整理的参考{writing ? "范文" : "译文"} / 非官方唯一答案
              </p>
              <p lang="en">{exam.reference}</p>
            </div>
          )}
        </>
      )}
      {!!exam.sentences?.length && (
        <p className="small-text muted" style={{ marginTop: 16 }}>
          同主题原创练习句 · 非中文原题
        </p>
      )}
      {exam.sentences?.map((s, i) => (
        <div className="sentence-practice" key={i}>
          <p>{s.chinese}</p>
          <button
            className="text-link"
            onClick={() =>
              setSentences((v) => {
                const n = new Set(v);
                n.has(i) ? n.delete(i) : n.add(i);
                return n;
              })
            }
          >
            {sentences.has(i) ? "收起参考翻译" : "查看参考翻译"}
          </button>
          {sentences.has(i) && <p lang="en">{s.english}</p>}
        </div>
      ))}
      <div className="exam-sources">
        {exam.sources.map((url, i) => (
          <a key={url} href={url} target="_blank" rel="noopener noreferrer">
            {i === 0 ? "查看原始来源" : "交叉核验来源"}
            <ArrowUpRight size={13} />
          </a>
        ))}
      </div>
    </article>
  );
}
