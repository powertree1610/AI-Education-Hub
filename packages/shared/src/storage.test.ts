import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { LocalDiskStorage, formatLocalUrl, parseLocalUrl } from "./storage.js";

test("local URL helpers round-trip", () => {
  const key = "student-1/abc.png";
  assert.equal(formatLocalUrl(key), "local://student-1/abc.png");
  assert.equal(parseLocalUrl("local://student-1/abc.png"), key);
  assert.equal(parseLocalUrl("r2://bucket/key"), null);
  assert.equal(parseLocalUrl("https://x/y"), null);
});

test("LocalDiskStorage put/get/delete round-trip", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "storage-test-"));
  try {
    const storage = new LocalDiskStorage(dir);
    const data = new TextEncoder().encode("hello");
    await storage.put("a/b.txt", data);
    const got = await storage.get("a/b.txt");
    assert.ok(got);
    assert.equal(got.data.toString(), "hello");
    await storage.delete("a/b.txt");
    assert.equal(await storage.get("a/b.txt"), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("LocalDiskStorage rejects path traversal", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "storage-test-"));
  try {
    const storage = new LocalDiskStorage(dir);
    await assert.rejects(() => storage.get("../outside.txt"), /Invalid storage key/);
    await assert.rejects(
      () => storage.put("..\\outside.txt", new Uint8Array([1])),
      /Invalid storage key/,
    );
    await assert.rejects(() => storage.delete("a/../../outside"), /Invalid storage key/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
