from dotenv import load_dotenv
from fastapi import FastAPI, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from .schemas import ChatRequest, SessionRequest
from .utils.prompt import convert_to_chat_messages
from .models import ModelConfig
from .plugins import WebAgentType, get_web_agent, AGENT_CONFIGS
from .streamer import stream_vercel_format
import os
import asyncio

# 1) Import the Steel client
try:
    from steel import Steel
except ImportError:
    raise ImportError("Please install the steel package: pip install steel")


load_dotenv(".env.local")

app = FastAPI()
STEEL_API_KEY = os.getenv("STEEL_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
STEEL_API_URL = os.getenv("STEEL_API_URL")

# 2) Initialize the Steel client
#    Make sure your STEEL_API_KEY is set as an environment variable
steel_client = Steel(steel_api_key=STEEL_API_KEY, base_url=STEEL_API_URL)

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


@app.post("/api/sessions")
async def create_session(request: SessionRequest):
    """
    Creates a new session.
    """
    if request.agent_type == WebAgentType.CLAUDE_STEEL_USE:
        return steel_client.sessions.create(
            dimensions={
                "width": 1280,
                "height": 800,
            },
            timeout=request.timeout,
        )
    else:
        return steel_client.sessions.create(
            timeout=request.timeout,
        )


@app.post("/api/sessions/{session_id}/release")
async def release_session(session_id: str):
    """
    Releases a session.
    """
    return steel_client.sessions.release(session_id)


@app.post("/api/chat")
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
                status_code=400, content="Session ID is required", media_type="text/plain"
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
            model_config_args["presence_penalty"] = request.model_settings.presence_penalty

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
        streaming_response = stream_vercel_format(stream=web_agent_stream)

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
                "code": getattr(e, 'code', 500)
            }
        }
        raise HTTPException(
            status_code=getattr(e, 'code', 500),
            detail=error_response
        )


@app.get("/api/agents")
async def get_available_agents():
    """
    Returns all available agents and their configurations.
    """
    return AGENT_CONFIGS
