# VOZ app (com.frzzy.vozma26) — decompile + API map

Reverse-engineering notes for `voz-app/base.apk`. Everything below was read out of the
decompiled sources and verified against the live API on 2026-11-05.

---

## 1. How the APK was decompiled

Tool: `jadx` CLI from `.github/skills/jadx-cli` (never `java -jar`, that opens the GUI).

```powershell
$jadx = "D:\Data 2\Github-Clone\siritami\.github\skills\jadx-cli\jadx.ps1"

# code + resources + manifest
& $jadx -d "D:\Data 2\Github-Clone\siritami\voz-app\decompiled" --no-imports `
        "D:\Data 2\Github-Clone\siritami\voz-app\base.apk"
```

Result: `voz-app\decompiled\sources\...` (Java) and `voz-app\decompiled\resources\...`
(decoded `AndroidManifest.xml`, `assets/`, `res/`).

The app is **Expo / React Native**, so the Java tree only contains the RN runtime.
All business logic lives in the Hermes bytecode bundle:

```
voz-app\decompiled\resources\assets\index.android.bundle   (4.87 MB, HBC magic C6 1F BC 03)
```

Hermes bundle → readable JS:

```powershell
pip install hermes-dec
python -m hermes_dec.decompilation.hbc_decompiler `
  "D:\Data 2\Github-Clone\siritami\voz-app\decompiled\resources\assets\index.android.bundle" `
  "D:\Data 2\Github-Clone\siritami\voz-app\hermes_out.js"
```

Output is register-level pseudo-JS (`r0`, `r1`, `_closure0_slot3`, …) but every function
keeps its original name in `// Original name: xxx`, which is enough to reconstruct the API
layer. Line numbers below refer to `voz-app\hermes_out.js`.

---

## 2. App identity

| Field | Value |
|---|---|
| package | `com.frzzy.vozma26` |
| display name | VOZ |
| version | 1.0.0 (versionCode 3) |
| min / target SDK | 24 / 36 |
| framework | Expo SDK 57, expo-router, React Native (Hermes) |
| scheme | `vozma26` (also `exp+voz-ma-26`) |
| EAS project | `40a5c2d5-3a42-4138-bcae-ba9eef56c22c` |
| Sentry | org `voz-0p`, project `voz-ma-26` |

---

## 3. API configuration (hardcoded)

From `hermes_out.js` around line 402600 (`SITE_URL`, `API_URL`, `GUEST_API_KEY`, …):

```js
SITE_URL       = "https://voz.vn"
API_URL        = "https://voz.vn" + "/api"
GUEST_API_KEY  = "5tYQHu6ETKPFQ4W-fQGd_78ttL1LyZpD"
OAUTH_CLIENT_ID= "2424906941304717"
API_USER_AGENT = "VOZ/MA26"
FEEDBACK_URL   = "https://voz.vn/t/thot-gop-y-bao-loi-cho-app-chinh-chu.1283658/"
```

### Required headers

| Header | When |
|---|---|
| `XF-Api-Key: 5tYQHu6ETKPFQ4W-fQGd_78ttL1LyZpD` | guest requests (no token) |
| `Authorization: Bearer <access_token>` | logged-in requests (replaces the API key) |
| `User-Agent: VOZ/MA26` | always — **without it every request returns 403** |
| `Content-Type: application/x-www-form-urlencoded` | any request with a body |

Verified: no key → 403, wrong key → 403, correct key but no `User-Agent` → 403.

### Request encoding (`createClient`, line ~391545)

- Query object → `URLSearchParams`; arrays become `key[]=v1&key[]=v2`; booleans become `1` / `0`.
- Body object → same encoder, sent as `application/x-www-form-urlencoded`.
- Default method `GET`.
- Timeout constant `60000` ms.
- Proactive refresh when `expiresAt - now < 60000`.
- On `401` with tokens present → refresh once, retry; refresh failure → `clearTokens()`.
- Errors are normalised into `ApiError { status, code, message, params }`; network failure → `status: 0, code: "network"`.

---

## 4. Login flow (OAuth2 Authorization Code + PKCE)

