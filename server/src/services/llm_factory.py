from langchain_core.language_models.chat_models import BaseChatModel

from src.models.ai_provide_model import AIProvider


def build_chat_model(provider: AIProvider, model_name: str, temperature: float) -> BaseChatModel:
    name = provider.provider_name.strip().lower()

    if "anthropic" in name or "claude" in name:
        from langchain_anthropic import ChatAnthropic

        return ChatAnthropic(
            model=model_name,
            api_key=provider.secret_key,
            base_url=provider.url or None,
            temperature=temperature,
        )

    if "google" in name or "gemini" in name:
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=provider.secret_key,
            temperature=temperature,
        )

    if "ollama" in name:
        from langchain_ollama import ChatOllama

        return ChatOllama(
            model=model_name,
            base_url=provider.url or "http://localhost:11434",
            temperature=temperature,
        )

    from langchain_openai import AzureChatOpenAI, ChatOpenAI

    if "azure" in name:
        return AzureChatOpenAI(
            azure_endpoint=provider.url,
            api_key=provider.secret_key,
            azure_deployment=model_name,
            api_version="2024-10-21",
            temperature=temperature,
        )

    return ChatOpenAI(
        model=model_name,
        api_key=provider.secret_key or "not-needed",
        base_url=provider.url or None,
        temperature=temperature,
    )
