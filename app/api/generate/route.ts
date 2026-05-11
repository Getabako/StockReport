import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { getCodex } from "@/lib/codex/client";
import { paths, ensureDir, newId } from "@/lib/paths";
import { buildCodexPrompt, StockSettings } from "@/lib/prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let settings: StockSettings;
  try {
    settings = JSON.parse(fs.readFileSync(paths.settings, "utf8"));
  } catch {
    return new Response("先に設定を保存してください", { status: 400 });
  }
  if (!settings.tickers?.length && !settings.themes?.length) {
    return new Response("ティッカー or テーマを 1 つ以上指定してください", { status: 400 });
  }

  const id = newId();
  const reportDir = paths.reportDir(id);
  ensureDir(reportDir);
  ensureDir(path.join(reportDir, "charts"));

  const prompt = buildCodexPrompt(settings, id);
  const srv = await getCodex();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {}
      };
      const close = () => { if (closed) return; closed = true; try { controller.close(); } catch {} };

      send("init", { id, reportDir });
      let threadId: string | null = null;
      let turnId: string | null = null;
      let turnDone = false;
      const startedAt = Date.now();

      const heartbeat = setInterval(() => {
        send("heartbeat", { elapsedSec: Math.floor((Date.now() - startedAt) / 1000) });
      }, 3000);
      const onStderr = (text: string) => { const t = text.trim(); if (t) send("stderr", { text: t.slice(0, 500) }); };
      srv.on("stderr", onStderr);

      const onNotif = (notif: any) => {
        const { method, params } = notif;
        if (!params) return;
        switch (method) {
          case "thread/started": threadId = params.thread?.id; send("step", { kind: "thread", text: `🧵 ${threadId}` }); return;
          case "thread/status/changed":
            if (params.status?.type) {
              send("step", { kind: params.status.type === "systemError" ? "error" : "status", text: `status: ${params.status.type}` });
              if (params.status.type === "systemError") turnDone = true;
            }
            return;
          case "turn/plan/updated": {
            const plan = (params.plan ?? []) as Array<{ step: string; status: string }>;
            const summary = plan.map((p) => `${p.status === "completed" ? "✓" : p.status === "inProgress" ? "▸" : "·"} ${p.step}`).join(" / ");
            if (summary) send("step", { kind: "plan", text: `📋 ${summary}` });
            return;
          }
          case "item/started": {
            const item = params.item;
            if (!item) return;
            if (item.type === "agentMessage") return;
            if (item.type === "reasoning") send("step", { kind: "reasoning", text: "🧠 思考中…" });
            else if (item.type === "commandExecution") {
              const cmd = Array.isArray(item.command) ? item.command.join(" ") : String(item.command ?? "");
              send("step", { kind: "command", text: `$ ${cmd.slice(0, 200)}` });
            } else if (item.type === "fileChange") {
              const files = (item.changes || []).map((c: any) => c.path).join(", ");
              send("step", { kind: "file", text: `📄 ${files}` });
            } else send("step", { kind: "info", text: `▸ ${item.type}` });
            return;
          }
          case "item/agentMessage/delta": send("delta", { text: params.delta ?? "" }); return;
          case "item/reasoning/summaryTextDelta": send("reasoning_delta", { text: params.delta ?? "" }); return;
          case "item/commandExecution/outputDelta": send("cmd_output", { text: String(params.chunk ?? params.output ?? "").slice(0, 200) }); return;
          case "item/completed": {
            const item = params.item;
            if (!item) return;
            if (item.type === "agentMessage" && item.text) send("agent", { text: item.text });
            else if (item.type === "commandExecution") {
              send("step", { kind: item.exitCode === 0 ? "command-ok" : "command-err", text: `↳ exit ${item.exitCode}` });
            } else if (item.type === "fileChange") {
              const files = (item.changes || []).map((c: any) => c.path).join(", ");
              send("step", { kind: "file-ok", text: `✓ ${files}` });
            }
            return;
          }
          case "turn/completed": turnDone = true; return;
        }
      };
      srv.on("notification", onNotif);
      const cleanup = () => { clearInterval(heartbeat); srv.off("notification", onNotif); srv.off("stderr", onStderr); };

      req.signal.addEventListener("abort", () => {
        if (threadId && turnId) srv.send("turn/interrupt", { threadId, turnId }).catch(() => {});
        cleanup(); close();
      });

      try {
        const model = process.env.STOCKREPORT_MODEL || "gpt-5.5";
        const effort = process.env.STOCKREPORT_EFFORT || "medium";
        send("step", { kind: "info", text: `thread/start (model=${model}, effort=${effort})` });
        const started: any = await srv.send("thread/start", {
          cwd: reportDir, model, effort,
          sandbox: "workspace-write", approvalPolicy: "never",
          serviceName: "stockreport",
        });
        threadId = started.thread.id;

        const turn: any = await srv.send("turn/start", {
          threadId,
          input: [{ type: "text", text: prompt }],
          cwd: reportDir, model, effort,
          sandboxPolicy: { type: "workspaceWrite", writableRoots: [reportDir], networkAccess: true },
          approvalPolicy: "never",
        });
        turnId = turn.turn.id;

        await new Promise<void>((resolve) => {
          const tick = setInterval(() => { if (turnDone) { clearInterval(tick); resolve(); } }, 200);
          req.signal.addEventListener("abort", () => { clearInterval(tick); resolve(); });
        });

        const reportPath = path.join(reportDir, "report.html");
        if (!fs.existsSync(reportPath)) {
          send("error", { message: "report.html が生成されませんでした" });
          cleanup(); close(); return;
        }
        const chartsDir = path.join(reportDir, "charts");
        const chartCount = fs.existsSync(chartsDir)
          ? fs.readdirSync(chartsDir).filter((f) => /\.(png|jpe?g|svg)$/i.test(f)).length
          : 0;
        send("step", { kind: "done", text: `🎉 完成: HTML ${(fs.statSync(reportPath).size / 1024).toFixed(1)} KB, チャート ${chartCount} 枚` });
        send("done", { id });
      } catch (err) {
        send("error", { message: (err as Error).message });
      } finally {
        cleanup(); close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
