import fs from "node:fs/promises";
import path from "node:path";
import { agenticosConfig } from "@/agenticos.config";
import { ensureVault, resolveVaultPath } from "@/lib/vault/service";
import { createId, nowIso, slugify } from "@/lib/utils";
import type { ArtifactFormat, ArtifactKind, GeneratedArtifact } from "@/types";

const MIME_BY_FORMAT: Record<ArtifactFormat, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  html: "text/html",
  md: "text/markdown",
  json: "application/json",
  csv: "text/csv",
  pdf: "application/pdf",
  txt: "text/plain",
};

export interface PersistArtifactInput {
  runId?: string;
  skillId?: string;
  kind: ArtifactKind;
  format: ArtifactFormat;
  title: string;
  /** Content for text formats. */
  text?: string;
  /** Bytes for binary formats. */
  bytes?: Buffer;
  caption?: string;
  pageCount?: number;
  width?: number;
  height?: number;
  tags?: string[];
  variantGroup?: string;
  /** Subfolder within attachments — defaults to runId/skillId/date. */
  subfolder?: string;
}

function attachmentsDirFor(input: PersistArtifactInput): string {
  const date = new Date().toISOString().slice(0, 10);
  const subfolder = input.subfolder
    ?? input.runId
    ?? input.skillId
    ?? `misc-${date}`;
  return path.join("attachments", subfolder);
}

/** Persist a single artifact under `vault/attachments/<scope>/`. Returns
 *  a GeneratedArtifact record. */
export async function persistArtifact(input: PersistArtifactInput): Promise<GeneratedArtifact> {
  await ensureVault();
  const folder = attachmentsDirFor(input);
  const dir = resolveVaultPath(folder);
  await fs.mkdir(dir, { recursive: true });

  const slug = slugify(input.title) || "artifact";
  const stamp = Date.now();
  const fileName = `${slug}-${stamp}.${input.format}`;
  const fullPath = path.join(dir, fileName);

  if (input.text !== undefined) {
    await fs.writeFile(fullPath, input.text, "utf8");
  } else if (input.bytes) {
    await fs.writeFile(fullPath, input.bytes);
  } else {
    throw new Error("persistArtifact requires text or bytes");
  }

  const relative = path
    .relative(agenticosConfig.vaultPath, fullPath)
    .replaceAll("\\", "/");
  const size = input.bytes?.length ?? input.text?.length ?? 0;

  return {
    id: createId("artifact"),
    runId: input.runId,
    kind: input.kind,
    format: input.format,
    path: relative,
    title: input.title,
    caption: input.caption,
    mimeType: MIME_BY_FORMAT[input.format],
    bytes: size,
    width: input.width,
    height: input.height,
    pageCount: input.pageCount,
    skillId: input.skillId,
    createdAt: nowIso(),
    tags: input.tags,
    variantGroup: input.variantGroup,
  };
}
