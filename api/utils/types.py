from pydantic import BaseModel, Field, validator
from typing import List, Mapping, Any, Optional


class ToolInvocation(BaseModel):
    toolCallId: str
    toolName: str
    args: Mapping[str, Any]
    result: str | List[Mapping[str, Any]]


class AgentSettings(BaseModel):
    steps: Optional[int] = None
    system_prompt: Optional[str] = None
    num_images_to_keep: Optional[int] = Field(default=10, ge=1, le=50)
    wait_time_between_steps: Optional[int] = Field(default=1, ge=0, le=10)
    debug_mode: Optional[bool] = False
    debug_page_urls: Optional[List[str]] = []
    
    @validator('debug_page_urls', pre=True)
    def parse_debug_urls(cls, value):
        # If it's already a list, return it
        if isinstance(value, list):
            return value
        # If it's a string, split on commas and strip whitespace
        if isinstance(value, str):
            if not value.strip():
                return []
            return [url.strip() for url in value.split(',') if url.strip()]
        return value


class ModelSettings(BaseModel):
    model_choice: str
    max_tokens: int = Field(default=1000, ge=1, le=4096)
    temperature: float = Field(default=0.7, ge=0, le=1)
    top_p: float = Field(default=0.9, ge=0, le=1)
    top_k: Optional[int] = None
    frequency_penalty: Optional[float] = None
    presence_penalty: Optional[float] = None
