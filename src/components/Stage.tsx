import type { RenderItem } from "../lib/widgetData";
import type { ResolvedPage } from "../lib/timeline";

interface Props {
  page: ResolvedPage;
  renderData: Map<string, RenderItem[]>;
  mediaUrls: Map<string, string>;
}

/** Google native files embed via /preview instead of /edit. */
export function toEmbedUrl(webViewLink: string): string {
  return webViewLink.replace(/\/(edit|view)([?#].*)?$/, "/preview");
}

/** Renders the current timeline page: widget HTML, image, video or iframe. */
export default function Stage({ page, renderData, mediaUrls }: Props) {
  const { item } = page;

  if (item.kind === "widget") {
    const items = renderData.get(item.widgetId) ?? [];
    return (
      <div className="flex h-full flex-col items-center justify-center gap-10 overflow-hidden p-12 text-center">
        {items.map((it, i) => (
          // Template HTML comes from the local config (trusted); data values
          // inside it are escaped by interpolate().
          <div key={i} dangerouslySetInnerHTML={{ __html: it.html }} />
        ))}
      </div>
    );
  }

  const url = mediaUrls.get(item.fileId);
  if (item.mimeType.startsWith("image/") && url) {
    return (
      <img
        src={url}
        alt={item.name}
        className="h-full w-full object-contain"
      />
    );
  }
  if (item.mimeType.startsWith("video/") && url) {
    return (
      <video
        src={url}
        autoPlay
        muted
        loop
        playsInline
        className="h-full w-full object-contain"
      />
    );
  }
  if (item.webViewLink) {
    return (
      <iframe
        src={toEmbedUrl(item.webViewLink)}
        title={item.name}
        className="h-full w-full border-0"
        sandbox="allow-scripts allow-same-origin"
      />
    );
  }
  return null;
}
