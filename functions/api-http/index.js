/**
 * 伙伴档案 · 云函数（HTTP 函数 · REST 版）
 *
 * 走 CloudBase 官方 REST 接口（PostgREST 规范）读写数据库。
 * 为什么不用 pg 直连：CloudBase 免费/个人版环境目前不开放 PostgreSQL 的 TCP 直连。
 *
 * 安全性：
 * - 用 API Key（服务端权限），只存在云函数环境变量里，网页拿不到
 * - 网页只能来敲这个函数的门，由函数决定返回哪些字段；电话住址永远不会发给普通访客
 *
 * 环境变量（控制台配置，不要写在代码里）：
 *   CLOUBASE_API_KEY   服务端 API Key
 *   ADMIN_PASS         管理员口令
 *   CLOUBASE_ENV_ID    环境 ID（已填默认值）
 *
 * 调试技巧：请求体里带 "debug": true，出错时会把真实原因返回给你（排查完记得别用）。
 */

const http = require('http');

const ENV_ID = process.env.CLOUBASE_ENV_ID || 'partner-profile-d0fjkj7a9c4abacc';
const API_KEY = process.env.CLOUBASE_API_KEY || '';
const ADMIN_PASS = process.env.ADMIN_PASS || '';
const BASE =
  process.env.CLOUBASE_RDB_URL ||
  `https://${ENV_ID}.api.tcloudbasegateway.com/v1/rdb/rest`;
const PORT = process.env.PORT || 9000;

const ok = (data = {}) => Object.assign({ ok: true }, data);
const fail = (msg) => ({ ok: false, msg });
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const orNull = (v) => {
  const s = str(v);
  return s === '' ? null : s;
};

// 统一走 REST 接口。失败时抛出的错误里带上状态码和数据库给的说明，方便定位问题
async function rest(path, options = {}) {
  const res = await fetch(BASE + path, {
    method: options.method || 'GET',
    headers: Object.assign(
      {
        apikey: API_KEY,
        Authorization: 'Bearer ' + API_KEY,
        'Content-Type': 'application/json',
      },
      options.headers || {}
    ),
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = '';
    try {
      const j = JSON.parse(text);
      detail = j.message || j.hint || j.details || '';
    } catch (e) {
      detail = text;
    }
    throw new Error(
      `数据库接口返回 ${res.status}${detail ? '：' + String(detail).slice(0, 160) : ''}`
    );
  }
  return text ? JSON.parse(text) : null;
}

const PUBLIC_FIELDS = 'id,name,major,school,birthday,hobby,joined_at';
const PRIVATE_FIELDS = 'profile_id,phone,address,note';

// 往公开表插一条，并拿到自动生成的 id。
// 优先让接口把插入结果返回（Prefer: return=representation）；
// 万一接口不支持这个头，就退回"插完再查一次"的办法。
async function insertPublic(body) {
  try {
    const rows = await rest('/profiles_public', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body,
    });
    if (rows && rows[0] && rows[0].id) return rows[0].id;
  } catch (e) {
    console.error('[api] 带返回值的插入失败，改用普通插入：', e.message);
  }
  await rest('/profiles_public', { method: 'POST', body });
  const rows = await rest(
    `/profiles_public?select=id&name=eq.${encodeURIComponent(body.name)}&order=joined_at.desc&limit=1`
  );
  return rows && rows[0] ? rows[0].id : '';
}

async function submitProfile(data) {
  const name = str(data.name);
  const major = str(data.major);
  const school = str(data.school);
  const phone = str(data.phone);
  const address = str(data.address);

  if (!name) return fail('姓名不能为空');
  if (!major) return fail('专业不能为空');
  if (!school) return fail('学校不能为空');
  if (!phone) return fail('电话不能为空');
  if (!address) return fail('家庭住址不能为空');

  const id = await insertPublic({
    name,
    major,
    school,
    birthday: orNull(data.birthday),
    hobby: orNull(data.hobby),
  });
  if (!id) return fail('提交失败，没能拿到档案编号');

  await rest('/profiles_private', {
    method: 'POST',
    body: { profile_id: id, phone, address },
  });

  return ok({ id });
}

async function listProfiles() {
  const list = await rest(`/profiles_public?select=${PUBLIC_FIELDS}&order=joined_at.desc`);
  return ok({ list: list || [] });
}

async function getProfile(data) {
  const id = str(data.id);
  if (!id) return fail('缺少档案编号');
  const rows = await rest(
    `/profiles_public?select=${PUBLIC_FIELDS}&id=eq.${encodeURIComponent(id)}`
  );
  if (!rows || rows.length === 0) return fail('这条档案不存在或已被删除');
  return ok({ profile: rows[0] });
}

// 管理员列表：分两次查，在服务端按 id 拼起来（两张表没建外键，不能联表查）
async function adminList() {
  const [pub, pri] = await Promise.all([
    rest(`/profiles_public?select=${PUBLIC_FIELDS}&order=joined_at.desc`),
    rest(`/profiles_private?select=${PRIVATE_FIELDS}`),
  ]);
  const map = {};
  (pri || []).forEach((r) => {
    map[r.profile_id] = r;
  });
  const list = (pub || []).map((p) => {
    const s = map[p.id] || {};
    return Object.assign({}, p, {
      phone: s.phone || '',
      address: s.address || '',
      note: s.note || '',
    });
  });
  return ok({ list });
}

