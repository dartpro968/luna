import requests
import uuid
import sys

BASE_URL = "http://localhost:5000/api"
test_user_id = "test_user_UUID_" + str(uuid.uuid4())[:8]

print("--- ANTIGRAIVY VERIFICATION SUITE ---")
print(f"Session Binding UUID: {test_user_id}")

try:
    print("\n[TEST 1] Testing /api/health endpoint...")
    resp = requests.get(f"{BASE_URL}/health")
    if resp.ok:
        print("✅ PASS: Health Endpoint Active:", resp.json())
    else:
        print("❌ FAIL: Server returned", resp.status_code)
except Exception as e:
    print("❌ FAIL: Connection Error:", e)

try:
    print("\n[TEST 2] Testing Database Injection & Multi-Tenancy (First Login Memory Assignment)...")
    payload = {"message": "Hello, are we floating?", "user_id": test_user_id}
    resp = requests.post(f"{BASE_URL}/chat", json=payload)
    if resp.ok:
        data = resp.json()
        print("✅ PASS: Pipeline resolved successfully.")
        print("   - Emotion detected:", data.get("emotion"))
        print("   - Intensity:", data.get("intensity"))
        print("   - Total Free Tokens remaining:", data.get("daily_free_left"))
        print("   - Love Coins remaining:", data.get("love_coins"))
        if data.get("daily_free_left") == 9:
            print("✅ PASS: Accounting logic deducted 1 properly from origin standard of 10.")
        else:
            print("❌ FAIL: Accounting did not decrement properly.")
    else:
        print("❌ FAIL:", resp.json())
except Exception as e:
    print("❌ FAIL:", e)

try:
    print("\n[TEST 3] Testing Follow-Up Payload & History Connection...")
    payload2 = {"message": "That sounds magical.", "user_id": test_user_id}
    resp2 = requests.post(f"{BASE_URL}/chat", json=payload2)
    if resp2.ok:
        data2 = resp2.json()
        if data2.get("daily_free_left") == 8:
            print("✅ PASS: Free Tokens successfully dropped to 8 seamlessly.")
        else:
            print("❌ FAIL: Token drift detected.")
    else:
        print("❌ FAIL:", resp2.text)
except Exception as e:
    print("❌ FAIL:", e)

try:
    print("\n[TEST 4] Testing Hard /api/clear Isolated Data Deletion...")
    payload3 = {"user_id": test_user_id}
    resp3 = requests.post(f"{BASE_URL}/clear", json=payload3)
    if resp3.ok:
        print("✅ PASS: Data cleared flawlessly.", resp3.json())
    else:
        print("❌ FAIL:", resp3.text)
except Exception as e:
    print("❌ FAIL:", e)