Source: `useLoginRequest`, `exchangeCode`, `refreshTokens`, `revokeToken`
(`hermes_out.js` ~394276–394910).

### 4.1 Endpoints

| Purpose | URL |
|---|---|
| authorize (browser) | `https://voz.vn/oauth2/authorize` |
| token | `https://voz.vn/api/oauth2/token` |
| revoke | `https://voz.vn/api/oauth2/revoke` |

### 4.2 Client parameters

```js
clientId     = "2424906941304717"
redirectUri  = "vozma26://oauth"          // makeRedirectUri({ scheme: "vozma26", path: "oauth" })
responseType = "code"
usePKCE      = true
codeChallengeMethod = "S256"
scopes = [
  "thread:read", "thread:write", "node:read", "alert:read",
  "conversation:read", "conversation:write",
  "user:read", "user:write", "search:read", "search:write",
  "attachment:read"
]
```

### 4.3 Step by step

1. Generate PKCE pair: `code_verifier` (random 43–128 chars) and
   `code_challenge = BASE64URL(SHA256(verifier))`.
2. Open in a browser / WebView:

```
https://voz.vn/oauth2/authorize
  ?client_id=2424906941304717
  &redirect_uri=vozma26%3A%2F%2Foauth
  &response_type=code
  &scope=thread%3Aread%20thread%3Awrite%20node%3Aread%20alert%3Aread%20conversation%3Aread%20conversation%3Awrite%20user%3Aread%20user%3Awrite%20search%3Aread%20search%3Awrite%20attachment%3Aread
  &code_challenge=<S256 challenge>
  &code_challenge_method=S256
  &state=<random>
```

3. User logs in on voz.vn and approves. Redirect:

```
vozma26://oauth?code=<AUTH_CODE>&state=<STATE>
```

4. Exchange the code (`exchangeCode`, line ~394325):

```powershell
curl.exe -s -X POST "https://voz.vn/api/oauth2/token" `
  -H "Content-Type: application/x-www-form-urlencoded" `
  -H "User-Agent: VOZ/MA26" `
  --data "grant_type=authorization_code&client_id=2424906941304717&code=<CODE>&code_verifier=<VERIFIER>&redirect_uri=vozma26%3A%2F%2Foauth"
```

5. Response is mapped to (line ~393960):

```js
{ accessToken: access_token,
  refreshToken: refresh_token,
  expiresAt: Date.now() + expires_in * 1000 }
```

6. Persist with `expo-secure-store` under key **`xf_tokens`** (JSON string, line ~392949).
   `loadTokens()` reads it, `clearTokens()` deletes it, `subscribeTokens()` notifies React.

### 4.4 Refresh

```powershell
curl.exe -s -X POST "https://voz.vn/api/oauth2/token" `
  -H "Content-Type: application/x-www-form-urlencoded" -H "User-Agent: VOZ/MA26" `
  --data "grant_type=refresh_token&client_id=2424906941304717&refresh_token=<REFRESH>"
```

### 4.5 Logout / revoke

```powershell
curl.exe -s -X POST "https://voz.vn/api/oauth2/revoke" `
  -H "Content-Type: application/x-www-form-urlencoded" -H "User-Agent: VOZ/MA26" `
  --data "client_id=2424906941304717&token=<REFRESH>&token_type_hint=refresh_token"
```

Then `clearTokens()`, clear the React Query cache, clear drafts/recent searches, and
unregister the push token.

### 4.6 Live behaviour notes

- `POST /api/oauth2/token` with a bogus code → `400 {"errors":[{"code":"invalid_grant", …}]}`.
- Wrong `client_id` → `400 {"code":"invalid_client"}`.
- `POST /api/oauth2/revoke` with a bogus token → `200` (idempotent).
- `GET https://voz.vn/oauth2/authorize` from plain curl → **403 `cf-mitigated: challenge`**
  (Cloudflare bot check). The authorize step must run in a real browser/WebView, not curl.
- `GET https://voz.vn/.well-known/openid-configuration` is not served (HTML error page);
  the app hardcodes the three endpoints instead of doing discovery.

---

## 5. Full endpoint map

Base URL: `https://voz.vn/api`. All paths below are relative to it.
"Guest" = works with only `XF-Api-Key` + `User-Agent` (verified live).

