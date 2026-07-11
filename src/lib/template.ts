/**
 * Templating engine (PRD §6.1).
 *
 * Templates are HTML snippets written by the user in the widget editor, with
 * `{placeholder}` variables bound to data fields (sheet columns or calendar
 * fields). The template itself is trusted (it comes from the local config);
 * interpolated VALUES are escaped so sheet content cannot inject markup.
 */

/** Matches {placeholder}; keys may contain accents/spaces ("{città}"). */
const PLACEHOLDER_RE = /\{([^{}]+)\}/g;

export function interpolate(
  template: string,
  data: Record<string, string>,
): string {
  return template.replace(PLACEHOLDER_RE, (_, rawKey: string) => {
    const key = rawKey.trim();
    return escapeHtml(data[key] ?? "");
  });
}

/** Unique placeholder names used by a template, in order of appearance. */
export function extractPlaceholders(template: string): string[] {
  const seen = new Set<string>();
  for (const match of template.matchAll(PLACEHOLDER_RE)) {
    seen.add(match[1].trim());
  }
  return [...seen];
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
