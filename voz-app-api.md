# VOZ app (com.&lt;publisher&gt;.vozma26) — decompile + API map

Reverse-engineering notes for `voz-app/base.apk`. Everything below was read out of the
decompiled sources and verified against the live API on 2026-11-05.

> **Note on personal data.** This file documents the app's API surface only. It contains
> **no** member usernames, user ids, member ids, conversation ids, thread ids, post ids or
> real post content. Every example uses placeholders such as `<your_id>`, `<your_name>`,
> `<post_id>`, `<thread_id>`, `<conversation_id>`, `<message_id>`, `<unix_ts>`.
> The publisher segment of the Android package name is redacted to `<publisher>` because it
> is a personal handle; the rest of the package (`vozma26`) is kept.
> The OAuth `client_id`, guest API key, Sentry/EAS identifiers and store links are kept
> because they are app constants needed to reproduce the API calls, not personal
> information. When adding new examples, keep the same rule: no real member identifiers,
> no real URLs to member profiles or conversations, no copied post text.
> The companion file `voz-forum-deploy.md` follows the same rule.

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
| package | `com.<publisher>.vozma26` |
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
| GET | `/forums/{node_id}/threads` | `page` | thread list of a forum; mỗi thread có `is_unread` theo tài khoản đang đăng nhập |
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

---

## 10. Posting, quoting and editing (verified live)

All three need `thread:write`. Body is `application/x-www-form-urlencoded`.
`message` is **BBCode**, not HTML — the server returns both `message` (raw BBCode)
and `message_parsed` (rendered HTML).

### 10.1 Create a reply

```
POST /api/posts/
  thread_id=<id>
  message=<bbcode>
```

```powershell
curl.exe -s -X POST "https://voz.vn/api/posts/" `
  -H "Authorization: Bearer $token" -H "User-Agent: VOZ/MA26" `
  -H "Content-Type: application/x-www-form-urlencoded" `
  --data-urlencode "thread_id=<thread_id>" `
  --data-urlencode "message=<bbcode>"
```

Response (`success: true` + the created post):

```json
{ "success": true,
  "post": { "post_id": <post_id>, "thread_id": <thread_id>, "position": <n>,
            "user_id": <your_id>, "username": "<your_name>",
            "message": "<bbcode>", "message_parsed": "<html>",
            "message_state": "visible", "post_date": <unix_ts>,
            "can_edit": true, "can_soft_delete": true, "can_hard_delete": false,
            "is_first_post": false, "is_last_post": true,
            "view_url": "https://voz.vn/p/<post_id>/" } }
```

Notes:
- `position` is the 1-based post index inside the thread; the new post gets
  `reply_count + 1`.
- `view_url` is the canonical short link — `https://voz.vn/p/{post_id}/` redirects to
  `/t/{slug}.{thread_id}/page-{n}#post-{post_id}`.
- `can_edit` / `can_soft_delete` are per-post permissions for the current user.
- Posting to a thread you cannot reply to returns `can_reply: false` on the thread
  object; the API then answers `403` with a `thread:write`-style error.

### 10.2 Quote reply

There is no dedicated quote endpoint. The app builds a BBCode block client-side
(`quoteBlock` + `composeMessage` in `hermes_out.js` ~763574) and posts it as a normal
reply. Exact format:

```
[QUOTE="<author>, post: <post_id>, member: <user_id>"]
<quoted message with nested quotes stripped>
[/QUOTE]

<your text>
```

Rules extracted from the bundle:

| Rule | Detail |
|---|---|
| Author | `username` with `"` characters removed |
| `post:` | `post_id`, or `0` when missing |
| `member:` | `user_id`; the whole `, member: N` part is omitted when `user_id` is falsy |
| Body | `stripQuotes()` removes every nested `[QUOTE…]…[/QUOTE]` block, then collapses 3+ newlines to 2 and trims |
| Separator | exactly one blank line (`\n\n`) between the quote block and your text |
| Empty text | the trailing text is dropped if blank, leaving only the quote |

`stripQuotes()` is a depth counter over `/\[(\/?)quote(?:=[^\]]*)?\]/gi`: text is kept
only while depth is 0, so nested quotes never leak into the new quote.

