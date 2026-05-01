"""APIWatch - Python Monitoring Example"""
import requests, time

URL = "http://localhost:3003"

def add_endpoint(target_url, interval=60):
    return requests.post(f"{URL}/api/endpoints", json={
        "url": target_url, "method": "GET",
        "interval": interval, "timeout": 5000, "expected_status": 200
    }).json()

def get_status():
    return requests.get(f"{URL}/api/status").json()

if __name__ == "__main__":
    for ep in ["https://api.github.com/zen", "https://httpbin.org/status/200"]:
        print(f"Added: {ep} -> {add_endpoint(ep)}")
    time.sleep(5)
    print(f"Status: {get_status()}")
