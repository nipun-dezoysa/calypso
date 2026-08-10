export interface ProviderSuggestion {
    name: string
    defaultUrl?: string
    requiresKey: boolean
    keyHint?: string
    models: string[]
    description: string
    accentColor: string
}

export const PROVIDER_SUGGESTIONS: ProviderSuggestion[] = [
    {
        name: 'OpenAI',
        requiresKey: true,
        keyHint: 'sk-…',
        description: 'GPT-4o, GPT-4, o1, o3 and more via the OpenAI API',
        accentColor: '#10a37f',
        models: [
            'gpt-4o',
            'gpt-4o-mini',
            'gpt-4-turbo',
            'gpt-4',
            'gpt-3.5-turbo',
            'o1',
            'o1-mini',
            'o1-preview',
            'o3',
            'o3-mini',
            'o4-mini',
        ],
    },
    {
        name: 'Anthropic',
        requiresKey: true,
        keyHint: 'sk-ant-…',
        description: 'Claude 3.5 Sonnet, Claude 3 Opus/Haiku via the Anthropic API',
        accentColor: '#d4a27f',
        models: [
            'claude-opus-4-5',
            'claude-sonnet-4-5',
            'claude-haiku-4-5',
            'claude-3-5-sonnet-20241022',
            'claude-3-5-haiku-20241022',
            'claude-3-opus-20240229',
            'claude-3-haiku-20240307',
        ],
    },
    {
        name: 'Google Gemini',
        requiresKey: true,
        keyHint: 'AIza…',
        description: 'Gemini 2.5 Pro/Flash models via Google AI Studio or Vertex AI',
        accentColor: '#4285f4',
        models: [
            'gemini-2.5-pro',
            'gemini-2.5-flash',
            'gemini-2.0-flash',
            'gemini-2.0-flash-lite',
            'gemini-1.5-pro',
            'gemini-1.5-flash',
            'gemini-1.5-flash-8b',
        ],
    },
    {
        name: 'Azure OpenAI',
        requiresKey: true,
        keyHint: 'Azure API key',
        description: 'OpenAI models hosted on Microsoft Azure',
        accentColor: '#0078d4',
        defaultUrl: 'https://<your-resource>.openai.azure.com/',
        models: [
            'gpt-4o',
            'gpt-4o-mini',
            'gpt-4-turbo',
            'gpt-4',
            'gpt-35-turbo',
            'o1',
            'o1-mini',
        ],
    },
    {
        name: 'Ollama',
        requiresKey: false,
        description: 'Run open-source LLMs locally via Ollama',
        accentColor: '#7c3aed',
        defaultUrl: 'http://localhost:11434',
        models: [
            'llama3.3',
            'llama3.2',
            'llama3.1',
            'llama3',
            'mistral',
            'mistral-nemo',
            'mixtral',
            'phi4',
            'phi3.5',
            'phi3',
            'gemma3',
            'gemma2',
            'qwen2.5',
            'qwen2.5-coder',
            'deepseek-r1',
            'deepseek-coder-v2',
            'codellama',
            'nomic-embed-text',
            'mxbai-embed-large',
        ],
    },
    {
        name: 'Groq',
        requiresKey: true,
        keyHint: 'gsk_…',
        description: 'Ultra-fast inference for open-source models via Groq hardware',
        accentColor: '#f97316',
        models: [
            'llama-3.3-70b-versatile',
            'llama-3.1-8b-instant',
            'llama3-70b-8192',
            'llama3-8b-8192',
            'mixtral-8x7b-32768',
            'gemma2-9b-it',
            'gemma-7b-it',
        ],
    },
    {
        name: 'Mistral AI',
        requiresKey: true,
        keyHint: 'Mistral API key',
        description: 'Mistral Large, Small, Codestral via Mistral AI platform',
        accentColor: '#ff7000',
        models: [
            'mistral-large-latest',
            'mistral-medium-latest',
            'mistral-small-latest',
            'codestral-latest',
            'ministral-8b-latest',
            'ministral-3b-latest',
            'open-mistral-nemo',
            'open-codestral-mamba',
        ],
    },
    {
        name: 'Cohere',
        requiresKey: true,
        keyHint: 'Cohere API key',
        description: 'Command R+ and other Cohere models',
        accentColor: '#39d353',
        models: [
            'command-r-plus',
            'command-r',
            'command',
            'command-light',
            'command-nightly',
        ],
    },
    {
        name: 'Together AI',
        requiresKey: true,
        keyHint: 'Together AI API key',
        description: 'Hundreds of open-source models via Together AI',
        accentColor: '#6366f1',
        defaultUrl: 'https://api.together.xyz/v1',
        models: [
            'meta-llama/Llama-3-70b-chat-hf',
            'meta-llama/Llama-3-8b-chat-hf',
            'mistralai/Mixtral-8x7B-Instruct-v0.1',
            'mistralai/Mistral-7B-Instruct-v0.3',
            'Qwen/Qwen2.5-72B-Instruct-Turbo',
            'deepseek-ai/deepseek-r1',
            'google/gemma-2-9b-it',
        ],
    },
    {
        name: 'Perplexity',
        requiresKey: true,
        keyHint: 'pplx-…',
        description: 'Web-grounded Sonar models via Perplexity AI',
        accentColor: '#20b2aa',
        defaultUrl: 'https://api.perplexity.ai',
        models: [
            'sonar-pro',
            'sonar',
            'sonar-reasoning-pro',
            'sonar-reasoning',
            'sonar-deep-research',
        ],
    },
    {
        name: 'Fireworks AI',
        requiresKey: true,
        keyHint: 'Fireworks API key',
        description: 'Fast open-source model serving via Fireworks AI',
        accentColor: '#ef4444',
        defaultUrl: 'https://api.fireworks.ai/inference/v1',
        models: [
            'accounts/fireworks/models/llama-v3p3-70b-instruct',
            'accounts/fireworks/models/llama-v3p1-8b-instruct',
            'accounts/fireworks/models/mixtral-8x7b-instruct',
            'accounts/fireworks/models/qwen2p5-72b-instruct',
            'accounts/fireworks/models/deepseek-r1',
            'accounts/fireworks/models/firefunction-v2',
        ],
    },
    {
        name: 'Hugging Face',
        requiresKey: true,
        keyHint: 'hf_…',
        description: 'Open-source models via Hugging Face Inference API',
        accentColor: '#ffcc00',
        defaultUrl: 'https://api-inference.huggingface.co/models',
        models: [
            'meta-llama/Llama-3.1-70B-Instruct',
            'mistralai/Mistral-7B-Instruct-v0.3',
            'google/gemma-2-9b-it',
            'Qwen/Qwen2.5-72B-Instruct',
            'microsoft/Phi-3.5-mini-instruct',
        ],
    },
    {
        name: 'Replicate',
        requiresKey: true,
        keyHint: 'r8_…',
        description: 'Run machine learning models via Replicate',
        accentColor: '#6c63ff',
        models: [
            'meta/llama-2-70b-chat',
            'mistralai/mistral-7b-instruct-v0.2',
            'snowflake/snowflake-arctic-instruct',
        ],
    },
    {
        name: 'AWS Bedrock',
        requiresKey: true,
        keyHint: 'AWS Access Key ID',
        description: 'Claude, Titan, Llama and more via Amazon Bedrock',
        accentColor: '#ff9900',
        models: [
            'anthropic.claude-3-5-sonnet-20241022-v2:0',
            'anthropic.claude-3-opus-20240229-v1:0',
            'anthropic.claude-3-haiku-20240307-v1:0',
            'amazon.titan-text-premier-v1:0',
            'meta.llama3-1-70b-instruct-v1:0',
            'mistral.mistral-large-2402-v1:0',
        ],
    },
    {
        name: 'xAI / Grok',
        requiresKey: true,
        keyHint: 'xai-…',
        description: 'Grok models via xAI API',
        accentColor: '#e5e5e5',
        defaultUrl: 'https://api.x.ai/v1',
        models: [
            'grok-3',
            'grok-3-mini',
            'grok-2',
            'grok-beta',
        ],
    },
    {
        name: 'DeepSeek',
        requiresKey: true,
        keyHint: 'DeepSeek API key',
        description: 'DeepSeek Chat and Coder models',
        accentColor: '#0ea5e9',
        defaultUrl: 'https://api.deepseek.com/v1',
        models: [
            'deepseek-chat',
            'deepseek-reasoner',
            'deepseek-coder',
        ],
    },
    {
        name: 'LM Studio',
        requiresKey: false,
        description: 'Local LLMs via LM Studio OpenAI-compatible server',
        accentColor: '#a78bfa',
        defaultUrl: 'http://localhost:1234/v1',
        models: [
            'local-model',
        ],
    },
    {
        name: 'Custom / Other',
        requiresKey: false,
        description: 'Any OpenAI-compatible endpoint',
        accentColor: '#71717a',
        models: [],
    },
]