Working example (quoting an existing post):

```
[QUOTE="<author>, post: <post_id>, member: <user_id>"]
<quoted message text, nested quotes already stripped>
[/QUOTE]

<your reply text>
```

Server renders it to:

```html
<blockquote class="xfBb-quote" data-name="<author>">…</blockquote><br />
<your reply text>
```

Helper script: `voz-app\quote_reply.py`

```powershell
python "D:\Data 2\Github-Clone\siritami\voz-app\quote_reply.py" <post_id> "your reply text"
```

It fetches the target post, builds the quote block with the same `stripQuotes` logic,
posts to `/api/posts/` with the target's `thread_id`, and prints the result.

### 10.3 Edit a post

```
POST /api/posts/{post_id}/
  message=<new bbcode>
```

```powershell
curl.exe -s -X POST "https://voz.vn/api/posts/<post_id>/" `
  -H "Authorization: Bearer $token" -H "User-Agent: VOZ/MA26" `
  -H "Content-Type: application/x-www-form-urlencoded" `
  --data-urlencode "message=<new bbcode>"
```

Response: same `{ success, post }` envelope, with `last_edit_date` now set
(Unix seconds) and `message` / `message_parsed` replaced.

Verified: the post's `message` changed to the new BBCode, `last_edit_date` was set to
the edit time, and the web UI shows `Last edited: A moment ago`.

Notes:
- Editing replaces the whole message — send the full BBCode, not a diff.
- Only the author (or a moderator) can edit; otherwise `403`.
- `can_edit` on the post object tells you in advance.
- There is no edit-history endpoint exposed by the app.

### 10.4 Optional flags on create/edit

| Field | Effect |
|---|---|
| `silent` | `true` → do not bump the thread / no alert to watchers |
| `author_alert` | `true` → notify the thread starter |

Both are only sent when truthy (the app omits them otherwise).

### 10.5 Delete a post

```
DELETE /api/posts/{post_id}/
```

Optional body fields (`application/x-www-form-urlencoded`):

| Field | Effect |
|---|---|
| `hard_delete=true` | permanent removal — moderators/admins only |
| `author_alert=true` | notify the post author |

```powershell
curl.exe -s -X DELETE "https://voz.vn/api/posts/<post_id>/" `
  -H "Authorization: Bearer $token" -H "User-Agent: VOZ/MA26"
```

Success response — **no post object**, just a flag:

```json
{ "success": true }
```

HTTP `200`, and the response headers echo the acting user:

```
xf-request-user: <your_id>
xf-request-user-extras: {"conversations_unread":0,"alerts_unviewed":0}
```

#### What actually happens

`DELETE` is a **soft delete** ("removed from public view"), not a row delete:

| Effect | Detail |
|---|---|
| Post disappears from the thread listing | `GET /threads/{id}/posts` no longer returns it |
| `GET /api/posts/{post_id}/` → `404` | `{"code":"requested_post_not_found"}` |
| `reply_count` decrements | `reply_count` drops by 1 |
| Remaining posts are **renumbered** | `position` shifts down by 1 for every later post |
| Post ID is **immutable** | the later post kept its ID; only `position` shifted down by 1 |
| Moderator log entry | `Post removed from public view (reason: )` |

So the post ID never changes after a delete — only `position` and `reply_count` do.
A deleted post is invisible to the API but still exists server-side and can be restored.

#### Permissions

| Who | Result |
|---|---|
| Author, own post | `200 {"success": true}` |
| Moderator, anyone's post | `200 {"success": true}` — **no confirmation, no ownership check** |
| Non-moderator, someone else's post | `403` |
| Already-deleted post | `404 requested_post_not_found` (not idempotent) |
| Non-existent post id | `404 requested_page_not_found` |

`can_soft_delete` / `can_hard_delete` on the post object tell you in advance what the
current user may do. Note `can_hard_delete` is `false` for regular moderators.

> **Warning:** because a moderator account can delete any post with a single
> unauthenticated-looking `DELETE`, never run this call as a "permission test" against
> a post you do not own. There is no dry-run and no confirmation step.

#### Restoring a soft-deleted post

