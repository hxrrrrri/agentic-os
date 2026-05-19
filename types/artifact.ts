export type ArtifactKind =
  | "markdown"
  | "carousel"
  | "thumbnail"
  | "image"
  | "html"
  | "pdf"
  | "json"
  | "csv"
  | "video-script"
  | "audio";

export type ArtifactFormat = "svg" | "png" | "jpg" | "html" | "md" | "json" | "csv" | "pdf" | "txt";

export interface GeneratedArtifact {
  id: string;
  runId?: string;
  kind: ArtifactKind;
  format: ArtifactFormat;
  /** Relative vault path. */
  path: string;
  /** Display label. */
  title: string;
  /** Optional preview-only thumbnail (vault path). */
  previewPath?: string;
  /** Optional caption/description for UI. */
  caption?: string;
  /** Mime type for browser rendering. */
  mimeType: string;
  bytes?: number;
  width?: number;
  height?: number;
  /** Number of pages/slides for multi-page artifacts. */
  pageCount?: number;
  /** Source skill id. */
  skillId?: string;
  /** When the artifact was created. */
  createdAt: string;
  /** Optional tags. */
  tags?: string[];
  /** Per-variant grouping — multiple variants of same brief. */
  variantGroup?: string;
}

export interface CarouselSlideSpec {
  title?: string;
  body?: string;
  footer?: string;
  /** Optional background color override. */
  background?: string;
}

export interface CarouselRenderSpec {
  title: string;
  slides: CarouselSlideSpec[];
  brand?: BrandKit;
  aspect?: "1:1" | "4:5" | "9:16" | "16:9";
}

export interface ThumbnailRenderSpec {
  title: string;
  subtitle?: string;
  badge?: string;
  brand?: BrandKit;
  aspect?: "16:9" | "1:1" | "9:16";
}

export interface BrandKit {
  name?: string;
  palette: {
    background: string;
    foreground: string;
    accent: string;
    muted: string;
    surface: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
  voice?: string;
  logoSvg?: string;
}
