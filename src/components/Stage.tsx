import { useEffect, useRef } from "react";
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

/**
 * Video with a hard stop on unmount (GitHub issue #1): a detached
 * HTMLMediaElement keeps playing its audio until garbage collected, so
 * page changes stacked the soundtracks of consecutive videos.
 */
function StageVideo({
  url,
  muted,
  loop,
  onEnded,
}: {
  url: string;
  muted: boolean;
  loop: boolean;
  onEnded?: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    // play() (re)starts after a StrictMode remount, where the cleanup below
    // already paused this same element; pausing is enough to silence a
    // detached element, and keeping src intact keeps the element reusable.
    video?.play().catch(() => {});
    return () => video?.pause();
  }, []);

  return (
    <video
      ref={ref}
      src={url}
      autoPlay
      muted={muted}
      loop={loop}
      playsInline
      onEnded={onEnded}
      className="h-full w-full object-contain"
    />
  );
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
  const bgUrl = backgroundUrls.get(item.widgetId);
  const bgStyle = bgUrl
    ? {
        backgroundImage: `url(${bgUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;

  if (item.kind === "widget") {
    return (
      <div className="h-full overflow-hidden" style={bgStyle}>
        <AutoFitPage
          items={renderData.get(item.widgetId) ?? []}
          margin={item.margin}
          durationSeconds={page.durationSeconds}
        />
      </div>
    );
  }

  const url = mediaUrls.get(item.fileId);
  const opts = item.options ?? {};

  let media: React.ReactNode = null;
  if (item.mimeType.startsWith("image/") && url) {
    // Default mirrors the editor's select: cover fills the screen.
    const fit =
      (opts.objectFit ?? "cover") === "cover"
        ? "object-cover"
        : "object-contain";
    media = (
      <img src={url} alt={item.name} className={`h-full w-full ${fit}`} />
    );
  } else if (item.mimeType.startsWith("video/") && url) {
    // autoDuration: play once and tell the player to advance; otherwise
    // loop for the fixed page duration.
    media = (
      <StageVideo
        url={url}
        muted={!opts.audioEnabled}
        loop={!opts.autoDuration}
        onEnded={opts.autoDuration ? onMediaEnd : undefined}
      />
    );
  } else if (item.webViewLink) {
    media = (
      <iframe
        src={toEmbedUrl(item.webViewLink)}
        title={item.name}
        className="h-full w-full border-0"
        sandbox="allow-scripts allow-same-origin"
      />
    );
  }
  if (!media) return null;

  // Drive widget background + per-side margins (GitHub issue #2): the media
  // renders inside the margin-inset rectangle, the background fills the page
  // behind it — e.g. a fixed header image with the media below.
  return (
    <div
      className="h-full overflow-hidden"
      style={{ ...bgStyle, padding: item.margin }}
    >
      {media}
    </div>
  );
}