The REST API has **no undelete endpoint** — `DELETE` on an already-deleted post returns
`404`, it does not toggle back. Restoration is only available through the web UI
(moderator action), which posts to:

```
POST /p/{post_id}/undelete
  _xfToken=<csrf token from the GET form>
```

```js
// browser console, logged in as moderator
const g = await fetch('/p/<post_id>/undelete', { credentials: 'include' });
const token = (await g.text()).match(/name="_xfToken" value="([^"]+)"/)[1];
await fetch('/p/<post_id>/undelete', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ _xfToken: token }).toString(),
});
```

After restore: `GET /api/posts/{id}/` returns `200` again with
`message_state: "visible"` and the original `position`; `reply_count` goes back up.

---

## 11. Reactions (verified live)

Reactions are a **toggle**, not separate add/remove endpoints. One call with the same
`reaction_id` twice: first `insert`, then `delete`.

### 11.1 Endpoint

```
POST /api/posts/{post_id}/react
  reaction_id=<id>
```

```powershell
curl.exe -s -X POST "https://voz.vn/api/posts/<post_id>/react" `
  -H "Authorization: Bearer $token" -H "User-Agent: VOZ/MA26" `
  -H "Content-Type: application/x-www-form-urlencoded" `
  --data "reaction_id=1"
```

Response — no post object, just the action taken:

```json
{ "success": true, "action": "insert" }   // reaction added
{ "success": true, "action": "delete" }   // reaction removed
```

### 11.2 Reaction IDs

`GET /api/voz/reactions` (guest-accessible) returns the catalogue:

| `reaction_id` | `title` | `score` | `active` |
|---|---|---|---|
| 1 | Ưng | +1 | true |
| 2 | Gạch | −1 | true |
| 3 | Haha | 0 | false |
| 4 | Wow | 0 | false |
| 5 | Sad | 0 | false |
| 6 | Angry | 0 | false |

`active: false` only hides the reaction in the UI — the API still accepts it
(verified: `reaction_id=3` returned `insert` and applied normally).

### 11.3 Toggle semantics

| Current state | Call | Result |
|---|---|---|
| no reaction | `reaction_id=1` | `action: "insert"`, score `0 → +1` |
| has Ưng (1) | `reaction_id=1` | `action: "delete"`, score `+1 → 0` |
| has Ưng (1) | `reaction_id=2` | `action: "insert"`, score `+1 → −1` (switches, does not stack) |
| has Gạch (2) | `reaction_id=2` | `action: "delete"`, score `−1 → 0` |

A user can hold **at most one** reaction per post. Sending a different `reaction_id`
replaces the existing one in a single call — no need to remove first.

### 11.4 Reading reaction state

`GET /api/posts/{post_id}/` exposes:

| Field | Meaning |
|---|---|
| `reaction_score` | net score (`Ưng` +1, `Gạch` −1, others 0) |
| `reaction_counts` | map of `reaction_id` → count, e.g. `{"1": 3, "2": 1}` |
| `visitor_reaction_id` | the current user's reaction id, or absent when none |
| `is_reacted_to` | boolean shortcut for `visitor_reaction_id != null` |
| `can_react` | whether the current user may react at all |

Example after reacting Ưng:

```json
{ "post": { "post_id": <post_id>, "reaction_score": 1,
            "reaction_counts": { "1": 1 },
            "visitor_reaction_id": 1, "is_reacted_to": true,
            "can_react": true } }
```

After removing it: `reaction_score: 0`, `reaction_counts: {}`,
`visitor_reaction_id` absent, `is_reacted_to: false`.

### 11.5 Errors

| Case | Response |
|---|---|
| missing `reaction_id` | `400 required_input_missing`, `params.missing: ["reaction_id"]` |
| unknown `reaction_id` (e.g. 99) | `404 requested_page_not_found` |
| no `thread:write` scope | `403 missing_scope`, `params.scope: "thread:write"` |
| post not found | `404 requested_post_not_found` |

### 11.6 Client-side model (from the app)

`applyReaction()` in `hermes_out.js` (~645431) mirrors the server logic for optimistic
updates: it decrements the old `visitor_reaction_id` count, deletes the key when it
reaches 0, increments the new one, adjusts `reaction_score` by the old reaction's
`score` then the new one's, and sets `is_reacted_to = (oldId !== newId)`.

The UI (`useReactToPost`, ~762051) calls the same endpoint for both add and remove —
there is no separate "unreact" call anywhere in the bundle.

---

## 12. Direct messages / conversations (verified live)

### 12.1 Start a conversation

```
POST /api/conversations/
  recipient_ids[]=<user_id>     (repeatable)
  title=<subject>
  message=<first message>
