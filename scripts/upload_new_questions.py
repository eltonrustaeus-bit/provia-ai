"""Upload new questions (ID >= 391) to Supabase driving_questions table."""
import json, urllib.request, sys

KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ubW90ZGx1aWd6ZWVoZGpiaGJ1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMzNzA4NCwiZXhwIjoyMDg1OTEzMDg0fQ.Fn-8x3vlgyU8OP6D5Cz1jiA7qSjqnXV5Wx-hR3nl5cc"
URL = "https://mnmotdluigzeehdjbhbu.supabase.co/rest/v1/driving_questions"
HEADERS = {
    "apikey": KEY,
    "Authorization": "Bearer " + KEY,
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

with open("C:/Users/elton/Desktop/ProvKlarUF/scripts/questions.json", encoding="utf-8") as f:
    all_q = json.load(f)

new_q = [q for q in all_q if q["id"] >= 391]
sys.stdout.write("Uploading " + str(len(new_q)) + " new questions (ID >= 391)...\n")

ok = 0
fail = 0
for q in new_q:
    body = json.dumps(q).encode("utf-8")
    req = urllib.request.Request(URL, data=body, method="POST")
    for k, v in HEADERS.items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req) as resp:
            ok += 1
            sys.stdout.write("OK " + str(q["id"]) + " " + q["category"] + "\n")
    except urllib.error.HTTPError as e:
        fail += 1
        err = e.read().decode("utf-8", errors="replace")
        sys.stdout.write("FAIL " + str(q["id"]) + ": " + str(e.code) + " " + err[:100] + "\n")

sys.stdout.write("\nDone. OK=" + str(ok) + " FAIL=" + str(fail) + "\n")
