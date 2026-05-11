import fs from "node:fs";
import { paths, ensureDir } from "@/lib/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT = {
  tickers: ["AAPL", "NVDA", "MSFT"],
  themes: ["AI", "半導体"],
  rssFeeds: [
    "https://nvidianews.nvidia.com/releases.xml",
    "https://news.microsoft.com/feed/",
  ],
  focus: "AI 関連株の中長期トレンドとニュース",
};

export async function GET() {
  try {
    const txt = fs.readFileSync(paths.settings, "utf8");
    return Response.json(JSON.parse(txt));
  } catch {
    return Response.json(DEFAULT);
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  ensureDir(paths.root);
  fs.writeFileSync(paths.settings, JSON.stringify(body, null, 2));
  return Response.json({ ok: true });
}
