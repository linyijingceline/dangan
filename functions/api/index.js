/**
 * 伙伴档案 · 唯一的云函数（api）
 *
 * 为什么只有一个：
 * 网页不许直接连数据库（RLS 已经把门关死），所有读写必须从这里过。
 * 一个入口按 action 分发，比 7 个云函数好维护，也省调用次数。
 *
 * 环境变量（在 CloudBase 控制台配置，千万不要写在代码里）：
 *   DATABASE_URL  数据库连接串（含密码）
 *   ADMIN_PASS    管理员口令
 */

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || '';
const ADMIN_PASS = process.env.ADMIN_PASS || '';

// 统一返回格式：成功 { ok: true, ... }；失败 { ok: false, msg: '人话提示' }
const ok = (data = {}) => Object.assign({ ok: true }, data);
const fail = (msg) => ({ ok: false, msg });

// 去掉首尾空格，非字符串当成空字符串
const str = (v) => (typeof v === 'string' ? v.trim() : '');
// 空字符串存成 null，避免数据库里留一堆空串
const orNull = (v) => {
  const s = str(v);
  return s === '' ? null : s;
};

// 连数据库：用完一定关掉连接，否则云函数会一直挂着把资源耗光
async function withDb(fn) {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end().catch(() => {});
  }
}

// 管理员身份检查：口令不对一律拒绝，不给任何提示性信息
function checkAdmin(pass) {
  if (!ADMIN_PASS) return { ok: false, msg: '服务端未配置 ADMIN_PASS' };
  if (str(pass) !== ADMIN_PASS) return { ok: false, msg: '口令错误' };
  return { ok: true };
}

// 提交档案：先写公开表拿 id，再用这个 id 写敏感表，两步要么都成功要么都撤销
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

  return withDb(async (c) => {
    await c.query('begin');
    try {
      const r = await c.query(
        `insert into profiles_public (name, major, school, birthday, hobby)
         values ($1, $2, $3, $4, $5) returning id`,
        [name, major, school, orNull(data.birthday), orNull(data.hobby)]
      );
      const id = r.rows[0].id;
      await c.query(
        `insert into profiles_private (profile_id, phone, address)
         values ($1, $2, $3)`,
        [id, phone, address]
      );
      await c.query('commit');
      return ok({ id });
    } catch (e) {
      await c.query('rollback');
      throw e;
    }
  });
}

// 公开列表：只查公开表，敏感表碰都不碰
async function listProfiles() {
  return withDb(async (c) => {
    const r = await c.query(
      `select id, name, major, school, birthday, hobby, joined_at
       from profiles_public
       order by joined_at desc`
    );
    return ok({ list: r.rows });
  });
}

// 公开详情：同样只查公开表
async function getProfile(data) {
  const id = str(data.id);
  if (!id) return fail('缺少档案编号');
  return withDb(async (c) => {
    const r = await c.query(
      `select id, name, major, school, birthday, hobby, joined_at
       from profiles_public where id = $1`,
      [id]
    );
    if (r.rows.length === 0) return fail('这条档案不存在或已被删除');
    return ok({ profile: r.rows[0] });
  });
}

// 管理员列表：两张表联起来查，才拿得到电话住址
async function adminList() {
  return withDb(async (c) => {
    const r = await c.query(
      `select p.id, p.name, p.major, p.school, p.birthday, p.hobby, p.joined_at,
              r.phone, r.address, r.note
       from profiles_public p
       left join profiles_private r on r.profile_id = p.id
       order by p.joined_at desc`
    );
    return ok({ list: r.rows });
  });
}

// 管理员改：两张表一起改（表单要提交完整内容，不填的字段会存成空）
async function adminUpdate(data) {
  const id = str(data.id);
  if (!id) return fail('缺少档案编号');
  return withDb(async (c) => {
    await c.query('begin');
    try {
      await c.query(
        `update profiles_public
            set name = $1, major = $2, school = $3, birthday = $4, hobby = $5
          where id = $6`,
        [
          str(data.name),
          str(data.major),
          str(data.school),
          orNull(data.birthday),
          orNull(data.hobby),
          id,
        ]
      );
      await c.query(
        `update profiles_private
            set phone = $1, address = $2, note = $3
          where profile_id = $4`,
        [str(data.phone), str(data.address), orNull(data.note), id]
      );
      await c.query('commit');
      return ok({});
    } catch (e) {
      await c.query('rollback');
      throw e;
    }
  });
}

// 管理员删：先删敏感表再删公开表，顺序反了会留下没人认领的敏感数据
async function adminDelete(data) {
  const id = str(data.id);
  if (!id) return fail('缺少档案编号');
  return withDb(async (c) => {
    await c.query('begin');
    try {
      await c.query(`delete from profiles_private where profile_id = $1`, [id]);
      await c.query(`delete from profiles_public where id = $1`, [id]);
      await c.query('commit');
      return ok({});
    } catch (e) {
      await c.query('rollback');
      throw e;
    }
  });
}

exports.main = async (event) => {
  const action = str((event && event.action) || '');
  const data = (event && event.data) || {};

  if (!DATABASE_URL) return fail('服务端未配置 DATABASE_URL');

  try {
    switch (action) {
      // 任何人都能调
      case 'submitProfile':
        return await submitProfile(data);
      case 'listProfiles':
        return await listProfiles();
      case 'getProfile':
        return await getProfile(data);

      // 需要管理员口令
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
  } catch (e) {
    // 出错只给一句人话，真实的报错留在云函数日志里，别把技术细节甩给用户
    console.error('[api] 出错：', e);
    return fail('服务出了点问题，请稍后再试');
  }
};
