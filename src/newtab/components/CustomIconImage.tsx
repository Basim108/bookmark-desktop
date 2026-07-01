import { useEffect, useState } from "react";
import { getIcon } from "../../lib/storage/iconDb";

interface CustomIconImageProps {
  itemId: string;
  alt: string;
}

/**
 * Renders a custom-uploaded icon via an object URL, never inline markup —
 * required by the icon-asset security rules (no format here can carry
 * executable content, but the rendering path stays consistent regardless
 * of format for when Group 7 adds upload).
 */
export function CustomIconImage({ itemId, alt }: CustomIconImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | undefined;
    void getIcon(itemId).then((blob) => {
      if (cancelled || !blob) return;
      createdUrl = URL.createObjectURL(blob);
      setObjectUrl(createdUrl);
    });
    return () => {
      cancelled = true;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [itemId]);

  if (!objectUrl) {
    return null;
  }

  return <img src={objectUrl} alt={alt} className="custom-icon" />;
}