```

```powershell
curl.exe -s -X POST "https://voz.vn/api/conversations/" `
  -H "Authorization: Bearer $token" -H "User-Agent: VOZ/MA26" `
  -H "Content-Type: application/x-www-form-urlencoded" `
  --data-urlencode "recipient_ids[]=<recipient_id>" `
  --data-urlencode "title=<subject>" `
  --data-urlencode "message=<first message>"
```

Response:

```json
{ "success": true,
  "conversation": {
    "conversation_id": <conversation_id>,
    "title": "<subject>",
    "user_id": <your_id>, "username": "<your_name>",
    "recipients": { "<recipient_id>": "<recipient_name>" },
    "recipient_count": 2,
    "first_message_id": <message_id>,
    "last_message_id": <message_id>,
    "last_message_date": <unix_ts>,
    "last_message_user_id": <your_id>,
    "reply_count": 0,
    "is_starred": false, "is_unread": false,
    "conversation_open": true,
    "can_edit": true, "can_reply": true, "can_invite": true,
    "can_upload_attachment": false,
    "start_date": <unix_ts>,
    "view_url": "https://voz.vn/direct-messages/<slug>.<conversation_id>/",
    "Starter": { "user_id": <your_id>, "username": "<your_name>", "avatar_urls": {...} }
  } }
```

Notes:
- `recipients` is a map of `user_id → username`, **excluding** the starter.
- `recipient_count` includes the starter (2 for a 1-to-1 DM).
- `reply_count` is 0 on creation — the first message is not counted as a reply.
- `view_url` slug is derived from the title; the numeric id is authoritative.
- Requires `conversation:write`. Target user must allow conversations
  (`can_converse: true` on `GET /api/users/{id}/`).

### 12.2 Read a conversation

```
GET /api/conversations/{id}/?with_messages=true&page=1
```

```json
{ "conversation": { ...same shape as above... },
  "messages": [ { "message_id": <message_id>, "user_id": <your_id>,
                  "username": "<your_name>", "message_date": <unix_ts>,
                  "message": "<bbcode>", "message_parsed": "<html>" } ] }
```

Without `with_messages=true` the response contains only `conversation`.

### 12.3 List conversations

| Query | Effect |
|---|---|
| `page` | pagination |
| `unread=true` | only conversations with unread messages; `pagination.total` = unread count |
| `starred=true` | only starred conversations |

```powershell
curl.exe -s -H "Authorization: Bearer $token" -H "User-Agent: VOZ/MA26" `
  "https://voz.vn/api/conversations/?unread=true"
```

### 12.4 Messages

| Method | Path | Body / query |
|---|---|---|
| GET | `/conversations/{id}/messages` | `page` — same as `?with_messages=true` |
| GET | `/conversation-messages/{message_id}/` | – |
| POST | `/conversation-messages/` | `conversation_id`, `message` |
| POST | `/conversation-messages/{message_id}/` | `message` (edit) |

```powershell
curl.exe -s -X POST "https://voz.vn/api/conversation-messages/" `
  -H "Authorization: Bearer $token" -H "User-Agent: VOZ/MA26" `
  -H "Content-Type: application/x-www-form-urlencoded" `
  --data-urlencode "conversation_id=<conversation_id>" `
  --data-urlencode "message=hello again"
```

### 12.5 Star / unstar

```
POST /api/conversations/{id}/star
  star=1     → star
  star=0     → unstar
  (no body)  → toggle
```

Response is always `{"success": true}` — no state echoed back, so re-read the
conversation to confirm `is_starred`.

Verified: `star=1` → `is_starred: true`, `star=0` → `false`, empty body → toggles.

### 12.6 Mark read

```
POST /api/conversations/{id}/mark-read
  date=<unix seconds>
