/**
 * 和云函数打交道的唯一入口。
 *
 * 为什么网页必须这样调：
 * 数据库被 RLS 锁死，直接连是连不上的；网页只能来敲云函数的门，
 * 由云函数决定返回哪些字段——电话和住址永远不会发到普通访客的浏览器里。
 */

const API_BASE =
  'https://partner-profile-d0fjkj7a9c4abacc-1495948086.ap-shanghai.app.tcloudbase.com/api';

/**
 * Day 8：改用本地假数据渲染页面
 *
 * 为什么要有这个开关：
 * 先把"页面长什么样、四种状态怎么表现"定下来，再谈接真实数据。
 * 调试页面时不该每次都等网络，也不该因为数据库里没数据就看不到效果。
 *
 * USE_MOCK = true   → 用 js/mock-data.js 里的假数据（今天的做法）
 * USE_MOCK = false  → 走真实云函数（第 3 周切回这个）
 */
const USE_MOCK = true;

// 假数据的可控开关，配合首页的"状态预览"用
const mockControl = {
  delay: 700,   // 模拟网络延迟，才看得出"加载中"状态
  fail: false,  // 打开后模拟"请求失败"，用来看错误状态
  empty: false, // 打开后模拟"一条数据都没有"，用来看空状态
};

async function mockCall(action, data) {
  await new Promise(function (r) { setTimeout(r, mockControl.delay); });

  if (mockControl.fail) throw new Error('加载失败：连不上服务器（这是假数据模拟出来的错误）');
  if (mockControl.empty) return { ok: true, list: [] };

  if (action === 'listProfiles') return { ok: true, list: MOCK_PROFILES };
  if (action === 'getProfile') {
    const p = MOCK_PROFILES.find(function (x) { return x.id === (data && data.id); });
    if (!p) throw new Error('这条档案不存在或已被删除');
    return { ok: true, profile: p };
  }
  return { ok: false, msg: '假数据模式暂不支持这个操作：' + action };
}

async function callApi(action, data) {
  if (USE_MOCK) return mockCall(action, data);

  let res;
  try {
    res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: action, data: data || {} }),
    });
  } catch (e) {
    throw new Error('网络好像不太好，请重试');
  }
  let json;
  try {
    json = await res.json();
  } catch (e) {
    throw new Error('服务返回的内容看不懂，请重试');
  }
  if (!json.ok) throw new Error(json.msg || '请求失败');
  return json;
}

// 把用户填的内容转成纯文本再显示，防止有人填了带标签的内容把页面搞乱
function esc(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return s.replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function fmtDate(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  const p = function (n) {
    return n < 10 ? '0' + n : String(n);
  };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
    ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

function showMsg(el, text, type) {
  el.textContent = text;
  el.className = 'msg show ' + (type || 'ok');
}

function getParam(name) {
  const m = new URLSearchParams(location.search).get(name);
  return m ? m : '';
}
