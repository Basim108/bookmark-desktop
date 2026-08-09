import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import type { ReleaseEntry } from "../../lib/releaseNotes/parse";

/**
 * Where the window was opened from. Each entrance leads with what the user came
 * for: the news when the window announced itself, an introduction to the
 * extension when they went looking for it. The release notes are common to
 * both — only the introduction and the heading are conditional.
 */
export type WhatsNewEntrance = "update" | "about";

const HEADINGS: Record<WhatsNewEntrance, string> = {
  update: "What's new",
  about: "About",
};

/**
 * The project's public links. Kept beside the window rather than derived: only
 * the homepage exists at runtime (via the manifest), and splitting three
 * related links across two sources reads worse than one list that
 * docs/store-submission.md and package.json are the record for.
 */
const LINKS = [
  {
    href: "https://github.com/Basim108/bookmark-desktop#readme",
    label: "GitHub",
  },
  {
    href: "https://github.com/Basim108/bookmark-desktop/issues",
    label: "Report a problem",
  },
  {
    href: "https://basim108.github.io/bookmark-desktop/privacy/",
    label: "Privacy",
  },
];

/**
 * What the extension is, for the entrance where that is the question.
 *
 * Two sentences: what it does, and where the data lives. The second is not
 * filler — "read and change your bookmarks" is one of the permissions Chrome
 * warns about at install, and this is the one place inside the product that
 * answers it. Kept in step with PRIVACY.md and the store listing.
 */
const ABOUT_PARAGRAPHS = [
  "Bookmark Desktop replaces Chrome's new-tab page with a desktop of your own bookmarks — a grid of icons you arrange yourself, with your folders in a sidebar alongside.",
  "Everything stays on this device. Your bookmarks, your layout, and any images you add are held in the browser's own storage and are never sent anywhere.",
];

interface WhatsNewWindowProps {
  /** The running version's notes, parsed from the changelog baked into the bundle. */
  notes: ReleaseEntry;
  entrance: WhatsNewEntrance;
  /**
   * Called on every dismissal route. The caller is what marks the version
   * seen — the window itself never records anything, so rendering it (in a test,
   * or from the About control) has no side effect on what the user is told.
   */
  onClose: () => void;
}

/**
 * Centered, opaque "What's new" window (portaled to document.body), styled to
 * match the Edit Bookmark, Folder Settings, and General Settings windows.
 *
 * It opens itself once after an update and is reachable any time from the
 * General Settings window's About control. It has no Save — there is nothing to
 * stage — so every dismissal route is equivalent, and each one tells the caller
 * the user has now been shown this version.
 *
 * The notes arrive as structured content rather than markdown, so they render
 * as ordinary elements. Nothing here assigns markup, which is what keeps the
 * project's no-raw-HTML rule intact without a sanitizer.
 */
export function WhatsNewWindow({
  notes,
  entrance,
  onClose,
}: WhatsNewWindowProps) {
  const titleId = useId();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className="whats-new-backdrop"
      data-testid="whats-new-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="whats-new-window"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="whats-new-titlebar">
          <span id={titleId} className="whats-new-title">
            {HEADINGS[entrance]}
          </span>
          {/* Named for the window it closes, not just "Close": this window
              stacks above the General Settings window, whose own close control
              is also a bare ✕. Two identically named buttons in one document
              are indistinguishable to assistive technology — the same reasoning
              that named the import toast's live region. */}
          <button
            type="button"
            className="whats-new-close"
            aria-label={`Close ${HEADINGS[entrance]}`}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="whats-new-body">
          {/* Only the About entrance introduces the project. Opened after an
              update, the news is the whole point of the window and a blurb
              above it would bury what the user was brought here to read. */}
          {entrance === "about" && (
            <>
              {ABOUT_PARAGRAPHS.map((paragraph) => (
                <p key={paragraph} className="whats-new-about">
                  {paragraph}
                </p>
              ))}
              <hr className="whats-new-divider" />
              <h2 className="whats-new-section">{HEADINGS.update}</h2>
            </>
          )}

          {notes.headsUp !== undefined && (
            <p className="whats-new-heads-up" role="note">
              {notes.headsUp}
            </p>
          )}

          <ul className="whats-new-changes">
            {notes.changes.map((change) => (
              <li key={change}>{change}</li>
            ))}
          </ul>

          {notes.fixesNote !== undefined && (
            <p className="whats-new-fixes">{notes.fixesNote}</p>
          )}
        </div>

        <div className="whats-new-footer">
          <span className="whats-new-version">
            Bookmark Desktop {notes.version}
          </span>
          <span className="whats-new-links">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
              >
                {link.label}
              </a>
            ))}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
