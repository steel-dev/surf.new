import asyncio
import json
from playwright.async_api import async_playwright
from tools import (
    GoToUrlTool,
    GetCurrentUrlTool,
    ClaudeComputerTool,
)
from steel import Steel
import os

STEEL_API_KEY = os.getenv("STEEL_API_KEY")
STEEL_CONNECT_URL = os.getenv("STEEL_CONNECT_URL")
STEEL_API_URL = os.getenv("STEEL_API_URL")

# Initialize Steel client with the API key from environment variables
client = Steel(
    steel_api_key=STEEL_API_KEY,
    base_url=STEEL_API_URL,
)


async def test_basic_navigation():
    """Test basic navigation using Steel session and tools"""
    print("\n=== Starting basic navigation test ===")

    # Create Steel session directly
    session = client.sessions.create()
    print(f"Session created successfully with Session ID: {session.id}.")
    print(f"You can view the session live at {session.session_viewer_url}\n")

    # Connect Playwright
    playwright = await async_playwright().start()
    browser = await playwright.chromium.connect_over_cdp(
        f"{STEEL_CONNECT_URL}?apiKey={STEEL_API_KEY}&sessionId={session.id}"
    )

    # Create page at existing context
    current_context = browser.contexts[0]
    page = await current_context.new_page()

    print("✓ Browser session started")

    try:
        # Navigate to langchain.com then example.com
        print("\nNavigating to langchain.com...")
        await GoToUrlTool(page).ainvoke(
            {"url": "https://langchain.com", "id": "test-navigation"}
        )
        print("\nNavigating to example.com...")
        await GoToUrlTool(page).ainvoke(
            {"url": "https://example.com", "wait_time": 3000, "id": "test-navigation"}
        )

        print("✓ Navigation successful")

        # Get current URL
        print("\nValidating current URL...")
        current_url = await GetCurrentUrlTool(page).ainvoke({})
        current_url = current_url.content

        # Validate the current URL
        test_passed = current_url == "https://example.com/"
        print(
            "✓ URL validation successful"
            if test_passed
            else f"✗ URL validation failed - got {current_url}"
        )

        return test_passed

    finally:
        # Cleanup: Release the session
        await browser.close()
        await playwright.stop()
        client.sessions.release(session.id)
        print("\n✓ Session released")

    print("\n=== Test completed ===")


async def test_claude_computer_tool_mouse():
    """
    Test the ClaudeComputerTool's mouse coordinate functionality by:
    1. Navigating to an online "mouse tracking" page (openprocessing).
    2. Using the 'mouse_move' action to move the cursor.
    3. Checking the page content for the updated coordinates.
    """
    print("\n=== Starting ClaudeComputerTool Mouse Coordinate Test ===")

    # Create Steel session directly
    session = client.sessions.create()
    print(
        f"""Session created successfully with Session ID: {session.id}.
You can view the session live at {session.session_viewer_url}
    """
    )

    # Connect Playwright
    playwright = await async_playwright().start()
    browser = await playwright.chromium.connect_over_cdp(
        f"{STEEL_CONNECT_URL}?apiKey={STEEL_API_KEY}&sessionId={session.id}"
    )

    # Create page at existing context
    currentContext = browser.contexts[0]
    page = await currentContext.new_page()

    print("✓ Browser session started")

    try:
        # 1. Navigate to a site that displays cursor position
        target_url = "https://openprocessing.org/sketch/651980/"
        print(f"\nNavigating to {target_url}...")
        await GoToUrlTool(page).ainvoke({"url": target_url, "wait_time": 3000})

        # 2. Move the mouse to a coordinate (e.g., (150, 150))
        move_x, move_y = 150, 150
        print(f"\nMoving mouse to coordinate ({move_x}, {move_y})...")
        await ClaudeComputerTool(page).ainvoke(
            {"action": "mouse_move", "coordinate": (move_x, move_y), "wait_time": 2000}
        )

        # 3. Attempt to read the page HTML or text to confirm the displayed coordinates
        # (Note: This depends on how the site displays them. We'll do a simple check.)
        page_content = await page.content()
        # We'll do a naive check that the page might contain the numeric values
        coord_check_str = f"{move_x}" in page_content or f"{move_y}" in page_content

        # This is purely illustrative; real verifying logic might differ:
        test_passed = coord_check_str
        print(
            "✓ Coordinate display check passed"
            if test_passed
            else "✗ Coordinate display check failed (didn't find them in HTML)"
        )

        return test_passed

    finally:
        # Cleanup
        await browser.close()
        await playwright.stop()
        client.sessions.release(session.id)
        print("\n✓ Session released")


