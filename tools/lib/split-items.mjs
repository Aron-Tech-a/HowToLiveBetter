// 把一行写到底的超长「收益 / 备注 / 来源」列表项，在换话题、换出处的地方拆成子条目。
// 只改版式，不动正文的字：拆出来的子条目按顺序拼回去，和原来那一行逐字相同（来源栏里文献之间那个「；」换成了换行）。
// 起因是电子书里一条「收益」常常一整段一千多字（比如第 31 节第 1 条把十二条路的门槛写在一行里），
// 在阅读器里就是一整块，找不到哪句讲哪条路。目前只接在 EPUB 构建里；PDF 想用的话同样在 read 之后套一层。

const MIN_LEN = 300;    // 短于这个长度的项不拆
const MIN_CHUNK = 25;   // 拆出来太短的块并回上一块

// 句号之后，下一句以这些开头，就当作换了一条依据
const TOPIC_START = [
  /^[^，。「」《》：；（）]{1,12}看(《|[^，。「」]{0,10}法[：「（第])/,     // 当兵看兵役法：/ 考公务员看《…》
  /^《[^》]{2,40}》/,                                                     // 《某条例》……
  /^[一-龥]{1,12}法(第[一二三四五六七八九十百零]+条|「)/,          // 刑法第…条 / 义务教育法「
  /^(另一|另有一|还有一|再一|又一)(项|篇)/,                          // 另一项试验
  /^(国内|国外|国内外)也有/,
  /^案例[一二三四五六七八九十]/,
  /^(同一天|同一试验|同一指南|同一研究)/,
  /^(美国|英国|欧洲|世界卫生组织|WHO|中国)[^，。]{0,20}(指南|共识|建议|学会)/,
  /^(先说|再说|最后说|先看|再看|最后看)/,
  /^一(项|篇)[^，。]{0,20}(试验|研究|综述|分析|调查)/,
  /^(芬兰|北欧|英国|美国|日本|韩国|瑞典|丹麦|挪威|德国|法国|澳大利亚|加拿大|荷兰|台湾|香港|上海|北京)[^，。]{0,25}(研究|数据库|试验|队列|调查)/,
];

function splitTopLevel(text, sep, keepSep) {
  // 在不处于 「」《》（）() <> 里面的位置按 sep 拆
  const out = [];
  let depth = 0, start = 0;
  const open = '「《（(', close = '」》）)';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '<' && /^<https?:/.test(text.slice(i, i + 9))) {
      const j = text.indexOf('>', i);
      if (j > 0) { i = j; continue; }
    }
    if (open.includes(c)) depth++;
    else if (close.includes(c)) depth = Math.max(0, depth - 1);
    else if (c === sep && depth === 0) {
      out.push(text.slice(start, keepSep ? i + 1 : i));
      start = i + 1;
    }
  }
  out.push(text.slice(start));
  return out.filter(s => s.trim());
}

function mergeShort(chunks) {
  const out = [];
  for (const c of chunks) {
    if (out.length && c.length < MIN_CHUNK) out[out.length - 1] += c;
    else out.push(c);
  }
  // 第一块也太短就并到第二块前面
  if (out.length > 1 && out[0].length < MIN_CHUNK) out.splice(0, 2, out[0] + out[1]);
  return out;
}

function splitBenefit(body) {
  const sentences = splitTopLevel(body, '。', true);
  const chunks = [];
  for (const s of sentences) {
    const t = s.trimStart();
    if (chunks.length && TOPIC_START.some(re => re.test(t))) chunks.push(t);
    else if (chunks.length) chunks[chunks.length - 1] += s;
    else chunks.push(s);
  }
  return mergeShort(chunks);
}

function splitSources(body) {
  // 一条文献以 <网址> 收尾，后面跟「；」再接下一条
  const parts = splitTopLevel(body, '；', false);
  const chunks = [];
  for (const p of parts) {
    if (chunks.length && /<https?:/.test(chunks[chunks.length - 1])) chunks.push(p.trim());
    else if (chunks.length) chunks[chunks.length - 1] += '；' + p;
    else chunks.push(p.trim());
  }
  return chunks;
}

const safe = s => s.replace(/^(\d+)([.)])(\s)/, '$1\\$2$3');

export function splitLongItems(md) {
  return md.split('\n').map(line => {
    const m = line.match(/^(\s*)- (收益|备注|来源)：(.*)$/);
    if (!m || line.length < MIN_LEN) return line;
    const [, indent, label, body] = m;
    const chunks = label === '来源' ? splitSources(body) : splitBenefit(body);
    if (chunks.length < 2) return line;
    return `${indent}- ${label}：\n` + chunks.map(c => `${indent}  - ${safe(c.trim())}`).join('\n');
  }).join('\n');
}
