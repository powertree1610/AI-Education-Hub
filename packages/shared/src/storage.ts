import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * File storage behind a swappable interface. v1 ships LocalDiskStorage
 * (Windows Server IIS deployment); R2/S3 can implement the same interface
 * later without touching callers. work_samples.file_url stores
 * `local://<key>` so the scheme survives a backend swap.
 */
export interface StorageProvider {
  put(key: string, data: Uint8Array, contentType?: string): Promise<void>;
  get(key: string): Promise<{ data: Buffer; contentType?: string } | null>;
  delete(key: string): Promise<void>;
}

const LOCAL_SCHEME = "local://";

export function formatLocalUrl(key: string): string {
  return `${LOCAL_SCHEME}${key}`;
}

/** Returns the storage key, or null if the URL is not a local:// URL. */
export function parseLocalUrl(url: string): string | null {
  return url.startsWith(LOCAL_SCHEME) ? url.slice(LOCAL_SCHEME.length) : null;
}

/** Reject keys that could escape the storage root. */
function safeJoin(rootDir: string, key: string): string {
  const resolved = path.resolve(rootDir, key);
  const root = path.resolve(rootDir);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`Invalid storage key: ${key}`);
  }
  return resolved;
}

export class LocalDiskStorage implements StorageProvider {
  constructor(private readonly rootDir: string) {}

  async put(key: string, data: Uint8Array): Promise<void> {
    const filePath = safeJoin(this.rootDir, key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
  }

  async get(key: string): Promise<{ data: Buffer } | null> {
    const filePath = safeJoin(this.rootDir, key);
    try {
      return { data: await readFile(filePath) };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = safeJoin(this.rootDir, key);
    try {
      await unlink(filePath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }
}
