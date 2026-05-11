"use client";

import { useEffect, useRef, useState } from "react";

type Settings = {
  tickers: string[];
  themes: string[];
  rssFeeds: string[];
  focus: string;
};

type ReportItem = { id: string; createdAt: number; ready: boolean };
type Log = { kind: string; text: string; ts: number };

export default function Home() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [editing, setEditing] = useState(false);
  const [tickersText, setTickersText] = useState("");
  const [themesText, setThemesText] = useState("");
  const [rssText, setRssText] = useState("");
  const [focus, setFocus] = useState("");

  const [reports, setReports] = useState<ReportItem[]>([]);
  const [generating, setGenerating] = useState(false);
  const [logs, setLogs] = useState<Log[]>([]);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadSettings();
    void loadReports();
  }, []);
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  const loadSettings = async () => {
    const r = await fetch("/api/settings");
    const s = await r.json();
    setSettings(s);
    setTickersText(s.tickers.join(", "));
    setThemesText(s.themes.join(", "));
    setRssText(s.rssFeeds.join("\n"));
    setFocus(s.focus ?? "");
  };
  const loadReports = async () => {
    const r = await fetch("/api/reports");
    const j = await r.json();
    setReports(j.reports);
  };

  const saveSettings = async () => {
    const next: Settings = {
      tickers: tickersText.split(",").map((s) => s.trim()).filter(Boolean),
      themes: themesText.split(",").map((s) => s.trim()).filter(Boolean),
      rssFeeds: rssText.split("\n").map((s) => s.trim()).filter(Boolean),
      focus: focus.trim(),
    };
    await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
    setSettings(next);
    setEditing(false);
  };

  const append = (kind: string, text: string) => setLogs((p) => [...p, { kind, text, ts: Date.now() }]);

  const startGenerate = async () => {
    setGenerating(true);
    setLogs([]);
    setActiveReportId(null);
    append("info", "▶ Codex にレポート生成を依頼…");

    const res = await fetch("/api/generate", { method: "POST" });
    if (!res.body) { append("error", "通信失敗"); setGenerating(false); return; }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const raw = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        let ev = "message", data = "";
        for (const line of raw.split("\n")) {
          if (line.startsWith("event: ")) ev = line.slice(7).trim();
          else if (line.startsWith("data: ")) data += line.slice(6);
        }
        if (!data) continue;
        try {
          const obj = JSON.parse(data);
          if (ev === "init") append("info", `生成 ID: ${obj.id}`);
          else if (ev === "heartbeat") {
            setLogs((p) => {
              const idx = p.findIndex((l) => l.kind === "heartbeat");
              const entry: Log = { kind: "heartbeat", text: `⏱ ${obj.elapsedSec}s 経過`, ts: Date.now() };
              if (idx >= 0) { const c = [...p]; c[idx] = entry; return c; }
              return [...p, entry];
            });
          } else if (ev === "step") append(obj.kind || "step", obj.text);
          else if (ev === "agent" && obj.text) append("agent", `🤖 ${obj.text}`);
          else if (ev === "done") {
            setActiveReportId(obj.id);
            append("done", "🎉 完成");
            void loadReports();
          } else if (ev === "error") append("error", obj.message);
        } catch {}
      }
    }
    setGenerating(false);
  };

  if (!settings) return <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">読み込み中…</main>;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <header className="flex items-baseline justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">📈 Stock Report</h1>
            <p className="text-zinc-400 text-sm">Codex が yfinance + RSS でレポートを生成・記録します（外部 API キー不要）</p>
          </div>
        </header>

        {/* Settings */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-md">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <div className="font-semibold">⚙ 設定（監視対象）</div>
            <button onClick={() => setEditing((v) => !v)}
              className="text-xs px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700">{editing ? "閉じる" : "編集"}</button>
          </div>
          {!editing ? (
            <div className="p-4 space-y-2 text-sm">
              <div><span className="text-zinc-500">ティッカー:</span> <span className="font-mono">{settings.tickers.join(", ") || "(未設定)"}</span></div>
              <div><span className="text-zinc-500">関心テーマ:</span> {settings.themes.join(", ") || "(未設定)"}</div>
              <div><span className="text-zinc-500">RSS:</span> <span className="text-zinc-400">{settings.rssFeeds.length} 件</span></div>
              <div><span className="text-zinc-500">観点:</span> {settings.focus || "(デフォルト)"}</div>
            </div>
          ) : (
            <div className="p-4 space-y-3 text-sm">
              <label className="block space-y-1">
                <span className="text-xs text-zinc-400">ティッカー（カンマ区切り、例: AAPL, NVDA, 7203.T）</span>
                <input className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 font-mono" value={tickersText} onChange={(e) => setTickersText(e.target.value)} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-zinc-400">関心テーマ（カンマ区切り）</span>
                <input className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2" value={themesText} onChange={(e) => setThemesText(e.target.value)} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-zinc-400">追加 RSS フィード（1 行 1 URL）</span>
                <textarea className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 font-mono" rows={4} value={rssText} onChange={(e) => setRssText(e.target.value)} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-zinc-400">重視する観点・指示</span>
                <input className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2" value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="例: AI 関連株の中長期トレンド、決算速報を重視" />
              </label>
              <button onClick={saveSettings} className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded text-sm font-medium">保存</button>
            </div>
          )}
        </section>

        {/* Action */}
        <section className="flex items-center gap-3">
          <button onClick={startGenerate} disabled={generating}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500 px-5 py-2.5 rounded-md text-sm font-semibold">
            {generating ? "生成中…" : "🔄 今最新にする"}
          </button>
          <span className="text-xs text-zinc-500">{generating ? "数分かかります" : "クリックで Codex がレポートを 1 件生成"}</span>
        </section>

        {/* Live log */}
        {generating || logs.length > 0 ? (
          <section>
            <h2 className="text-xs uppercase tracking-wider text-zinc-400 mb-2">ライブログ</h2>
            <div className="bg-black border border-zinc-800 rounded-md p-3 max-h-[300px] overflow-y-auto font-mono text-xs space-y-1">
              {logs.map((l, i) => (
                <div key={i} className={kindClass(l.kind)}>
                  <span className="text-zinc-600">{new Date(l.ts).toLocaleTimeString()}</span> {l.text}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
            {activeReportId && (
              <div className="mt-3 flex gap-2">
                <a href={`/api/preview/${activeReportId}/report.html`} target="_blank" rel="noreferrer"
                  className="text-sm bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded">↗ レポートを開く</a>
                <a href={`/api/download/${activeReportId}`}
                  className="text-sm bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded">⬇ ZIP</a>
              </div>
            )}
          </section>
        ) : null}

        {/* Past reports */}
        <section>
          <h2 className="text-sm font-semibold text-zinc-300 mb-2">📚 過去のレポート ({reports.length})</h2>
          {reports.length === 0 ? (
            <p className="text-zinc-500 text-sm">まだありません。上の「今最新にする」を押して 1 件作ってください。</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {reports.map((r) => (
                <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-md p-3 space-y-2">
                  <div className="text-xs text-zinc-500 font-mono">{r.id}</div>
                  <div className="text-xs text-zinc-400">{new Date(r.createdAt).toLocaleString("ja-JP")}</div>
                  {r.ready ? (
                    <div className="flex gap-2">
                      <a href={`/api/preview/${r.id}/report.html`} target="_blank" rel="noreferrer"
                        className="text-xs bg-emerald-700/40 border border-emerald-700 hover:bg-emerald-700/60 px-2 py-1 rounded">↗ 開く</a>
                      <a href={`/api/download/${r.id}`}
                        className="text-xs bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded">⬇ ZIP</a>
                    </div>
                  ) : (
                    <div className="text-xs text-amber-400">未完成</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function kindClass(k: string) {
  switch (k) {
    case "error":
    case "command-err":
    case "stderr": return "text-red-400";
    case "done": return "text-emerald-400 font-semibold";
    case "info":
    case "thread":
    case "turn":
    case "status": return "text-sky-400";
    case "agent": return "text-zinc-100 whitespace-pre-wrap";
    case "command":
    case "command-ok": return "text-zinc-300";
    case "file":
    case "file-ok": return "text-purple-300";
    case "reasoning": return "text-amber-200/70 italic";
    case "plan": return "text-emerald-300";
    case "heartbeat": return "text-zinc-600";
    default: return "text-zinc-500";
  }
}
