## Context

Canvas pagination is discrete React state, not scrolling. `useGridLayout`
owns `pageSelection: { folderId, page }`; `Canvas` mounts *every* page's grid
simultaneously and shows one with `display: grid` while the rest sit at
`display: none`. Nothing scrolls, and there is no scroll container to hang a
native gesture off.

```
   .canvas  (flex column, overflow:hidden)
   ┌──────────────────────────────────────────────┐
   │ ┌────────────┐ ┌────────────┐ ┌────────────┐ │
   │ │  page 0    │ │  page 1    │ │  page 2    │ │  ← all mounted,
   │ │ display:   │ │ display:   │ │ display:   │ │    same position
   │ │   grid     │ │   none     │ │   none     │ │
   │ └────────────┘ └────────────┘ └────────────┘ │
   │              ‹   Page 1 of 3   ›              │
   └──────────────────────────────────────────────┘
```

Pages are mounted-but-hidden deliberately: it is what keeps a dragged icon's
node alive across a mid-drag page flip. Any design that relocates pages into a
scrolling track has to re-establish that guarantee, plus re-derive the
droppable rects that `Canvas` already re-measures via
`measureDroppableContainers([])` on every `currentPage` change.

There is one existing precedent for driving this discrete state from a
continuous input: `useEdgePagination`, which converts "dragged icon held near
an edge" into repeated page advances, re-arming while the condition holds and
halting at the bounds. This change follows that shape rather than inventing a
new one.

## Goals / Non-Goals

**Goals:**

- Horizontal wheel input over the canvas turns pages, bounded at first/last.
- One thumbwheel detent turns exactly one page.
- A sustained roll keeps paging, at a cadence slow enough to read.
- Burst magnitude does not translate into page count.
- Identical behavior whether the browser reports pixel- or line-based deltas.
- Wheel paging never triggers browser history navigation.

**Non-Goals:**

- Vertical wheel (`deltaY`) paging. The grid never scrolls vertically by
  design, so `deltaY` over the canvas stays dead input. Note that `Shift` +
  vertical wheel is synthesized by browsers into `deltaX` and therefore works
  as a side effect; that is accepted, not designed for.
- A slide/carousel animation between pages. Page changes remain instant
  `display` swaps.
- Converting the canvas into a scroll container (see Decision 1).
- Wheel paging during a drag (see Decision 4).
- Touch/trackpad-first tuning (see Risks).

## Decisions

### 1. Discrete accumulator over a native scroll-snap carousel

**Chosen:** Keep pages as `display` swaps; translate wheel deltas into
`setCurrentPage` calls in a hook.

**Alternative considered:** Lay pages out in a horizontal track inside an
`overflow-x: auto` container with `scroll-snap-type: x mandatory`, deriving
`currentPage` from `scrollLeft`. This buys native momentum, native snapping,
and a free slide animation with no physics code of our own.

**Why rejected (for now):** It inverts the ownership of `currentPage` from
React state to DOM-derived state, and it lands squarely on the drag machinery
in three places — droppable rects would live in a scrolled container, the
mounted-but-hidden guarantee changes shape, and `useEdgePagination` would have
to become a programmatic `scrollTo` that does not fight the user's pointer.
That is a large blast radius for a feature whose requirement is "the thumbwheel
turns pages." The accumulator approach is also not a dead end: if the carousel
is wanted later (most likely because the slide animation is wanted), this hook
is deleted rather than refactored.

### 2. Threshold + cooldown + accumulator clamp

The horizontal wheel on a performance mouse is a **ratcheted thumbwheel**,
not a flywheel. That matters, because the three input sources this handler can
see have materially different signatures:

```
  thumbwheel, one detent    ▏                    single event, ~40px
  thumbwheel, rolled        ▏  ▏  ▏  ▏  ▏  ▏     steady stream, equal magnitude,
                                                  ~60-100ms apart, no decay
  trackpad / shift+wheel    ▂▄▆█▆▄▂▁▁▁            burst, then decaying tail
```