```

`date` is the timestamp up to which messages are considered read.

### 12.7 Leave / delete a conversation

```
DELETE /api/conversations/{id}/
```

Returns `{"success": true}`. The conversation then disappears for the current user —
`GET /api/conversations/{id}/` → `404 requested_direct_message_not_found`.

> This is a **leave**, not a global delete: other participants keep their copy.
> There is no separate `/leave` endpoint (`404`).

### 12.8 Invite more recipients

```
POST /api/conversations/{id}/invite
  recipient_ids[]=<user_id>
```

Missing input → `400 required_input_missing`, `params.missing: ["recipient_ids"]`.

### 12.9 Errors

| Case | Response |
|---|---|
| no `conversation:read` scope | `403 missing_scope`, `params.scope: "conversation:read"` |
| no `conversation:write` scope | `403 missing_scope`, `params.scope: "conversation:write"` |
| unknown conversation id | `404 requested_direct_message_not_found` |
| recipient disallows DMs | `403` with a permission error |

---

## 13. Endpoints the app does not use (discovered by probing)

The APK only calls the subset in §5. The XenForo REST layer underneath exposes more.
Everything below was verified live; entries marked **unverified** returned a
validation error rather than a success, so the shape is inferred from the error only.

### 13.1 Thread lists and filters

| Method | Path | Notes |
|---|---|---|
| GET | `/threads/` | global thread list, `page`; 11 218 threads visible to a guest |
| GET | `/threads/?order=post_date` | **all** threads, 819 218 total — the only `order` value that changes the result set |
| GET | `/threads/?forum_id=13` | accepted but **ignored** (same total as unfiltered) |
| GET | `/threads/?creator_id=…`, `?starter_id=…` | accepted but ignored |
| GET | `/threads/?unread=1` | auth only; returns the account's unread threads |
| GET | `/threads/?sticky=1`, `?prefix_id=`, `?with_tags=1`, `?since=`, `?direction=` | accepted, no observable effect |
| GET | `/forums/{id}/` | forum detail: `node_id`, `title`, `description`, `breadcrumbs`, `type_data`, `view_url` |
| GET | `/forums/{id}/threads` | `page`, `order`, `direction`, `sticky` |

#### Read / unread state (thread list)

Every thread in `/forums/{id}/threads`, `/search-forums/{id}/threads`, `/threads/` and
`/threads/?unread=1` carries the read state **for the authenticated account**, so the bold
"unread" title in a forum listing needs no extra endpoint:

| Field | Meaning |
|---|---|
| `is_unread` | `true` when there are posts after `visitor_read_date` — voz.vn renders these rows with `is-unread` and a `font-weight: 600` title |
| `first_unread_snippet` | preview text of the first unread post (`null` when everything is read) |
| `visitor_read_date` | Unix seconds of the account's last read inside that thread |
| `is_watching` | the account is watching the thread |

With a guest key (`XF-Api-Key` only) the flag still parses but reflects no account, so it
should be treated as "read". Reading a thread (`GET /threads/{id}/`) does **not** change
`is_unread`; only `POST /threads/{id}/mark-read` with `date` flips it back to `false`.

`GET /threads/{id}/` returns the same `is_unread` / `visitor_read_date` fields for the
thread itself, alongside `pagination` and `post_date`-ordered `posts`, so the first unread
post can be resolved from one call plus a walk back over `/threads/{id}/posts` — the API
exposes no direct "first unread post id" and `/threads/{id}/posts?unread=1` is ignored.
`visitor_read_date: null` means the account never opened the thread, so everything is
unread and page 1 is the answer.

| GET | `/nodes/` | full node tree: `{ tree_map, nodes }`, 61 nodes |
| GET | `/nodes/{id}/` | single node |

> `order=post_date` is the only ordering that actually works; `view_count`,
> `reply_count`, `first_post_likes`, `last_post_date` all return the default set.

### 13.2 Users

| Method | Path | Notes |
|---|---|---|
| GET | `/users/{id}/` | public profile: `message_count`, `reaction_score`, `trophy_points`, `register_date`, `signature`, `custom_fields`, `is_staff`, `can_follow`, `can_ignore`, `can_post_profile`, … |
| GET | `/users/{id}/?with_posts=1` | accepted, no extra fields observed |
| GET | `/users/find-name?username=` | `{ exact, … }`; empty username returns `200` |
| GET | `/users/` | **403** — listing users is disabled |
| GET | `/users/find-email?email=` | **403** — disabled |

### 13.3 Profile posts

| Method | Path | Notes |
|---|---|---|
| GET | `/profile-posts/{id}/` | `profile_post` object: `profile_post_id`, `profile_user_id`, `message`, `comment_count`, `reaction_score`, `ProfileUser`, `User` |
| GET | `/profile-posts/{id}/comments` | `page` |
| POST | `/profile-posts/` | needs `profile_post:write` scope (not granted to this app) |

### 13.4 Stats

```
GET /api/stats
```

```json
{ "totals": { "threads": "1047777", "messages": "36671980", "users": 1249342 },
  "latest_user": { "user_id": <user_id>, "username": "<username>", "register_date": <unix_ts> },
  "online": { "total": "16253", "members": "1277", "guests": "14976" } }
