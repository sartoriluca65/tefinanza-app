"""Optional Chromium integration test; synthetic data, new temporary browser context, loopback only."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import shutil
import re
import threading
from playwright.sync_api import sync_playwright, expect


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    directory = Path(__file__).resolve().parent
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(directory)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    origin = "http://127.0.0.1:" + str(server.server_port)
    try:
        with sync_playwright() as p:
            executable = shutil.which("chromium") or shutil.which("google-chrome")
            browser = p.chromium.launch(executable_path=executable, headless=True,
                args=["--no-sandbox", "--disable-background-networking", "--disable-sync", "--no-first-run"])
            context = browser.new_context(service_workers="block")
            blocked = []
            def route(request):
                if request.request.url.startswith(origin + "/"):
                    request.continue_()
                else:
                    blocked.append(True)
                    request.abort()
            context.route("**/*", route)
            page = context.new_page()
            page.goto(origin + "/browser-test.html")
            page.wait_for_function("document.querySelector('#status').textContent.startsWith('PASS:') || document.querySelector('#status').textContent.startsWith('FAIL:')")
            status = page.locator("#status").inner_text()
            assert status.startswith("PASS:"), "SYNTHETIC_BROWSER_TEST_FAILED"
            page.goto(origin + "/lab.html")
            expect(page.locator('#profile option').first).to_be_attached()
            with page.expect_download() as downloaded:
                page.locator("#fixture").click()
            synthetic_file = downloaded.value.path()
            expect(page.locator('#status')).to_have_text(re.compile('^Download'))
            page.locator("#input").set_input_files(synthetic_file)
            page.locator("#verify").click()
            expect(page.locator('#status')).to_have_text(re.compile('^Formato,'))
            page.locator("#restore").click()
            expect(page.locator('#status')).to_have_text(re.compile('^Copia importata'))
            assert not blocked, "UNEXPECTED_EXTERNAL_REQUEST"
            print(status)
            print("PASS: laboratory UI synthetic download, file reread, verification, isolated import")
            print("EXTERNAL_REQUESTS: 0; EXISTING_BROWSER_PROFILES_USED: 0")
            context.close()
            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
