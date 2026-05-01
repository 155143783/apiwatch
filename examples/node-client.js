#!/usr/bin/env node
const https = require('https');
const API = 'https://carey-omaha-resume-kitty.trycloudflare.com';

async function get(path) {
    return new Promise((resolve, reject) => {
        https.get(`https://${API.replace('https://','')}${path}`, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => resolve(JSON.parse(d)));
        }).on('error', reject);
    });
}

async function main() {
    console.log('=== APIWatch Node.js Examples ===\n');
    console.log('Status:', JSON.stringify(await get('/status')).slice(0, 300));
    console.log('GitHub:', JSON.stringify(await get('/check/github')).slice(0, 300));
}
main().catch(console.error);
