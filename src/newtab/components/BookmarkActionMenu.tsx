import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onCopy: () => void;
  onMove: () => void;
  onSettings: () => void;
  onClose: () => void;
}

export function BookmarkActionMenu({
  anchorRef,
  onCopy,
  onMove,
  onSettings,
  onClose,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    const anchor = anchorRef.current?.getBoundingClientRect();
    const menu = menuRef.current;
    if (!anchor || !menu) return;
    const gap = 6;
    const width = menu.offsetWidth || 150;
    const height = menu.offsetHeight || 116;
    let left = anchor.right - width;
    let top = anchor.bottom + gap;
    if (left < 8) left = anchor.left;
    if (left + width > window.innerWidth - 8)
      left = window.innerWidth - width - 8;
    if (top + height > window.innerHeight - 8) top = anchor.top - height - gap;
    setPosition({ left: Math.max(8, left), top: Math.max(8, top) });
    itemsRef.current[0]?.focus();
  }, [anchorRef]);

  useEffect(() => {
    function closeAndRestore() {
      onClose();
      anchorRef.current?.focus();
    }
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        !menuRef.current?.contains(target) &&
        !anchorRef.current?.contains(target)
      )
        closeAndRestore();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAndRestore();
        return;
      }
      if (
        event.key !== "ArrowDown" &&
        event.key !== "ArrowUp" &&
        event.key !== "Home" &&
        event.key !== "End"
      )
        return;
      event.preventDefault();
      const current = itemsRef.current.indexOf(
        document.activeElement as HTMLButtonElement,
      );
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? 2
            : event.key === "ArrowDown"
              ? (current + 1) % 3
              : (current + 2) % 3;
      itemsRef.current[next]?.focus();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [anchorRef, onClose]);

  const actions = [
    { label: "Copy To...", action: onCopy },
    { label: "Move To...", action: onMove },
    { label: "Settings", action: onSettings },
  ];
  return createPortal(
    <div
      ref={menuRef}
      className="bookmark-action-menu"
      role="menu"
      aria-label="Bookmark actions"
      style={position}
    >
      {actions.map(({ label, action }, index) => (
        <div key={label}>
          {index === 2 && (
            <div className="bookmark-action-menu-separator" role="separator" />
          )}
          <button
            ref={(node) => {
              itemsRef.current[index] = node;
            }}
            type="button"
            role="menuitem"
            onClick={action}
          >
            {label}
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
