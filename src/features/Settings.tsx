import { useEffect, useState, type ChangeEvent } from "react";
import {
  Download,
  Upload,
  ShieldCheck,
  Sun,
  Moon,
  Monitor,
  Trash2,
  HardDrive,
  Wifi,
  CheckCircle2,
} from "lucide-react";
import { db, clearLearningData } from "../storage/db";
import {
  exportBackup,
  validateBackup,
  restoreBackup,
  type LearningBackup,
} from "../storage/backup";
import { Modal, PageHeading, errorMessage } from "../components/ui";

export default function Settings({
  onChange,
  notify,
}: {
  onChange: () => void;
  notify: (v: string) => void;
}) {
  const [theme, setTheme] = useState(
    localStorage.getItem("cet6-theme") || "system",
  );
  const [backup, setBackup] = useState<LearningBackup>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [storage, setStorage] = useState<{
    usage?: number;
    quota?: number;
    persistent?: boolean;
  }>({});
  const [clear, setClear] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [offline, setOffline] = useState("正在检查…");
  const estimate = async () => {
    const e = await navigator.storage?.estimate?.();
    const p = await navigator.storage?.persisted?.();
    setStorage({ ...e, persistent: p });
  };
  useEffect(() => {
    void estimate().catch(() => {});
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker
        .getRegistration()
        .then((r) =>
          setOffline(
            r?.active
              ? "已启用核心页面离线缓存"
              : import.meta.env.DEV
                ? "开发模式 · 正式构建后启用离线缓存"
                : "尚未就绪，请联网刷新一次",
          ),
        )
        .catch(() => setOffline("当前浏览器未能启用离线缓存"));
    else setOffline("当前浏览器不支持离线缓存");
  }, []);
  const changeTheme = async (value: string) => {
    try {
      await db.put("settings", { id: "theme", value });
      localStorage.setItem("cet6-theme", value);
      setTheme(value);
      document.documentElement.dataset.theme =
        value === "system"
          ? matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : value;
      onChange();
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const download = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await exportBackup();
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `cet6-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify("备份已导出，请妥善保存下载的 JSON 文件");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const readBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    try {
      if (file.size > 50 * 1024 * 1024)
        throw new Error("备份文件超过 50 MB，请确认文件是否正确。");
      setBackup(validateBackup(await file.text()));
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="SETTINGS · YOUR OWN SPACE"
        title="设置与数据管理"
        description="照顾好你的学习积累，也让这里用起来更顺手。"
      />
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <div className="settings-layout">
        <section className="settings-main">
          <div className="panel settings-panel">
            <h2>外观</h2>
            <p className="muted">选一个适合现在的阅读环境。</p>
            <div className="theme-options">
              {[
                { v: "light", label: "浅色", Icon: Sun },
                { v: "dark", label: "深色", Icon: Moon },
                { v: "system", label: "跟随系统", Icon: Monitor },
              ].map(({ v, label, Icon }) => (
                <button
                  key={v}
                  className={`theme-option ${theme === v ? "active" : ""}`}
                  aria-pressed={theme === v}
                  onClick={() => void changeTheme(v)}
                >
                  <Icon size={22} strokeWidth={1.5} />
                  <span>{label}</span>
                  {theme === v && <CheckCircle2 size={15} />}
                </button>
              ))}
            </div>
          </div>
          <div className="panel settings-panel">
            <h2>备份与恢复</h2>
            <p className="muted">
              把积累带走，也随时可以找回来。建议每周备份一次。
            </p>
            <div className="setting-row">
              <span className="setting-icon">
                <Download size={20} />
              </span>
              <div>
                <h3>导出学习数据</h3>
                <p>包含单词、复习记录、个人表达、收藏、练习记录和设置。</p>
              </div>
              <button
                className="btn"
                onClick={() => void download()}
                disabled={busy}
              >
                {busy ? "处理中…" : "导出备份"}
              </button>
            </div>
            <div className="setting-row">
              <span className="setting-icon">
                <Upload size={20} />
              </span>
              <div>
                <h3>从备份恢复</h3>
                <p>验证通过并经你确认后，替换现有学习数据。</p>
              </div>
              <label className="btn file-button">
                选择备份
                <input
                  aria-label="选择备份文件"
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => void readBackup(e)}
                />
              </label>
            </div>
            <p className="settings-hint">
              音频文件不包含在 JSON 备份中，请保留原始
              MP3。恢复备份会保留当前浏览器已导入的音频。
            </p>
          </div>
          <div className="panel settings-panel">
            <h2>本地存储与离线</h2>
            <div className="setting-row">
              <span className="setting-icon">
                <HardDrive size={20} />
              </span>
              <div>
                <h3>
                  {storage.usage === undefined
                    ? "浏览器存储"
                    : `已使用 ${(storage.usage / 1024 / 1024).toFixed(1)} MB`}
                </h3>
                <p>
                  {storage.persistent
                    ? "浏览器已授予持久存储。"
                    : "浏览器可能在空间不足时清理本地数据。"}
                </p>
              </div>
              <button
                className="btn"
                disabled={storage.persistent}
                onClick={async () => {
                  try {
                    const granted = await navigator.storage?.persist?.();
                    await estimate();
                    notify(
                      granted
                        ? "已授予持久存储，仍建议定期备份"
                        : "浏览器未授予持久存储，请继续定期备份",
                    );
                  } catch (e) {
                    setError(errorMessage(e));
                  }
                }}
              >
                {storage.persistent ? "已保护" : "申请持久存储"}
              </button>
            </div>
            <div className="setting-row">
              <span className="setting-icon">
                <Wifi size={20} />
              </span>
              <div>
                <h3>离线使用</h3>
                <p>{offline}</p>
              </div>
            </div>
            <div className="notice subtle-notice">
              手机添加到主屏幕：iPhone 使用 Safari → 分享 →
              添加到主屏幕；Android
              使用浏览器菜单中的“安装应用”或“添加到主屏幕”。首次联网加载后，可离线使用核心页面、单词复习和个人积累。
            </div>
          </div>
          <div className="panel settings-panel danger-panel">
            <h2>清空学习记录</h2>
            <p className="muted">
              移除所有单词、复习记录、个人积累、收藏、练习记录与本地音频。保留外观设置和预置内容。
            </p>
            <button
              className="btn danger"
              onClick={() => {
                setConfirmText("");
                setClear(true);
              }}
            >
              <Trash2 size={16} />
              清空学习数据
            </button>
          </div>
        </section>
        <aside className="settings-aside panel">
          <span className="privacy-icon">
            <ShieldCheck size={27} strokeWidth={1.4} />
          </span>
          <h2>你的积累，留在你这里</h2>
          <p>
            无需账号，也没有云端同步。学习数据只保存在当前设备、当前浏览器的网站存储中。
          </p>
          <p>
            更换浏览器、清除网站数据或使用隐私模式，都可能失去这些记录。导出备份后，可以在另一台设备导入。
          </p>
          <div className="aside-divider" />
          <span className="eyebrow">六级备考</span>
          <p className="small-text">
            版本 1.0.0
            <br />
            一个专注于日常积累的个人学习工具。
          </p>
        </aside>
      </div>
      {backup && (
        <Modal title="确认恢复备份" onClose={() => setBackup(undefined)}>
          <p>备份时间：{new Date(backup.exportedAt).toLocaleString("zh-CN")}</p>
          <div className="backup-counts">
            <span>单词 {backup.data.words.length}</span>
            <span>复习记录 {backup.data.wordReviews.length}</span>
            <span>
              个人表达{" "}
              {backup.data.writingExpressions.length +
                backup.data.translationExpressions.length}
            </span>
            <span>收藏 {backup.data.favorites.length}</span>
            <span>练习记录 {backup.data.practiceRecords.length}</span>
          </div>
          <p className="notice error">
            恢复会替换当前全部学习数据。建议先导出当前数据；本地音频文件保留。
          </p>
          <div className="modal-actions">
            <button
              className="btn"
              onClick={() => setBackup(undefined)}
              disabled={busy}
            >
              取消
            </button>
            <button
              className="btn primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await restoreBackup(backup);
                  setBackup(undefined);
                  const t = await db.get<{ id: string; value: string }>(
                    "settings",
                    "theme",
                  );
                  localStorage.setItem("cet6-theme", t?.value || "system");
                  setTheme(t?.value || "system");
                  onChange();
                  notify("备份已恢复");
                } catch (e) {
                  setError(errorMessage(e));
                  setBackup(undefined);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "恢复中…" : "确认替换并恢复"}
            </button>
          </div>
        </Modal>
      )}
      {clear && (
        <Modal title="确认清空学习数据" onClose={() => setClear(false)}>
          <p>此操作无法撤销。请先确认已经导出需要保留的备份。</p>
          <label className="field">
            输入“清空”进行第二次确认
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="清空"
              autoComplete="off"
            />
          </label>
          <div className="modal-actions">
            <button className="btn" onClick={() => setClear(false)}>
              取消
            </button>
            <button
              className="btn danger"
              disabled={confirmText !== "清空" || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await clearLearningData();
                  setClear(false);
                  onChange();
                  await estimate();
                  notify("学习数据已清空");
                } catch (e) {
                  setError(errorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              永久清空学习数据
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
