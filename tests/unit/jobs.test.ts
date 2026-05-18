import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const tmpRoot = path.join(os.tmpdir(), `agenticos-jobs-test-${Date.now()}`);

beforeAll(async () => {
  await fs.mkdir(path.join(tmpRoot, ".agenticos"), { recursive: true });
  await fs.mkdir(path.join(tmpRoot, "vault"), { recursive: true });
  process.chdir(tmpRoot);
  process.env.AGENTICOS_VAULT_PATH = path.join(tmpRoot, "vault");
  process.env.AGENTICOS_DB_PATH = path.join(tmpRoot, ".agenticos", "agenticos.sqlite");
});

afterAll(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe("jobs/queue", () => {
  it("persists and lists a queued job", async () => {
    const { enqueueJob, listJobs } = await import("@/lib/jobs/queue");
    const id = await enqueueJob("test.echo", { hello: "world" });
    const jobs = await listJobs(50);
    const job = jobs.find((j) => j.id === id);
    expect(job).toBeDefined();
    expect(job?.status).toBe("pending");
    expect(job?.payload).toEqual({ hello: "world" });
  });
});
