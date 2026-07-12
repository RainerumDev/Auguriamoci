import type { RenderItem } from "../lib/widgetData";
import type { ResolvedPage } from "../lib/timeline";
import AutoFitPage from "./AutoFitPage";

interface Props {
  page: ResolvedPage;
  renderData: Map<string, RenderItem[]>;
  mediaUrls: Map<string, string>;
  backgroundUrls: Map<string, string>;
  /** Called when an auto-duration video finishes: the player advances. */
  onMediaEnd?: () => void;
}

/** Google native files embed via /preview instead of /edit. */
export function toEmbedUrl(webViewLink: string): string {
  return webViewLink.replace(/\/(edit|view)([?#].*)?$/, "/preview");
}

/** Renders the current timeline page: widget HTML, image, video or iframe. */
export default function Stage({
  page,
  renderData,
  mediaUrls,
  backgroundUrls,
  onMediaEnd,
}: Props) {
  const { item } = page;

  if (item.kind === "widget") {
    const items = renderData.get(item.widgetId) ?? [];
    const bgUrl = backgroundUrls.get(item.widgetId);
    return (
      <div
        className="h-full overflow-hidden"
        style={
          bgUrl
            ? {
                backgroundImage: `url(${bgUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        <AutoFitPage
          items={items}
          margin={item.margin}
          durationSeconds={page.durationSeconds}
        />
      </div>
    );
  }

  const url = mediaUrls.get(item.fileId);
  const opts = item.options ?? {};
  if (item.mimeType.startsWith("image/") && url) {
    // Default mirrors the editor's select: cover fills the screen.
    const fit =
      (opts.objectFit ?? "cover") === "cover"
        ? "object-cover"
        : "object-contain";
    return <img src={url} alt={item.name} className={`h-full w-full ${fit}`} />;
  }
  if (item.mimeType.startsWith("video/") && url) {
    // autoDuration: play once and tell the player to advance; otherwise
    // loop for the fixed page duration.
    return (
      <video
        src={url}
        autoPlay
        muted={!opts.audioEnabled}
        loop={!opts.autoDuration}
        playsInline
        onEnded={opts.autoDuration ? onMediaEnd : undefined}
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
