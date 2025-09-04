# session.py
import sys
from telegram import SessionManager

if __name__ == "__main__":
    if len(sys.argv) == 4:
        api_id = int(sys.argv[1])
        api_hash = sys.argv[2]
        phone = sys.argv[3]
        SessionManager.telethon(api_id, api_hash, phone)
    else:
        SessionManager.telethon()
        
