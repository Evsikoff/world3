from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:8000/test_parent.html")
    page.wait_for_timeout(1000)

    # Click init progress
    page.get_by_text("Send init (With Progress)").click()
    page.wait_for_timeout(1000)

    # Click init solved
    page.get_by_text("Send init (Solved)").click()
    page.wait_for_timeout(1500)

    page.screenshot(path="/home/jules/verification/screenshots/verification.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
