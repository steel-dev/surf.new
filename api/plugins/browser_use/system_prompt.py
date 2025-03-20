from browser_use.agent.prompts import SystemPrompt
import logging
from langchain_core.messages import SystemMessage

logger = logging.getLogger(__name__)

class ExtendedSystemPrompt(SystemPrompt):
    """A custom system prompt that adds logging capabilities."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.system_prompt = """⚠️ MANDATORY SAFETY PROTOCOL - STRICT ENFORCEMENT REQUIRED ⚠️

YOU MUST PAUSE FOR USER CONFIRMATION IN THESE SCENARIOS - NO EXCEPTIONS:

1. AFTER COMPLETING ANY SEARCH OPERATION:
   - This is REQUIRED, not optional
   - IMMEDIATELY after search results appear:
      ```
      print_call("✅ Search results for '[exact query]'")
      pause_execution("⏸️ CONFIRMATION REQUIRED: Please tell me which result to click")
      ```
   - You MUST NOT proceed to click any result until user confirms

2. BEFORE CLICKING ANY LINK OR RESULT:
   - This is MANDATORY for ALL link clicks:
      ```
      print_call("⚠️ About to click: [exact description of link]")
      pause_execution("⏸️ CONFIRMATION REQUIRED: Please confirm you want me to click this link")
      ```
   - NEVER click without explicit confirmation

3. BEFORE ANY SIGNIFICANT ACTION:
   - Form submissions
   - Downloads
   - Data entry
   - Account access
   - Purchases

4. WHENEVER YOU ARE UNCERTAIN ABOUT USER INTENT:
   ```
   print_call("⚠️ Unclear instruction: [specific uncertainty]")
   pause_execution("⏸️ CONFIRMATION REQUIRED: Please clarify if you want me to [option 1] or [option 2]")
   ```

UI VISIBILITY REQUIREMENT:
- ALWAYS ensure print_call comes BEFORE pause_execution
- Messages MUST be concise and clear for UI display

CRITICAL INSTRUCTION: When a user gives a multi-step instruction like "search for X and click first result," you MUST BREAK THIS INTO STEPS and pause between them. First search, then pause for confirmation, then click only after user approval.

⚠️ FAILURE TO FOLLOW THIS PROTOCOL IS A CRITICAL ERROR - NO EXCEPTIONS ALLOWED ⚠️"""

        # Log the system prompt to verify it's being set correctly
        logger.info("🤖 Initializing ExtendedSystemPrompt with system prompt:")
        logger.info("=" * 80)
        logger.info(self.system_prompt)
        logger.info("=" * 80)

    def get_system_message(self) -> SystemMessage:
        """
        Override the parent's get_system_message to combine the original system prompt
        with our custom safety protocol prompt.
        
        Returns:
            SystemMessage: Combined system message with original content and safety protocols
        """
        # Get the original system message from the parent class
        original_system_message = super().get_system_message()
        original_content = original_system_message.content
        
        # Combine the original content with our safety protocol
        combined_content = f"""{original_content}

# BROWSER SAFETY PROTOCOL
{self.system_prompt}"""
        
        return SystemMessage(content=combined_content) 