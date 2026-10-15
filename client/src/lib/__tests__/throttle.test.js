import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { throttle } from "../throttle.js";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("throttle", () => {
  it("runs at most twice (leading + trailing) for many calls within 50 ms", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 50);

    for (let t = 0; t < 50; t += 5) {
      throttled(t);
      vi.advanceTimersByTime(5);
    }
    vi.advanceTimersByTime(50);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, 0); // leading call, right away
  });

  it("uses the latest arguments for the trailing call", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 50);

    throttled("first");
    throttled("second");
    throttled("third");
    vi.advanceTimersByTime(50);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith("third");
  });

  it("cancel() prevents the trailing call", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 50);

    throttled("leading");
    throttled("trailing");
    throttled.cancel();
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("leading");
  });

  it("sends about 20 calls per second for continuous movement", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 50);

    // A mouse firing every 4 ms (250 events per second) for one second.
    for (let t = 0; t < 1000; t += 4) {
      throttled(t);
      vi.advanceTimersByTime(4);
    }

    expect(fn.mock.calls.length).toBeGreaterThanOrEqual(19);
    expect(fn.mock.calls.length).toBeLessThanOrEqual(21);
  });
});
