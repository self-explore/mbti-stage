// ============================================================
//  MBTI 心智阶位测评 · 逻辑层
//  选类型 → 动态组卷（通用24+专属12=36）→ 六维成熟度打分 → 阶位判定 → 结果
// ============================================================

// ---------- 全局状态 ----------
let selType = null;        // 用户选择的类型对象
let questions = [];        // 组卷后的题目
let answers = [];          // 每题所选的成熟度分 m
let cur = 0;
let lastResult = null;

// ---------- 阶位定义 ----------
function tierOf(pct) { if (pct <= 47) return 'low'; if (pct <= 72) return 'mid'; return 'high'; }
const TIER = {
  low:  { name: '低阶', tag: 'low'  },
  mid:  { name: '中阶', tag: 'mid'  },
  high: { name: '高阶', tag: 'high' }
};
const DIM_TIER_TXT = {
  low:  '较多受本能与防御支配，是当前的成长卡点',
  mid:  '已具备觉察，但压力下仍会摇摆反复',
  high: '已相当成熟整合，是你稳定的优势区'
};

// ---------- 视图切换 ----------
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

// ---------- 确定性洗牌（打乱选项显示顺序） ----------
function seededShuffle(arr, seed) {
  const a = arr.slice();
  let s = (seed % 233280) + 1;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- 选择类型页 ----------
function goTypePage() { renderTypeCards(); show('type-page'); }

function renderTypeCards() {
  const wrap = document.getElementById('type-groups');
  wrap.innerHTML = ['NT', 'NF', 'SJ', 'SP'].map(g => {
    const meta = GROUPS[g];
    const cards = TYPES.filter(t => t.group === g).map(t => `
      <div class="type-card" style="--tc:${t.color}" onclick="selectType('${t.code}')">
        <div class="tc-code">${t.code}</div>
        <div class="tc-name">${t.name}</div>
      </div>`).join('');
    return `
      <div class="tgroup">
        <div class="tgroup-head">
          <span class="tgroup-dot" style="background:${meta.color}"></span>
          <span class="tgroup-name">${meta.name}</span>
          <span class="tgroup-desc">${meta.desc}</span>
        </div>
        <div class="type-grid">${cards}</div>
      </div>`;
  }).join('');
}

// ---------- 组卷 ----------
function buildQuestions(code) {
  const t = TYPES.find(x => x.code === code);
  const pool = COMMON_Q.concat(GROUP_Q[t.group]);          // 24 + 12 = 36
  const shuffled = seededShuffle(pool.map((q, i) => i), 2026); // 打乱题目顺序
  return shuffled.map((origIdx, pos) => {
    const q = pool[origIdx];
    return { dim: q.dim, text: q.text, opts: seededShuffle(q.opts, origIdx * 37 + pos * 7 + 11) };
  });
}

function selectType(code) {
  selType = TYPES.find(t => t.code === code);
  questions = buildQuestions(code);
  answers = new Array(questions.length).fill(null);
  document.getElementById('q-code').textContent = code;
  show('quiz-page');
  renderQuestion(0);
}

// ---------- 答题 ----------
function renderQuestion(i) {
  cur = i;
  const q = questions[i], total = questions.length;
  const dimMeta = DIMS.find(d => d.key === q.dim);
  document.getElementById('q-num').textContent = `Question ${i + 1}`;
  document.getElementById('q-total').textContent = `${total} total`;
  document.getElementById('q-bar').style.width = `${(i / total) * 100}%`;
  document.getElementById('q-dim').textContent = dimMeta ? dimMeta.label : '';
  document.getElementById('q-text').textContent = q.text;
  document.getElementById('q-opts').innerHTML = q.opts.map((o, idx) =>
    `<button class="opt" onclick="pick(${idx})"><span class="opt-tag">${'ABCD'[idx]}</span>${o.t}</button>`
  ).join('');
}

function pick(idx) {
  answers[cur] = questions[cur].opts[idx].m;
  if (cur < questions.length - 1) { renderQuestion(cur + 1); window.scrollTo(0, 0); }
  else { document.getElementById('q-bar').style.width = '100%'; startLoading(); }
}

// ---------- 加载页 ----------
function startLoading() {
  show('load-page');
  const steps = ['读取作答轨迹', '计算六维成熟度', '比对你的类型成长模型', '封装专属阶位解读'];
  const bar = document.getElementById('load-bar');
  const pct = document.getElementById('load-pct');
  const list = document.getElementById('load-steps');
  list.innerHTML = steps.map((s, i) => `<div class="load-step" id="ls-${i}"><span class="ls-dot"></span>${s}</div>`).join('');
  let p = 0;
  const timer = setInterval(() => {
    p += Math.random() * 9 + 4;
    if (p >= 100) { p = 100; clearInterval(timer); setTimeout(showResult, 420); }
    bar.style.width = p + '%';
    pct.textContent = Math.floor(p) + '%';
    const stage = Math.min(3, Math.floor(p / 25));
    for (let i = 0; i < 4; i++) {
      const el = document.getElementById('ls-' + i);
      el.classList.toggle('done', i < stage || p >= 100);
      el.classList.toggle('active', i === stage && p < 100);
    }
  }, 155);
}

// ---------- 计分 ----------
function compute() {
  const dimScore = {}, dimCount = {};
  DIMS.forEach(d => { dimScore[d.key] = 0; dimCount[d.key] = 0; });
  questions.forEach((q, i) => {
    const m = answers[i] == null ? 2 : answers[i];   // 未答按中间分
    dimScore[q.dim] += m; dimCount[q.dim] += 1;
  });
  const radar = DIMS.map(d => {
    const max = dimCount[d.key] * 4;
    const pct = max ? Math.round(dimScore[d.key] / max * 100) : 0;
    return { key: d.key, label: d.label, color: d.color, pct, tier: tierOf(pct) };
  });
  let total = 0, totalMax = 0;
  DIMS.forEach(d => { total += dimScore[d.key]; totalMax += dimCount[d.key] * 4; });
  const overall = Math.round(total / totalMax * 100);
  return { radar, overall, tier: tierOf(overall) };
}

// ---------- 雷达图 ----------
function drawRadar(canvasId, radar) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1, size = 300;
  canvas.width = size * dpr; canvas.height = size * dpr;
  const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
  const cx = size / 2, cy = size / 2, R = size / 2 - 52, n = radar.length;
  ctx.clearRect(0, 0, size, size);
  for (let ring = 1; ring <= 4; ring++) {
    const rr = R * ring / 4; ctx.beginPath();
    for (let i = 0; i <= n; i++) { const ang = -Math.PI / 2 + (i % n) * (2 * Math.PI / n); const x = cx + rr * Math.cos(ang), y = cy + rr * Math.sin(ang); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.strokeStyle = 'rgba(90,130,190,0.16)'; ctx.lineWidth = 1; ctx.stroke();
  }
  for (let i = 0; i < n; i++) { const ang = -Math.PI / 2 + i * (2 * Math.PI / n); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + R * Math.cos(ang), cy + R * Math.sin(ang)); ctx.strokeStyle = 'rgba(90,130,190,0.14)'; ctx.stroke(); }
  ctx.beginPath(); const pts = [];
  radar.forEach((d, i) => { const v = d.pct / 100; const ang = -Math.PI / 2 + i * (2 * Math.PI / n); const x = cx + R * v * Math.cos(ang), y = cy + R * v * Math.sin(ang); pts.push([x, y]); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
  ctx.closePath(); ctx.fillStyle = 'rgba(91,143,208,0.24)'; ctx.fill(); ctx.strokeStyle = '#4f7fc4'; ctx.lineWidth = 2; ctx.stroke();
  pts.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fillStyle = '#4f7fc4'; ctx.fill(); });
  ctx.font = '12px "Noto Sans SC", sans-serif'; ctx.fillStyle = '#55687f'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  radar.forEach((d, i) => { const ang = -Math.PI / 2 + i * (2 * Math.PI / n); ctx.fillText(d.label, cx + (R + 30) * Math.cos(ang), cy + (R + 24) * Math.sin(ang)); });
}

