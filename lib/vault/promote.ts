import fsp from "node:fs/promises";
import path from "node:path";
import { agenticosConfig } from "@/agenticos.config";
import { getPromotionCandidates, markVaultNodeMoved, type VaultNode } from "@/lib/db/repositories";
import { indexVaultGraph } from "@/lib/vault/graph";
import { resolveVaultPath } from "@/lib/vault/service";

export const PROMOTION_THRESHOLD = 3;

export type { VaultNode as PromotionCandidate };

export async function listPromotionCandidates(): Promise<VaultNode[]> {
  return getPromotionCandidates(PROMOTION_THRESHOLD);
}

export async function promoteNote(sourcePath: string): Promise<{ newPath: string }> {
  const root = agenticosConfig.vaultPath;
  const normalized = sourcePath.replace(/\\/g, "/").replace(/^\/+/, "");

  if (!normalized.startsWith("raw/") || normalized.includes("..")) {
    throw new Error(`Only raw/ notes can be promoted (got: ${sourcePath})`);
  }

  // resolveVaultPath enforces the path stays under the vault root.
  const fullSource = resolveVaultPath(normalized);

  const stat = await fsp.stat(fullSource).catch(() => null);
  if (!stat || !stat.isFile()) throw new Error(`Source note not found: ${sourcePath}`);

  const wikiDir = resolveVaultPath("wiki");
  await fsp.mkdir(wikiDir, { recursive: true });

  const filename = path.basename(fullSource);
  let destPath = path.join(wikiDir, filename);

  // avoid collision — suffix if target already exists
  if (await fsp.stat(destPath).catch(() => null)) {
    const stem = filename.replace(/\.md$/, "");
    destPath = path.join(wikiDir, `${stem}-promoted.md`);
  }

  const content = await fsp.readFile(fullSource, "utf8");

  // inject promoted_from field into existing frontmatter, or wrap without one
  const promoted = content.startsWith("---\n")
    ? content.replace(/^---\n/, "---\npromoted_from: raw\n")
    : `---\npromoted_from: raw\n---\n\n${content}`;

  await fsp.writeFile(destPath, promoted, "utf8");
  await fsp.unlink(fullSource);

  const newRelPath = path.relative(root, destPath).replaceAll("\\", "/");
  await markVaultNodeMoved(normalized, newRelPath);

  // re-index so the new path is indexed and backlinks resolve
  void indexVaultGraph().catch(() => {});

  return { newPath: newRelPath };
}
