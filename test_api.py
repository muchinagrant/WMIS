#!/usr/bin/env python
import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kicowasco.settings')
django.setup()

from django.test import Client

client = Client()

# Test incidents endpoint
print("Testing /api/incidents/")
response = client.get('/api/incidents/')
print(f'Status: {response.status_code}')
if response.status_code == 200:
    try:
        data = json.loads(response.content)
        if isinstance(data, dict):
            print(f'Response is dict with keys: {list(data.keys())}')
            if 'results' in data:
                print(f'Results count: {len(data.get("results", []))}')
        elif isinstance(data, list):
            print(f'Response is array with {len(data)} items')
    except Exception as e:
        print(f'Error parsing JSON: {e}')
        print(f'Content: {response.content[:200]}')
else:
    print(f'Error response: {response.content[:500]}')

print("\n" + "="*50 + "\n")

# Test lab-records endpoint
print("Testing /api/lab-records/")
response = client.get('/api/lab-records/')
print(f'Status: {response.status_code}')
if response.status_code == 200:
    try:
        data = json.loads(response.content)
        if isinstance(data, dict):
            print(f'Response is dict with keys: {list(data.keys())}')
            if 'results' in data:
                print(f'Results count: {len(data.get("results", []))}')
        elif isinstance(data, list):
            print(f'Response is array with {len(data)} items')
    except Exception as e:
        print(f'Error parsing JSON: {e}')
else:
    print(f'Error response: {response.content[:500]}')

print("\n" + "="*50 + "\n")

# Test summary endpoint
print("Testing /api/summary/")
response = client.get('/api/summary/')
print(f'Status: {response.status_code}')
if response.status_code == 200:
    try:
        data = json.loads(response.content)
        print(f'Response structure: {type(data).__name__}')
        if isinstance(data, dict):
            print(f'Keys: {list(data.keys())[:5]}...')
    except Exception as e:
        print(f'Error parsing JSON: {e}')
else:
    print(f'Error response: {response.content[:500]}')
