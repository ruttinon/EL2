import { useCallback, useEffect, useState } from 'react';

export type GraphicNavigationState = {
  stack: string[];
  currentId: string;
  canGoBack: boolean;
  push: (graphicId: string) => void;
  pop: () => void;
  reset: (graphicId: string) => void;
};

/** Drill-down navigation stack for runtime graphic switching (Phase 11) */
export function useGraphicNavigation(initialGraphicId: string): GraphicNavigationState {
  const [stack, setStack] = useState<string[]>(() => (initialGraphicId ? [initialGraphicId] : []));

  useEffect(() => {
    if (!initialGraphicId) return;
    setStack((prev) => {
      if (prev.length === 0) return [initialGraphicId];
      if (prev.length === 1 && prev[0] !== initialGraphicId) return [initialGraphicId];
      return prev;
    });
  }, [initialGraphicId]);

  const currentId = stack[stack.length - 1] ?? initialGraphicId;

  const push = useCallback((graphicId: string) => {
    if (!graphicId) return;
    setStack((s) => (s[s.length - 1] === graphicId ? s : [...s, graphicId]));
  }, []);

  const pop = useCallback(() => {
    setStack((s) => (s.length <= 1 ? s : s.slice(0, -1)));
  }, []);

  const reset = useCallback((graphicId: string) => {
    if (!graphicId) return;
    setStack([graphicId]);
  }, []);

  return {
    stack,
    currentId,
    canGoBack: stack.length > 1,
    push,
    pop,
    reset,
  };
}
