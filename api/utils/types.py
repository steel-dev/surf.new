from pydantic import BaseModel, Field
from typing import List, Mapping, Any, Optional


class ToolInvocation(BaseModel):
    toolCallId: str
    toolName: str
    args: Mapping[str, Any]
    result: str | List[Mapping[str, Any]]


class AgentSettings(BaseModel):
    # General settings
    system_prompt: Optional[str] = None
    
    # Image and timing settings
    num_images_to_keep: Optional[int] = Field(default=10, ge=1, le=50)
    wait_time_between_steps: Optional[int] = Field(default=1, ge=0, le=10)
    
    # Step control
    max_steps: Optional[int] = Field(default=30, ge=10, le=50)
    
    # Legacy field for backward compatibility
    steps: Optional[int] = None  # Deprecated in favor of max_steps


class ModelSettings(BaseModel):
    model_choice: str
    max_tokens: int = Field(default=1000, ge=1, le=4096)
    temperature: float = Field(default=0.7, ge=0, le=1)
    top_p: float = Field(default=0.9, ge=0, le=1)
    top_k: Optional[int] = None
    frequency_penalty: Optional[float] = None
    presence_penalty: Optional[float] = None
