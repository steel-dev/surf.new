from dotenv import load_dotenv
from fastapi import FastAPI, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from .schemas import ChatRequest, SessionRequest
from .utils.prompt import convert_to_chat_messages
from .models import ModelConfig
from .plugins import WebAgentType, get_web_agent, AGENT_CONFIGS
from .streamer import stream_vercel_format
from api.middleware.profiling_middleware import ProfilingMiddleware
from pydantic import BaseModel
from typing import List, Dict
import os
import asyncio
import subprocess
import re
import time

# 1) Import the Steel client
try:
    from steel import Steel
except ImportError:
    raise ImportError("Please install the steel package: pip install steel")


load_dotenv(".env.local")

app = FastAPI()
app.add_middleware(ProfilingMiddleware) # Uncomment this when profiling is not needed
STEEL_API_KEY = os.getenv("STEEL_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
STEEL_API_URL = os.getenv("STEEL_API_URL")

# 2) Initialize the Steel client
#    Make sure your STEEL_API_KEY is set as an environment variable
steel_client = Steel(steel_api_key=STEEL_API_KEY, base_url=STEEL_API_URL)

# Add a session locks mechanism to prevent multiple resume requests
session_locks: Dict[str, asyncio.Lock] = {}
session_last_resume: Dict[str, float] = {}
RESUME_COOLDOWN = 1.0  # seconds

origins = [
    "http://localhost",
    "http://localhost:8080",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/sessions", tags=["Sessions"])
async def create_session(request: SessionRequest):
    """
    Creates a new session.
    """
    if request.agent_type == WebAgentType.CLAUDE_COMPUTER_USE:
        return steel_client.sessions.create(
            dimensions={
                "width": 1280,
                "height": 800,
            },
            api_timeout=request.timeout * 1000,
        )
    else:
        return steel_client.sessions.create(
            api_timeout=request.timeout * 1000,
        )


@app.post("/api/sessions/{session_id}/release", tags=["Sessions"])
async def release_session(session_id: str):
    """
    Releases a session. Returns success even if session is already released.
    """
    try:
        return steel_client.sessions.release(session_id)
    except Exception as e:
        # Return success response even if session was already released
        if "Session already stopped" in str(e):
            return {"status": "success", "message": "Session released"}
        raise e

@app.post("/api/sessions/{session_id}/resume", tags=["Sessions"])
async def resume_session(session_id: str):
    """
    Resume execution for a paused session.
    """
    from .plugins.browser_use.agent import resume_execution, ResumeRequest

    # Check if this session was recently resumed
    now = time.time()
    if session_id in session_last_resume:
        time_since_last_resume = now - session_last_resume[session_id]
        if time_since_last_resume < RESUME_COOLDOWN:
            # Too soon - return success but don't actually resume again
            return {
                "status": "success", 
                "message": f"Resume already in progress", 
                "is_resumed": True, 
                "timestamp": now
            }

    # Create a lock for this session if it doesn't exist
    if session_id not in session_locks:
        session_locks[session_id] = asyncio.Lock()
    
    # Try to acquire the lock with a timeout
    try:
        # Use a timeout to prevent deadlocks
        lock_acquired = await asyncio.wait_for(
            session_locks[session_id].acquire(), 
            timeout=0.5
        )
        
        if not lock_acquired:
            # If we couldn't acquire the lock, someone else is already processing
            return {
                "status": "success", 
                "message": "Resume already in progress", 
                "is_resumed": True, 
                "timestamp": now
            }
            
        # Update last resume timestamp
        session_last_resume[session_id] = now
            
        try:
            # Make multiple attempts to resume the session in case the first one fails
            max_attempts = 2
            last_error = None
            
            for attempt in range(max_attempts):
                try:
                    result = await resume_execution(ResumeRequest(session_id=session_id))
                    if result.get("status") == "success":
                        result["is_resumed"] = True
                        result["timestamp"] = now
                        # If we were successful after a retry, log it
                        if attempt > 0:
                            print(f"Successfully resumed session {session_id} on attempt {attempt+1}")
                        return result
                    elif attempt < max_attempts - 1:
                        # Wait briefly before retry
                        await asyncio.sleep(0.2)
                except Exception as e:
                    last_error = e
                    # Only sleep before retry if not the last attempt
                    if attempt < max_attempts - 1:
                        await asyncio.sleep(0.2)
            
            # If we got here, all attempts failed
            if last_error:
                raise last_error
            return {
                "status": "error",
                "message": "Failed to resume session after multiple attempts",
                "is_resumed": False
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
        finally:
            # Always release the lock
            session_locks[session_id].release()
    except asyncio.TimeoutError:
        # If we timed out waiting for the lock
        return {
            "status": "success", 
            "message": "Resume already in progress", 
            "is_resumed": True, 
            "timestamp": now
        }


@app.post("/api/sessions/{session_id}/pause", tags=["Sessions"])
async def pause_session(session_id: str):
    """
    Manually pause execution for a session to take control.
    """
    from .plugins.browser_use.agent import pause_execution_manually, PauseRequest

    try:
        result = await pause_execution_manually(PauseRequest(session_id=session_id))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat", tags=["Chat"])
async def handle_chat(request: ChatRequest):
    """
    This endpoint accepts a chat request, instantiates an agent,
    and then streams the response in the Vercel AI Data Stream Protocol format.
    """
    try:
        messages = request.messages
        chat_messages = convert_to_chat_messages(messages)

        if not request.session_id:
            return Response(
                status_code=400,
                content="Session ID is required",
                media_type="text/plain",
            )

        model_config_args = {
            "provider": request.provider,
            "model_name": request.model_settings.model_choice,
            "api_key": request.api_key,
        }

        if hasattr(request.model_settings, "temperature"):
            model_config_args["temperature"] = request.model_settings.temperature
        if hasattr(request.model_settings, "max_tokens"):
            model_config_args["max_tokens"] = request.model_settings.max_tokens
        if hasattr(request.model_settings, "top_p"):
            model_config_args["top_p"] = request.model_settings.top_p
        if hasattr(request.model_settings, "top_k"):
            model_config_args["top_k"] = request.model_settings.top_k
        if hasattr(request.model_settings, "frequency_penalty"):
            model_config_args["frequency_penalty"] = (
                request.model_settings.frequency_penalty
            )
        if hasattr(request.model_settings, "presence_penalty"):
            model_config_args["presence_penalty"] = (
                request.model_settings.presence_penalty
            )

        model_config = ModelConfig(**model_config_args)

        web_agent = get_web_agent(request.agent_type)

        # Create a FastAPI-level cancel event
        cancel_event = asyncio.Event()

        async def on_disconnect():
            # When the client disconnects, set cancel_event
            cancel_event.set()

        # Pass cancel_event explicitly to the agent only if you want cancellation support
        web_agent_stream = web_agent(
            model_config=model_config,
            agent_settings=request.agent_settings,
            history=chat_messages,
            session_id=request.session_id,
            # Only base_agent really uses it for now
            cancel_event=cancel_event,
        )

        # Directly wrap the agent stream with the Vercel AI format
        streaming_response = stream_vercel_format(
            stream=web_agent_stream,
        )

        # Use background=on_disconnect to catch client-aborted requests
        response = StreamingResponse(
            streaming_response, background=on_disconnect)
        response.headers["x-vercel-ai-data-stream"] = "v1"
        # response.headers["model_used"] = request.model_name
        return response
    except Exception as e:
        # Format error for frontend consumption
        error_response = {
            "error": {
                "message": str(e),
                "type": type(e).__name__,
                "code": getattr(e, "code", 500),
            }
        }
        raise HTTPException(status_code=getattr(
            e, "code", 500), detail=error_response)


@app.get("/api/agents", tags=["Agents"])
async def get_available_agents():
    """
    Returns all available agents and their configurations.
    """
    return AGENT_CONFIGS


@app.get("/healthcheck", tags=["System"])
async def healthcheck():
    """
    Simple health check endpoint to verify the API is running.
    """
    return {"status": "ok"}


# Define response models for Ollama models endpoint
class OllamaModel(BaseModel):
    tag: str
    base_name: str

class OllamaModelsResponse(BaseModel):
    models: List[OllamaModel]

@app.get("/api/ollama/models", response_model=OllamaModelsResponse, tags=["Ollama"])
async def get_ollama_models():
    """
    Fetches available models from a local Ollama instance using the 'ollama list' command.
    
    Returns:
        A list of model objects with full tags and base names that can be used with Ollama.
        
    Example response:
        {
            "models": [
                {
                    "tag": "llama2:7b",
                    "base_name": "llama2"
                },
                {
                    "tag": "mistral:7b",
                    "base_name": "mistral"
                }
            ]
        }
    """
    try:
        result = subprocess.run(
            ["ollama", "list"], 
            capture_output=True, 
            text=True, 
            check=True
        )
        
        models = []
        lines = result.stdout.strip().split('\n')
        
        if lines and "NAME" in lines[0] and "ID" in lines[0]:
            lines = lines[1:]
        
        for line in lines:
            if line.strip():
                parts = re.split(r'\s{2,}', line.strip())
                if parts and parts[0]:
                    full_tag = parts[0]
                    base_name = full_tag.split(':')[0] if ':' in full_tag else full_tag
                    models.append({
                        "tag": full_tag,
                        "base_name": base_name
                    })
        
        return {"models": models}
    except subprocess.CalledProcessError as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to fetch Ollama models: {e.stderr}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Error fetching Ollama models: {str(e)}"
        )