async def test_claude_computer_tool_stress():
    """
    Stress-test various actions of ClaudeComputerTool by:
    1. Navigating to https://automationintesting.online/
    2. Moving and clicking text fields (via coordinates).
    3. Typing form data (name, email, subject, message).
    4. Submitting the form.
    5. Verifying success or any post-submission text in the page.

    NOTE: Because these are coordinate-based interactions, exact values may differ
    depending on the layout. Adjust accordingly if the site changes.
    """
    print(
        "\n=== Starting ClaudeComputerTool Stress Test on automationintesting.online ==="
    )

    # Create Steel session directly
    session = client.sessions.create()
    print(f"Session created successfully with Session ID: {session.id}.")
    print(f"You can view the session live at {session.session_viewer_url}\n")

    # Connect Playwright
    playwright = await async_playwright().start()
    browser = await playwright.chromium.connect_over_cdp(
        f"{STEEL_CONNECT_URL}?apiKey={STEEL_API_KEY}&sessionId={session.id}"
    )

    # Create page at existing context
    current_context = browser.contexts[0]
    page = await current_context.new_page()

    print("✓ Browser session started")

    try:
        # 1. Navigate to https://automationintesting.online/
        target_url = "https://automationintesting.online/"
        print(f"\nNavigating to {target_url}...")
        await GoToUrlTool(page).ainvoke({"url": target_url, "wait_time": 2000})

        # Because we don't have direct element selectors (we're focusing on the ClaudeComputerTool),
        # we simulate interactions via coordinates. This is an approximation for demonstration.

        # Example approximate positions for fields on the page's contact form:
        #   (You may need to adjust these values based on the actual layout.)

        # Do a page down action to ensure form is visible
        # Loop through page down key presses to scroll the page
        for i in range(2):
            print(f"\nPressing Page Down key (loop {i+1}/5)...")
            await ClaudeComputerTool(page).ainvoke(
                {"action": "key", "text": "PageDown"}
            )

        # 2. Move to the "Name" field, left-click, then type a name
        name_field_coords = (350, 400)  # Adjust these as necessary
        print(f"\nMoving mouse, then clicking Name field at {name_field_coords} ...")
        await ClaudeComputerTool(page).ainvoke(
            {"action": "mouse_move", "coordinate": name_field_coords, "wait_time": 1000}
        )
        await ClaudeComputerTool(page).ainvoke(
            {"action": "left_click", "wait_time": 500}
        )
        print("Typing 'Test Name' ...")
        await ClaudeComputerTool(page).ainvoke(
            {"action": "type", "text": "Test Name", "wait_time": 1000}
        )

        # # 3. Move to the "Email" field, left-click, then type an email
        # email_field_coords = (250, 1000)  # Adjust if needed
        # print(
        #     f"\nMoving mouse, then clicking Email field at {email_field_coords} ...")
        # await ClaudeComputerTool(page).ainvoke({
        #     "action": "mouse_move",
        #     "coordinate": email_field_coords,
        #     "wait_time": 1000
        # })
        # await ClaudeComputerTool(page).ainvoke({
        #     "action": "left_click",
        #     "wait_time": 500
        # })
        # print("Typing 'test@example.com' ...")
        # await ClaudeComputerTool(page).ainvoke({
        #     "action": "type",
        #     "text": "test@example.com",
        #     "wait_time": 1000
        # })

        # # 4. Move to the "Subject" field, left-click, and type subject
        # subject_field_coords = (250, 1100)  # Adjust if needed
        # print(
        #     f"\nMoving mouse, then clicking Subject field at {subject_field_coords} ...")
        # await ClaudeComputerTool(page).ainvoke({
        #     "action": "mouse_move",
        #     "coordinate": subject_field_coords,
        #     "wait_time": 1000
        # })
        # await ClaudeComputerTool(page).ainvoke({
        #     "action": "left_click",
        #     "wait_time": 500
        # })
        # print("Typing 'My Subject' ...")
        # await ClaudeComputerTool(page).ainvoke({
        #     "action": "type",
        #     "text": "My Subject",
        #     "wait_time": 1000
        # })

        # # 5. Move to the "Message" field, left-click, and type message
        # message_field_coords = (250, 1200)  # Adjust if needed
        # print(
        #     f"\nMoving mouse, then clicking Message field at {message_field_coords} ...")
        # await ClaudeComputerTool(page).ainvoke({
        #     "action": "mouse_move",
        #     "coordinate": message_field_coords,
        #     "wait_time": 1000
        # })
        # await ClaudeComputerTool(page).ainvoke({
        #     "action": "left_click",
        #     "wait_time": 500
        # })
        # print("Typing 'Hello, this is a test message.' ...")
        # await ClaudeComputerTool(page).ainvoke({
        #     "action": "type",
        #     "text": "Hello, this is a test message.",
        #     "wait_time": 1000
        # })

        # # 6. Move to the "Submit" button, left-click to submit
        # submit_button_coords = (400, 1400)  # Adjust if needed
        # print(
        #     f"\nMoving mouse, then clicking Submit button at {submit_button_coords} ...")
        # await ClaudeComputerTool(page).ainvoke({
        #     "action": "mouse_move",
        #     "coordinate": submit_button_coords,
        #     "wait_time": 1000
        # })
        # await ClaudeComputerTool(page).ainvoke({
        #     "action": "left_click",
        #     "wait_time": 1500
        # })

        # 7. Optional: check if submission was successful
        page_content = await page.content()
        # For example, let's see if "Thanks for getting in touch" text is present
        success_text = "Thanks for getting in touch"
        test_passed = success_text.lower() in page_content.lower()
        if test_passed:
            print("✓ Form submission success text found.")
        else:
            print(
                "✗ Couldn't find success text. The site or coordinates may have changed."
            )

        return test_passed

    finally:
        # Cleanup
        await browser.close()
        await playwright.stop()
        client.sessions.release(session.id)
        print("\n✓ Session released")


def main():
    """Run all tests"""
    print("Starting test suite...")

    # Run tests
    # basic_nav_result = asyncio.run(test_basic_navigation())
    # mouse_tool_result = asyncio.run(test_claude_computer_tool_mouse())
    stress_test_result = asyncio.run(test_claude_computer_tool_stress())

    print("\nTest Summary:")
    # print(f"Basic Navigation Test:      {'PASSED' if basic_nav_result else 'FAILED'}")
    # print(f"Mouse Coordinate Test:      {'PASSED' if mouse_tool_result else 'FAILED'}")
    print(f"Stress Test (Form Submit):  {'PASSED' if stress_test_result else 'FAILED'}")


if __name__ == "__main__":
    main()