```

Guest-accessible. Note `totals` values are **strings**, `users` is a number.

### 13.5 Attachments

**Status: upload via REST API does not work. Use the web UI.**

The shared editor in this client therefore offers image URLs, not file uploads. The
proxy currently requests only `attachment:read`; it deliberately does not advertise
an upload capability or request `attachment:write` for a non-working endpoint.

#### What works

| Method | Path | Notes |
|---|---|---|
| GET | `/attachments/{id}/` | returns the `attachment` object (see shape below) |
| GET | `/posts/{id}/` | includes an `Attachments` array when the post has files |

Attachment object:

```json
{ "attachment": {
    "attachment_id": <attachment_id>,
    "content_id": <post_id>,
    "content_type": "post",
    "filename": "<filename>.png",
    "file_size": 279828,
    "attach_date": <unix_ts>,
    "direct_url": "https://voz.vn/attachments/<slug>.<id>/",
    "thumbnail_url": "https://data.voz.vn/attachments/...",
    "width": 955, "height": 719,
    "is_audio": false, "is_video": false,
    "view_count": 957 } }
```

#### What does not work

| Attempt | Result |
|---|---|
| `POST /api/attachments/` (no body) | `400 required_input_missing`, `params.missing: ["key"]` |
| `POST /api/attachments/` with `key` + multipart `attachment` | `404 requested_page_not_found` |
| `POST /api/attachments/` with `key` = UUID / MD5 / SHA1 / attachment id / upload hash | `404 requested_page_not_found` |
| `POST /api/attachments/` with `key` = `attachment_hash_combined` JSON | `404 requested_page_not_found` |
| `POST /api/attachments/upload` | `404 endpoint_not_found`, `params.reason: "invalid_action"` |
| `GET /api/attachments/?key=<anything>` | `404 requested_page_not_found` |
| `POST /api/posts/{id}/` with `attachment_key=<value>` | `400 attachment_key_unknown` |

The `attachment:write` scope **is** grantable — it appears on the consent screen as
"Covers uploading new attachments" and can be added to the authorize request:

```
&scope=... attachment:read attachment:write
```

With that scope the `missing_scope` error disappears, but every upload attempt then
falls through to `404 requested_page_not_found`. The REST route accepts the scope check
and then fails to resolve the request — the upload action is not wired up on this
install.

`attachment_key` **is** a real field on `POST /api/posts/{id}/` (it validates and
returns `attachment_key_unknown`), but no key format tried was accepted. The key is
presumably issued by the upload endpoint, which is unreachable — so the field cannot be
used.

#### How the web UI does it

The browser uses a **non-API** route, not `/api/`:

```
POST /attachments/upload?type=post&context[post_id]=<post_id>&hash=<upload_hash>
  multipart field: attachment
  header: X-Requested-With: XMLHttpRequest
  header: _xfToken: <csrf>
```

The `hash` comes from a hidden input on the edit page:

```html
<input type="hidden" name="attachment_hash" value="<hash>">
<input type="hidden" name="attachment_hash_combined"
       value='{"type":"post","context":{"post_id":<id>},"hash":"<hash>"}'>
