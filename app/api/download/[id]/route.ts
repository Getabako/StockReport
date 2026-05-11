import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { paths } from "@/lib/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!/^[\w-]+$/.test(id)) {
    return new Response("bad id", { status: 400 });
  }
  const projectDir = paths.reportDir(id);
  if (!fs.existsSync(projectDir)) {
    return new Response("not found", { status: 404 });
  }

  const zip = new AdmZip();

  const reportPath = path.join(projectDir, "report.html");
  if (fs.existsSync(reportPath)) {
    zip.addLocalFile(reportPath);
  }
  const chartsDir = path.join(projectDir, "charts");
  if (fs.existsSync(chartsDir) && fs.statSync(chartsDir).isDirectory()) {
    zip.addLocalFolder(chartsDir, "charts");
  }
  const dataPath = path.join(projectDir, "data.json");
  if (fs.existsSync(dataPath)) {
    zip.addLocalFile(dataPath);
  }

  const buf = zip.toBuffer();
  return new Response(buf, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="report-${id}.zip"`,
      "Cache-Control": "no-store",
      "Content-Length": String(buf.length),
    },
  });
}
