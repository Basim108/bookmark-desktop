import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { getCanvasBackground } from "../../lib/storage/canvasBackground";
import { getGeneralSettings } from "../../lib/storage/generalSettings";
import { onStorageKeysChanged } from "../../lib/storage/onChanged";
import { STORAGE_KEYS } from "../../lib/storage/schema";
import type { BackgroundFit, CanvasBackground } from "../../lib/storage/schema";

/** Maps a fit mode to the CSS background-size value; center shows the image at its natural size. */
function backgroundSizeFor(fit: BackgroundFit): string {
  if (fit === "cover") return "cover";
  if (fit === "contain") return "contain";
  return "auto";
}

function backgroundStyleFor(url: string, fit: BackgroundFit): CSSProperties {
  return {
    backgroundImage: `url("${url}")`,
    backgroundSize: backgroundSizeFor(fit),
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  };
}

/**
 * Loads the canvas background and derives the CSS style to apply to the canvas.
 * Owns the object-URL lifecycle for the uploaded image (a CSS `background-image`
 * has no unmount hook of its own, unlike an `<img>`), revoking the previous URL
 * when the background changes or the hook unmounts. Live-updates when the
 * general settings change from any open new-tab page (this one or another).
 */
export function useCanvasBackground(): {
  /** The saved background metadata (presence + fit). */
  background: CanvasBackground;
  /** Object URL of the saved background image, or undefined when none is set. */
  backgroundUrl: string | undefined;
  /** CSS style to apply to the canvas element (empty when no background). */
  style: CSSProperties;
  /** Re-reads the background, e.g. after the settings window saves. */
  reload: () => void;
} {
  const [background, setBackground] = useState<CanvasBackground>({
    kind: "none",
  });
  const [backgroundUrl, setBackgroundUrl] = useState<string | undefined>(
    undefined,
  );
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | undefined;
    void (async () => {
      const settings = await getGeneralSettings();
      if (cancelled) return;
      setBackground(settings.background);
      if (settings.background.kind !== "upload") {
        setBackgroundUrl(undefined);
        return;
      }
      const blob = await getCanvasBackground();
      if (cancelled) return;
      if (!blob) {
        setBackgroundUrl(undefined);
        return;
      }
      createdUrl = URL.createObjectURL(blob);
      setBackgroundUrl(createdUrl);
    })();
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [reloadToken]);

  useEffect(
    () =>
      onStorageKeysChanged([STORAGE_KEYS.GENERAL_SETTINGS], () =>
        setReloadToken((token) => token + 1),
      ),
    [],
  );

  const style = useMemo<CSSProperties>(() => {
    if (background.kind !== "upload" || !backgroundUrl) return {};
    return backgroundStyleFor(backgroundUrl, background.fit);
  }, [background, backgroundUrl]);

  return {
    background,
    backgroundUrl,
    style,
    reload: () => setReloadToken((token) => token + 1),
  };
}