export function findProviderSuggestion(name: string): ProviderSuggestion | undefined {
    const lower = name.toLowerCase()
    return PROVIDER_SUGGESTIONS.find((p) => p.name.toLowerCase() === lower)
}

export const MODEL_CONTEXT_TOKENS: Record<string, number> = {
    // OpenAI
    'gpt-4o': 128_000,
    'gpt-4o-mini': 128_000,
    'gpt-4-turbo': 128_000,
    'gpt-4': 8_192,
    'gpt-3.5-turbo': 16_385,
    'gpt-35-turbo': 16_385,
    o1: 200_000,
    'o1-mini': 128_000,
    'o1-preview': 128_000,
    o3: 200_000,
    'o3-mini': 200_000,
    'o4-mini': 200_000,

    // Anthropic
    'claude-opus-4-5': 200_000,
    'claude-sonnet-4-5': 200_000,
    'claude-haiku-4-5': 200_000,
    'claude-3-5-sonnet-20241022': 200_000,
    'claude-3-5-haiku-20241022': 200_000,
    'claude-3-opus-20240229': 200_000,
    'claude-3-haiku-20240307': 200_000,

    // Google
    'gemini-2.5-pro': 1_048_576,
    'gemini-2.5-flash': 1_048_576,
    'gemini-2.0-flash': 1_048_576,
    'gemini-2.0-flash-lite': 1_048_576,
    'gemini-1.5-pro': 2_097_152,
    'gemini-1.5-flash': 1_048_576,
    'gemini-1.5-flash-8b': 1_048_576,

    // Ollama 
    'llama3.3': 128_000,
    'llama3.2': 128_000,
    'llama3.1': 128_000,
    llama3: 8_192,
    mistral: 32_768,
    'mistral-nemo': 128_000,
    mixtral: 32_768,
    phi4: 16_384,
    'phi3.5': 128_000,
    phi3: 128_000,
    gemma3: 128_000,
    gemma2: 8_192,
    'qwen2.5': 32_768,
    'qwen2.5-coder': 32_768,
    'deepseek-r1': 65_536,
    'deepseek-coder-v2': 163_840,
    codellama: 16_384,

    // Groq
    'llama-3.3-70b-versatile': 128_000,
    'llama-3.1-8b-instant': 128_000,
    'llama3-70b-8192': 8_192,
    'llama3-8b-8192': 8_192,
    'mixtral-8x7b-32768': 32_768,
    'gemma2-9b-it': 8_192,
    'gemma-7b-it': 8_192,

    // Mistral
    'mistral-large-latest': 128_000,
    'mistral-medium-latest': 128_000,
    'mistral-small-latest': 128_000,
    'codestral-latest': 256_000,
    'ministral-8b-latest': 128_000,
    'ministral-3b-latest': 128_000,
    'open-mistral-nemo': 128_000,
    'open-codestral-mamba': 256_000,

    // Cohere
    'command-r-plus': 128_000,
    'command-r': 128_000,
    command: 4_096,
    'command-light': 4_096,
    'command-nightly': 128_000,

    // Together
    'meta-llama/Llama-3-70b-chat-hf': 8_192,
    'meta-llama/Llama-3-8b-chat-hf': 8_192,
    'mistralai/Mixtral-8x7B-Instruct-v0.1': 32_768,
    'mistralai/Mistral-7B-Instruct-v0.3': 32_768,
    'Qwen/Qwen2.5-72B-Instruct-Turbo': 32_768,
    'deepseek-ai/deepseek-r1': 65_536,
    'google/gemma-2-9b-it': 8_192,

    // Perplexity
    'sonar-pro': 200_000,
    sonar: 128_000,
    'sonar-reasoning-pro': 128_000,
    'sonar-reasoning': 128_000,
    'sonar-deep-research': 128_000,
}

