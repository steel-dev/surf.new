"""
JavaScript code and helper function for injecting a visible cursor overlay into the browser.
"""

from playwright.async_api import Page

async def inject_cursor_overlay(page: Page) -> None:
    """Inject a custom cursor overlay into the page."""
    await page.add_init_script("""
    // Only run in the top frame
    if (window.self === window.top) {
        function initCursor() {
            const CURSOR_ID = '__cursor__';
            if (document.getElementById(CURSOR_ID)) return;

            const cursor = document.createElement('div');
            cursor.id = CURSOR_ID;
            Object.assign(cursor.style, {
                position: 'fixed',
                top: '0px',
                left: '0px',
                width: '20px',
                height: '20px',
                backgroundImage: 'url("data:image/svg+xml;utf8,<svg width=\\'16\\' height=\\'16\\' viewBox=\\'0 0 20 20\\' fill=\\'black\\' outline=\\'white\\' xmlns=\\'http://www.w3.org/2000/svg\\'><path d=\\'M15.8089 7.22221C15.9333 7.00888 15.9911 6.78221 15.9822 6.54221C15.9733 6.29333 15.8978 6.06667 15.7555 5.86221C15.6133 5.66667 15.4311 5.52445 15.2089 5.43555L1.70222 0.0888888C1.47111 0 1.23555 -0.0222222 0.995555 0.0222222C0.746667 0.0755555 0.537779 0.186667 0.368888 0.355555C0.191111 0.533333 0.0755555 0.746667 0.0222222 0.995555C-0.0222222 1.23555 0 1.47111 0.0888888 1.70222L5.43555 15.2222C5.52445 15.4445 5.66667 15.6267 5.86221 15.7689C6.06667 15.9111 6.28888 15.9867 6.52888 15.9955H6.58221C6.82221 15.9955 7.04445 15.9333 7.24888 15.8089C7.44445 15.6845 7.59555 15.52 7.70221 15.3155L10.2089 10.2222L15.3022 7.70221C15.5155 7.59555 15.6845 7.43555 15.8089 7.22221Z\\' ></path></svg>")',
                backgroundSize: 'cover',
                pointerEvents: 'none',
                zIndex: '99999',
                transform: 'translate(-2px, -2px)',
            });

            document.body.appendChild(cursor);
            document.addEventListener("mousemove", (e) => {
                cursor.style.top = e.clientY + "px";
                cursor.style.left = e.clientX + "px";
            });
        }

        requestAnimationFrame(function checkBody() {
            if (document.body) {
                initCursor();
            } else {
                requestAnimationFrame(checkBody);
            }
        });
    }
    """) 