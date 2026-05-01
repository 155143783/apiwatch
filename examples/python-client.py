#!/usr/bin/env python3
"""
APIWatch - Python Client Example
API health monitoring and alerting
"""

import requests
import json

API_URL = "https://carey-omaha-resume-kitty.trycloudflare.com"

def check_api(endpoint: str):
    """Check API health"""
    response = requests.get(f"{API_URL}/check/{endpoint}")
    return response.json()

def get_status():
    """Get overall APIWatch status"""
    response = requests.get(f"{API_URL}/status")
    return response.json()

def main():
    print("=== APIWatch Examples ===\n")
    
    print("1. Overall Status:")
    result = get_status()
    print(json.dumps(result, indent=2)[:500])
    print()
    
    print("2. Check GitHub API:")
    result = check_api("github")
    print(json.dumps(result, indent=2)[:500])
    print()
    
    print("3. Check NPM API:")
    result = check_api("npm")
    print(json.dumps(result, indent=2)[:500])

if __name__ == "__main__":
    main()
