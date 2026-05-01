import { useState, useCallback } from 'react';

/**
 * useCopy — returns a copy function and a "copied" boolean.
 * The boolean flips true for `duration` ms then resets.
 *
 * Usage:
 *   const { copied, copy } = useCopy();
 *   <button onClick={() => copy(text)}>{copied ? '✓ Copied!' : '📋 Copy'}</button>
 */
export function useCopy(duration = 2000) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), duration);
    } catch (err) {
      console.error('[useCopy] Failed:', err);
    }
  }, [duration]);

  return { copied, copy };
}
