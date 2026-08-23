import { IoCheckmark, IoCopyOutline } from "react-icons/io5";
import { PrismAsync as SyntaxHighlighter } from "react-syntax-highlighter";
import oneDark from "react-syntax-highlighter/dist/esm/styles/prism/one-dark";
import { useCopiedState } from "../../../hooks/useCopiedState";
import { copyText } from "../../../utils/clipboard";
import { Button } from "../../ui/button";

interface Props {
  language?: string;
  code: string;
}

function CodeBlock({ language, code }: Props) {
  const [copied, setCopied] = useCopiedState();

  async function handleCopy() {
    try {
      await copyText(code);
      setCopied(true);
    } catch {
      // Clipboard permission denied — the button simply won't flip to "copied".
    }
  }

  return (
    <div className="my-3 overflow-hidden rounded-md border border-(--c-border) bg-(--c-surface) text-sm first:mt-0 last:mb-0">
      <div className="flex items-center justify-between border-b border-(--c-border) bg-(--c-hover)/60 px-3 py-1.5">
        <span className="font-mono text-[11px] tracking-wide text-(--c-text-subtle) uppercase">
          {language || "text"}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleCopy}
          title={copied ? "Copied" : "Copy code"}
          aria-label="Copy code"
          className="size-5 text-(--c-text-subtle) hover:text-(--c-accent-hi)"
        >
          {copied ? <IoCheckmark size={12} /> : <IoCopyOutline size={12} />}
        </Button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        PreTag="div"
        className="overflow-x-auto"
        customStyle={{
          margin: 0,
          background: "transparent",
          padding: "12px 14px",
          fontSize: "12.5px",
          lineHeight: 1.6,
        }}
        codeTagProps={{
          style: { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" },
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

export default CodeBlock;
