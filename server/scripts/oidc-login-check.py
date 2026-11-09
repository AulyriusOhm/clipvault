"""End-to-end OIDC login against Authentik, without a browser.

Runs the authentication flow through Authentik's flow executor API, retrieves
the authorization code, posts it to ClipVault's /auth/callback, then checks that
the session is actually opened on the application side.

No test account is kept on the IdP: create one by hand (password, no group) for
the duration of the check, then delete it.

Usage: CLIPVAULT_TEST_PASSWORD=… python3 scripts/oidc-login-check.py [--verbose]
Variables: CLIPVAULT_TEST_USER (default clipvault-test), CLIPVAULT_APP,
CLIPVAULT_ISSUER.
"""
import http.cookiejar
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

APP = os.environ.get("CLIPVAULT_APP", "http://127.0.0.1:8099")
ISSUER = os.environ.get("CLIPVAULT_ISSUER", "https://auth.lanro.eu")
FLOW = "default-authentication-flow"
USERNAME = os.environ.get("CLIPVAULT_TEST_USER", "clipvault-test")
PASSWORD = os.environ.get("CLIPVAULT_TEST_PASSWORD")
VERBOSE = "--verbose" in sys.argv
WRITE_TESTS = "--write-tests" in sys.argv
UPLOAD = ""
if "--upload" in sys.argv:
    UPLOAD = sys.argv[sys.argv.index("--upload") + 1]

if not PASSWORD:
    sys.exit("CLIPVAULT_TEST_PASSWORD is required (password of the Authentik test account).")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar), NoRedirect())
opener.addheaders = [("User-Agent", "clipvault-e2e/0.1"), ("Accept", "application/json, text/html")]


def log(*args):
    if VERBOSE:
        print("     ", *args)


def csrf_token():
    for cookie in jar:
        if cookie.name.lower() in ("authentik_csrf", "csrftoken"):
            return cookie.value
    return ""


def call(url, payload=None):
    body = None
    headers = {}
    if payload is not None:
        body = json.dumps(payload).encode()
        headers["Content-Type"] = "application/json"
        token = csrf_token()
        if token:
            headers["X-CSRFToken"] = token
    req = urllib.request.Request(url, data=body, headers=headers)
    try:
        with opener.open(req, timeout=25) as response:
            return response.status, {k.lower(): v for k, v in response.headers.items()}, response.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as error:
        return error.code, {k.lower(): v for k, v in error.headers.items()}, error.read().decode("utf-8", "replace")


def as_json(text):
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def walk(url, hops=10):
    """Follows redirects and redirect-like challenges until back on the app."""
    current = url
    for _ in range(hops):
        if "/auth/callback" in current:
            return current
        status, headers, body = call(current)
        log(status, current[:70], "→", headers.get("location", "")[:60])
        location = headers.get("location", "")
        if location and "/auth/callback" in location:
            return location
        challenge = as_json(body)
        if challenge:
            if str(challenge.get("component", "")).startswith("xak-flow-redirect"):
                current = urllib.parse.urljoin(ISSUER, challenge.get("to", ""))
                continue
            log("challenge inattendu:", challenge.get("component"))
            return ""
        if status in (301, 302, 303, 307) and location:
            current = urllib.parse.urljoin(current, location)
            continue
        return ""
    return ""


