/**
 * Serializes async work so overlapping callers (e.g. rapid-fire bookmark
 * events) can't interleave a read-modify-write against shared storage and
 * clobber each other's result.
 */
export function createMutex() {
  let tail: Promise<unknown> = Promise.resolve();

  function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const result = tail.then(fn, fn);
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  return { runExclusive };
}