### 5.1 Public / guest

| Method | Path | Params | Notes |
|---|---|---|---|
| GET | `/me/` | – | returns `{ me: {...} }`; guest → `user_id: 0` |
| GET | `/nodes/flattened` | – | 61 forum nodes (`node_id`, `title`, `node_type_id`) |
| GET | `/forums/{node_id}/threads` | `page` | thread list of a forum |
| GET | `/search-forums/{node_id}/threads` | `page` | thread list of a SearchForum node |
| GET | `/threads/{thread_id}/` | `with_posts=true`, `page` | thread + first page of posts |
| GET | `/threads/{thread_id}/posts` | `page` | posts only |
| GET | `/posts/{post_id}/` | – | single post |
| GET | `/users/find-name` | `username` | `{ exact: {...}, ... }` |
| GET | `/voz/app-config` | – | min_version, update_url, maintenance, notice |
| GET | `/voz/smilies` | – | smiley index |
| GET | `/voz/reactions` | – | reaction list (`reaction_id`, `title`, `image_url`) |
| POST | `/search/` | `keywords`, `search_type=post`, `order=date` | returns `search.search_id` |
| POST | `/search/member` | `user_id`, `content` | search inside one member's posts |
| GET | `/search/{search_id}/` | `page` | page through a stored search |
| POST | `/search/{search_id}/older` | `search_id`, `before` | older results of a search |

### 5.2 Login required (`login_required`)

| Method | Path | Body / query |
|---|---|---|
| GET | `/voz/bookmarks` | `page` |
| POST | `/voz/posts/{post_id}/bookmark` | `state=bookmark` \| `state=unbookmark` |
| GET | `/voz/watched-threads` | `page` |
| POST | `/voz/threads/{thread_id}/watch` | `state=watch` (anything else = unwatch) |
| POST | `/voz/push-tokens` | `token`, `platform` (`android`) |
| DELETE | `/voz/push-tokens` | `token` |
| GET | `/voz/warnings` | – |
| POST | `/voz/posts/{post_id}/warn` | `warning_definition_id` |
| POST | `/voz/posts/{post_id}/report` | `message` |
| POST | `/threads/{thread_id}/mark-read` | `date` |

### 5.3 Scope required

| Scope | Method | Path | Body / query |
|---|---|---|---|
| `alert:read` | GET | `/alerts/` | `page` |
| `alert:read` | GET | `/alerts/` | `unviewed=true` (unread count) |
| `alert:read` | POST | `/alerts/{alert_id}/mark` | `read=true` |
| `alert:read` | POST | `/alerts/mark-all` | `viewed=true` |
| `conversation:read` | GET | `/conversations/` | `page` |
| `conversation:read` | GET | `/conversations/` | `unread=true` (unread count) |
| `conversation:read` | GET | `/conversations/{id}/` | `with_messages=true`, `page` |
| `conversation:read` | GET | `/conversations/{id}/messages` | `page` |
| `conversation:read` | GET | `/conversation-messages/{id}/` | – |
| `conversation:write` | POST | `/conversations/` | `recipient_ids[]`, `title`, `message` |
| `conversation:write` | DELETE | `/conversations/{id}/` | – |
| `conversation:write` | POST | `/conversation-messages/` | `conversation_id`, `message` |
| `conversation:write` | POST | `/conversation-messages/{id}/` | `message` |
| `conversation:write` | POST | `/conversations/{id}/mark-read` | `date` |
| `thread:write` | POST | `/posts/` | `thread_id`, `message` |
| `thread:write` | POST | `/posts/{post_id}/` | `message`, `silent`, `author_alert` |
| `thread:write` | DELETE | `/posts/{post_id}/` | `hard_delete`, `author_alert` |
| `thread:write` | DELETE | `/threads/{thread_id}/` | – |
| `thread:write` | POST | `/threads/{thread_id}/` | thread fields (title, …) |
| `thread:write` | POST | `/threads/{thread_id}/move` | `target_node_id`, `starter_alert` |
| `thread:write` | POST | `/posts/{post_id}/react` | `reaction_id` |

