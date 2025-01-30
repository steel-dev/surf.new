# Contributing a New Plugin

Thank you for your interest in extending this AI project! A *plugin* is a self-contained system that can handle its own agent logic, custom tools, and any specialized processing. Below is how to get started.

## 1. Folder Structure

Within the `api/plugins/` folder, create a subfolder for your plugin. Example:
```
api/plugins/my_new_plugin/
    ├── __init__.py
    ├── agent.py
    ├── tools.py
    ├── processors.py
    ├── router.py     (optional)
    └── config.py     (optional)
```

- **agent.py**  
  Your main "Agent" class or method. This class should take in user messages, decide if it needs to call tools, and produce a final response.

- **tools.py**  
  One or more functions or classes that perform actions. For instance, hitting a weather API, performing math, or interacting with a webpage.

- **processors.py**  
  Contains any logic to run after a tool completes, e.g. formatting the result, applying bounding boxes, or transforming data.

- **router.py** (optional)  
  If your plugin needs specific routes beyond the main chat route, you can define them here.

- **config.py** (optional)  
  If your plugin has unique environment variables or other configuration settings, place them here.

## 2. Implementing the Plugin Agent

- The agent should at least have a method (e.g. `handle_messages(messages: List[Message]) -> str`) that returns the final response text or data.
- If it calls tools, the agent is responsible for receiving the tool output and integrating it into its final result.

## 3. Example Flow

1. **User sends a request** containing messages.  
2. **Your agent** reads the messages, checks if it needs to call a tool.  
3. **Tools** are invoked (if needed).  
4. **Processors** can be applied to the tool output.  
5. **Agent returns** final data or text.

## 4. Using Your Plugin

In the main code (e.g. `api/index.py`), you might import your plugin and choose to instantiate it based on user input or config:
```python
# pseudocode
from .plugins.my_new_plugin.agent import MyNewAgent

agent = MyNewAgent()
result = agent.handle_messages(user_messages)
return result
```

## 5. Tips

- Keep dependencies minimal. If your plugin requires external libraries, list them separately so others can install them only if they want your plugin.  
- Write tests if your plugin does something non-trivial.  
- Try to keep plugin structure consistent so others can follow a common pattern.  

**Happy building!**
