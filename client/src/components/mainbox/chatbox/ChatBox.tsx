import BotMessage from './BotMessage'
import ChatInput from './ChatInput'
import UserMessage from './UserMessage'

function ChatBox() {
const markdown = `## **Lorem ipsum**

Lorem ipsum dolor sit amet consectetur adipisicing elit. Doloremque eligendi minima in fuga? Accusantium quis a debitis. Beatae, perferendis. Eum deserunt placeat quia totam quaerat pariatur. Tempore rerum quibusdam inventore!`;
    return (
      <div className="relative h-full flex flex-col items-center">
        <div className="absolute top-0 w-full text-zinc-300 px-5 py-2 bg-zinc-900">
          chat name
        </div>
        <div className="h-15"></div>
        <div className="w-1/2 h-full flex flex-col gap-5">
          <UserMessage message="Hello, how can I help you today?" />
          <BotMessage message={markdown} />
        </div>
        <ChatInput />
      </div>
    );
}

export default ChatBox