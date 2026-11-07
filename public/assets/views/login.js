// OAuth login: PKCE code exchange, or pasting an access token directly.

import { app, state } from '../core/dom.js';
import { navigate } from '../core/nav.js';
import { auth } from '../api.js';
import { setActiveNav, setBreadcrumbs } from '../ui/chrome.js';
import { toast } from '../ui/feedback.js';
import { renderAccount } from '../ui/chrome.js';

function b64url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function makePkce() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = b64url(new Uint8Array(digest));
  const stateValue = b64url(crypto.getRandomValues(new Uint8Array(16)));
  return { verifier, challenge, state: stateValue };
}

// The userscript posts the captured code back to this tab. Registered once at
// module load so repeated visits to /login do not stack listeners.
window.addEventListener('message', (event) => {
  if (event.origin !== location.origin && !/voz\.vn$/.test(new URL(event.origin).hostname)) return;
  const data = event.data || {};
  if (data.type !== 'voz-oauth-code' || !data.code) return;
  const field = document.getElementById('auth-code');
  if (!field) return;
  field.value = data.code;
  toast('Đã nhận code từ userscript');
});

export async function viewLogin() {
  setActiveNav('');
  setBreadcrumbs([{ label: 'Diễn đàn', href: '/' }, { label: 'Đăng nhập' }]);
  if (!state.config) state.config = await auth.config();
  const cfg = state.config;

  app.innerHTML = `
    <div class="login-wrap">
      <div class="block">
        <div class="block-header">Đăng nhập bằng voz.vn</div>
        <div class="block-body block-body--pad">
          <p class="u-smaller u-dimmed">
            Ứng dụng OAuth <b>VOZ chính chủ</b> chỉ cho phép redirect về <code>vozma26://oauth</code>,
            nên trình duyệt không tự bắt được mã uỷ quyền. Dùng userscript bên dưới để lấy mã,
            hoặc dán thẳng access token.
          </p>

          <div class="tabs" id="login-tabs">
            <button type="button" data-tab="code" class="is-active">Lấy mã uỷ quyền</button>
            <button type="button" data-tab="token">Dán access token</button>
          </div>

          <div id="tab-code" style="padding-top:14px">
            <ol class="login-steps">
              <li>Cài userscript <a href="/userscript/voz-oauth-helper.user.js" target="_blank" rel="noopener">voz-oauth-helper.user.js</a> (Tampermonkey / Violentmonkey).</li>
              <li>Bấm <b>Mở trang uỷ quyền</b> — cửa sổ voz.vn mở ra, bấm <b>Authorize</b>.</li>
              <li>Userscript bắt mã và hiện nút <b>Copy code</b> (hoặc tự gửi về tab này).</li>
              <li>Dán mã vào ô dưới rồi bấm <b>Đăng nhập</b>.</li>
            </ol>
            <div class="formRow">
              <button class="button button--primary" type="button" id="open-authorize">Mở trang uỷ quyền</button>
            </div>
            <div class="formRow">
              <label for="auth-code">Mã uỷ quyền (code)</label>
              <textarea class="code-box" id="auth-code" placeholder="Dán code hoặc cả URL vozma26://oauth?code=..."></textarea>
              <div class="formHint" id="pkce-hint"></div>
            </div>
            <button class="button button--primary" type="button" id="exchange-btn">Đăng nhập</button>
          </div>

          <div id="tab-token" class="u-hidden" style="padding-top:14px">
            <div class="formRow">
              <label for="raw-token">Access token</label>
              <textarea class="code-box" id="raw-token" placeholder='{"accessToken":"...","refreshToken":"...","expiresAt":123}'></textarea>
              <div class="formHint">Dán chuỗi token, hoặc JSON đầy đủ từ <code>tokens.json</code>.</div>
            </div>
            <button class="button button--primary" type="button" id="token-btn">Đăng nhập</button>
          </div>
        </div>
      </div>
    </div>`;

  const tabs = document.getElementById('login-tabs');
  tabs.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-tab]');
    if (!btn) return;
    for (const b of tabs.querySelectorAll('button')) b.classList.toggle('is-active', b === btn);
    document.getElementById('tab-code').classList.toggle('u-hidden', btn.dataset.tab !== 'code');
    document.getElementById('tab-token').classList.toggle('u-hidden', btn.dataset.tab !== 'token');
  });

  let pkce = null;
  const hint = document.getElementById('pkce-hint');

  const ensurePkce = async () => {
    if (!pkce) {
      pkce = await makePkce();
      sessionStorage.setItem('voz_pkce', JSON.stringify(pkce));
      hint.textContent = `PKCE challenge: ${pkce.challenge.slice(0, 24)}…`;
    }
    return pkce;
  };

  const stored = sessionStorage.getItem('voz_pkce');
  if (stored) {
    try {
      pkce = JSON.parse(stored);
      hint.textContent = `PKCE challenge: ${pkce.challenge.slice(0, 24)}…`;
    } catch {
      pkce = null;
    }
  }

  document.getElementById('open-authorize').addEventListener('click', async () => {
    const p = await ensurePkce();
    const params = new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: cfg.redirectUri,
      response_type: 'code',
      scope: cfg.scopes,
      code_challenge: p.challenge,
      code_challenge_method: 'S256',
      state: p.state,
    });
    const url = `${cfg.authorizeUrl}?${params.toString()}`;
    const popup = window.open(url, 'voz-oauth', 'width=560,height=760');
    if (!popup) toast('Trình duyệt chặn popup — cho phép popup rồi thử lại', true);
  });

  document.getElementById('exchange-btn').addEventListener('click', async () => {
    const raw = document.getElementById('auth-code').value.trim();
    if (!raw) return toast('Chưa có code', true);
    const match = raw.match(/[?&]code=([^&\s]+)/);
    const code = match ? decodeURIComponent(match[1]) : raw;
    const p = await ensurePkce();
    const btn = document.getElementById('exchange-btn');
    btn.disabled = true;
    btn.textContent = 'Đang đổi token…';
    try {
      const { ok, data } = await auth.exchange(code, p.verifier);
      if (!ok) throw new Error(data.detail || data.error || 'Đổi token thất bại');
      sessionStorage.removeItem('voz_pkce');
      state.loggedIn = true;
      state.me = data.me;
      renderAccount();
      toast(`Xin chào ${data.me.username}`);
      navigate('/');
    } catch (err) {
      toast(err.message, true);
      btn.disabled = false;
      btn.textContent = 'Đăng nhập';
    }
  });

  document.getElementById('token-btn').addEventListener('click', async () => {
    const raw = document.getElementById('raw-token').value.trim();
    if (!raw) return toast('Chưa có token', true);
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = { accessToken: raw };
    }
    const btn = document.getElementById('token-btn');
    btn.disabled = true;
    btn.textContent = 'Đang kiểm tra…';
    try {
      const { ok, data } = await auth.useToken(payload);
      if (!ok) throw new Error(data.error === 'token_rejected' ? 'Token không hợp lệ' : data.error || 'Thất bại');
      state.loggedIn = true;
      state.me = data.me;
      renderAccount();
      toast(`Xin chào ${data.me.username}`);
      navigate('/');
    } catch (err) {
      toast(err.message, true);
      btn.disabled = false;
      btn.textContent = 'Đăng nhập';
    }
  });
}
