"""
Map OpenAI CUA keys to Playwright-compatible keys.
"""

CUA_KEY_TO_PLAYWRIGHT_KEY = {
    # Common / Basic Keys
    "return": "Enter",
    "enter": "Enter",
    "tab": "Tab",
    "backspace": "Backspace",
    "up": "ArrowUp",
    "down": "ArrowDown",
    "left": "ArrowLeft",
    "right": "ArrowRight",
    "space": "Space",
    "ctrl": "Control",
    "control": "Control",
    "alt": "Alt",
    "shift": "Shift",
    "meta": "Meta",
    "command": "Meta",
    "windows": "Meta",
    "esc": "Escape",
    "escape": "Escape",
    # Numpad Keys
    "kp_0": "Numpad0",
    "kp_1": "Numpad1",
    "kp_2": "Numpad2",
    "kp_3": "Numpad3",
    "kp_4": "Numpad4",
    "kp_5": "Numpad5",
    "kp_6": "Numpad6",
    "kp_7": "Numpad7",
    "kp_8": "Numpad8",
    "kp_9": "Numpad9",
    # Numpad Operations
    "kp_enter": "NumpadEnter",
    "kp_multiply": "NumpadMultiply",
    "kp_add": "NumpadAdd",
    "kp_subtract": "NumpadSubtract",
    "kp_decimal": "NumpadDecimal",
    "kp_divide": "NumpadDivide",
    # Navigation
    "page_down": "PageDown",
    "page_up": "PageUp",
    "home": "Home",
    "end": "End",
    "insert": "Insert",
    "delete": "Delete",
    # Function Keys
    "f1": "F1",
    "f2": "F2",
    "f3": "F3",
    "f4": "F4",
    "f5": "F5",
    "f6": "F6",
    "f7": "F7",
    "f8": "F8",
    "f9": "F9",
    "f10": "F10",
    "f11": "F11",
    "f12": "F12",
    # Left/Right Variants
    "shift_l": "ShiftLeft",
    "shift_r": "ShiftRight",
    "control_l": "ControlLeft",
    "control_r": "ControlRight",
    "alt_l": "AltLeft",
    "alt_r": "AltRight",
    # Media Keys
    "audiovolumemute": "AudioVolumeMute",
    "audiovolumedown": "AudioVolumeDown",
    "audiovolumeup": "AudioVolumeUp",
    # Additional Special Keys
    "print": "PrintScreen",
    "scroll_lock": "ScrollLock",
    "pause": "Pause",
    "menu": "ContextMenu",
    # Additional mappings for common variations
    "/": "Divide",
    "\\": "Backslash",
    "capslock": "CapsLock",
    "option": "Alt",  # Mac "option" maps to Alt
    "super": "Meta",  # Mac "⌘" or Win "⊞"
    "win": "Meta",
}


def translate_key(key: str) -> str:
    """
    Map CUA-style key strings to Playwright-compatible keys.
    Reference: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values
    
    Args:
        key: The key string to translate
        
    Returns:
        The Playwright-compatible key string
    """
    return CUA_KEY_TO_PLAYWRIGHT_KEY.get(key.lower(), key) 