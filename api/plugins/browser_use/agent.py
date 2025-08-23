import logging
from browser_use import Agent, BrowserSession, BrowserProfile, Controller
from browser_use import ChatGoogle, ChatOpenAI, ChatAnthropic
from typing import Any, List, Mapping, AsyncIterator, Optional, Dict
from ...models import ModelConfig, ModelProvider
import os
from dotenv import load_dotenv
from ...utils.types import AgentSettings
from browser_use.browser.views import BrowserStateSummary
from browser_use.agent.views import (
    AgentHistoryList,
    AgentOutput,
)
import asyncio
from pydantic import BaseModel
import uuid
from .system_prompt import ExtendedSystemPrompt

# Configure logging - also log to file for debugging
logger = logging.getLogger(__name__)
debug_handler = logging.FileHandler('browser_use_debug.log')
debug_handler.setLevel(logging.DEBUG)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
debug_handler.setFormatter(formatter)
logger.addHandler(debug_handler)
logger.setLevel(logging.DEBUG)

# Load environment variables
load_dotenv()

# Configuration
STEEL_API_KEY = os.getenv("STEEL_API_KEY")
STEEL_CONNECT_URL = os.getenv("STEEL_CONNECT_URL", "wss://connect.steel.dev")

# Storage for active agents and sessions
active_agents: Dict[str, Agent] = {}
active_browser_sessions: Dict[str, BrowserSession] = {}

def create_browser_use_llm(model_config: ModelConfig):
    """Create browser-use compatible LLM from ModelConfig"""
    
    if model_config.provider == ModelProvider.GEMINI:
        api_key = model_config.api_key or os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("Google API key is required for Gemini models")
        
        # Use Gemini 2.5 Flash as requested - use correct model names
        if "2.5" in model_config.model_name:
            model_name = "gemini-2.5-flash"  # Standard Gemini 2.5 Flash model
        elif "2.0" in model_config.model_name:
            model_name = "gemini-2.0-flash-exp"  # Gemini 2.0 Flash experimental
        else:
            model_name = model_config.model_name
            
        return ChatGoogle(
            model=model_name,
            api_key=api_key,
            temperature=model_config.temperature,
            top_p=model_config.top_p,
        )
    elif model_config.provider == ModelProvider.OPENAI:
        # browser-use has built-in ChatOpenAI which is the default
        api_key = model_config.api_key or os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OpenAI API key is required for OpenAI models")
            
        return ChatOpenAI(
            model=model_config.model_name,
            api_key=api_key,
            temperature=model_config.temperature,
            max_completion_tokens=model_config.max_tokens,
            top_p=model_config.top_p,
        )
    elif model_config.provider == ModelProvider.ANTHROPIC:
        api_key = model_config.api_key or os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("Anthropic API key is required for Claude models")
            
        return ChatAnthropic(
            model=model_config.model_name,
            api_key=api_key,
            temperature=model_config.temperature,
            max_tokens=model_config.max_tokens,
            top_p=model_config.top_p,
        )
    else:
        # Default to OpenAI if provider not recognized
        return ChatOpenAI(
            model="gpt-4o-mini",
            temperature=0.7,
        )


class PauseRequest(BaseModel):
    session_id: str


class ResumeRequest(BaseModel):
    session_id: str


class ReleaseRequest(BaseModel):
    session_id: str


async def pause_execution_manually(request: PauseRequest) -> Dict[str, Any]:
    """Pause the agent execution for a session"""
    session_id = request.session_id
    
    logger.info(f"Manual pause requested for session: {session_id}")
    
    if session_id in active_agents:
        try:
            agent = active_agents[session_id]
            # Try to pause the agent - this might not be fully supported in browser-use 0.6.1
            if hasattr(agent, 'pause'):
                await agent.pause()
            logger.info(f"Manual pause completed for session: {session_id}")
            return {"status": "paused", "session_id": session_id}
        except Exception as e:
            logger.error(f"Error pausing agent for session {session_id}: {e}")
            return {"status": "error", "message": f"Failed to pause agent: {str(e)}"}
    else:
        logger.warning(f"No active agent found for session: {session_id}")
        return {"status": "error", "message": "No active agent found"}


async def resume_execution(request: ResumeRequest) -> Dict[str, Any]:
    """Resume the agent execution for a session"""
    session_id = request.session_id
    
    logger.info(f"Resume execution requested for session: {session_id}")
    
    if session_id in active_agents:
        try:
            agent = active_agents[session_id]
            # Try to resume the agent - this might not be fully supported in browser-use 0.6.1
            if hasattr(agent, 'resume'):
                await agent.resume()
            logger.info(f"Resumed execution for session: {session_id}")
            return {"status": "resumed", "session_id": session_id}
        except Exception as e:
            logger.error(f"Error resuming agent for session {session_id}: {e}")
            return {"status": "error", "message": f"Failed to resume agent: {str(e)}"}
    else:
        logger.warning(f"No active agent found for session: {session_id}")
        return {"status": "error", "message": "No active agent found"}


async def release_session(request: ReleaseRequest) -> Dict[str, Any]:
    """Release/cleanup a session and its resources"""
    session_id = request.session_id
    
    try:
        # Clean up agent
        if session_id in active_agents:
            agent = active_agents[session_id]
            # Stop the agent gracefully
            try:
                await agent.stop()
            except Exception as e:
                logger.warning(f"Error stopping agent for session {session_id}: {e}")
            del active_agents[session_id]
            logger.info(f"Released agent for session: {session_id}")
        
        # Clean up browser session
        if session_id in active_browser_sessions:
            browser_session = active_browser_sessions[session_id]
            try:
                await browser_session.close()
            except Exception as e:
                logger.warning(f"Error closing browser session for session {session_id}: {e}")
            del active_browser_sessions[session_id]
            logger.info(f"Released browser session: {session_id}")
        
        return {"status": "released", "session_id": session_id}
    except Exception as e:
        logger.error(f"Error releasing session {session_id}: {e}")
        return {"status": "error", "message": str(e)}