```

Uploading returns an HTML fragment (`template-attachment_upload`) containing
`<li data-attachment-id="...">`. The attachment only becomes permanent after the post
is saved with the edit form, which submits `attachment_hash` /
`attachment_hash_combined` alongside the message.

Verified end-to-end in the browser: file uploaded → `data-attachment-id` appeared →
Save → `GET /api/posts/{id}/` showed `attach_count: 1` and the `Attachments` array.
Deleting the file in the editor and saving brought `attach_count` back to `0`.

#### Practical workaround

If you need to attach a file programmatically:

1. `GET /posts/{id}/edit` with the session cookie, scrape `attachment_hash` and
   `_xfToken`.
2. `POST /attachments/upload?type=post&context[post_id]={id}&hash={hash}` with the
   file as multipart `attachment`.
3. `POST /posts/{id}/edit` with `_xfToken`, `message`, `attachment_hash`,
   `attachment_hash_combined`.

This requires a **cookie session**, not the OAuth bearer token — the `/attachments/`
and `/posts/{id}/edit` routes are the web frontend, not the REST API.

### 13.6 Account management (unverified — validation errors only)

| Method | Path | Required input |
|---|---|---|
| POST | `/me/avatar` | `avatar` |
| POST | `/me/password` | `current_password`, `new_password` |
| POST | `/me/email` | `current_password`, `email` |

These exist and are reachable with the current token, but were **not executed** —
they change account credentials. Input names come from the `required_input_missing`
error payload.

### 13.7 Thread creation (unverified)

```
POST /api/threads/
  node_id, title, message
```

`400 required_input_missing` with `params.missing: ["node_id", "title", "message"]`.
Not executed — the user asked not to create new threads.

### 13.8 Confirmed absent

These return `404` and do **not** exist on this install:

```
/api/forums/            /api/categories/       /api/tags/
/api/online/            /api/link-forums/      /api/batch
/api/me/alerts          /api/me/watched        /api/me/bookmarks
/api/me/conversations   /api/me/push           /api/me/notifications
/api/me/ignored         /api/me/following      /api/me/followers
/api/me/timeline        /api/me/likes          /api/me/avatar (GET)
/api/me/security        /api/me/settings       /api/me/preferences
/api/me/tfa             /api/me/sessions       /api/me/oauth
/api/me/api-keys        /api/posts/ (list)     /api/polls/
/api/threads/{id}/poll  /api/threads/{id}/tags /api/threads/{id}/reactions
/api/posts/{id}/reactions                     /api/users/{id}/followers
/api/users/{id}/following                     /api/users/{id}/timeline
/api/users/{id}/likes   /api/users/{id}/bookmarks
/api/users/{id}/warnings                      /api/users/{id}/ignored
/api/users/{id}/avatar  /api/users/{id}/activity
/api/users/{id}/threads /api/users/{id}/posts
/api/users/{id}/conversations
/api/users/{id}/follow  /api/users/{id}/ignore
/api/threads/{id}/bookmark  /api/threads/{id}/watch  /api/posts/{id}/bookmark
/api/conversations/{id}/leave  /api/conversations/{id}/read
/api/alerts/{id}/  /api/alerts/{id}/read  /api/alerts/{id}/mark
/api/alerts/read
```

Bookmarking and watching live only under the `/voz/` prefix
(`/voz/posts/{id}/bookmark`, `/voz/threads/{id}/watch`) — the plain XenForo paths
are not routed on this install.

### 13.9 Error codes seen while probing

| Code | Meaning |
|---|---|
| `required_input_missing` | `params.missing` lists the missing fields |
| `missing_scope` | `params.scope` names the required scope |
| `endpoint_not_found` | route exists but action invalid (`params.reason`: `invalid_action`, `invalid_route`) |
| `requested_page_not_found` | unknown id or unrouted path |
| `requested_thread_not_found` | thread id unknown or not visible |
| `requested_post_not_found` | post id unknown or soft-deleted |
| `requested_direct_message_not_found` | conversation id unknown or left |
| `login_required` | endpoint needs a session, not just a scope |
| `invalid_grant` / `invalid_client` | OAuth token endpoint errors |
