// Public release build: no embedded cookies, no personal identifiers.
const CONFIG = {
  pageUrl: 'https://www.6sq.net/qiandao/',
  signUrl: 'https://www.6sq.net/qiandao/ajax/send/',
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  timeout: 20000,
  cookieKey: '6sq_qiandao_cookie',
  captureNotifyKey: '6sq_qiandao_cookie_last_notify',
  captureNotifyCooldownMs: 15000,
  mobile: '',
  renewUrl: 'https://www.6sq.net/qiandao/'
};

function readCookieStore() {
  return ($prefs.valueForKey(CONFIG.cookieKey) || '').trim();
}

function saveCookieStore(cookie) {
  if (!cookie) return false;
  const current = readCookieStore();
  if (current === cookie) return false;
  return $prefs.setValueForKey(cookie, CONFIG.cookieKey);
}

function parseCookieString(cookie) {
  const jar = new Map();
  String(cookie || '')
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => {
      const idx = item.indexOf('=');
      if (idx <= 0) return;
      const name = item.slice(0, idx).trim();
      const value = item.slice(idx + 1).trim();
      if (name) jar.set(name, value);
    });
  return jar;
}

function stringifyCookieJar(jar) {
  return Array.from(jar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

function normalizeSetCookie(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    return raw
      .split(/\n|,(?=[^;]+?=)/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function mergeSetCookie(cookie, setCookieHeaders) {
  const jar = parseCookieString(cookie);
  for (const line of normalizeSetCookie(setCookieHeaders)) {
    const first = String(line || '').split(';')[0].trim();
    const idx = first.indexOf('=');
    if (idx <= 0) continue;
    const name = first.slice(0, idx).trim();
    const value = first.slice(idx + 1).trim();
    if (!name) continue;
    if (!value || /^deleted$/i.test(value)) {
      jar.delete(name);
    } else {
      jar.set(name, value);
    }
  }
  return stringifyCookieJar(jar);
}

function getHeader(headers, name) {
  if (!headers) return undefined;
  const lower = String(name).toLowerCase();
  for (const key of Object.keys(headers)) {
    if (String(key).toLowerCase() === lower) return headers[key];
  }
  return undefined;
}

function cleanText(text) {
  return String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractUsefulCookie(rawCookie) {
  const jar = parseCookieString(rawCookie);
  const keep = ['wgy__user_login', 'wgy__Session'];
  const picked = new Map();
  for (const key of keep) {
    if (jar.has(key)) picked.set(key, jar.get(key));
  }
  return stringifyCookieJar(picked);
}

function notify(title, subtitle, body, url) {
  const options = url ? { 'open-url': url } : undefined;
  $notify(title, subtitle || '', body || '', options);
}

function shouldNotifyCapture() {
  const now = Date.now();
  const last = Number($prefs.valueForKey(CONFIG.captureNotifyKey) || '0');
  if (now - last < CONFIG.captureNotifyCooldownMs) {
    return false;
  }
  $prefs.setValueForKey(String(now), CONFIG.captureNotifyKey);
  return true;
}

async function request({ url, method = 'GET', headers = {}, body = '', cookie = '' }) {
  const reqHeaders = Object.assign(
    {
      'User-Agent': CONFIG.userAgent,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    },
    headers
  );
  if (cookie) reqHeaders.Cookie = cookie;
  const resp = await $task.fetch({
    url,
    method,
    headers: reqHeaders,
    body,
    opts: { redirection: true },
    timeout: CONFIG.timeout
  });
  return {
    statusCode: resp.statusCode,
    headers: resp.headers || {},
    body: resp.body || '',
    cookie: mergeSetCookie(cookie, getHeader(resp.headers, 'set-cookie'))
  };
}

async function fetchText(state, url, headers = {}) {
  const resp = await request({ url, headers, cookie: state.cookie });
  state.cookie = resp.cookie;
  saveCookieStore(extractUsefulCookie(state.cookie));
  if (resp.statusCode < 200 || resp.statusCode >= 400) {
    throw new Error(`请求失败：${resp.statusCode}`);
  }
  return resp.body;
}

async function postForm(state, url, data, headers = {}) {
  const body = Object.keys(data)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(data[key] ?? '')}`)
    .join('&');
  const resp = await request({
    url,
    method: 'POST',
    headers: Object.assign(
      {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: CONFIG.pageUrl,
        Origin: 'https://www.6sq.net',
        Accept: 'application/json, text/javascript, */*; q=0.01'
      },
      headers
    ),
    body,
    cookie: state.cookie
  });
  state.cookie = resp.cookie;
  saveCookieStore(extractUsefulCookie(state.cookie));
  if (resp.statusCode < 200 || resp.statusCode >= 400) {
    throw new Error(`提交失败：${resp.statusCode}`);
  }
  return resp.body;
}

function parseUserInfo(html) {
  const uidMatch = html.match(/G_USER_ID\s*=\s*"([0-9]+)"/i);
  const nameMatch = html.match(/G_USER_NAME\s*=\s*"([^"]*)"/i);
  return {
    uid: uidMatch ? uidMatch[1] : '',
    username: nameMatch ? cleanText(nameMatch[1]) : ''
  };
}

function looksLoggedOut(html) {
  const text = cleanText(html);
  return (
    text.includes('登录 - 六西格玛品质网') ||
    text.includes('邮箱 / 用户名 / 手机号') ||
    text.includes('微信扫一扫登录')
  );
}

function parseResult(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return { status: 'error', detail: `返回不是 JSON：${cleanText(raw).slice(0, 200)}` };
  }
  const msg = cleanText(data.err || data.rsm || '');
  if (msg.includes('成功领取') || msg.includes('6SQ币')) {
    return { status: 'success', detail: msg };
  }
  if (msg.includes('明天再来') || msg.includes('怎么又来了') || msg.includes('刚领完积分')) {
    return { status: 'already', detail: msg };
  }
  if (msg.includes('登录') || msg.includes('用户') || msg.includes('权限')) {
    return { status: 'cookie_invalid', detail: msg || '登录态失效' };
  }
  return { status: 'unknown', detail: msg || raw.slice(0, 200) };
}

async function captureCookieMode() {
  const req = typeof $request !== 'undefined' ? $request : null;
  if (!req || !req.headers) {
    return false;
  }
  const url = req.url || '';
  const host = url.match(/^https?:\/\/([^/]+)/i);
  if (!host || !/6sq\.net$/i.test(host[1])) {
    return false;
  }

  const path = url.replace(/^https?:\/\/[^/]+/i, '') || '/';
  const isCapturePage = (
    path === '/' ||
    path.startsWith('/qiandao') ||
    path.startsWith('/account/login')
  );
  if (!isCapturePage) {
    return false;
  }

  const accept = String(getHeader(req.headers, 'accept') || '').toLowerCase();
  if (accept && !accept.includes('text/html') && !accept.includes('application/xhtml+xml')) {
    return false;
  }

  const rawCookie = getHeader(req.headers, 'cookie') || '';
  const usefulCookie = extractUsefulCookie(rawCookie);
  if (!usefulCookie || !usefulCookie.includes('wgy__user_login=') || !usefulCookie.includes('wgy__Session=')) {
    $done({});
    return true;
  }
  const changed = saveCookieStore(usefulCookie);
  if (path.startsWith('/qiandao')) {
    try {
      const result = await runCheckinWithCookie(usefulCookie);
      const subtitle =
        result.status === 'success'
          ? 'Cookie 已刷新并签到成功'
          : result.status === 'already'
            ? 'Cookie 已刷新，今天已签'
            : result.status === 'cookie_invalid'
              ? 'Cookie 已刷新但仍登录失效'
              : 'Cookie 已刷新，签到状态异常';
      notify('6SQ Cookie 抓取', subtitle, result.lines.join('\n'), result.status === 'cookie_invalid' ? CONFIG.renewUrl : undefined);
    } catch (e) {
      notify('6SQ Cookie 抓取', '已保存，但自动签到失败', `请稍后手动执行任务：${e.message || e}`, CONFIG.renewUrl);
    }
  } else if (changed && shouldNotifyCapture()) {
    notify('6SQ Cookie 抓取', '成功', '已保存到 QuanX 本地存档；打开签到页可立即补签', CONFIG.renewUrl);
  }
  $done({});
  return true;
}

async function runCheckinWithCookie(cookie) {
  const state = { cookie };
  const pageHtml = await fetchText(state, CONFIG.pageUrl);
  if (looksLoggedOut(pageHtml)) {
    throw new Error('本地 cookie 已失效，请重新打开 6sq.net 登录页抓取新 cookie');
  }

  const user = parseUserInfo(pageHtml);
  if (!user.uid) {
    throw new Error('未能从页面提取 uid，页面结构可能变化');
  }

  const resultRaw = await postForm(state, CONFIG.signUrl, { uid: user.uid });
  const result = parseResult(resultRaw);
  const name = user.username || CONFIG.mobile || 'unknown';
  const lines = [`账号：${name}`, `UID：${user.uid}`, result.detail];
  console.log(`RESULT: ${result.status.toUpperCase()}`);
  console.log(`UID: ${user.uid}`);
  console.log(`USERNAME: ${name}`);
  console.log(`DETAIL: ${result.detail}`);
  return { status: result.status, detail: result.detail, user, name, lines };
}

async function main() {
  if (await captureCookieMode()) return;

  const storedCookie = readCookieStore();
  if (!storedCookie) {
    throw new Error('当前没有本地 cookie，请先在 QuanX 里打开 6sq.net 登录并抓取 cookie');
  }

  const result = await runCheckinWithCookie(storedCookie);
  const subtitle =
    result.status === 'success'
      ? '签到成功'
      : result.status === 'already'
        ? '今天已签'
        : result.status === 'cookie_invalid'
          ? '登录失效'
          : '状态异常';

  notify('6SQ 签到', subtitle, result.lines.join('\n'), result.status === 'cookie_invalid' ? CONFIG.renewUrl : undefined);
}

main()
  .catch((error) => {
    const detail = error.message || error;
    const msg = `签到异常：${detail}`;
    console.log('RESULT: ERROR');
    console.log(`DETAIL: ${detail}`);
    const needRenew = String(detail).includes('cookie') || String(detail).includes('登录') || String(detail).includes('没有本地');
    notify('6SQ 签到', needRenew ? '登录失效，点通知重新抓取' : '异常', msg, needRenew ? CONFIG.renewUrl : undefined);
  })
  .finally(() => {
    if (typeof $request === 'undefined') $done();
  });