const CONTEXT_PATTERNS: Array<[RegExp, number]> = [
    [/^claude-/i, 200_000],
    [/^gemini-/i, 1_048_576],
    [/^(gpt-4o|gpt-4\.|o[1-9])/i, 128_000],
    [/^gpt-4/i, 8_192],
    [/^gpt-3\.5|^gpt-35/i, 16_385],
    [/llama-?3\.[1-9]|llama-?4/i, 128_000],
    [/llama/i, 8_192],
    [/qwen|mistral|mixtral|command-r/i, 32_768],
    [/deepseek/i, 65_536],
    [/phi-?[34]|gemma-?3/i, 128_000],
    [/sonar/i, 128_000],
]

export function suggestContextTokens(modelName: string): number | null {
    const name = modelName.trim()
    if (!name) return null

    const exact = MODEL_CONTEXT_TOKENS[name]
    if (exact) return exact

    const base = name.split(':')[0]
    if (base !== name && MODEL_CONTEXT_TOKENS[base]) return MODEL_CONTEXT_TOKENS[base]

    for (const [pattern, tokens] of CONTEXT_PATTERNS) {
        if (pattern.test(name)) return tokens
    }
    return null
}

/** "128,000" → readable in a hint without dragging in a formatter. */
export function formatTokens(tokens: number): string {
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M`
    if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}k`
    return String(tokens)
}
