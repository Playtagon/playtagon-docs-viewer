import { readFile } from "node:fs/promises";

export async function loadEnv(file = ".env") {
  let raw = "";
  try {
    raw = await readFile(file, "utf8");
  } catch {
    return;
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const key = match[1];
    let value = match[2].trim();
    value = value.replace(/^["']|["']$/g, "");

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
