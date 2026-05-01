#!/bin/bash
API="https://carey-omaha-resume-kitty.trycloudflare.com"
echo "=== APIWatch cURL Examples ==="
echo -e "\n1. Overall Status:"
curl -s "$API/status" | head -c 300
echo -e "\n\n2. Check GitHub:"
curl -s "$API/check/github" | head -c 300
echo -e "\n\n3. Check NPM:"
curl -s "$API/check/npm" | head -c 300
echo -e "\n"
