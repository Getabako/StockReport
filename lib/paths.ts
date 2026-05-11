import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const ROOT =
  process.env.STOCKREPORT_DATA_ROOT ?? path.join(os.homedir(), ".stockreport-data");

export const paths = {
  root: ROOT,
  settings: path.join(ROOT, "settings.json"),
  reports: path.join(ROOT, "reports"),
  reportDir(id: string) {
    return path.join(ROOT, "reports", id);
  },
};

export function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

export function newId(): string {
  const ts = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .replace("T", "-");
  const rnd = Math.random().toString(36).slice(2, 6);
  return `${ts}-${rnd}`;
}
