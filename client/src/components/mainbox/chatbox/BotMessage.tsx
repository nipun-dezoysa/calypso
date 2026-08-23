import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { IoCheckmark, IoCopyOutline, IoRefreshOutline } from "react-icons/io5";
import { copyText } from "../../../utils/clipboard";
import { cn } from "../../../lib/utils";
import { useCopiedState } from "../../../hooks/useCopiedState";
import { Button } from "../../ui/button";
import CodeBlock from "./CodeBlock";

interface Props {
  message?: string;
  messageId?: string;
  canRegenerate?: boolean;
  onRegenerate?: () => void;
  busy?: boolean;
}

const headingClass = "font-semibold text-(--c-text-strong) first:mt-0";

const markdownComponents: Components = {
  h1: (props) => (
    <h1
      className={cn(headingClass, "mt-5 mb-2 border-b border-(--c-border) pb-1 text-xl")}
      {...props}
    />
  ),
  h2: (props) => <h2 className={cn(headingClass, "mt-5 mb-2 text-lg")} {...props} />,
  h3: (props) => <h3 className={cn(headingClass, "mt-4 mb-1.5 text-base")} {...props} />,
  h4: (props) => <h4 className={cn(headingClass, "mt-3 mb-1 text-sm")} {...props} />,
  h5: (props) => <h5 className={cn(headingClass, "mt-3 mb-1 text-sm")} {...props} />,
  h6: (props) => <h6 className={cn(headingClass, "mt-3 mb-1 text-sm")} {...props} />,
  p: (props) => <p className="my-3 leading-relaxed first:mt-0 last:mb-0" {...props} />,
  strong: (props) => <strong className="font-semibold text-(--c-text-strong)" {...props} />,
  a: ({ href, ...rest }) => {
    const isExternal = /^https?:\/\//i.test(href ?? "");
    return (
      <a
        href={href}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noopener noreferrer" : undefined}
        className="text-(--c-accent-hi) underline underline-offset-2 hover:text-(--c-accent) wrap-break-word"
        {...rest}
      />
    );
  },
  ul: ({ className, ...rest }) => {
    const isTaskList = className?.includes("contains-task-list");
    return (
      <ul
        className={cn(
          "my-3 space-y-1 first:mt-0 last:mb-0",
          isTaskList ? "list-none pl-1" : "list-disc pl-5 marker:text-(--c-text-subtle)",
        )}
        {...rest}
      />
    );
  },
  ol: (props) => (
    <ol
      className="my-3 list-decimal space-y-1 pl-5 marker:text-(--c-text-subtle) first:mt-0 last:mb-0"
      {...props}
    />
  ),
  li: ({ className, ...rest }) => {
    const isTask = className?.includes("task-list-item");
    return (
      <li
        className={cn("leading-relaxed [&_ul]:my-1.5 [&_ol]:my-1.5", isTask && "flex items-start gap-2")}
        {...rest}
      />
    );
  },
  input: (props) => <input className="mt-1.5 accent-(--c-accent)" {...props} />,
  blockquote: (props) => (
    <blockquote
      className="my-3 border-l-2 border-(--c-accent)/60 pl-3 text-(--c-text-dim) italic first:mt-0 last:mb-0"
      {...props}
    />
  ),
  hr: (props) => <hr className="my-4 border-(--c-border)" {...props} />,
  img: (props) => (
    <img
      className="my-2 max-w-full rounded-md border border-(--c-border) first:mt-0 last:mb-0"
      loading="lazy"
      {...props}
    />
  ),
  table: (props) => (
    <div className="my-3 overflow-x-auto rounded-md border border-(--c-border) first:mt-0 last:mb-0">
      <table className="w-full border-collapse text-left text-[0.9em]" {...props} />
    </div>
  ),
  thead: (props) => <thead className="bg-(--c-hover)" {...props} />,
  tbody: (props) => <tbody className="[&>tr:last-child>td]:border-b-0" {...props} />,
  tr: (props) => <tr className="hover:bg-(--c-hover)/30 transition-colors" {...props} />,
  th: (props) => (
    <th
      className="border-b border-(--c-border) px-3 py-1.5 font-semibold text-(--c-text-strong)"
      {...props}
    />
  ),
  td: (props) => (
    <td className="border-b border-(--c-border)/60 px-3 py-1.5 align-top" {...props} />
  ),
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children, ...rest }) => {
    const match = /language-(\w+)/.exec(className || "");
    const text = String(children).replace(/\n$/, "");
    const isBlock = Boolean(match) || text.includes("\n");
    if (isBlock) {
      return <CodeBlock language={match?.[1]} code={text} />;
    }
    return (
      <code
        className="rounded bg-(--c-hover) px-1.5 py-0.5 font-mono text-[0.85em] text-(--c-accent-hi)"
        {...rest}
      >
        {children}
      </code>
    );
  },
};

function BotMessage({ message, messageId, canRegenerate, onRegenerate, busy }: Props) {
  const [copied, setCopied] = useCopiedState();

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
      <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {message}
      </Markdown>
      {messageId && (
        <div className="flex items-center gap-1 mt-1 h-5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            title={copied ? "Copied" : "Copy"}
            aria-label="Copy message"
            className="size-6 text-(--c-text-subtle) hover:text-(--c-accent-hi)"
          >
            {copied ? <IoCheckmark size={14} /> : <IoCopyOutline size={14} />}
          </Button>
          {canRegenerate && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onRegenerate}
              disabled={busy}
              title="Regenerate response"
              aria-label="Regenerate response"
              className="size-6 text-(--c-text-subtle) hover:text-(--c-accent-hi) disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <IoRefreshOutline size={14} />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default BotMessage;
