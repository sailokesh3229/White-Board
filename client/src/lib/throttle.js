// Limits how often fn runs: at most once every `ms` milliseconds.
//
// How it works:
// - Leading call: if fn hasn't run in the last `ms`, run it immediately.
// - Otherwise remember the latest arguments and schedule ONE trailing call for
//   when the `ms` window ends. More calls in the meantime just overwrite the
//   remembered arguments, so the trailing call always uses the newest ones.
//
// The trailing call matters for cursors: without it, the last position before
// the mouse stops might never be sent, and the cursor would freeze short of
// where it really is.
//
// cancel() drops a pending trailing call (e.g. when the pointer leaves the
// board, so a late "move" can't re-show a cursor that was just hidden).
export function throttle(fn, ms) {
  let lastRun = 0;
  let timer = null;
  let pendingArgs = null;

  function run(args) {
    lastRun = Date.now();
    fn(...args);
  }

  function throttled(...args) {
    const remaining = ms - (Date.now() - lastRun);
    if (remaining <= 0 && !timer) {
      run(args);
      return;
    }
    pendingArgs = args;
    if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        const latest = pendingArgs;
        pendingArgs = null;
        run(latest);
      }, remaining);
    }
  }

  throttled.cancel = () => {
    clearTimeout(timer);
    timer = null;
    pendingArgs = null;
  };

  return throttled;
}
