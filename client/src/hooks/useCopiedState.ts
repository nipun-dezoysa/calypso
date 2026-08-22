import { useEffect, useState } from "react";

export function useCopiedState(resetDelayMs = 2000) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), resetDelayMs);
    return () => clearTimeout(timer);
  }, [copied, resetDelayMs]);

  return [copied, setCopied] as const;
}
