# login.py
import sys
import os
import asyncio
from telethon import TelegramClient

API_ID = int(os.getenv("API_ID"))
API_HASH = os.getenv("API_HASH")

async def main():
    if len(sys.argv) < 2:
        print("Usage: python3 login.py <session_file>")
        return

    session_file = sys.argv[1]

    if not os.path.exists(session_file):
        print("❌ Session file not found.")
        return

    client = TelegramClient(session_file, API_ID, API_HASH)
    await client.start()

    me = await client.get_me()
    print(f"✅ Logged in as: {me.first_name} (@{me.username or 'no username'})")

    await client.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
    
