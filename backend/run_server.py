import asyncio
import sys
import uvicorn
import os

from setup_kohya import setup_kohya

if __name__ == "__main__":
    # Force ProactorEventLoop on Windows for subprocess support
    # (Must be done before uvicorn.run or loop creation)
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    
    # Ensure kohya_ss is available
    print("Проверяем наличие kohya_ss...")
    setup_kohya()
    
    # Run uvicorn programmatically
    print(f"Setting event loop policy: {asyncio.get_event_loop_policy()}")
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=False)