A strict one-page-per-gesture latch (re-arm only once input goes quiet) is
correct for the trackpad but wrong for the primary device: a steady roll would
turn one page and then stall until the user let the wheel rest. Conversely, a
bare `if (deltaX > 0) next()` lets a single trackpad swipe cross the whole
folder.

**Chosen state machine:**

```
  wheel event (deltaX only)
        │
        ▼
  normalize by deltaMode ──▶ PIXEL: as-is
        │                    LINE:  × 16
        │                    PAGE:  × container width
        ▼
  sign flipped vs accumulator? ──▶ yes: accumulator = 0   (reverse feels instant)
        │
        ▼
  accumulator += delta
        │
        ▼
  |accumulator| ≥ THRESHOLD ?
        │ yes
        ▼
  now - lastTurn ≥ COOLDOWN ?
        │                    │ no
        │ yes                ▼
        ▼             clamp |accumulator| to THRESHOLD
  turn(sign)                 (a burst banks no credit for future turns)
  accumulator = 0
  lastTurn = now
```

- `THRESHOLD ≈ 50` normalized px — roughly one detent, so one tilt turns one
  page.
- `COOLDOWN ≈ 250ms` — caps a sustained roll at ~4 pages/sec.

**The clamp is the load-bearing part.** Without it a hard swipe deposits
~800px into the accumulator and then pays out page turns for seconds
afterwards. With it, the accumulator can never hold more than one page's worth
of credit, so burst *magnitude* stops mattering entirely and only burst
*duration* does. That is what lets a single threshold-and-cooldown rule serve
both the single detent and the sustained roll without a separate latch.

Both constants are hook options with defaults, matching how
`useEdgePagination` takes `{ thresholdPx, holdMs }` — the tests set them
explicitly rather than depending on the defaults.

### 2a. Banked input goes stale between gestures (found during implementation)

The clamp leaves up to one threshold's worth of input banked in the
accumulator when a gesture ends mid-cooldown. Nothing then clears it, so the
*next* gesture — possibly minutes later — would inherit a full threshold of
credit and turn a page on its very first event.

Resolved with an `idleResetMs` (default 500ms) staleness check: input banked
before a gap longer than that is discarded before the new delta is applied.
This is not the deferred decay detection of Decision 3 — it compares only
timestamps, never delta magnitudes, and cannot distinguish a coast from a
held roll.

### 2b. The cooldown is deliberately direction-agnostic

A reversal arriving inside the cooldown window is clamped rather than turning
immediately, so reversing direction right after a turn takes up to one
cooldown to take effect. Exempting reversals was considered and rejected: a
trackpad's directional jitter would then be able to oscillate pages. Reversal
still resets the *accumulator* (Decision 2), which is the part that matters
for a gesture that has not yet turned. An e2e test asserting instant reversal
was corrected to wait out the cooldown, and documents this.

### 3. Momentum decay detection deferred

Distinguishing a coasting trackpad from a held roll is possible: momentum
deltas shrink monotonically, fresh input does not. Tracking that and
suppressing while `|delta|` decays would make the gesture exactly
one-page-per-flick on trackpads too.

**Deferred deliberately.** The cooldown already bounds the overshoot to a
handful of pages, the target device is unaffected, and a decay heuristic is
better tuned against an observed annoyance than a predicted one. Recorded here
as the known follow-up so the residual in Risks is not rediscovered as a bug.

### 4. Wheel paging suppressed during a drag

`useEdgePagination` already owns paging while a drag is active. Two live
paging mechanisms means a stray thumbwheel nudge relocates an in-flight icon
to a page the user did not intend to drop on. `Canvas` already consumes
`useDndContext()`, so the active drag is in hand and the gate costs one
condition. Wheel events are still `preventDefault`ed while suppressed, so the
history-navigation guarantee holds during a drag too.

### 5. A manually registered, non-passive listener

