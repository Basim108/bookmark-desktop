import { vi } from "vitest";

type Listener<T extends (...args: never[]) => void> = T;

function createEvent<T extends (...args: never[]) => void>() {
  const listeners = new Set<Listener<T>>();
  return {
    addListener: (fn: Listener<T>) => listeners.add(fn),
    removeListener: (fn: Listener<T>) => listeners.delete(fn),
    hasListeners: () => listeners.size > 0,
    clearListeners: () => listeners.clear(),
    emit: (...args: Parameters<T>) => {
      for (const fn of listeners) {
        (fn as (...a: Parameters<T>) => void)(...args);
      }
    },
  };
}

/**
 * Minimal in-memory fake of the subset of the chrome.* APIs the bookmark
 * data layer depends on. Installs onto globalThis.chrome for the duration
 * of a test file; call reset() between tests to clear stored state.
 */
export function installChromeMock() {
  const storage = new Map<string, unknown>();
  const bookmarkNodes = new Map<string, chrome.bookmarks.BookmarkTreeNode>();

  const storageOnChanged =
    createEvent<
      (
        changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
        areaName: string,
      ) => void
    >();

  const bookmarksEvents = {
    onCreated:
      createEvent<
        (id: string, bookmark: chrome.bookmarks.BookmarkTreeNode) => void
      >(),
    onRemoved: createEvent<
      (
        id: string,
        removeInfo: {
          parentId: string;
          index: number;
          node: chrome.bookmarks.BookmarkTreeNode;
        },
      ) => void
    >(),
    onMoved: createEvent<
      (
        id: string,
        moveInfo: {
          parentId: string;
          index: number;
          oldParentId: string;
          oldIndex: number;
        },
      ) => void
    >(),
    onChanged:
      createEvent<
        (id: string, changeInfo: { title: string; url?: string }) => void
      >(),
    onChildrenReordered:
      createEvent<(id: string, reorderInfo: { childIds: string[] }) => void>(),
    onImportBegan: createEvent<() => void>(),
    onImportEnded: createEvent<() => void>(),
  };

  const chromeMock = {
    runtime: {
      getURL: (path: string) => `chrome-extension://test-extension-id${path}`,
    },
    storage: {
      local: {
        get: vi.fn(async (keys?: string | string[] | null) => {
          if (keys == null) {
            return Object.fromEntries(storage.entries());
          }
          const keyList = Array.isArray(keys) ? keys : [keys];
          const result: Record<string, unknown> = {};
          for (const key of keyList) {
            if (storage.has(key)) {
              result[key] = storage.get(key);
            }
          }
          return result;
        }),
        set: vi.fn(async (items: Record<string, unknown>) => {
          const changes: Record<
            string,
            { oldValue?: unknown; newValue?: unknown }
          > = {};
          for (const [key, value] of Object.entries(items)) {
            changes[key] = { oldValue: storage.get(key), newValue: value };
            storage.set(key, value);
          }
          storageOnChanged.emit(changes, "local");
        }),
        remove: vi.fn(async (keys: string | string[]) => {
          const keyList = Array.isArray(keys) ? keys : [keys];
          for (const key of keyList) {
            storage.delete(key);
          }
        }),
        clear: vi.fn(async () => {
          storage.clear();
        }),
      },
      onChanged: storageOnChanged,
    },
    bookmarks: {
      ...bookmarksEvents,
      getChildren: vi.fn(
        async (id: string): Promise<chrome.bookmarks.BookmarkTreeNode[]> => {
          return [...bookmarkNodes.values()]
            .filter((node) => node.parentId === id)
            .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
        },
      ),
      get: vi.fn(
        async (
          idOrIdList: string | string[],
        ): Promise<chrome.bookmarks.BookmarkTreeNode[]> => {
          const ids = Array.isArray(idOrIdList) ? idOrIdList : [idOrIdList];
          return ids.map((id) => {
            const node = bookmarkNodes.get(id);
            if (!node) throw new Error(`No such bookmark node: ${id}`);
            return node;
          });
        },
      ),
      update: vi.fn(
        async (
          id: string,
          changes: { title?: string; url?: string },
        ): Promise<chrome.bookmarks.BookmarkTreeNode> => {
          const node = bookmarkNodes.get(id);
          if (!node) throw new Error(`No such bookmark node: ${id}`);
          const updated = { ...node, ...changes };
          bookmarkNodes.set(id, updated);
          bookmarksEvents.onChanged.emit(
            id,
            updated.url === undefined
              ? { title: updated.title }
              : { title: updated.title, url: updated.url },
          );
          return updated;
        },
      ),
      remove: vi.fn(async (id: string): Promise<void> => {
        const node = bookmarkNodes.get(id);
        if (!node) throw new Error(`No such bookmark node: ${id}`);
        bookmarkNodes.delete(id);
        bookmarksEvents.onRemoved.emit(id, {
          parentId: node.parentId ?? "",
          index: node.index ?? 0,
          node,
        });
      }),
    },
  };

  vi.stubGlobal("chrome", chromeMock);

  return {
    chrome: chromeMock,
    /** Seeds a fake bookmark/folder node directly into the fake tree. */
    addNode(node: chrome.bookmarks.BookmarkTreeNode) {
      bookmarkNodes.set(node.id, node);
    },
    removeNode(id: string) {
      bookmarkNodes.delete(id);
    },
    reset() {
      storage.clear();
      bookmarkNodes.clear();
      for (const event of Object.values(bookmarksEvents)) {
        event.clearListeners();
      }
      storageOnChanged.clearListeners();
    },
  };
}
