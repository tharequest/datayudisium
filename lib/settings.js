import fs from 'node:fs/promises';
import path from 'node:path';

const KEY = 'yudisium:settings';
const FILE = path.join(process.cwd(), '.data', 'settings.json');

function defaults() {
  return {
    sheetUrl: process.env.DEFAULT_SHEET_URL || '',
    periode: process.env.DEFAULT_PERIODE || 'I',
    tahunAjar: process.env.DEFAULT_TAHUN_AJAR || '2026/2027',
    updatedAt: null,
  };
}

function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

async function redis(command) {
  const c = redisConfig();
  const res = await fetch(c.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Redis error ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.result;
}

/** 'redis' = tersimpan permanen, 'file' = lokal (dev), 'none' = di Vercel tanpa storage (tidak bisa simpan) */
export function storageMode() {
  if (redisConfig()) return 'redis';
  return process.env.VERCEL ? 'none' : 'file';
}

export async function getSettings() {
  const d = defaults();
  try {
    if (redisConfig()) {
      const v = await redis(['GET', KEY]);
      return v ? { ...d, ...JSON.parse(v) } : d;
    }
    if (!process.env.VERCEL) {
      return { ...d, ...JSON.parse(await fs.readFile(FILE, 'utf8')) };
    }
  } catch {
    /* belum ada pengaturan tersimpan -> pakai default */
  }
  return d;
}

export async function saveSettings(input) {
  const data = {
    sheetUrl: input.sheetUrl,
    periode: input.periode,
    tahunAjar: input.tahunAjar,
    updatedAt: new Date().toISOString(),
  };
  if (redisConfig()) {
    await redis(['SET', KEY, JSON.stringify(data)]);
    return data;
  }
  if (process.env.VERCEL) throw new Error('NO_STORAGE');
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(data, null, 2));
  return data;
}
