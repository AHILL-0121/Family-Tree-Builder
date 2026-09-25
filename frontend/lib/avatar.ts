// Convert image file to base64 data URL
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

// First user-perceived character. Tamil letters are often several code points
// (e.g. "நா" is ந + ா), so slicing by code unit would split them.
export function firstGrapheme(text: string): string {
  const s = text.trim();
  if (!s) return "";
  if (segmenter) {
    for (const { segment } of segmenter.segment(s)) return segment.toUpperCase();
  }
  return Array.from(s)[0].toUpperCase();
}

// Get initials from name
export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map(firstGrapheme)
    .slice(0, 2)
    .join("");
}

const AVATAR_COLORS: Record<string, string> = {
  male: "#3b82f6",
  female: "#ec4899",
  other: "#6b7280",
  "": "#6b7280",
};

// SVG avatar with the person's initial, as a data URL. Uses percent-encoding rather than
// btoa(), which throws on any character outside Latin-1 (every Tamil letter).
export function initialAvatarDataUrl(name: string, gender: string): string {
  const bg = AVATAR_COLORS[gender] ?? AVATAR_COLORS[""];
  const initial = (firstGrapheme(name) || "?")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="${bg}"/><text x="50" y="50" dy="0.35em" text-anchor="middle" fill="#ffffff" font-size="40" font-family="Arial, sans-serif" font-weight="bold">${initial}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// Validate if URL is a valid image URL
export function isValidImageUrl(url: string): boolean {
  if (!url) return false;

  // Check if it's a data URL
  if (url.startsWith("data:image/")) return true;

  // Only allow web URLs (no javascript:, file:, etc.)
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}
