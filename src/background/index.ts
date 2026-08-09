import { registerBookmarkListeners } from "../lib/bookmarks/events";
import { registerReleaseNoticeListener } from "../lib/releaseNotes/installEvent";

registerBookmarkListeners();
registerReleaseNoticeListener();
