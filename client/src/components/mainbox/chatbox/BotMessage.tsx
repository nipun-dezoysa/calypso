import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { IoCheckmark, IoCopyOutline, IoRefreshOutline } from "react-icons/io5";
import { copyText } from "../../../utils/clipboard";

interface Props {
  message?: string;
  /** Omitted for the in-flight streaming preview, which has no saved message
   * to act on yet. */
  messageId?: string;
  canRegenerate?: boolean;
  onRegenerate?: () => void;
  busy?: boolean;
}

function BotMessage({ message, messageId, canRegenerate, onRegenerate, busy }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    if (!message) return;
    try {
      await copyText(message);
      setCopied(true);
    } catch {
      // Clipboard permission denied — the button simply won't flip to "copied".
    }
  }

  return (
    <div className="text-(--c-text-body) group">
      <Markdown remarkPlugins={[remarkGfm]}>{message}</Markdown>
      {messageId && (
        <div className="flex items-center gap-1 mt-1 h-5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={handleCopy}
            title={copied ? "Copied" : "Copy"}
            aria-label="Copy message"
            className="text-(--c-text-subtle) hover:text-(--c-accent-hi) p-0.5"
          >
            {copied ? <IoCheckmark size={14} /> : <IoCopyOutline size={14} />}
          </button>
          {canRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={busy}
              title="Regenerate response"
              aria-label="Regenerate response"
              className="text-(--c-text-subtle) hover:text-(--c-accent-hi) p-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <IoRefreshOutline size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default BotMessage;