`preventDefault()` is mandatory here, not cosmetic: horizontal overscroll over
a non-scrolling area triggers Chrome's back/forward history navigation, so on
a new-tab page a page-right gesture could navigate the user away entirely.

React's `onWheel` prop cannot deliver this. React registers `wheel` (along
with `touchstart`/`touchmove`) as a **passive** listener at the root, which
makes `preventDefault()` a silent no-op. The listener therefore goes on
`containerRef.current` in an effect, via
`addEventListener("wheel", handler, { passive: false })`, with matching
teardown.

One nearby subtlety: `.canvas-grid` is `overflow: auto`. Content normally fits
exactly so it never scrolls, but a mid-resize frame can transiently overflow.
A wheel over a scrollable-but-not-overflowing element still bubbles, so this
is expected to be benign; a resize frame eating one event is acceptable.

### 6. Test seams mirror the edge-pagination pair

`useEdgePagination` exports a pure `computeEdgeDirection` tested directly, and
the hook itself tested under `vi.useFakeTimers()`. This change mirrors that
split: delta normalization and the accumulate/threshold/clamp arithmetic are
pure functions of `(delta, deltaMode, accumulator, now, lastTurn)` and test
without a DOM; the hook's timing behavior tests against fake timers.

Confirmed during implementation that jsdom honours passive-listener
semantics — `preventDefault()` from a passive listener leaves
`defaultPrevented` false — so a component test asserting `defaultPrevented`
genuinely catches a regression to React's `onWheel`. That assertion, not the
e2e test, is the real guard for Decision 5: synthetic wheel events do not
reproduce Chrome's actual trackpad overscroll gesture.

### 7. No latest-callback ref inside the hook (found during implementation)

`useEdgePagination` keeps `onAdvance` in a ref because it arms a `setTimeout`
whose closure would be stale by the time it fires. `useWheelPagination` has no
timer — `handleWheel` runs synchronously from whichever render's closure the
caller holds — so the equivalent ref was redundant and was removed. `Canvas`
still needs one, because the DOM listener is registered once and must reach
the current render's closure; it is assigned inside a bare `useEffect` rather
than during render, which is what the repo's `react-hooks/refs` lint rule
requires.

## Risks / Trade-offs

- **A hard trackpad swipe or shift+wheel flick turns 2–4 pages, not one.**
  The coast lasts ~1s and the cooldown pays out a turn every 250ms of it. →
  Bounded, not eliminated, by the cooldown and clamp. Decision 3 records the
  decay-detection fix if this proves annoying in practice. The target device
  is unaffected.
- **`THRESHOLD`/`COOLDOWN` are tuned against one class of device.** A mouse
  reporting unusually small or large per-detent deltas could feel sluggish or
  twitchy. → Both are hook options, so retuning is a one-line change with no
  structural consequence.
- **The `× 16` line-height constant for `DOM_DELTA_LINE` is an
  approximation.** Firefox reports ~1–3 lines per detent; ×16 lands them at
  16–48px against a 50px threshold, so a single small line delta may need two
  events to cross. → Acceptable: it errs toward under-triggering rather than
  runaway paging, and the constant is exported for tuning.
- **Missed `preventDefault` regresses into history navigation.** If the
  listener registration ever reverts to React's `onWheel`, the failure is
  silent in unit tests and only shows as "the new tab navigated away." → Call
  it out in the listener's comment and cover the gesture in e2e, where a real
  browser would actually navigate.
- **Wheel events reach the canvas from anywhere inside it, including over
  icons.** That is intended (the whole canvas is the paging surface), but it
  means a wheel over a bookmark icon pages rather than doing nothing. → This
  is the desired behavior; noted so it is not filed as a bug.

## Open Questions

None blocking. The two decisions taken under uncertainty — deferring decay
detection (Decision 3) and the specific `THRESHOLD`/`COOLDOWN` values
(Decision 2) — are both cheap to revisit and isolated to the new hook.
