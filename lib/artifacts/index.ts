import path from "node:path";
import { loadBrandKit } from "@/lib/brand/kit";
import type {
  CarouselRenderSpec,
  GeneratedArtifact,
  ThumbnailRenderSpec,
} from "@/types";
import { renderCarouselIndexHtml, renderCarouselSvgs } from "./carousel";
import { renderThumbnailSvg } from "./thumbnail";
import { generateImage, type ImageGenRequest } from "./image-gen";
import { persistArtifact } from "./persist";
import { dimensionsFor } from "./dimensions";

export interface RenderOptions {
  runId?: string;
  skillId?: string;
  variantGroup?: string;
}

/** End-to-end: render a carousel and persist all slides + HTML index. */
export async function renderCarousel(
  spec: CarouselRenderSpec,
  options: RenderOptions = {},
): Promise<GeneratedArtifact[]> {
  const brand = spec.brand ?? (await loadBrandKit());
  const svgs = renderCarouselSvgs(spec, brand);
  const { w, h } = dimensionsFor(spec.aspect, "1:1");

  const slideArtifacts: GeneratedArtifact[] = [];
  for (let i = 0; i < svgs.length; i += 1) {
    const slideArtifact = await persistArtifact({
      runId: options.runId,
      skillId: options.skillId,
      kind: "carousel",
      format: "svg",
      title: `${spec.title} — Slide ${i + 1}`,
      text: svgs[i],
      caption: spec.slides[i]?.title,
      width: w,
      height: h,
      pageCount: svgs.length,
      tags: ["carousel", `slide-${i + 1}`],
      variantGroup: options.variantGroup,
      subfolder: path.join(options.runId ?? options.skillId ?? "carousel", "slides"),
    });
    slideArtifacts.push(slideArtifact);
  }

  // Embed slide SVGs so the preview works both from the vault and through
  // /api/vault/file, where relative image URLs would otherwise resolve
  // against the API route instead of the attachment folder.
  const embeddedSlides = svgs.map((svg) => `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`);
  const indexHtml = renderCarouselIndexHtml(spec, embeddedSlides, brand);
  const indexArtifact = await persistArtifact({
    runId: options.runId,
    skillId: options.skillId,
    kind: "carousel",
    format: "html",
    title: `${spec.title} — Preview`,
    text: indexHtml,
    pageCount: svgs.length,
    caption: "Open in browser to preview all slides",
    tags: ["carousel", "index"],
    variantGroup: options.variantGroup,
    subfolder: path.join(options.runId ?? options.skillId ?? "carousel", "slides"),
  });

  return [...slideArtifacts, indexArtifact];
}

export async function renderThumbnail(
  spec: ThumbnailRenderSpec,
  options: RenderOptions = {},
): Promise<GeneratedArtifact> {
  const brand = spec.brand ?? (await loadBrandKit());
  const svg = renderThumbnailSvg(spec, brand);
  const { w, h } = dimensionsFor(spec.aspect, "16:9");
  return persistArtifact({
    runId: options.runId,
    skillId: options.skillId,
    kind: "thumbnail",
    format: "svg",
    title: spec.title,
    text: svg,
    caption: spec.subtitle,
    width: w,
    height: h,
    tags: ["thumbnail"],
    variantGroup: options.variantGroup,
  });
}

export async function renderGeneratedImage(
  req: ImageGenRequest,
  title: string,
  options: RenderOptions & { caption?: string } = {},
): Promise<GeneratedArtifact> {
  const result = await generateImage(req);
  const format = result.mimeType === "image/jpeg" ? "jpg" : "png";
  return persistArtifact({
    runId: options.runId,
    skillId: options.skillId,
    kind: "image",
    format,
    title,
    bytes: result.bytes,
    caption: options.caption ?? req.prompt.slice(0, 200),
    tags: ["image", `provider:${result.provider}`],
    variantGroup: options.variantGroup,
  });
}

export { renderCarouselSvgs, renderCarouselIndexHtml } from "./carousel";
export { renderThumbnailSvg } from "./thumbnail";
export { generateImage, imageProviderAvailable } from "./image-gen";
export { persistArtifact } from "./persist";
export { dimensionsFor } from "./dimensions";
