/**
 * 可复用组件：档案卡片（Day 8 余力加练）
 *
 * 为什么单独抽一个文件：
 * 卡片以后会在多个地方用（列表页、搜索结果、以后可能的"最近加入"板块）。
 * 如果样式结构散在页面里，改一处就要找好几遍。所以：**一处定义，处处调用**。
 *
 * 用法：
 *   container.innerHTML = ProfileCard.html(profile);
 *   或者  container.innerHTML = ProfileCard.list(profiles);
 *
 * 组件约束（新增或修改卡片时照这套走，别自己另立一套）：
 *   1. 外层用 .person，内边距 --space-4，头像与正文间距 --space-3，圆角 --radius-lg
 *   2. 头像与正文垂直居中（.person 里已设 align-items: center）
 *   3. 正文容器必须带 .person-body（min-width: 0），长名字才截得住
 *   4. 次要信息用 .meta：13px、--muted、行间距 --space-1
 *   5. 缺字段就不渲染那一行，别留空标签占位
 *   6. 用户内容必须过 esc()，否则填的内容能把页面结构搞乱
 */

const ProfileCard = {
  /**
   * 单张卡片
   * @param {object} p 档案对象（公开字段）
   * @returns {string} 卡片 HTML
   */
  html: function (p) {
    if (!p) return '';

    const name = esc(p.name) || '（未填姓名）';
    const first = (p.name || '?').trim().charAt(0);
    const schoolLine = [p.major, p.school].filter(Boolean).map(esc).join(' · ');

    // 可选信息可能缺，缺了就不显示这一行，不留空标签
    const extras = [];
    if (p.birthday) extras.push('生日 ' + esc(p.birthday));
    if (p.hobby) extras.push('爱好 ' + esc(p.hobby));

    const joined = p.joined_at ? '<div class="meta">加入于 ' + fmtDate(p.joined_at) + '</div>' : '';

    return (
      '<a class="person" href="profile.html?id=' + encodeURIComponent(p.id || '') + '">' +
        '<div class="avatar">' + esc(first) + '</div>' +
        '<div class="person-body">' +
          '<div class="name">' + name + '</div>' +
          (schoolLine ? '<div class="meta">' + schoolLine + '</div>' : '') +
          (extras.length ? '<div class="meta">' + extras.join(' · ') + '</div>' : '') +
          joined +
        '</div>' +
      '</a>'
    );
  },

  /**
   * 一组卡片
   * @param {array} list 档案数组
   * @returns {string} 若干张卡片的 HTML
   */
  list: function (list) {
    if (!list || !list.length) return '';
    return list.map(ProfileCard.html).join('');
  },

  /**
   * 骨架屏：加载中占位的卡片，让页面在等待时"有形状"
   */
  skeleton: function (count) {
    const n = count || 3;
    let out = '';
    for (let i = 0; i < n; i++) {
      out +=
        '<div class="person skeleton">' +
          '<div class="avatar"></div>' +
          '<div class="person-body">' +
            '<div class="sk-line" style="width:40%"></div>' +
            '<div class="sk-line" style="width:70%"></div>' +
            '<div class="sk-line" style="width:55%"></div>' +
          '</div>' +
        '</div>';
    }
    return out;
  },
};