// ---------- 颜色加深（阶位卡渐变） ----------
function darken(hex, amt) {
  const h = hex.replace('#', '');
  const num = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  let r = (num >> 16) - amt, g = ((num >> 8) & 0xff) - amt, b = (num & 0xff) - amt;
  r = Math.max(0, r); g = Math.max(0, g); b = Math.max(0, b);
  return `rgb(${r},${g},${b})`;
}

// ---------- 结果页 ----------
function showResult() {
  const r = compute(); lastResult = r;
  const t = selType, tier = r.tier, stage = t.stages[tier];
  show('result-page');
  const scroll = document.getElementById('result-scroll');
  const srcWord = tier === 'high' ? '已然通透' : tier === 'mid' ? '正在成长' : '蓄力待发';
  scroll.innerHTML = `
    <div class="r-head fade-enter">
      <span class="r-badge">测评完成</span>
      <h1 class="r-h1">你的心智阶位画像</h1>
    </div>

    <div class="stage-card fade-enter" style="animation-delay:.05s">
      <div class="stage-top" style="background:linear-gradient(155deg,${t.color},${darken(t.color, 42)})">
        <div class="stage-tier-badge">${TIER[tier].name}</div>
        <div class="stage-pct">成熟度 ${r.overall}%</div>
        <div class="stage-code">${t.code}</div>
        <div class="stage-name">${t.name} · ${GROUPS[t.group].name}</div>
        <div class="stage-fn">认知功能 ${t.functions}</div>
        <div class="stage-tier-name">${TIER[tier].name} · ${t.code}</div>
        <div class="stage-tier-title">「${stage.title}」</div>
      </div>
      <div class="stage-bottom"><p class="stage-summary">${stage.summary}</p></div>
    </div>

    <div class="duo fade-enter" style="animation-delay:.1s">
      <div class="duo-card">
        <div class="card-title">六维成长光谱</div>
        <canvas id="radar-canvas"></canvas>
      </div>
      <div class="duo-card">
        <div class="card-title">分维度成熟度</div>
        ${r.radar.map(d => `
          <div class="dim-row">
            <div class="dim-lab"><b>${d.label}</b><span>${d.pct}%</span></div>
            <div class="dim-track"><div class="dim-fill" style="width:${d.pct}%"></div></div>
            <div class="dim-tier">${TIER[d.tier].name} · ${DIM_TIER_TXT[d.tier]}</div>
          </div>`).join('')}
      </div>
    </div>

    <div class="sec fade-enter" style="animation-delay:.15s">
      <div class="sec-title">你的三阶画像</div>
      <div class="tiers">
        ${['low', 'mid', 'high'].map(k => {
          const s = t.stages[k], isCur = k === tier;
          return `<div class="tier ${isCur ? 'cur' : 'dim-out'}">
            <div class="tier-head">
              <span class="tier-tag ${k}">${TIER[k].name}</span>
              ${isCur ? '<span class="tier-cur-mark">◀ 你在这里</span>' : ''}
            </div>
            <div class="tier-title">${s.title}</div>
            <div class="tier-summary">${s.summary}</div>
            <ul class="tier-signs">${s.signs.map(x => `<li>${x}</li>`).join('')}</ul>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="sec fade-enter" style="animation-delay:.2s">
      <div class="sec-title">优势与盲点</div>
      <div class="sb-grid">
        <div class="card">
          <div class="card-title">✦ 你的核心优势</div>
          <div class="tag-wrap">${t.strengths.map(x => `<span class="tag-s good">${x}</span>`).join('')}</div>
        </div>
        <div class="card">
          <div class="card-title">◇ 你的成长盲点</div>
          <div class="tag-wrap">${t.blindspots.map(x => `<span class="tag-s bad">${x}</span>`).join('')}</div>
        </div>
      </div>
    </div>

    <div class="sec fade-enter" style="animation-delay:.25s">
      <div class="sec-title">通往高阶的路径</div>
      <div class="card">
        <div class="growth-list">
          ${t.growth.map(g => `<div class="growth-item"><span class="growth-num"></span><span class="growth-txt">${g}</span></div>`).join('')}
        </div>
      </div>
    </div>

    <div class="sec fade-enter" style="animation-delay:.3s">
      <div class="sec-title">写给你的话</div>
      <div class="golden-box">
        <div class="golden-quote">${t.quote}</div>
        <div class="golden-src">—— 致${srcWord}的 ${t.code}</div>
      </div>
    </div>

    <div class="r-foot fade-enter" style="animation-delay:.35s">
      <div class="foot-score">你的人格 <strong>${t.code} · ${t.name}</strong><br>当前处于「${TIER[tier].name}」阶段 · 成熟度 ${r.overall}%</div>
      <div class="foot-btns">
        <button class="fbtn" onclick="restart()">重新测试</button>
        <button class="fbtn ghost" onclick="shareResult()">分享结果</button>
      </div>
    </div>
  `;
  window.scrollTo(0, 0);
  setTimeout(() => drawRadar('radar-canvas', r.radar), 120);
}

function restart() { goTypePage(); }
function shareResult() {
  const t = selType, tier = lastResult ? lastResult.tier : 'mid';
  const txt = `我刚测了 MBTI 心智阶位，我是「${t.code} · ${t.name}」的${TIER[tier].name}状态，来测测你在哪个阶段？`;
  if (navigator.share) navigator.share({ title: 'MBTI 心智阶位测评', text: txt, url: location.href }).catch(() => {});
  else { alert('链接已复制，去分享给朋友吧！\n' + location.href); }
}
