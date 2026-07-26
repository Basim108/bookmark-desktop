# make-position-writes-atomic

Serialize every read-modify-write of stored positions across the service worker and newtab pages with a Web Lock, so concurrent writes cannot silently drop placements
