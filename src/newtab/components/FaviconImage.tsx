import { useState } from "react";
import { getFaviconUrl } from "../../lib/icons/favicon";

interface FaviconImageProps {
  url: string;
  size: number;
  alt: string;
}

/**
 * Renders a bookmark's favicon via the MV3 `_favicon` API, falling back to
 * a generic placeholder if the favicon can't be resolved. The placeholder
 * is a stand-in until product supplies a final fallback asset (see
 * design.md's Open Questions).
 */
export function FaviconImage({ url, size, alt }: FaviconImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <span className="favicon-fallback" aria-hidden="true" />;
  }

  return (
    <img
      src={getFaviconUrl(url, size)}
      alt={alt}
      className="favicon-image"
      onError={() => setFailed(true)}
    />
  );
}
