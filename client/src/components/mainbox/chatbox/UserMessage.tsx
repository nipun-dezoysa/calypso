function UserMessage({message}: {message?: string}) {
    return (
        <div className="text-zinc-300 flex justify-end">
            <div className="bg-zinc-800 p-2 rounded-md max-w-[75%]">
                <p>{message}</p>
            </div>
        </div>
    )
}

export default UserMessage