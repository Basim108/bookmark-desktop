import { useEffect, useState } from "react";
import { getIcon } from "../../lib/storage/iconDb";

interface CustomIconImageProps {
  itemId: string;
  alt: string;
  /** Bumped by the caller's settings hook after an upload/removal, so this refetches even though itemId is unchanged. */
  version?: number;
}

/**
 * Renders a custom-uploaded icon via an object URL, never inline markup —
 * required by the icon-asset security rules (no format here can carry
 * executable content, but the rendering path stays consistent regardless
 * of format).
 */
export function CustomIconImage({
  itemId,
  alt,
  version = 0,
}: CustomIconImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | undefined;
    void getIcon(itemId).then((blob) => {
      if (cancelled) return;
      if (!blob) {
        setObjectUrl(undefined);
        return;
      }
      createdUrl = URL.createObjectURL(blob);
      setObjectUrl(createdUrl);
    });
    return () => {
      cancelled = true;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [itemId, version]);

  if (!objectUrl) {
    return null;
  }

  return <img src={objectUrl} alt={alt} className="custom-icon" />;
}
