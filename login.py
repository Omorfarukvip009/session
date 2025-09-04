# login.py
import sys
import asyncio
from telethon import TelegramClient

async def main():
    if len(sys.argv) < 4:
        print("Usage: python3 login.py api_id api_hash session_file")
        sys.exit(1)

    api_id = int(sys.argv[1])
    api_hash = sys.argv[2]
    session_file = sys.argv[3]

    client = TelegramClient(session_file, api_id, api_hash)
    await client.connect()

    if not await client.is_user_authorized():
        print("❌ Session is not authorized. Please generate again.")
    else:
        me = await client.get_me()
        print(f"✅ Logged in as {me.first_name} (ID: {me.id})")

    await client.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
