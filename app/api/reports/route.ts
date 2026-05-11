import fs from "node:fs";
import path from "node:path";
import { paths } from "@/lib/paths";

export const runtime = "nodejs";

export async function GET() {
  if (!fs.existsSync(paths.reports)) return Response.json({ reports: [] });
  const ids = fs.readdirSync(paths.reports)
    .filter((d) => fs.statSync(path.join(paths.reports, d)).isDirectory())
    .sort()
    .reverse();
  const reports = ids.map((id) => {
    const dir = path.join(paths.reports, id);
    const hasReport = fs.existsSync(path.join(dir, "report.html"));
    const stat = fs.statSync(dir);
    return {
      id,
      createdAt: stat.birthtimeMs || stat.mtimeMs,
      ready: hasReport,
    };
  });
  return Response.json({ reports });
}