async def browser_use_agent(
    model_config: ModelConfig,
    agent_settings: AgentSettings,
    history: List[Mapping[str, Any]],
    session_id: str,
    cancel_event: Optional[asyncio.Event] = None,
) -> AsyncIterator[str]:
    """
    Browser-use agent using the new browser-use 0.6.1 API
    """
    
    logger.info(f"Starting browser_use_agent with session_id: {session_id}")
    logger.info(f"Model config: {model_config}")
    logger.info(f"Agent settings: {agent_settings}")
    
    # Check if agent is already running for this session
    if session_id in active_agents:
        logger.warning(f"Agent already running for session: {session_id}")
        yield f"data: {{'type': 'error', 'content': 'Agent already running for this session'}}\n\n"
        return
    
    # Get the user's task from the last message - ensure it's a string
    if history and len(history) > 0:
        last_message = history[-1]
        logger.info(f"Last message type: {type(last_message)}")
        logger.info(f"Last message content: {last_message}")
        
        if isinstance(last_message.get("content"), str):
            task = last_message["content"]
        elif isinstance(last_message.get("content"), list):
            # Handle structured content (like from some LLM providers)
            task = ""
            for content_item in last_message["content"]:
                if isinstance(content_item, dict) and content_item.get("type") == "text":
                    task += content_item.get("text", "")
                elif isinstance(content_item, str):
                    task += content_item
        else:
            task = str(last_message.get("content", "Help me browse the web"))
    else:
        task = "Help me browse the web"
    
    # Debug logging to verify task is a string
    logger.info(f"Extracted task: {task}")
    logger.info(f"Task type: {type(task)}")
    logger.info(f"Task length: {len(task)}")
    
    # Ensure task is always a string
    if not isinstance(task, str):
        task = str(task)
        logger.warning(f"Task was not a string, converted to: {task}")
    
    try:
        # Create or reuse browser session
        if session_id not in active_browser_sessions:
            # Create a new browser session instance
            logger.info("Creating new browser session for session: %s", session_id)
            
            # Create browser session directly with CDP URL for Steel API connection
            cdp_url = f"{STEEL_CONNECT_URL}?apiKey={STEEL_API_KEY}&sessionId={session_id}"
            logger.info(f"CDP URL: {cdp_url[:50]}...")
            
            try:
                browser_session = BrowserSession(
                    cdp_url=cdp_url
                )
                # Store for future use
                active_browser_sessions[session_id] = browser_session
                logger.info("Browser session created successfully")
            except Exception as browser_error:
                logger.error(f"Failed to create browser session: {browser_error}")
                yield f"data: {{'type': 'error', 'content': 'Browser connection failed: Steel API may be unavailable or session limit reached'}}\n\n"
                return
        else:
            browser_session = active_browser_sessions[session_id]
            logger.info("Reusing existing browser session for session: %s", session_id)
        
        # Create LLM instance using browser-use framework
        logger.info(f"Creating LLM with provider: {model_config.provider}, model: {model_config.model_name}")
        llm = create_browser_use_llm(model_config)
        logger.info(f"LLM created successfully: {type(llm)}")
        
        # Create the Agent with browser-use 0.6.1 API
        logger.info(f"Creating Agent with task: '{task[:50]}...' (length: {len(task)})")
        agent = Agent(
            task=task,
            llm=llm,
            browser_session=browser_session,
            use_vision=True,
            max_actions_per_step=agent_settings.steps or 10,
        )
        
        # Store the agent
        active_agents[session_id] = agent
        
        logger.info("Agent created successfully for session: %s", session_id)
        
        # Start the agent execution
        yield f"data: {{'type': 'status', 'content': 'Starting browser automation with {model_config.model_name}...'}}\n\n"
        
        # Run the agent ONLY ONCE
        logger.info("Starting agent.run() - SINGLE EXECUTION")
        result = await agent.run()
        logger.info(f"Agent run completed, result type: {type(result)}")
        logger.info(f"Agent result: {result}")
        
        # Stream the results
        if hasattr(result, 'history') and result.history:
            logger.info(f"Result has history with {len(result.history)} steps")
            for i, step in enumerate(result.history):
                logger.info(f"Step {i}: {step}")
                if hasattr(step, 'result') and step.result:
                    yield f"data: {{'type': 'message', 'content': {repr(step.result)}}}\n\n"
        else:
            logger.warning("Result has no history or empty history")
        
        yield f"data: {{'type': 'done', 'content': 'Task completed successfully'}}\n\n"
        
    except Exception as e:
        error_msg = f"Error in browser_use_agent: {str(e)}"
        logger.error(error_msg, exc_info=True)
        
        # Also write to debug file
        with open('browser_use_error.log', 'a') as f:
            import traceback
            f.write(f"\n=== ERROR at {__import__('datetime').datetime.now()} ===\n")
            f.write(f"Error: {error_msg}\n")
            f.write(f"Traceback:\n{traceback.format_exc()}\n")
            f.write("=" * 50 + "\n")
            
        yield f"data: {{'type': 'error', 'content': {repr(error_msg)}}}\n\n"
    
    finally:
        # Clean up if needed (but keep session for potential reuse)
        logger.info(f"browser_use_agent completed for session: {session_id}")


# Export the main function
__all__ = ["browser_use_agent", "pause_execution_manually", "resume_execution", "release_session"]
