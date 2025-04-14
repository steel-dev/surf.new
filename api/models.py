from enum import Enum
from typing import Optional


class ModelProvider(str, Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    ANTHROPIC_COMPUTER_USE = "anthropic_computer_use"
    GEMINI = "gemini"
    DEEPSEEK = "deepseek"
    OLLAMA = "ollama"
    # OPENROUTER = "openrouter"
    # GOOGLE = "google"


class ModelConfig:
    """
    A class representing configuration details for different LLM providers.
    Extend this to add more providers or model versions in the future.
    """

    def __init__(
        self,
        provider: ModelProvider,
        model_name: str,
        temperature: float = 0.7,
        max_tokens: int = 1024,
        top_k: Optional[int] = None,
        top_p: Optional[float] = None,
        frequency_penalty: Optional[float] = None,
        presence_penalty: Optional[float] = None,
        api_key: Optional[str] = None,
        **kwargs,
    ):
        self.provider = provider
        self.model_name = model_name or ModelConfig.default_model(provider)
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.extra_params = kwargs
        self.top_k = top_k
        self.top_p = top_p
        self.frequency_penalty = frequency_penalty
        self.presence_penalty = presence_penalty
        self.api_key = api_key

    def __repr__(self):
        return (
            f"ModelConfig(provider={self.provider}, "
            f"model_name={self.model_name}, "
            f"temperature={self.temperature}, "
            f"max_tokens={self.max_tokens}, "
            f"extras={self.extra_params}, "
            f"top_k={self.top_k}, "
            f"top_p={self.top_p}, "
            f"frequency_penalty={self.frequency_penalty}, "
            f"presence_penalty={self.presence_penalty}, "
            f"api_key={'[SET]' if self.api_key else '[NOT SET]'})"
        )

    def model_dump(self):
        return {
            "provider": self.provider,
            "model_name": self.model_name,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "top_k": self.top_k,
            "top_p": self.top_p,
            "frequency_penalty": self.frequency_penalty,
            "presence_penalty": self.presence_penalty,
            **self.extra_params,
        }

    @staticmethod
    def default_model(provider: ModelProvider) -> str:
        """
        Returns a default model for each provider.
        """
        default_models = {
            ModelProvider.OPENAI: "gpt-4.1",
            ModelProvider.ANTHROPIC: "claude-3-7-sonnet-latest",
            ModelProvider.ANTHROPIC_COMPUTER_USE: "claude-3-5-sonnet-20241022",
            ModelProvider.GEMINI: "gemini-2.0-flash",
            ModelProvider.DEEPSEEK: "deepseek-chat",
            ModelProvider.OLLAMA: "llama3.3",
        }
        return default_models.get(provider) or ValueError("Unsupported provider.")
