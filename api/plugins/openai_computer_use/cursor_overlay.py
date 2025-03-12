"""
JavaScript code and helper function for injecting a visible cursor overlay into the browser.
"""

CURSOR_OVERLAY_SCRIPT = """
(() => {
  // Add a cursor to every top-level document
  if (window.self === window.top) {
    function initCursor() {
      const CURSOR_ID = '__cua_cursor__';

      // Avoid re-injecting if it already exists
      if (document.getElementById(CURSOR_ID)) return;

      const cursor = document.createElement('div');
      cursor.id = CURSOR_ID;
      Object.assign(cursor.style, {
        position: 'fixed',
        top: '0px',
        left: '0px',
        width: '24px',
        height: '24px',
        backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 24 24\\' fill=\\'black\\' stroke=\\'white\\' stroke-width=\\'1\\' stroke-linejoin=\\'round\\' stroke-linecap=\\'round\\'><polygon points=\\'2,2 2,22 8,16 14,22 17,19 11,13 20,13\\'/></svg>")',
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        pointerEvents: 'none',
        zIndex: '999999',
        transform: 'translate(-2px, -2px)',
      });

      document.body.appendChild(cursor);

      document.addEventListener('mousemove', (e) => {
        cursor.style.top = e.clientY + 'px';
        cursor.style.left = e.clientX + 'px';
      }, { passive: true });
    }

    // Wait for <body> to exist
    requestAnimationFrame(function checkBody() {
      if (document.body) {
        initCursor();
      } else {
        requestAnimationFrame(checkBody);
      }
    });
  }
})();
"""

async def inject_cursor_overlay(page):
    """
    Injects the cursor overlay script into a Playwright page.
    
    Args:
        page: A Playwright Page object
        
    The script creates a visible cursor overlay that follows mouse movements,
    making it easier to track the agent's actions in the remote browser.
    """
    await page.add_init_script(CURSOR_OVERLAY_SCRIPT) 