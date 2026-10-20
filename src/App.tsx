import { Component, useEffect, useState, type ReactNode } from "react";
import {
  BookOpen,
  House,
  Languages,
  Headphones,
  NotebookPen,
  BookText,
  Settings as SettingsIcon,
  ArrowUpRight,
  Check,
  ArrowRight,
  ShieldCheck,
  WifiOff,
  RefreshCw,
  LibraryBig,
  Leaf,
} from "lucide-react";
import { db } from "./storage/db";
import { getDueWords } from "./lib/review";
import type { Favorite, PracticeRecord, Word, WordReview } from "./types";
import Words from "./features/Words";
import Expressions from "./features/Expressions";
import Practice from "./features/Practice";
import Settings from "./features/Settings";
import { Empty, formatTime } from "./components/ui";

const navigation = [
  { path: "/", label: "首页", icon: House },
  { path: "/words", label: "单词", icon: BookOpen },
  { path: "/listening", label: "听力", icon: Headphones },
  { path: "/reading", label: "阅读", icon: BookText },
  { path: "/writing", label: "作文", icon: NotebookPen },
  { path: "/translation", label: "翻译", icon: Languages },
];

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="container">
        <div className="panel empty">
          <h1>页面暂时无法显示</h1>
          <p>请刷新重试。若浏览器禁止本地存储，请允许本站保存数据。</p>
          <button className="btn primary" onClick={() => location.reload()}>
            重新加载
          </button>
        </div>
      </main>
    ) : (
      this.props.children
    );
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [route, setRoute] = useState(
    () => location.hash.slice(1).split("?")[0] || "/",
  );
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [update, setUpdate] = useState(false);
  const changed = () => setRevision((v) => v + 1);
  useEffect(() => {
    const hash = () => {
      setRoute(location.hash.slice(1).split("?")[0] || "/");
      window.scrollTo(0, 0);
    };
    const network = () => setOnline(navigator.onLine);
    const available = () => setUpdate(true);
    const unavailable = () =>
      setNotice("离线缓存未能启用；联网时仍可正常使用。可在设置中重新检查。");
    window.addEventListener("hashchange", hash);
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
    window.addEventListener("cet6-update", available);
    window.addEventListener("cet6-offline-unavailable", unavailable);
    return () => {
      window.removeEventListener("hashchange", hash);
      window.removeEventListener("online", network);
      window.removeEventListener("offline", network);
      window.removeEventListener("cet6-update", available);
      window.removeEventListener("cet6-offline-unavailable", unavailable);
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    let active = true;
    const apply = async () => {
      const setting = await db.get<{ id: string; value: string }>(
        "settings",
        "theme",
      );
      if (!active) return;
      const theme =
        setting?.value || localStorage.getItem("cet6-theme") || "system";
      document.documentElement.dataset.theme =
        theme === "system"
          ? matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : theme;
    };
    void apply().catch((error) =>
      setNotice(
        `本地数据不可用：${error instanceof Error ? error.message : "请检查浏览器存储权限"}`,
      ),
    );
    const media = matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    return () => {
      active = false;
      media.removeEventListener("change", apply);
    };
  }, [revision]);
  const isActive = (path: string) =>
    path === "/" ? route === "/" : route.startsWith(path);
  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
          document.getElementById("main")?.scrollIntoView();
        }}
      >
        跳到主要内容
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a href="#/" className="brand" aria-label="六级备考首页">
            <span className="brand-mark">
              <BookOpen size={22} strokeWidth={1.7} />
            </span>
            <span>
              六级备考<span className="brand-caption">A LITTLE, EVERY DAY</span>
            </span>
          </a>
          <nav className="desktop-nav" aria-label="主要导航">
            {navigation.map(({ path, label }) => (
              <a
                key={path}
                href={`#${path}`}
                className={isActive(path) ? "active" : ""}
                aria-current={isActive(path) ? "page" : undefined}
              >
                {label}
              </a>
            ))}
          </nav>
          <a
            href="#/settings"
            className={`settings-link icon-button ${isActive("/settings") ? "selected" : ""}`}
            aria-label="设置与数据管理"
            title="设置与数据管理"
          >
            <SettingsIcon size={20} />
          </a>
        </div>
      </header>
      <main id="main" className="container" tabIndex={-1}>
        {!online && (
          <div className="notice">
            <WifiOff size={16} /> 当前离线 · 单词复习和本地积累仍可使用。
          </div>
        )}
        {update && (
          <div className="notice">
            <RefreshCw size={16} />
            <span>新版本已准备好，请先完成当前练习。</span>
            <button
              className="btn small"
              onClick={async () => {
                const registration =
                  await navigator.serviceWorker.getRegistration();
                registration?.waiting?.postMessage("SKIP_WAITING");
                navigator.serviceWorker.addEventListener(
                  "controllerchange",
                  () => location.reload(),
                  { once: true },
                );
              }}
            >
              更新并刷新
            </button>
          </div>
        )}
        {route === "/" ? (
          <Home revision={revision} />
        ) : route.startsWith("/words") ? (
          <Words
            reviewing={route === "/words/review"}
            onChange={changed}
            notify={setNotice}
          />
        ) : route === "/writing" || route === "/translation" ? (
          <Expressions
            key={route}
            module={route === "/writing" ? "writing" : "translation"}
            onChange={changed}
            notify={setNotice}
          />
        ) : route === "/reading" || route === "/listening" ? (
          <Practice
            key={route}
            module={route === "/reading" ? "reading" : "listening"}
            onChange={changed}
          />
        ) : route === "/settings" ? (
          <Settings onChange={changed} notify={setNotice} />
        ) : (
          <Empty title="没有找到这个页面">
            <a className="btn primary" href="#/">
              回到首页
            </a>
          </Empty>
        )}
      </main>
      <footer className="site-footer container">
        <span>
          <span className="status-dot" /> 学习数据保存在此浏览器
        </span>
        <span>
          每天一点，慢慢积累。 <span className="footer-version">v1.0.0</span>
        </span>
      </footer>
      <nav className="mobile-nav" aria-label="手机导航">
        {navigation.map(({ path, label, icon: Icon }) => (
          <a
            key={path}
            href={`#${path}`}
            className={isActive(path) ? "active" : ""}
            aria-current={isActive(path) ? "page" : undefined}
          >
            <Icon size={19} strokeWidth={1.7} />
            <span>{label}</span>
          </a>
        ))}
      </nav>
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          {notice}
          <button
            className="icon-button"
            aria-label="关闭提示"
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}

