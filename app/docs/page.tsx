import { DocsViewer } from "@/components/docs/docs-viewer";
import { listDocs } from "@/lib/docs/sources";

export const dynamic = "force-dynamic";

export default async function DocsPage() {
  const docs = await listDocs();
  return <DocsViewer initialDocs={docs} />;
}
