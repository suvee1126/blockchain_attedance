"""
Smart Attendance System - Main Python Application Entry Point
Run with:
    python main.py
or:
    python run.py
"""

import os
import sys
import uvicorn

# Ensure utf-8 encoding for Windows console
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.main import app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "127.0.0.1")
    
    print("\n" + "=" * 60)
    print(" [SMART ATTENDANCE] - BLOCKCHAIN-POWERED PYTHON SYSTEM")
    print("=" * 60)
    print(f" * Local Web Application : http://{host}:{port}/")
    print(f" * REST API Docs         : http://{host}:{port}/docs")
    print(f" * ReDoc Specification   : http://{host}:{port}/redoc")
    print("=" * 60)
    print(" Press CTRL+C to stop the server.\n")

    uvicorn.run("backend.main:app", host=host, port=port, reload=True, reload_dirs=["backend"])
