"""
A simple file containing tool implementations.
Real tools might scrape websites, fetch data, or manipulate images.
"""

from typing import Dict, Type
from langchain_core.tools import BaseTool
import time
from pydantic import BaseModel, Field
from typing import Optional
from langchain_core.callbacks import CallbackManagerForToolRun


class ExampleInput(BaseModel):
    input_data: str = Field(
        ...,  # ... means required field
        description="The input string to be processed by the example tool",
    )


class PrintCallInput(BaseModel):
    message: str = Field(
        ...,
        description="The message to print when the tool is called",
    )


class PrintCallTool(BaseTool):
    name: str = "print_call"
    description: str = "Prints a message when the tool is called."
    args_schema: Type[BaseModel] = PrintCallInput

    def _run(
        self, message: str, run_manager: Optional[CallbackManagerForToolRun] = None
    ) -> str:
        """Print the message when tool is called."""
        print(f"🔔 Tool call: {message}")
        return f"Printed: {message}"

    async def _arun(self, message: str) -> str:
        """Async version of the tool."""
        print(f"🔔 Tool call: {message}")
        return f"Printed: {message}"


class ExampleTool(BaseTool):
    name: str = "example_tool"
    description: str = "A sample tool that processes input data."
    args_schema: Type[BaseModel] = ExampleInput

    def _run(
        self, input_data: str, run_manager: Optional[CallbackManagerForToolRun] = None
    ) -> str:
        """Process the input data."""
        return f"Tool processed: {input_data}"

    async def _arun(self, input_data: str) -> str:
        """Async version is not implemented."""
        raise NotImplementedError("Async not implemented for ExampleTool")


class CalculateInput(BaseModel):
    a: float = Field(..., description="The first number to add")
    b: float = Field(..., description="The second number to add")


class CalculateTool(BaseTool):
    name: str = "calculate_tool"
    description: str = "Adds two numbers together and returns their sum."
    args_schema: Type[BaseModel] = CalculateInput

    def _run(
        self,
        a: float,
        b: float,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        """Add two numbers together."""

        time.sleep(5)
        return f"Sum of {a} and {b} is {a + b}"

    async def _arun(self, a: float, b: float) -> str:
        """Async version is not implemented."""
        print("🔵 Tool: calculating sum of {a} and {b}")
        time.sleep(5)
        return f"Sum of {a} and {b} is {a + b}"


def get_available_tools() -> Dict[str, Type[BaseTool]]:
    """Return a dictionary of the tools provided by this plugin."""
    return {
        "example_tool": ExampleTool(),
        "calculate_tool": CalculateTool(),
        "print_call": PrintCallTool(),
    }


def main():
    """Print information about all available tools."""
    tools = get_available_tools()
    for name, tool in tools.items():
        print(f"Tool name: {name}")
        print(f"  Description: {tool.description}")
        print(f"  Args schema: {tool.args_schema.schema_json(indent=2)}")
        print(f"  Return Direct: {tool.return_direct}")
        print("")


if __name__ == "__main__":
    main()