def main() -> int:
    print("1. start on the ClipVault side")
    status, headers, _ = call(f"{APP}/auth/start")
    authorize = headers.get("location", "")
    if status != 302 or "authorize" not in authorize:
        print(f"   failure: {status} {authorize[:120]}")
        return 1
    print("   → authorize built (state, nonce, PKCE S256)")

    print("2. Authentik: opening the flow")
    status, headers, _ = call(authorize)
    location = headers.get("location", "")
    if "error=" in location:
        print("   refused:", urllib.parse.parse_qs(urllib.parse.urlparse(location).query).get("error_description"))
        return 1
    flow_url = urllib.parse.urljoin(ISSUER, location)
    status, headers, _ = call(flow_url)
    flow_url = urllib.parse.urljoin(flow_url, headers.get("location", "") or flow_url)
    query = urllib.parse.parse_qs(urllib.parse.urlparse(flow_url).query).get("query", [""])[0]
    executor = f"{ISSUER}/api/v3/flows/executor/{FLOW}/?query={urllib.parse.quote(query)}"
    print("   flow opened")

    print("3. steps")
    status, _, body = call(executor)
    challenge = as_json(body) or {}
    callback = ""

    for step in range(3):
        component = str(challenge.get("component", ""))
        if not component:
            print("   unexpected component:", body[:200])
            return 1
        print(f"   {step + 1}. {component}")

        if component.startswith("xak-flow-redirect"):
            callback = walk(urllib.parse.urljoin(ISSUER, challenge.get("to", "")))
            break
        if component == "ak-stage-identification":
            payload = {"component": component, "uid_field": USERNAME}
        elif component == "ak-stage-password":
            payload = {"component": component, "password": PASSWORD}
        elif component == "ak-stage-consent":
            payload = {"component": component, "token": challenge.get("token", "")}
        else:
            print("   unsupported step")
            return 1

        _, headers, body = call(executor, payload)
        challenge = as_json(body) or {}
        if not challenge:
            location = headers.get("location", "")
            if location and "/flows/executor/" not in location:
                challenge = {"component": "xak-flow-redirect", "to": location}
            else:
                status, headers, body = call(executor)
                challenge = as_json(body) or {}
                if not challenge and headers.get("location"):
                    challenge = {"component": "xak-flow-redirect", "to": headers["location"]}
        if not challenge:
            print("   dead end:", body[:160])
            return 1

    if not callback:
        print("   resuming: requesting /authorize again once authenticated")
        callback = walk(authorize)
    if not callback:
        print("   no return to /auth/callback")
        return 1
    print("4. authorization code received on", callback.split("?")[0])

    # the return may target the public URL (public_url setting): the script runs
    # on the same machine as the application, so the call is brought back to APP so
    # that the session cookie matches, the state still being validated server-side
    parsed = urllib.parse.urlparse(callback)
    app_parsed = urllib.parse.urlparse(APP)
    if parsed.netloc != app_parsed.netloc:
        print(f"   return rewritten from {parsed.netloc} to {app_parsed.netloc} (local test)")
        callback = urllib.parse.urlunparse(parsed._replace(scheme=app_parsed.scheme, netloc=app_parsed.netloc))

    print("5. posting the code to /auth/callback")
    status, headers, _ = call(callback)
    landing = headers.get("location", "")
    print(f"   {status} → {landing[:80]}")
    if status != 302 or "error" in landing:
        return 1

    print("6. session opened?")
    status, _, body = call(f"{APP}/library")
    name = body.split('<span class="name">')[1].split("<")[0] if '<span class="name">' in body else ""
    chip = body.split('class="userchip"')[-1] if 'class="userchip"' in body else ""
    role = chip.split('<span class="num">')[1].split("<")[0] if '<span class="num">' in chip else ""
    print(f"   library {status} · user « {name} » · role « {role} »")
    if not name:
        return 1

    print("7. administration")
    status, _, body = call(f"{APP}/admin")
    expected = ["Instance settings", "Create an invitation link", "Invitation"]
    missing = [label for label in expected if label not in body]
    print(f"   /admin {status} · missing: {missing or 'none'}")

    if UPLOAD:
        print("8. uploading a real file")
        bound = "----clipvault" + str(int(time.time()))
        name = os.path.basename(UPLOAD)
        with open(UPLOAD, "rb") as handle:
            payload = handle.read()
        parts = []
        for field, value in (("title", "Upload test " + name), ("game", "Test"), ("tags", "e2e, upload"), ("visibility", "public")):
            parts.append(f"--{bound}\r\nContent-Disposition: form-data; name=\"{field}\"\r\n\r\n{value}\r\n".encode())
        parts.append(f"--{bound}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{name}\"\r\nContent-Type: video/mp4\r\n\r\n".encode() + payload + b"\r\n")
        parts.append(f"--{bound}--\r\n".encode())
        body = b"".join(parts)
        req = urllib.request.Request(f"{APP}/upload", data=body, headers={
            "Content-Type": f"multipart/form-data; boundary={bound}", "Content-Length": str(len(body))})
        try:
            with opener.open(req, timeout=180) as response:
                print("   POST", response.status, "→", {k.lower(): v for k, v in response.headers.items()}.get("location", ""))
        except urllib.error.HTTPError as error:
            print("   POST", error.code)
        for _ in range(30):
            time.sleep(2)
            _, _, raw = call(f"{APP}/api/jobs")
            jobs = json.loads(raw) if raw else []
            state = jobs[0]["state"] if jobs else "?"
            if state in ("done", "failed"):
                print("   job:", state, "·", jobs[0].get("detail", ""))
                break
        _, _, body_html = call(f"{APP}/library")
        print("   clip visible in the library:", name in body_html or "Upload test" in body_html)

    if not WRITE_TESTS:
        print("8-9. writes skipped (rerun with --write-tests to exercise them)")
        return 0

    print("8. saving the settings")
    form = "instance_name=La+Tani%C3%A8re&default_visibility=link&link_expiry_days=30&max_upload_gb=4"
    status, headers, _ = call(f"{APP}/admin/settings", None) if False else (None, None, None)
    req = urllib.request.Request(f"{APP}/admin/settings", data=form.encode(),
                                 headers={"Content-Type": "application/x-www-form-urlencoded"})
    try:
        with opener.open(req, timeout=20) as response:
            print("   POST", response.status, "→", {k.lower(): v for k, v in response.headers.items()}.get("location", ""))
    except urllib.error.HTTPError as error:
        print("   POST failed", error.code)
    status, _, body = call(f"{APP}/admin")
    print("   expiry 30 days applied:", 'value="30"' in body)

    print("9. creating an invite")
    req = urllib.request.Request(f"{APP}/admin/invites", data=b"note=test+e2e&expires_days=1",
                                 headers={"Content-Type": "application/x-www-form-urlencoded"})
    try:
        with opener.open(req, timeout=20) as response:
            pass
    except urllib.error.HTTPError:
        pass
    status, _, body = call(f"{APP}/admin")
    token = ""
    if "/join/" in body:
        token = body.split("/join/")[1].split('"')[0].split("<")[0]
    print("   token created:", token or "none")
    if token:
        status, headers, _ = call(f"{APP}/join/{token}")
        print(f"   /join/{token[:8]}… {status} → {headers.get('location', '')}")

    return 0 if not missing and token else 1


if __name__ == "__main__":
    sys.exit(main())
