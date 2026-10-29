import os
import sys
import subprocess
import webbrowser
import threading
import time
import socket

# Ensure utf-8 encoding for Windows console
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def get_local_wifi_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def check_and_build_frontend():
    dist_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist")
    if not os.path.exists(dist_dir) or not os.path.exists(os.path.join(dist_dir, "index.html")):
        print("[*] Building production frontend assets...")
        try:
            subprocess.run(["npm", "run", "build"], check=True, shell=True)
            print("[+] Frontend build completed successfully!")
        except Exception as e:
            print(f"[!] Notice during frontend build: {e}")

def open_browser():
    time.sleep(1.5)
    webbrowser.open("http://127.0.0.1:8000/")

if __name__ == "__main__":
    check_and_build_frontend()
    
    # Auto launch browser in a thread
    threading.Thread(target=open_browser, daemon=True).start()

    import uvicorn
    from backend.main import app

    local_ip = get_local_wifi_ip()

    print("\n" + "=" * 65)
    print(" [SMART ATTENDANCE] PYTHON SERVER STARTING")
    print("=" * 65)
    print(f" * Computer (Localhost) : http://127.0.0.1:8000/")
    print(f" * Mobile Phone (Wi-Fi) : http://{local_ip}:8000/")
    print(f" * API Swagger Docs     : http://127.0.0.1:8000/docs")
    print("=" * 65 + "\n")

    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
