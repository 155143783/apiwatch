#!/bin/bash
URL="http://localhost:3003"
curl "$URL/health"
curl -X POST "$URL/api/endpoints" -H "Content-Type: application/json" \
  -d '{"url":"https://api.github.com/zen","method":"GET","interval":60}'
curl "$URL/api/endpoints"
curl "$URL/api/status"
curl "$URL/api/alerts"
