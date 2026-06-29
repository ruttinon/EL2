import React from 'react';

/** Smooth numeric transition when the target value changes. */
export function useAnimatedNumber(target: number, duration = 900, minDelta = 0.05) {
  const [display, setDisplay] = React.useState(target);
  const fromRef = React.useRef(target);

  React.useEffect(() => {
    if (!Number.isFinite(target)) {
      setDisplay(0);
      fromRef.current = 0;
      return;
    }
    if (Math.abs(target - fromRef.current) < minDelta) {
      setDisplay(target);
      fromRef.current = target;
      return;
    }

    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;

    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, minDelta]);

  return display;
}