async function adminUpdate(data) {
  const id = str(data.id);
  if (!id) return fail('缺少档案编号');
  const where = encodeURIComponent(id);

  await rest(`/profiles_public?id=eq.${where}`, {
    method: 'PATCH',
    body: {
      name: str(data.name),
      major: str(data.major),
      school: str(data.school),
      birthday: orNull(data.birthday),
      hobby: orNull(data.hobby),
    },
  });
  await rest(`/profiles_private?profile_id=eq.${where}`, {
    method: 'PATCH',
    body: {
      phone: str(data.phone),
      address: str(data.address),
      note: orNull(data.note),
    },
  });
  return ok({});
}

// 删除顺序：先删敏感表，再删公开表，避免留下没人认领的敏感数据
async function adminDelete(data) {
  const id = str(data.id);
  if (!id) return fail('缺少档案编号');
  const where = encodeURIComponent(id);
  await rest(`/profiles_private?profile_id=eq.${where}`, { method: 'DELETE' });
  await rest(`/profiles_public?id=eq.${where}`, { method: 'DELETE' });
  return ok({});
}

function checkAdmin(pass) {
  if (!ADMIN_PASS) return { ok: false, msg: '服务端未配置 ADMIN_PASS' };
  if (str(pass) !== ADMIN_PASS) return { ok: false, msg: '口令错误' };
  return { ok: true };
}

async function dispatch(action, data) {
  if (!API_KEY) return fail('服务端未配置 CLOUBASE_API_KEY');
  switch (action) {
    // 用来查"我到底是谁"：调用数据库里的 who_am_i() 函数，返回当前身份
    case 'whoAmI': {
      const me = await rest('/rpc/who_am_i', { method: 'POST' });
      return ok({ me });
    }
    // 用来排查"哪种请求头才被认"：同一张表，用几种不同的头各试一次，把状态码报回来
    case 'probe': {
      const ways = [
        { name: 'apikey + Bearer', headers: { apikey: API_KEY, Authorization: 'Bearer ' + API_KEY } },
        { name: 'Bearer only', headers: { Authorization: 'Bearer ' + API_KEY } },
        { name: 'apikey only', headers: { apikey: API_KEY } },
        { name: 'x-api-key', headers: { 'x-api-key': API_KEY } },
      ];
      const out = [];
      for (const w of ways) {
        try {
          const res = await fetch(BASE + '/profiles_public?select=id&limit=1', {
            headers: Object.assign({ 'Content-Type': 'application/json' }, w.headers),
          });
          const text = await res.text();
          out.push({ 方式: w.name, 状态码: res.status, 返回: String(text).slice(0, 160) });
        } catch (e) {
          out.push({ 方式: w.name, 错误: String(e.message).slice(0, 120) });
        }
      }
      return ok({ probe: out });
    }
    case 'submitProfile':
      return await submitProfile(data);
    case 'listProfiles':
      return await listProfiles();
    case 'getProfile':
      return await getProfile(data);
    case 'adminVerify': {
      const r = checkAdmin(data.pass);
      return r.ok ? ok({}) : fail(r.msg);
    }
    case 'adminList': {
      const r = checkAdmin(data.pass);
      if (!r.ok) return fail(r.msg);
      return await adminList();
    }
    case 'adminUpdate': {
      const r = checkAdmin(data.pass);
      if (!r.ok) return fail(r.msg);
      return await adminUpdate(data);
    }
    case 'adminDelete': {
      const r = checkAdmin(data.pass);
      if (!r.ok) return fail(r.msg);
      return await adminDelete(data);
    }
    default:
      return fail('未知操作：' + action);
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) reject(new Error('请求体过大'));
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // 跨域（CORS）头一个都不要在这里设！
  // HTTP 网关已经帮我们设好了；如果函数里再设一遍，响应里会出现两个
  // Access-Control-Allow-Origin 值，浏览器会直接拒绝整个响应
  //（表现就是 fetch 报"网络好像不太好"，而服务端其实一切正常）。

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // 健康检查：浏览器直接打开地址就能看到，方便确认服务活着
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ ok: true, msg: '伙伴档案服务运行中' }));
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(fail('只支持 POST')));
  }

  let result;
  let raw = '';
  try {
    raw = await readBody(req);
    const payload = raw ? JSON.parse(raw) : {};
    result = await dispatch(str(payload.action), payload.data || {});
  } catch (e) {
    console.error('[api] 出错：', e);
    // 带 debug 时把真实原因给出来（只在排查时用，平时给人话）
    const wantDebug = /"debug"\s*:\s*true/.test(raw || '');
    result = wantDebug ? fail('排查信息：' + e.message) : fail('服务出了点问题，请稍后再试');
  }

  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(result));
});

server.listen(PORT, () => {
  console.log('[api] 已启动，监听端口 ' + PORT);
});
