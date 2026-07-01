import { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { useSubfolders } from "./hooks/useSubfolders";

/** Chrome's bookmark tree root id — parent of the top-level folders (Bookmarks Bar, Other Bookmarks, etc.). */
const ROOT_FOLDER_ID = "0";

export function App() {
  const { folders: rootFolders, loading } = useSubfolders(ROOT_FOLDER_ID);
  // Tracks only an explicit user override; absent an override, the first
  // root folder is selected. Computed during render rather than synced via
  // an effect, since it's fully derivable from props/state each render.
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(
    undefined,
  );
  const activeFolderId = selectedFolderId ?? rootFolders[0]?.id;

  return (
    <div className="app">
      <Sidebar
        rootFolders={rootFolders}
        loading={loading}
        activeFolderId={activeFolderId}
        onSelectFolder={setSelectedFolderId}
      />
      <main className="canvas">
        {/* Grid/pagination is implemented in Group 4. */}
        <p>Selected folder: {activeFolderId ?? "none"}</p>
      </main>
    </div>
  );
}