function Home({ revision }: { revision: number }) {
  const [data, setData] = useState<{
    words: Word[];
    favorites: Favorite[];
    practices: PracticeRecord[];
    reviews: WordReview[];
  }>();
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    void Promise.all([
      db.getAll<Word>("words"),
      db.getAll<Favorite>("favorites"),
      db.getAll<PracticeRecord>("practiceRecords"),
      db.getAll<WordReview>("wordReviews"),
    ])
      .then(([words, favorites, practices, reviews]) => {
        if (alive) setData({ words, favorites, practices, reviews });
      })
      .catch((e) => setError(String(e)));
    return () => {
      alive = false;
    };
  }, [revision]);
  const due = data ? getDueWords(data.words).length : 0;
  const day = new Date().toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  const recent = data
    ? [
        ...data.reviews.map((r) => ({
          id: r.id,
          title: `复习了 ${data.words.find((w) => w.id === r.wordId)?.english || "一个单词"}`,
          type: "单词复习",
          date: r.reviewedAt,
          path: "/words",
        })),
        ...data.favorites.map((f) => ({
          id: f.id,
          title:
            f.module === "writing"
              ? "收藏了一条作文表达"
              : "收藏了一条翻译表达",
          type: f.module === "writing" ? "作文积累" : "翻译积累",
          date: f.createdAt,
          path: `/${f.module}`,
        })),
        ...data.practices.map((p) => ({
          id: p.id,
          title: `完成${p.module === "reading" ? "阅读" : p.module === "listening" ? "听力" : p.module === "writing" ? "写作" : "翻译"}练习 · ${p.correct}/${p.total}`,
          type: "练习记录",
          date: p.completedAt,
          path: `/${p.module}`,
        })),
      ]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5)
    : [];
  const cards = [
    {
      path: "listening",
      title: "听力",
      en: "LISTEN & UNDERSTAND",
      desc: "专注听懂，每一处细节。",
      icon: Headphones,
      cls: "blue",
    },
    {
      path: "reading",
      title: "阅读",
      en: "READ & THINK",
      desc: "读懂文章，也读懂逻辑。",
      icon: BookText,
      cls: "orange",
    },
    {
      path: "writing",
      title: "作文",
      en: "COLLECT & EXPRESS",
      desc: "把好表达，变成自己的。",
      icon: NotebookPen,
      cls: "purple",
    },
    {
      path: "translation",
      title: "翻译",
      en: "CONNECT & CONVEY",
      desc: "从字词积累，到准确传达。",
      icon: Languages,
      cls: "green",
    },
  ];
  return (
    <>
      <section className="home-intro">
        <div>
          <div className="eyebrow">
            <span className="tiny-line" /> YOUR PERSONAL STUDY SPACE
          </div>
          <h1>
            把进步，留给<span>每一天。</span>
          </h1>
          <p>不必一次做很多。专注当下这一小步，让积累慢慢发生。</p>
        </div>
        <div className="date-block">
          <span className="date-label">今天，也是新的开始</span>
          <strong>{day}</strong>
          <span>
            <Leaf size={13} /> 保持自己的节奏
          </span>
        </div>
      </section>
      {error && (
        <div className="notice error" role="alert">
          数据加载失败：{error}
        </div>
      )}
      <div className="section-title">
        <h2>
          今日学习<span className="section-en">TODAY'S FOCUS</span>
        </h2>
        <span className="muted small-text">从一个小目标开始</span>
      </div>
      <section className="study-grid" aria-label="今日学习">
        <div className="word-focus">
          <div className="focus-top">
            <span className="focus-icon">
              <BookOpen size={25} strokeWidth={1.5} />
            </span>
            <span className="focus-tag">间隔复习</span>
          </div>
          <div>
            <div className="eyebrow">YOUR WORD NOTEBOOK</div>
            <h2>单词</h2>
            <p>
              让那些总记不住的词，
              <br />
              慢慢成为熟悉的朋友。
            </p>
          </div>
          <div className="due-number">
            <strong>{data ? due : "—"}</strong>
            <span>
              个单词
              <br />
              今日待复习
            </span>
          </div>
          <a href={due ? "#/words/review" : "#/words"} className="focus-button">
            {due
              ? "开始复习"
              : data?.words.length
                ? "查看单词本"
                : "添加第一个错词"}
            <ArrowRight size={17} />
          </a>
          <a href="#/words" className="focus-link">
            查看我的单词本 <ArrowUpRight size={14} />
          </a>
        </div>
        <div className="module-grid">
          {cards.map(({ path, title, en, desc, icon: Icon, cls }) => (
            <a href={`#/${path}`} className="module-card" key={path}>
              <div className="module-top">
                <span className={`module-icon ${cls}`}>
                  <Icon size={23} strokeWidth={1.5} />
                </span>
                <ArrowUpRight className="card-arrow" size={18} />
              </div>
              <h3>{title}</h3>
              <span className="module-en">{en}</span>
              <p>{desc}</p>
            </a>
          ))}
        </div>
      </section>
      <section className="stats-row" aria-label="学习概况">
        {[
          ["错词总数", data?.words.length, BookOpen],
          ["今日待复习", data ? due : undefined, RefreshCw],
          [
            "作文收藏",
            data?.favorites.filter((f) => f.module === "writing").length,
            NotebookPen,
          ],
          [
            "翻译收藏",
            data?.favorites.filter((f) => f.module === "translation").length,
            Languages,
          ],
          [
            "完成练习",
            data
              ? new Set(data.practices.map((p) => p.practiceId)).size
              : undefined,
            ShieldCheck,
          ],
        ].map(([label, count, Icon]) => {
          const StatIcon = Icon as typeof BookOpen;
          return (
            <div className="stat" key={String(label)}>
              <span>
                <StatIcon size={15} />
                {String(label)}
              </span>
              <strong>{count === undefined ? "—" : String(count)}</strong>
            </div>
          );
        })}
      </section>
      <div className="home-bottom">
        <section className="recent-panel">
          <div className="section-title">
            <h2>
              最近学习<span className="section-en">RECENT ACTIVITY</span>
            </h2>
            <LibraryBig size={18} className="muted" />
          </div>
          {!data ? (
            <p className="muted" role="status">
              正在读取学习记录…
            </p>
          ) : recent.length ? (
            <div className="recent-list">
              {recent.map((item) => (
                <a href={`#${item.path}`} key={item.id}>
                  <span className="recent-mark">
                    <Check size={15} />
                  </span>
                  <span className="recent-title">
                    <strong>{item.title}</strong>
                    <small>{item.type}</small>
                  </span>
                  <time>{formatTime(item.date)}</time>
                  <ArrowUpRight size={15} />
                </a>
              ))}
            </div>
          ) : (
            <div className="recent-empty">
              <span className="empty-book">
                <BookOpen size={27} strokeWidth={1.2} />
              </span>
              <div>
                <h3>你的学习故事，从这里开始</h3>
                <p>
                  添加一个错词，或收藏一句喜欢的表达。
                  <br />
                  每一次认真学习，都会留在这里。
                </p>
              </div>
            </div>
          )}
        </section>
        <aside className="daily-note">
          <span className="eyebrow">A THOUGHT TO KEEP</span>
          <span className="quote-mark">“</span>
          <blockquote>
            Small steps, taken consistently,
            <br />
            lead to meaningful progress.
          </blockquote>
          <p>持续迈出小步，也能带来实实在在的进步。</p>
          <div className="daily-note-footer">
            <span />
            今日一句 · 自主整理
          </div>
        </aside>
      </div>
      <div className="home-footnote">
        <ShieldCheck size={16} />
        <span>
          这是只属于你的学习空间。无需登录，数据留在本地；记得定期
          <a href="#/settings">导出备份</a>。
        </span>
      </div>
    </>
  );
}
