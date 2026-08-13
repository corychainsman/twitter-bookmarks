#!/usr/bin/env zsh
set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-nuc}"
REMOTE_PATH="${REMOTE_PATH:-~/twitter-bookmarks/.data/secrets/x-cookies.env}"
PROFILE_NAME="${PROFILE_NAME:-}"
PROFILE="${PROFILE:-}"

chrome_root="$HOME/Library/Application Support/Google/Chrome"

if [[ -z "$PROFILE" ]]; then
  PROFILE="$(
    PROFILE_NAME="$PROFILE_NAME" python3 - "$chrome_root" <<'PY'
import json
import os
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
profile_name = os.environ.get("PROFILE_NAME", "").strip()
state = json.loads((root / "Local State").read_text())
profiles = state.get("profile", {}).get("info_cache", {})

if profile_name:
    for key, value in profiles.items():
        if value.get("name") == profile_name or value.get("user_name") == profile_name:
            print(key)
            raise SystemExit(0)
    raise SystemExit(f'Could not find Chrome profile named "{profile_name}".')

for key, value in profiles.items():
    if (root / key / "Network" / "Cookies").exists() or (root / key / "Cookies").exists():
        print(key)
        raise SystemExit(0)

raise SystemExit("Could not find a Chrome profile with a Cookies database.")
PY
  )"
fi

cookie_db="$chrome_root/$PROFILE/Network/Cookies"
if [[ ! -f "$cookie_db" ]]; then
  cookie_db="$chrome_root/$PROFILE/Cookies"
fi

if [[ ! -f "$cookie_db" ]]; then
  print -u2 "Could not find Chrome cookies DB for profile folder: $PROFILE"
  exit 1
fi

tmp_db="$(mktemp)"
trap 'rm -f "$tmp_db"' EXIT
cp "$cookie_db" "$tmp_db"

print -u2 "Using Chrome profile folder: $PROFILE"

python3 - "$tmp_db" <<'PY' | ssh -o ExitOnForwardFailure=no -o ClearAllForwardings=yes "$REMOTE_HOST" "umask 077; mkdir -p \$(dirname $REMOTE_PATH); cat > $REMOTE_PATH"
import hashlib
import sqlite3
import subprocess
import sys

db = sys.argv[1]
password = subprocess.check_output(
    ["security", "find-generic-password", "-w", "-s", "Chrome Safe Storage"]
).rstrip()
key = hashlib.pbkdf2_hmac("sha1", password, b"saltysalt", 1003, 16)
iv = b" " * 16


def decrypt(value: bytes) -> str:
    if not value:
        return ""
    if value.startswith((b"v10", b"v11")):
        value = value[3:]
    result = subprocess.run(
        [
            "openssl",
            "enc",
            "-aes-128-cbc",
            "-d",
            "-K",
            key.hex(),
            "-iv",
            iv.hex(),
            "-nopad",
        ],
        input=value,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    output = result.stdout
    if not output:
        return ""
    padding = output[-1]
    if 1 <= padding <= 16:
        output = output[:-padding]
    if len(output) > 32:
        output = output[32:]
    return output.decode("utf-8", "ignore")


connection = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
rows: dict[str, str] = {}
for name, value, encrypted in connection.execute(
    """
    select name, value, encrypted_value
    from cookies
    where host_key in ('.x.com', 'x.com', '.twitter.com', 'twitter.com')
      and name in ('ct0', 'auth_token')
    """
):
    rows[name] = value or decrypt(encrypted)

print("CT0=" + rows.get("ct0", ""))
print("AUTH_TOKEN=" + rows.get("auth_token", ""))
PY

print -u2 "Sent X cookies to $REMOTE_HOST:$REMOTE_PATH"