Notes:
- `POST /posts/{id}/react` needs `thread:write`, not a separate reaction scope.
- `GET /voz/push-tokens` does not exist (404); only POST and DELETE.
- `POST /voz/posts/{id}/bookmark` and `/voz/threads/{id}/watch` return `login_required`
  (not `missing_scope`) — they are gated on a session, not on a scope.

---

## 6. Response shapes seen live

`GET /api/me/` (guest):

```json
{ "me": { "user_id": 0, "username": "", "is_admin": false, "can_search": true,
          "can_converse": false, "can_report": false, "can_view_profile": true, ... } }
```

`GET /api/threads/1/posts?page=1`:

```json
{ "posts": [ { "post_id": 1, "thread_id": 1, "user_id": 1, "username": "...",
               "post_date": 0, "message": "...", "message_parsed": "...",
               "message_state": "visible", "position": 0, "reaction_score": 0,
               "reaction_counts": {}, "attach_count": 0, "can_react": false,
               "can_edit": false, "can_soft_delete": false, "can_hard_delete": false,
               "is_first_post": true, "is_last_post": false, "view_url": "...",
               "User": { ... } } ],
  "pagination": { "current_page": 1, "last_page": 2, "per_page": 20, "shown": 20, "total": 30 } }
```

`GET /api/voz/app-config`:

```json
{ "min_version": { "ios": "1.0.0", "android": "1.0.0" },
  "update_url": { "ios": "https://testflight.apple.com/join/rxMUwfUz",
                  "android": "https://play.google.com/apps/internaltest/4701654132048119196" },
  "maintenance": { "active": false, "message": "" },
  "notice": null }
```

`GET /api/nodes/flattened` → `{ "nodes_flat": [ { "node": { "node_id": 1, "title": "Đại sảnh", "node_type_id": "Category", ... } } ] }`

Error envelope:

```json
{ "errors": [ { "code": "missing_scope", "message": "...", "params": { "scope": "thread:write" } } ] }
```

---

## 7. Quick start (guest, no login)

```powershell
$k = "5tYQHu6ETKPFQ4W-fQGd_78ttL1LyZpD"
$h = @("-H","XF-Api-Key: $k","-H","User-Agent: VOZ/MA26","--max-time","30","-s")

curl.exe @h "https://voz.vn/api/nodes/flattened"
curl.exe @h "https://voz.vn/api/forums/17/threads?page=1"
curl.exe @h "https://voz.vn/api/threads/1/?with_posts=true&page=1"
curl.exe @h "https://voz.vn/api/threads/1/posts?page=1"
curl.exe @h "https://voz.vn/api/voz/reactions"
curl.exe @h -X POST "https://voz.vn/api/search/" `
  -H "Content-Type: application/x-www-form-urlencoded" `
  --data "keywords=test&search_type=post&order=date"
```

## 8. Quick start (logged in)

```powershell
$token = "<access_token>"
curl.exe -s -H "Authorization: Bearer $token" -H "User-Agent: VOZ/MA26" `
  "https://voz.vn/api/me/"
curl.exe -s -H "Authorization: Bearer $token" -H "User-Agent: VOZ/MA26" `
  "https://voz.vn/api/alerts/?page=1"
curl.exe -s -H "Authorization: Bearer $token" -H "User-Agent: VOZ/MA26" `
  -X POST "https://voz.vn/api/posts/" `
  -H "Content-Type: application/x-www-form-urlencoded" `
  --data "thread_id=1&message=hello"
```

---

## 9. Other things worth knowing

- Push: `expo-notifications` → `getDevicePushTokenAsync()` → `POST /api/voz/push-tokens`
  with `{ token, platform: "android" }`; token cached in AsyncStorage; removed on logout.
- Deep links handled by the app: `voz.vn` thread/post/conversation URLs are mapped to
  `/threads/{id}`, `/posts/{id}`, `/conversations/{id}`; unknown links open in the browser.
- `expo-secure-store` key for the session: `xf_tokens`.
- Sentry DSN is embedded (`o4512162143535104.ingest.de.sentry.io/4512162166800464`).
- The APK ships split configs (`arm64_v8a`, `en`, `xxhdpi`); only `base.apk` contains code.
