import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto('file:///c:/Users/abhishek/Desktop/LLMS%20Projects%20and%20code/LLM%20project/luna/choose.html')
        await page.wait_for_timeout(2000)
        await page.screenshot(path='choose_screenshot.png')
        await browser.close()

asyncio.run(main())
