# session.py
import sys
from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.errors import SessionPasswordNeededError

if __name__ == "__main__":
    if len(sys.argv) < 5:
        print("Usage:")
        print("  Step 1: python3 session.py api_id api_hash phone request")
        print("  Step 2: python3 session.py api_id api_hash phone otp=<code>")
        print("  Step 3: python3 session.py api_id api_hash phone otp=<code> password=<2fa>")
        sys.exit(1)

    api_id = int(sys.argv[1])
    api_hash = sys.argv[2]
    phone = sys.argv[3]
    args = sys.argv[4:]

    client = TelegramClient(f"{phone}.session", api_id, api_hash)
    client.connect()

    if args[0] == "request":
        client.send_code_request(phone)
        print("CODE_REQUESTED")
        client.disconnect()

    else:
        otp = None
        password = None
        for a in args:
            if a.startswith("otp="):
                otp = a.split("=")[1]
            if a.startswith("password="):
                password = a.split("=")[1]

        try:
            if otp:
                client.sign_in(phone, otp)
        except SessionPasswordNeededError:
            if password:
                client.sign_in(password=password)
            else:
                print("NEED_2FA")
                client.disconnect()
                sys.exit(0)

        print(f"SESSION_FILE={phone}.session")
        print(f"STRING_SESSION={StringSession.save(client.session)}")
        client.disconnect()
        
