from pydantic import BaseModel, Field
from typing import List, Mapping, Any, Optional


class ToolInvocation(BaseModel):
    toolCallId: str
    toolName: str
    args: Mapping[str, Any]
    result: Optional[str | List[Mapping[str, Any]]] = None
    state: str = "call"  # "call" or "result"


class AgentSettings(BaseModel):
    steps: Optional[int] = None
    system_prompt: Optional[str] = None
    num_images_to_keep: Optional[int] = Field(default=10, ge=1, le=50)
    wait_time_between_steps: Optional[int] = Field(default=1, ge=0, le=10)
    steps: Optional[int] = None


class ModelSettings(BaseModel):
    model_choice: str
    max_tokens: int = Field(default=1000, ge=1, le=4096)
    temperature: float = Field(default=0.7, ge=0, le=1)
    top_p: float = Field(default=0.9, ge=0, le=1)
    top_k: Optional[int] = None
    frequency_penalty: Optional[float] = None
    presence_penalty: Optional[float] = None
    # Azure OpenAI specific settings
    azure_endpoint: Optional[str] = None
    api_version: Optional[str] = None
