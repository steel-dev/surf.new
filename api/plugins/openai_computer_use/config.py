import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv(".env.local")

# Environment variables and constants
STEEL_API_KEY = os.getenv("STEEL_API_KEY")
STEEL_CONNECT_URL = os.getenv("STEEL_CONNECT_URL")
STEEL_API_URL = os.getenv("STEEL_API_URL")
OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"
VALID_OPENAI_CUA_MODELS = {
    "computer-use-preview",
    "computer-use-preview-2025-02-04",
}

# Default settings
DEFAULT_MAX_STEPS = 30
DEFAULT_WAIT_TIME_BETWEEN_STEPS = 1
DEFAULT_NUM_IMAGES_TO_KEEP = 10
