import "server-only";
import path from "node:path";
import { LocalDiskStorage, type StorageProvider } from "@platform/shared";

const globalForStorage = globalThis as unknown as { __storage?: StorageProvider };

/**
 * v1: local disk (Windows Server IIS deployment). UPLOAD_DIR may be absolute
 * (recommended in production) or relative to the web app's cwd in dev.
 * Swap R2/S3 in later by returning a different StorageProvider here.
 */
export function getStorage(): StorageProvider {
  if (!globalForStorage.__storage) {
    const dir = process.env.UPLOAD_DIR || "./uploads";
    globalForStorage.__storage = new LocalDiskStorage(path.resolve(dir));
  }
  return globalForStorage.__storage;
}
