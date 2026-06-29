import React from 'react';

export function useGraphicScale(stageW: number, stageH: number, fitViewport = false) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);
  React.useEffect(() => {
    if (!stageW) return;
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const availW = entry.contentRect.width;
      const availH = entry.contentRect.height;
      const ratioW = availW / stageW;
      const ratioH = availH / stageH;
      if (fitViewport) {
        setScale(Math.min(ratioW, ratioH));
      } else {
        setScale(ratioW < 1 ? ratioW : 1);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [stageW, stageH, fitViewport]);
  return { wrapRef, scale };
}
