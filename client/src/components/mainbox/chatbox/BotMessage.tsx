import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

function BotMessage({message}: {message?: string}) {
  return (
    <div className="text-zinc-300">
      <Markdown remarkPlugins={[remarkGfm]}>{message}</Markdown>
    </div>
  );
}

export default BotMessage;
