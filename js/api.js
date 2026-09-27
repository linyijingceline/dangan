/**
 * 和云函数打交道的唯一入口。
 *
 * 为什么网页必须这样调：
 * 数据库被 RLS 锁死，直接连是连不上的；网页只能来敲云函数的门，
 * 由云函数决定返回哪些字段——电话和住址永远不会发到普通访客的浏览器里。
 */

const API_BASE =
  'https://partner-profile-d0fjkj7a9c4abacc-1495948086.ap-shanghai.app.tcloudbase.com/api';

async function callApi(action, data) {
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
