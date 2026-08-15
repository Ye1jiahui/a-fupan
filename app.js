const fallbackData = window.MARKET_REVIEW_FALLBACK;

function hasValidSchema(candidate) {
  return Boolean(
    candidate &&
    candidate.meta &&
    Array.isArray(candidate.tradingDays) &&
    candidate.overview &&
    Array.isArray(candidate.overview.indices) &&
    candidate.emotion &&
    Array.isArray(candidate.emotion.daily) &&
    candidate.boards &&
    candidate.identity &&
    candidate.research
  );
}

const data = hasValidSchema(window.MARKET_REVIEW_DATA) ? window.MARKET_REVIEW_DATA : fallbackData;
const stageColors = {
  "冰点": "#168a62",
  "修复": "#197b87",
  "启动": "#b48226",
  "发酵": "#d9473f",
  "高潮": "#d9473f",
  "分歧": "#b48226",
  "退潮": "#168a62"
};
const stageOrder = ["冰点", "修复", "启动", "发酵", "高潮", "分歧", "退潮"];
const state = {
  activeTab: "global",
  selectedDate: data.tradingDays[data.tradingDays.length - 1],
  boardType: "industry",
  boardPeriod: "d7",
  researchMode: "research",
  researchWindow: "d30",
  noteTimer: null,
  lastFocus: null
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[char]));
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatNumber(value, digits = 1, suffix = "") {
  const number = finite(value);
  if (number === null) return "--";
  return `${number.toLocaleString("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })}${suffix}`;
}

function formatChange(value, digits = 2) {
  const number = finite(value);
  if (number === null) return "--";
  return `${number > 0 ? "+" : ""}${number.toFixed(digits)}%`;
}

function changeClass(value) {
  const number = finite(value);
  if (number === null || number === 0) return "is-flat";
  return number > 0 ? "is-up" : "is-down";
}

function shortDate(date) {
  if (!date) return "--";
  const parts = String(date).split("-");
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : date;
}

function selectedEmotion() {
  return data.emotion.daily.find(item => item.date === state.selectedDate) || data.emotion.daily[data.emotion.daily.length - 1];
}

function latestOverview() {
  return data.overview.daily.find(item => item.date === state.selectedDate) || data.overview.daily[data.overview.daily.length - 1];
}

function sparkline(values) {
  const clean = values.map(finite);
  const available = clean.filter(value => value !== null);
  if (!available.length) return '<div class="metric-note">暂无趋势</div>';
  const min = Math.min(...available);
  const max = Math.max(...available);
  const span = max - min || 1;
  const points = clean.map((value, index) => {
    const x = clean.length === 1 ? 50 : (index / (clean.length - 1)) * 100;
    const y = value === null ? 25 : 31 - ((value - min) / span) * 25;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  return `
    <svg class="sparkline" viewBox="0 0 100 35" preserveAspectRatio="none" aria-hidden="true">
      <line class="sparkline-baseline" x1="0" y1="31" x2="100" y2="31"></line>
      <polyline class="sparkline-path" points="${points}"></polyline>
    </svg>`;
}

function renderLineChart(container, values, labels, options = {}) {
  const element = typeof container === "string" ? document.getElementById(container) : container;
  if (!element) return;
  const clean = values.map(finite);
  const available = clean.filter(value => value !== null);
  element.classList.toggle("is-empty", available.length < 2);
  if (available.length < 2) {
    element.innerHTML = '<div class="empty-state">当前快照的历史数据不足，等待后续交易日积累。</div>';
    return;
  }
  const width = 900;
  const height = 210;
  const left = 55;
  const right = 25;
  const top = 24;
  const bottom = 42;
  let min = Math.min(...available);
  let max = Math.max(...available);
  const padding = (max - min || Math.abs(max) || 1) * .18;
  min -= padding;
  max += padding;
  const x = index => left + (index / Math.max(1, clean.length - 1)) * (width - left - right);
  const y = value => top + ((max - value) / (max - min || 1)) * (height - top - bottom);
  const pointData = clean.map((value, index) => value === null ? null : ({x: x(index), y: y(value), value, index}));
  const points = pointData.filter(Boolean).map(point => `${point.x},${point.y}`).join(" ");
  const area = pointData.filter(Boolean).length > 1
    ? `M ${pointData.find(Boolean).x} ${height - bottom} L ${points.replaceAll(" ", " L ")} L ${[...pointData].reverse().find(Boolean).x} ${height - bottom} Z`
    : "";
  const grid = [0, .5, 1].map(ratio => {
    const yy = top + ratio * (height - top - bottom);
    const label = max - ratio * (max - min);
    return `<line class="chart-grid-line" x1="${left}" y1="${yy}" x2="${width - right}" y2="${yy}"></line><text class="chart-label" x="${left - 8}" y="${yy + 3}" text-anchor="end">${formatNumber(label, options.axisDigits ?? 0)}</text>`;
  }).join("");
  const selectedIndex = labels.indexOf(state.selectedDate);
  element.innerHTML = `
    <svg class="line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(options.label || "7日趋势图")}">
      ${grid}
      ${area ? `<path class="chart-area" d="${area}"></path>` : ""}
      <polyline class="chart-line" points="${points}"></polyline>
      ${pointData.map(point => point ? `
        <circle class="chart-point ${point.index === selectedIndex ? "active" : ""}" cx="${point.x}" cy="${point.y}" r="4"></circle>
        <text class="chart-value-label" x="${point.x}" y="${point.y - 10}" text-anchor="middle">${options.valueFormatter ? options.valueFormatter(point.value) : formatNumber(point.value, 0)}</text>
        <text class="chart-label" x="${point.x}" y="${height - 17}" text-anchor="middle">${shortDate(labels[point.index])}</text>` : "").join("")}
    </svg>`;
}

function renderEmotionCompositeChart() {
  const element = document.getElementById("emotion-chart");
  const daily = data.emotion.daily || [];
  if (!daily.length) {
    element.innerHTML = '<div class="empty-state">当前快照没有可用的情绪历史数据。</div>';
    return;
  }
  const width = window.matchMedia("(max-width: 640px)").matches ? 700 : 940;
  const height = 270;
  const left = 52;
  const right = 52;
  const top = 28;
  const bottom = 46;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const step = plotWidth / daily.length;
  const countValues = daily.flatMap(item => [finite(item.limitUp), finite(item.limitDown)]).filter(value => value !== null);
  const rawCountMax = Math.max(10, ...countValues);
  const countStep = rawCountMax <= 50 ? 10 : rawCountMax <= 100 ? 20 : 50;
  const countMax = Math.ceil(rawCountMax / countStep) * countStep;
  const countY = value => top + (1 - Math.max(0, value) / countMax) * plotHeight;
  const percentY = value => top + (1 - Math.max(0, Math.min(100, value)) / 100) * plotHeight;
  const centerX = index => left + step * (index + .5);
  const barWidth = Math.max(9, Math.min(20, step * .2));
  const barHeight = value => Math.max(value > 0 ? 2 : 0, height - bottom - countY(value));
  const scorePoints = daily.map((item, index) => finite(item.score) === null ? null : ({x: centerX(index), y: percentY(item.score), value: finite(item.score)}));
  const brokenPoints = daily.map((item, index) => finite(item.brokenRate) === null ? null : ({x: centerX(index), y: percentY(item.brokenRate), value: finite(item.brokenRate)}));
  const polyline = points => points.filter(Boolean).map(point => `${point.x},${point.y}`).join(" ");
  const grid = [0, 25, 50, 75, 100].map(value => {
    const y = percentY(value);
    const countLabel = Math.round(countMax * value / 100);
    return `<line class="chart-grid-line" x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"></line><text class="chart-label" x="${left - 8}" y="${y + 3}" text-anchor="end">${countLabel}</text><text class="chart-label" x="${width - right + 8}" y="${y + 3}" text-anchor="start">${value}</text>`;
  }).join("");
  element.innerHTML = `
    <svg class="emotion-composite-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="过去7个交易日涨停、跌停、情绪得分和炸板率组合图">
      <text class="chart-axis-title" x="${left}" y="13">家数</text>
      <text class="chart-axis-title" x="${width - right}" y="13" text-anchor="end">得分 / %</text>
      ${grid}
      ${daily.map((item, index) => {
        const x = centerX(index);
        const limitUp = finite(item.limitUp);
        const limitDown = finite(item.limitDown);
        const limitUpHeight = limitUp === null ? 0 : barHeight(limitUp);
        const limitDownHeight = limitDown === null ? 0 : barHeight(limitDown);
        const selected = item.date === state.selectedDate;
        return `
          <g class="emotion-day-target ${selected ? "active" : ""}" tabindex="0" role="button" aria-label="${escapeHtml(item.date)}，涨停${formatNumber(limitUp, 0)}家，跌停${formatNumber(limitDown, 0)}家" data-date="${escapeHtml(item.date)}">
            ${selected ? `<rect class="emotion-day-highlight" x="${x - step / 2 + 3}" y="${top}" width="${step - 6}" height="${plotHeight}"></rect>` : ""}
            ${limitUp === null ? "" : `<rect class="emotion-bar limit-up" x="${x - barWidth - 2}" y="${countY(limitUp)}" width="${barWidth}" height="${limitUpHeight}"></rect><text class="emotion-bar-value ${limitUpHeight >= 20 ? "on-bar" : "is-up"}" x="${x - barWidth / 2 - 2}" y="${limitUpHeight >= 20 ? countY(limitUp) + 12 : Math.max(top + 9, countY(limitUp) - 5)}" text-anchor="middle">${formatNumber(limitUp, 0)}</text>`}
            ${limitDown === null ? "" : `<rect class="emotion-bar limit-down" x="${x + 2}" y="${countY(limitDown)}" width="${barWidth}" height="${limitDownHeight}"></rect><text class="emotion-bar-value ${limitDownHeight >= 20 ? "on-bar" : "is-down"}" x="${x + barWidth / 2 + 2}" y="${limitDownHeight >= 20 ? countY(limitDown) + 12 : Math.max(top + 9, countY(limitDown) - 5)}" text-anchor="middle">${formatNumber(limitDown, 0)}</text>`}
            <text class="chart-label" x="${x}" y="${height - 17}" text-anchor="middle">${shortDate(item.date)}</text>
          </g>`;
      }).join("")}
      <polyline class="emotion-score-line" points="${polyline(scorePoints)}"></polyline>
      <polyline class="emotion-broken-line" points="${polyline(brokenPoints)}"></polyline>
      ${scorePoints.map(point => point ? `<circle class="emotion-score-point" cx="${point.x}" cy="${point.y}" r="10"></circle><text class="emotion-line-value score" x="${point.x}" y="${point.y + 3}" text-anchor="middle">${formatNumber(point.value, 0)}</text>` : "").join("")}
      ${brokenPoints.map(point => point ? `<circle class="emotion-broken-point" cx="${point.x}" cy="${point.y}" r="3.5"><title>炸板率 ${formatNumber(point.value, 1)}%</title></circle>` : "").join("")}
    </svg>`;
  element.querySelectorAll(".emotion-day-target").forEach(target => {
    const select = () => selectReviewDate(target.dataset.date);
    target.addEventListener("click", select);
    target.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        select();
      }
    });
  });
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2400);
}

function activateTab(tabName, focus = false) {
  const available = Array.from(document.querySelectorAll(".tab-button")).map(button => button.dataset.tab);
  const nextTab = available.includes(tabName) ? tabName : "global";
  state.activeTab = nextTab;
  document.body.classList.toggle("is-global-view", nextTab === "global");
  document.querySelectorAll(".tab-button").forEach(button => {
    const active = button.dataset.tab === nextTab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
    if (active && focus) button.focus();
  });
  document.querySelectorAll(".tab-panel").forEach(panel => {
    const active = panel.id === nextTab;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });
  if (location.hash !== `#${nextTab}`) history.replaceState(null, "", `#${nextTab}`);
}

function setupTabs() {
  const buttons = Array.from(document.querySelectorAll(".tab-button"));
  buttons.forEach((button, index) => {
    button.addEventListener("click", () => activateTab(button.dataset.tab));
    button.addEventListener("keydown", event => {
      let target = null;
      if (event.key === "ArrowRight") target = buttons[(index + 1) % buttons.length];
      if (event.key === "ArrowLeft") target = buttons[(index - 1 + buttons.length) % buttons.length];
      if (event.key === "Home") target = buttons[0];
      if (event.key === "End") target = buttons[buttons.length - 1];
      if (target) {
        event.preventDefault();
        activateTab(target.dataset.tab, true);
      }
    });
  });
  window.addEventListener("hashchange", () => activateTab(location.hash.slice(1)));
  activateTab(location.hash.slice(1));
}

function renderMeta() {
  document.getElementById("data-date").textContent = data.meta.dataDate || "--";
  const status = document.getElementById("data-status");
  const isDemo = data.meta.mode !== "live";
  status.textContent = isDemo ? "演示快照" : (data.meta.status === "degraded" ? "部分数据缺失" : "AKShare 已更新");
  status.classList.toggle("is-demo", isDemo);
  const warnings = Array.isArray(data.meta.warnings) ? data.meta.warnings.filter(Boolean) : [];
  const warningBanner = document.getElementById("warning-banner");
  warningBanner.hidden = warnings.length === 0;
  warningBanner.textContent = warnings.join("　");
  warningBanner.title = warnings.join("\n");
  document.getElementById("source-line").textContent = `生成时间：${data.meta.generatedAt || "--"}　来源：${(data.meta.sources || []).join("、") || "--"}`;
}

function renderTemperatureTape() {
  const tape = document.getElementById("temperature-tape");
  tape.innerHTML = data.emotion.daily.map(item => {
    const color = stageColors[item.stage] || stageColors["修复"];
    return `
      <button class="temperature-day ${item.date === state.selectedDate ? "active" : ""}" type="button" role="listitem" data-date="${escapeHtml(item.date)}" style="--temperature-color:${color};--temperature-scale:${Math.max(.08, Math.min(1, item.score / 100))}">
        <time datetime="${escapeHtml(item.date)}">${shortDate(item.date)}</time>
        <span>${escapeHtml(item.stage)}</span>
        <strong>${formatNumber(item.score, 0)}</strong>
      </button>`;
  }).join("");
  tape.querySelectorAll(".temperature-day").forEach(button => {
    button.addEventListener("click", () => selectReviewDate(button.dataset.date));
  });
  const activeDay = tape.querySelector(".temperature-day.active");
  if (activeDay && window.matchMedia("(max-width: 640px)").matches) {
    tape.scrollLeft = Math.max(0, activeDay.offsetLeft - tape.clientWidth + activeDay.offsetWidth);
  }
  const item = selectedEmotion();
  document.getElementById("selected-day-readout").innerHTML = `<span>${escapeHtml(item.stage)}</span><strong>${escapeHtml(item.date)} · ${formatNumber(item.score, 0)}分</strong>`;
}

function selectReviewDate(date) {
  state.selectedDate = date;
  renderTemperatureTape();
  renderGlobal();
  renderOverview();
  renderEmotion();
  if (state.activeTab !== "global" && state.activeTab !== "overview" && state.activeTab !== "emotion") activateTab("emotion");
}

function globalMiniSpark(values, tone = "data") {
  const chart = sparkline(values);
  return `<span class="global-spark ${tone}">${chart}</span>`;
}

function globalMetric(label, value, tone = "") {
  return `<span class="global-metric"><small>${label}</small><strong class="${tone}">${value}</strong></span>`;
}

function renderGlobal() {
  const currentEmotion = selectedEmotion() || {};
  const currentOverview = latestOverview() || {};
  const indices = data.overview.indices || [];
  const visibleIndices = indices.slice(0, 6);
  const boardList = [...(data.boards[state.boardType] || [])]
    .sort((a, b) => (finite(b[state.boardPeriod]) ?? -Infinity) - (finite(a[state.boardPeriod]) ?? -Infinity))
    .slice(0, 4);
  const identityList = (data.identity.ranked || []).slice(0, 4);
  const popularList = (data.identity.popular || []).slice(0, 4);
  const researchBuckets = data.research.buckets || [];
  const notes = readAllNotes();
  const note = notes[currentNoteDate()] || {};
  const stageColor = stageColors[currentEmotion.stage] || stageColors["修复"];
  const periodLabel = {d1: "1日", d3: "3日", d7: "7日"}[state.boardPeriod] || "7日";

  document.getElementById("global-selected-date").textContent = currentEmotion.date || data.meta.dataDate || "--";
  const selectedStage = document.getElementById("global-selected-stage");
  selectedStage.textContent = currentEmotion.stage || "--";
  selectedStage.style.setProperty("--stage-color", stageColor);

  document.getElementById("global-temperature-days").innerHTML = (data.emotion.daily || []).map(item => {
    const color = stageColors[item.stage] || stageColors["修复"];
    return `<button class="global-day-cell ${item.date === state.selectedDate ? "active" : ""}" type="button" role="listitem" data-date="${escapeHtml(item.date)}" title="切换到 ${escapeHtml(item.date)} 的全局复盘" style="--temperature-color:${color};--temperature-scale:${Math.max(.08, Math.min(1, (finite(item.score) || 0) / 100))}"><time>${shortDate(item.date)}</time><strong>${formatNumber(item.score, 0)}</strong><span>${escapeHtml(item.stage || "--")}</span></button>`;
  }).join("");
  document.querySelectorAll(".global-day-cell").forEach(button => button.addEventListener("click", () => selectReviewDate(button.dataset.date)));

  const overviewMetrics = [
    globalMetric("成交额", formatNumber(currentOverview.turnover, 0, "亿")),
    globalMetric("涨 / 跌", `${formatNumber(currentOverview.up, 0)} / ${formatNumber(currentOverview.down, 0)}`, currentOverview.up >= currentOverview.down ? "is-up" : "is-down"),
    globalMetric("涨停 / 跌停", `${formatNumber(currentEmotion.limitUp, 0)} / ${formatNumber(currentEmotion.limitDown, 0)}`),
    globalMetric("涨跌中位数", formatChange(currentOverview.median), changeClass(currentOverview.median))
  ].join("");
  const indexCells = visibleIndices.map(index => {
    const history = index.history || [];
    const d7 = history.length > 1 && finite(history[0]) !== 0 ? ((finite(history.at(-1)) / finite(history[0])) - 1) * 100 : null;
    return `<span class="global-index-mini"><b>${escapeHtml(index.name)}</b><strong>${formatNumber(index.value, 2)}</strong><em class="${changeClass(index.change)}">${formatChange(index.change)}</em>${globalMiniSpark(history, index.change >= 0 ? "up" : "down")}</span>`;
  }).join("");

  const emotionHistory = (data.emotion.daily || []).map(item => item.score);
  const emotionMetrics = [
    globalMetric("最高连板", formatNumber(currentEmotion.maxStreak, 0, "板")),
    globalMetric("炸板率", formatNumber(currentEmotion.brokenRate, 1, "%"), changeClass(-(finite(currentEmotion.brokenRate) || 0))),
    globalMetric("昨涨停溢价", formatChange(currentEmotion.previousPremium), changeClass(currentEmotion.previousPremium))
  ].join("");
  const boardRows = boardList.length ? boardList.map((item, index) => `<div class="global-board-row"><b>${String(index + 1).padStart(2, "0")}</b><span>${escapeHtml(item.name)}</span><em class="${changeClass(item[state.boardPeriod])}">${formatChange(item[state.boardPeriod])}</em><small>${escapeHtml(item.leader?.name || "--")}</small></div>`).join("") : `<div class="global-empty">暂无板块数据</div>`;
  const identityRows = identityList.length ? identityList.map(item => `<div class="global-identity-row"><b>${String(item.rank).padStart(2, "0")}</b><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.role || "观察标的")}</small></span><em>${formatNumber(item.score, 0)}</em></div>`).join("") : popularList.map(item => `<div class="global-identity-row"><b>${String(item.rank).padStart(2, "0")}</b><span><strong>${escapeHtml(item.name)}</strong><small>人气</small></span><em class="${changeClass(item.change)}">${formatChange(item.change)}</em></div>`).join("");
  const researchRows = researchBuckets.map(bucket => {
    const top = [...(bucket.stocks || [])].filter(stock => (finite(researchStats(stock, "d30").researchInstitutions) || 0) > 0).sort((a, b) => (finite(researchStats(b, "d30").researchInstitutions) ?? -Infinity) - (finite(researchStats(a, "d30").researchInstitutions) ?? -Infinity))[0];
    if (!top) return `<div class="global-research-row"><b>${escapeHtml(bucket.label)}</b><span>--</span><em>暂无</em></div>`;
    const stats = researchStats(top, "d30");
    return `<div class="global-research-row"><b>${escapeHtml(bucket.label)}</b><span><strong>${escapeHtml(top.name)}</strong><small>现价 ${formatNumber(top.price, 2)}元 · ${formatNumber(top.marketCap, 1)}亿</small></span><em>${formatNumber(stats.researchInstitutions, 0)}家</em></div>`;
  }).join("");
  const noteConclusion = note.dailyConclusion ? note.dailyConclusion.replace(/\s+/g, " ").slice(0, 54) : "尚未记录今日结论";
  const noteFocus = note.tomorrowFocus ? note.tomorrowFocus.replace(/\s+/g, " ").slice(0, 54) : "尚未记录明日观察方向";

  document.getElementById("global-module-grid").innerHTML = `
    <button class="global-module-card" type="button" data-global-target="overview" title="打开市场总览">
      <span class="global-card-top"><span class="global-card-index">01</span><span class="section-kicker">MARKET BREADTH</span><i aria-hidden="true">↗</i></span>
      <h3>市场总览</h3>
      <div class="global-index-grid">${indexCells}</div>
      <div class="global-metric-row">${overviewMetrics}</div>
      <div class="global-card-caption">成交额、涨跌分布和指数强弱 · 1日 / 7日</div>
    </button>
    <button class="global-module-card" type="button" data-global-target="emotion" title="打开情绪周期">
      <span class="global-card-top"><span class="global-card-index">02</span><span class="section-kicker">CYCLE SIGNALS</span><i aria-hidden="true">↗</i></span>
      <div class="global-emotion-main"><div class="global-score-ring" style="--score:${finite(currentEmotion.score) || 0};--stage-color:${stageColor}"><strong>${formatNumber(currentEmotion.score, 0)}</strong><span>情绪分</span></div><div><h3>情绪周期</h3><p class="global-stage-line" style="color:${stageColor}">${escapeHtml(currentEmotion.stage || "--")}</p><p class="global-card-caption">${escapeHtml(currentEmotion.confidence || "可用样本")} · 7日全景</p></div></div>
      <div class="global-metric-row">${emotionMetrics}</div>
      <div class="global-chart-line">${globalMiniSpark(emotionHistory, "data")}</div>
    </button>
    <button class="global-module-card" type="button" data-global-target="boards" title="打开板块复盘">
      <span class="global-card-top"><span class="global-card-index">03</span><span class="section-kicker">SECTOR ROTATION</span><i aria-hidden="true">↗</i></span>
      <div class="global-card-title-row"><h3>板块复盘</h3><span class="global-filter-chip">${state.boardType === "industry" ? "行业" : "概念"} · ${periodLabel}</span></div>
      <div class="global-board-list">${boardRows}</div>
      <div class="global-card-caption">领涨股同步显示 · 点击进入完整排名和搜索</div>
    </button>
    <button class="global-module-card" type="button" data-global-target="identity" title="打开辨识度观察">
      <span class="global-card-top"><span class="global-card-index">04</span><span class="section-kicker">MARKET RECOGNITION</span><i aria-hidden="true">↗</i></span>
      <div class="global-card-title-row"><h3>辨识度观察</h3><span class="global-filter-chip">Top 20</span></div>
      <div class="global-identity-list">${identityRows}</div>
      <div class="global-card-caption">人气成交 · 价格强度 · 题材地位 · 市场确认</div>
    </button>
    <button class="global-module-card" type="button" data-global-target="research" title="打开机构调研">
      <span class="global-card-top"><span class="global-card-index">05</span><span class="section-kicker">INSTITUTIONAL RESEARCH</span><i aria-hidden="true">↗</i></span>
      <div class="global-card-title-row"><h3>机构调研</h3><span class="global-filter-chip">30天 · 调研机构</span></div>
      <div class="global-research-list">${researchRows || `<div class="global-empty">暂无机构数据</div>`}</div>
      <div class="global-method-pills"><span>7天</span><span>30天</span><span>半年</span><span>现价</span><span>买入评级</span></div>
    </button>
    <button class="global-module-card" type="button" data-global-target="notes" title="打开复盘笔记">
      <span class="global-card-top"><span class="global-card-index">06</span><span class="section-kicker">DAILY JOURNAL</span><i aria-hidden="true">↗</i></span>
      <div class="global-card-title-row"><h3>复盘笔记</h3><span class="global-filter-chip">${escapeHtml(note.stage || currentEmotion.stage || "--")}</span></div>
      <div class="global-note-preview"><span><b>每日结论</b><em>${escapeHtml(noteConclusion)}</em></span><span><b>明日观察</b><em>${escapeHtml(noteFocus)}</em></span></div>
      <div class="global-note-status"><span class="save-dot"></span>${note.updatedAt ? "已自动保存" : "等待输入"}<span>JSON 导入 / 导出</span></div>
    </button>`;
  document.querySelectorAll("[data-global-target]").forEach(button => button.addEventListener("click", () => activateTab(button.dataset.globalTarget)));
}

function renderOverview() {
  const today = latestOverview();
  const emotion = selectedEmotion();
  const daily = data.overview.daily;
  const indexGrid = document.getElementById("index-grid");
  indexGrid.innerHTML = data.overview.indices.map(index => {
    const history = (index.history || []).map(finite).filter(value => value !== null);
    const d7 = history.length > 1 && history[0] !== 0 ? (history[history.length - 1] / history[0] - 1) * 100 : null;
    return `
      <article class="index-cell">
        <div class="index-name"><span>${escapeHtml(index.name)}</span><code>${escapeHtml(index.code)}</code></div>
        <div class="index-main"><strong class="index-value">${formatNumber(index.value, 2)}</strong><span class="index-changes"><span class="${changeClass(index.change)}"><small>1日</small>${formatChange(index.change)}</span><span class="${changeClass(d7)}"><small>7日</small>${formatChange(d7)}</span></span></div>
        ${sparkline(index.history || [])}
      </article>`;
  }).join("");
  const currentIndex = Math.max(0, daily.findIndex(item => item.date === today.date));
  const previous = daily[Math.max(0, currentIndex - 1)] || today;
  const recentWindow = daily.slice(Math.max(0, currentIndex - 4), currentIndex + 1);
  const recent = recentWindow.map(item => finite(item.turnover)).filter(value => value !== null);
  const turnover = finite(today.turnover);
  const turnoverChange = turnover !== null && finite(previous.turnover) ? ((turnover / previous.turnover) - 1) * 100 : null;
  const average5 = recentWindow.length === 5 && recent.length === 5 ? recent.reduce((sum, value) => sum + value, 0) / recent.length : null;
  const averageDelta = turnover !== null && average5 ? ((turnover / average5) - 1) * 100 : null;
  const upCount = finite(today.up);
  const downCount = finite(today.down);
  const flatCount = finite(today.flat);
  const breadthTotal = (upCount ?? 0) + (downCount ?? 0) + (flatCount ?? 0);
  const upRatio = breadthTotal ? upCount / breadthTotal * 100 : null;
  const downRatio = breadthTotal ? downCount / breadthTotal * 100 : null;
  const metrics = [
    ["两市成交额", formatNumber(turnover, 0, "亿"), `较昨日 ${formatChange(turnoverChange)}`, turnoverChange],
    ["较5日均额", formatChange(averageDelta), `5日均值 ${formatNumber(average5, 0, "亿")}`, averageDelta],
    ["上涨家数", formatNumber(upCount, 0), upRatio === null ? "等待日快照积累" : `占比 ${formatNumber(upRatio, 1, "%")}`, upCount === null ? null : 1],
    ["下跌家数", formatNumber(downCount, 0), downRatio === null ? "等待日快照积累" : `占比 ${formatNumber(downRatio, 1, "%")}`, downCount === null ? null : -1],
    ["涨跌中位数", formatChange(today.median), "全A非ST", today.median],
    ["涨停 / 跌停", `${formatNumber(emotion.limitUp, 0)} / ${formatNumber(emotion.limitDown, 0)}`, "近期涨跌停池", finite(emotion.limitUp) !== null && finite(emotion.limitDown) !== null ? emotion.limitUp - emotion.limitDown : null],
    ["炸板率", formatNumber(emotion.brokenRate, 1, "%"), "炸板 / 触板", finite(emotion.brokenRate) === null ? null : -emotion.brokenRate],
    ["最高连板", formatNumber(emotion.maxStreak, 0, "板"), "空间高度", emotion.maxStreak],
    ["昨涨停溢价", formatChange(emotion.previousPremium), "次日反馈", emotion.previousPremium],
    ["1进2", formatNumber(emotion.promotion12, 1, "%"), "低位晋级", emotion.promotion12],
    ["整体晋级率", formatNumber(emotion.promotionAll, 1, "%"), "连板承接", emotion.promotionAll],
    ["大盘–小盘", formatChange(today.largeSmallSpread), "沪深300 - 中证1000", today.largeSmallSpread]
  ];
  document.getElementById("overview-kpis").innerHTML = metrics.map(([label, value, note, tone]) => `
    <div class="metric-item"><span class="metric-label">${label}</span><strong class="metric-value ${changeClass(tone)}">${value}</strong><span class="metric-note">${note}</span></div>`).join("");
  const largeSmallSpread = finite(today.largeSmallSpread);
  document.getElementById("overview-summary").textContent = breadthTotal
    ? `上涨 ${formatNumber(upCount, 0)} 家，下跌 ${formatNumber(downCount, 0)} 家；情绪处于${emotion.stage}${largeSmallSpread === null ? "；大小盘相对强弱暂无历史值。" : `，小盘相对强度 ${formatChange(-largeSmallSpread)}。`}`
    : `历史涨跌家数将在每日快照中逐步积累；当前情绪处于${emotion.stage}。`;
  document.getElementById("turnover-delta").textContent = `较昨日 ${formatChange(turnoverChange)}`;
  renderLineChart("turnover-chart", daily.map(item => item.turnover), daily.map(item => item.date), {
    label: "两市7日成交额",
    valueFormatter: value => `${Math.round(value / 100) / 10}万亿`
  });
  document.getElementById("breadth-chart").innerHTML = breadthTotal ? `
    <div class="breadth-track" aria-label="上涨${upCount}家，平盘${flatCount}家，下跌${downCount}家">
      <span class="breadth-up" style="width:${upCount / breadthTotal * 100}%"></span>
      <span class="breadth-flat" style="width:${flatCount / breadthTotal * 100}%"></span>
      <span class="breadth-down" style="width:${downCount / breadthTotal * 100}%"></span>
    </div>` : '<div class="empty-state">该交易日尚无涨跌家数快照。</div>';
  document.getElementById("breadth-numbers").innerHTML = `
    <div class="breadth-number"><strong class="is-up">${formatNumber(upCount, 0)}</strong><span>上涨</span></div>
    <div class="breadth-number"><strong>${formatNumber(flatCount, 0)}</strong><span>平盘</span></div>
    <div class="breadth-number"><strong class="is-down">${formatNumber(downCount, 0)}</strong><span>下跌</span></div>`;
}

function renderEmotion() {
  const current = selectedEmotion();
  document.getElementById("emotion-score").textContent = formatNumber(current.score, 0);
  const stageBadge = document.getElementById("emotion-stage");
  stageBadge.textContent = current.stage;
  stageBadge.style.color = stageColors[current.stage] || stageColors["修复"];
  document.getElementById("emotion-confidence").textContent = `置信口径：${current.confidence || "可用样本"}`;
  const priorIndex = data.emotion.daily.findIndex(item => item.date === current.date) - 1;
  const prior = data.emotion.daily[Math.max(0, priorIndex)] || current;
  const scoreDelta = current.score - prior.score;
  document.getElementById("emotion-summary").textContent = `得分较前一交易日${scoreDelta >= 0 ? "回升" : "回落"} ${Math.abs(scoreDelta)} 分；涨停 ${formatNumber(current.limitUp, 0)} 家，昨日涨停溢价 ${formatChange(current.previousPremium)}。`;
  renderEmotionCompositeChart();
  const metrics = [
    ["涨停", current.limitUp, "家", 1],
    ["跌停", current.limitDown, "家", -1],
    ["炸板率", current.brokenRate, "%", -current.brokenRate],
    ["最高连板", current.maxStreak, "板", current.maxStreak],
    ["昨日溢价", current.previousPremium, "%", current.previousPremium],
    ["1进2", current.promotion12, "%", current.promotion12],
    ["2进3", current.promotion23, "%", current.promotion23],
    ["整体晋级", current.promotionAll, "%", current.promotionAll]
  ];
  document.getElementById("emotion-metrics").innerHTML = metrics.map(([label, value, suffix, tone]) => `
    <div class="metric-item"><span class="metric-label">${label}</span><strong class="metric-value ${changeClass(tone)}">${formatNumber(value, label === "涨停" || label === "跌停" || label === "最高连板" ? 0 : 1, suffix)}</strong><span class="metric-note">${current.date}</span></div>`).join("");
  const matrixRows = [
    ["情绪得分", "score", value => formatNumber(value, 0)],
    ["阶段", "stage", value => escapeHtml(value)],
    ["涨停 / 跌停", null, (_, item) => `${formatNumber(item.limitUp, 0)} / ${formatNumber(item.limitDown, 0)}`],
    ["炸板率", "brokenRate", value => formatNumber(value, 1, "%")],
    ["1进2", "promotion12", value => formatNumber(value, 1, "%")],
    ["2进3", "promotion23", value => formatNumber(value, 1, "%")],
    ["整体晋级", "promotionAll", value => formatNumber(value, 1, "%")],
    ["最高连板", "maxStreak", value => formatNumber(value, 0, "板")]
  ];
  document.getElementById("emotion-matrix").innerHTML = `
    <table class="matrix-table">
      <thead><tr><th>指标</th>${data.emotion.daily.map(item => `<th class="${item.date === state.selectedDate ? "active-day" : ""}">${shortDate(item.date)}</th>`).join("")}</tr></thead>
      <tbody>${matrixRows.map(([label, key, formatter]) => `<tr><td>${label}</td>${data.emotion.daily.map(item => `<td class="${item.date === state.selectedDate ? "active-day" : ""}">${formatter(key ? item[key] : null, item)}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>`;
}

function boardRows() {
  const keyword = document.getElementById("board-search").value.trim().toLowerCase();
  return [...(data.boards[state.boardType] || [])]
    .filter(item => !keyword || `${item.name} ${item.leader?.name || ""} ${item.leader?.code || ""}`.toLowerCase().includes(keyword))
    .sort((a, b) => (finite(b[state.boardPeriod]) ?? -Infinity) - (finite(a[state.boardPeriod]) ?? -Infinity))
    .slice(0, 20);
}

function renderBoards() {
  const rows = boardRows();
  document.getElementById("board-count").textContent = `展示 ${rows.length} 个${state.boardType === "industry" ? "行业" : "概念"}`;
  const leaders = rows.slice(0, 5);
  const maxReturn = Math.max(1, ...leaders.map(item => Math.abs(finite(item[state.boardPeriod]) || 0)));
  const periodLabel = {d1: "1日", d3: "3日", d7: "7日"}[state.boardPeriod];
  document.getElementById("board-bars").innerHTML = leaders.length ? leaders.map((item, index) => `
    <article class="board-bar-item">
      <div class="board-leader-head"><span class="board-rank">${String(index + 1).padStart(2, "0")}</span><h4>${escapeHtml(item.name)}</h4></div>
      <div class="board-return-line"><strong class="board-return ${changeClass(item[state.boardPeriod])}">${formatChange(item[state.boardPeriod])}</strong><span>${periodLabel}</span></div>
      <div class="board-progress"><i style="width:${Math.abs(item[state.boardPeriod]) / maxReturn * 100}%;background:${item[state.boardPeriod] >= 0 ? "var(--up)" : "var(--down)"}"></i></div>
      <div class="board-periods">${[["1日", "d1"], ["3日", "d3"], ["7日", "d7"]].map(([label, key]) => `<span class="${key === state.boardPeriod ? "active" : ""}"><small>${label}</small><b class="${changeClass(item[key])}">${formatChange(item[key])}</b></span>`).join("")}</div>
      <span class="board-leader">领涨 ${escapeHtml(item.leader?.name || "--")} · ${formatChange(item.leader?.[state.boardPeriod])}</span>
    </article>`).join("") : '<div class="empty-state">没有匹配的板块。</div>';
  document.getElementById("board-table").innerHTML = `
    <div class="table-row header" role="row"><div class="table-cell">排名</div><div class="table-cell">板块</div><div class="table-cell number-cell">1日</div><div class="table-cell number-cell">3日</div><div class="table-cell number-cell">7日</div><div class="table-cell">领涨股 · 1日 / 3日 / 7日</div></div>
    ${rows.map((item, index) => `
      <div class="table-row" role="row">
        <div class="table-cell numeric">${String(index + 1).padStart(2, "0")}</div>
        <div class="table-cell board-name-cell"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.code)}</span></div>
        ${["d1", "d3", "d7"].map(period => `<div class="table-cell number-cell ${changeClass(item[period])}">${formatChange(item[period])}</div>`).join("")}
        <div class="table-cell leader-cell"><div><strong>${escapeHtml(item.leader?.name || "--")}</strong><span>${escapeHtml(item.leader?.code || "--")}</span></div>${["d1", "d3", "d7"].map(period => `<span class="return-mini ${changeClass(item.leader?.[period])}">${formatChange(item.leader?.[period])}</span>`).join("")}</div>
      </div>`).join("")}`;
}

function setupBoardControls() {
  document.getElementById("board-type-control").addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    state.boardType = button.dataset.boardType;
    event.currentTarget.querySelectorAll("button").forEach(item => item.classList.toggle("active", item === button));
    renderBoards();
  });
  document.getElementById("board-period-control").addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    state.boardPeriod = button.dataset.period;
    event.currentTarget.querySelectorAll("button").forEach(item => item.classList.toggle("active", item === button));
    renderBoards();
  });
  document.getElementById("board-search").addEventListener("input", renderBoards);
}

function renderIdentity() {
  const ranked = data.identity.ranked || [];
  const recognitionRanks = new Map(ranked.map(item => [String(item.code), item.rank]));
  document.getElementById("popular-list").innerHTML = (data.identity.popular || []).slice(0, 20).map(item => {
    const recognitionRank = recognitionRanks.get(String(item.code));
    return `
      <article class="popular-item ${recognitionRank ? "is-recognized" : ""}"><b>${item.rank}</b><strong>${escapeHtml(item.name)}</strong><span class="${changeClass(item.change)}">${formatChange(item.change)}</span>${recognitionRank ? `<em>综合#${recognitionRank}</em>` : ""}</article>`;
  }).join("");
  document.getElementById("identity-list").innerHTML = `
    <div class="identity-table-head" aria-hidden="true"><span>排名</span><span>标的 / 角色</span><span>评分</span><span>分项 / 题材</span><span>入榜依据 / 风险</span></div>
    ${ranked.map(item => `
    <article class="identity-row">
      <div class="identity-rank">${String(item.rank).padStart(2, "0")}</div>
      <div class="identity-stock"><strong>${escapeHtml(item.name)}</strong><code>${escapeHtml(item.code)} · ${escapeHtml(item.industry)}</code><span class="role-tag">${escapeHtml(item.role)}</span></div>
      <div class="identity-score"><strong>${formatNumber(item.score, 0)}</strong><span>辨识度</span><div class="score-stack" aria-label="评分构成"><i style="width:${item.components.attention}%"></i><i style="width:${item.components.strength}%"></i><i style="width:${item.components.leadership}%"></i><i style="width:${item.components.confirmation}%"></i></div></div>
      <div class="identity-breakdown"><div class="breakdown-list"><span>人气成交 <b>${item.components.attention}/30</b></span><span>价格强度 <b>${item.components.strength}/30</b></span><span>题材地位 <b>${item.components.leadership}/25</b></span><span>市场确认 <b>${item.components.confirmation}/15</b></span></div><div class="concept-tags">${(item.concepts || []).map(concept => `<span>${escapeHtml(concept)}</span>`).join("")}</div></div>
      <div class="identity-analysis"><p><b>依据：</b>${escapeHtml((item.reasons || []).join("；"))}</p><p class="risk-line"><b>风险：</b>${escapeHtml((item.risks || []).join("；") || "暂无显著风险标签")}</p></div>
    </article>`).join("")}`;
}

function researchWindowMeta(windowKey = state.researchWindow) {
  const defaults = {
    d7: {label: "过去7天", days: 7},
    d30: {label: "过去30天", days: 30},
    d180: {label: "过去半年", days: 180}
  };
  return {...defaults[windowKey], ...(data.research.windows?.[windowKey] || {})};
}

function researchStats(stock, windowKey = state.researchWindow) {
  const current = stock.windowStats?.[windowKey];
  if (current) return current;
  if (windowKey !== "d30") {
    return {researchInstitutions: null, researchEvents: null, ratingInstitutions: null, positiveReports: null};
  }
  return {
    researchInstitutions: finite(stock.researchCount),
    researchEvents: finite(stock.eventCount),
    ratingInstitutions: finite(stock.ratingInstitutions),
    positiveReports: finite(stock.ratingCount)
  };
}

function researchValue(stock) {
  const stats = researchStats(stock);
  return state.researchMode === "research" ? stats.researchInstitutions : stats.ratingInstitutions;
}

function allResearchStocks() {
  return (data.research.buckets || []).flatMap(bucket => bucket.stocks.map(stock => ({...stock, bucketId: bucket.id, bucketLabel: bucket.label, min: bucket.min, max: bucket.max})));
}

function rankedResearchStocks(bucket) {
  return bucket.stocks.filter(stock => {
    const stats = researchStats(stock);
    if ((finite(stats.researchInstitutions) ?? 0) <= 0) return false;
    return state.researchMode === "research" || (finite(stats.ratingInstitutions) ?? 0) > 0;
  });
}

function chartedResearchStocks(bucket) {
  return [...rankedResearchStocks(bucket)]
    .sort((a, b) => (finite(researchValue(b)) ?? -Infinity) - (finite(researchValue(a)) ?? -Infinity))
    .slice(0, 10);
}

function renderResearchBubbles() {
  const buckets = data.research.buckets || [];
  const width = 1000;
  const height = 245;
  const left = 150;
  const right = 55;
  const laneYs = [48, 125, 202];
  const allValues = buckets.flatMap(bucket => chartedResearchStocks(bucket).map(researchValue)).map(finite).filter(value => value !== null);
  const maxCount = Math.max(1, ...allValues);
  const nodes = [];
  buckets.forEach((bucket, bucketIndex) => {
    const laneY = laneYs[bucketIndex] || 70 + bucketIndex * 95;
    chartedResearchStocks(bucket).forEach((stock, stockIndex) => {
      const span = Math.max(1, bucket.max - bucket.min);
      const ratio = Math.max(0, Math.min(1, (stock.marketCap - bucket.min) / span));
      const x = left + ratio * (width - left - right);
      const jitter = [-13, 13, -24, 24, 0][stockIndex % 5];
      const y = laneY + jitter;
      const value = finite(researchValue(stock)) || 0;
      const radius = 7 + Math.sqrt(value / maxCount) * 14;
      const color = finite(stock.returns?.d30) >= 0 ? "#d9473f" : "#168a62";
      nodes.push(`
        <g class="bubble-group">
          <circle class="bubble-node" tabindex="0" role="button" aria-label="${escapeHtml(stock.name)}，${formatNumber(value, 0)}家" data-code="${escapeHtml(stock.code)}" cx="${x}" cy="${y}" r="${radius}" fill="${color}" fill-opacity=".82"><title>${escapeHtml(stock.name)} · ${escapeHtml(stock.code)} · 现价${formatNumber(stock.price, 2)}元</title></circle>
          ${stockIndex < 3 ? `<text class="bubble-name" x="${x}" y="${y + radius + 12}" text-anchor="middle">${escapeHtml(stock.name)} ${formatNumber(stock.price, 2)}</text>` : ""}
          <text class="bubble-value" x="${x}" y="${y + 3}" text-anchor="middle" fill="#fff">${formatNumber(value, 0)}</text>
        </g>`);
    });
  });
  document.getElementById("research-bubbles").innerHTML = `
    <svg class="bubble-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="机构调研市值档位气泡图，标注当前股价">
      ${buckets.map((bucket, index) => {
        const y = laneYs[index] || 70 + index * 95;
        return `<text class="bubble-lane-label" x="12" y="${y + 4}">${escapeHtml(bucket.label)}</text><line class="bubble-axis" x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"></line><text class="bubble-value" x="${left}" y="${y - 34}" text-anchor="start">${bucket.min}亿</text><text class="bubble-value" x="${width - right}" y="${y - 34}" text-anchor="end">${bucket.max}亿</text>`;
      }).join("")}
      ${nodes.join("")}
    </svg>`;
  document.querySelectorAll(".bubble-node").forEach(node => {
    const open = () => openStockDrawer(node.dataset.code);
    node.addEventListener("click", open);
    node.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });
}

function renderResearchBuckets() {
  const windowMeta = researchWindowMeta();
  const start = windowMeta.start || (state.researchWindow === "d30" ? data.research.windowStart : null);
  const end = windowMeta.end || data.research.windowEnd;
  document.getElementById("research-window").textContent = start && end
    ? `${start} 至 ${end} · ${windowMeta.label}（${windowMeta.days}个自然日，含首尾日）`
    : `${windowMeta.label} · 当前快照尚未生成该窗口数据`;
  document.getElementById("bubble-caption").textContent = `每档展示当前榜单Top 10；圆点大小代表${state.researchMode === "research" ? "累计接待机构数" : "买入评级机构数"}，颜色代表30日涨跌`;
  document.getElementById("research-buckets").innerHTML = (data.research.buckets || []).map(bucket => {
    const rows = [...rankedResearchStocks(bucket)].sort((a, b) => (finite(researchValue(b)) ?? -Infinity) - (finite(researchValue(a)) ?? -Infinity)).slice(0, 10);
    return `
      <section class="research-bucket">
        <header><div><span>总市值</span><h3>${escapeHtml(bucket.label)}</h3></div><span>${state.researchMode === "research" ? "累计接待机构数" : "买入评级机构数"} · 7天 / 30天 / 半年</span></header>
        <div class="research-rank-list">${rows.length ? rows.map((stock, index) => `
          <button class="research-row" type="button" data-code="${escapeHtml(stock.code)}">
            <span class="rank">${String(index + 1).padStart(2, "0")}</span>
            <span><strong>${escapeHtml(stock.name)}</strong><code>${escapeHtml(stock.code)} · ${escapeHtml(stock.industry)}</code></span>
            <span class="price"><small>现价</small>${formatNumber(stock.price, 2, "元")}</span>
            <span class="cap"><small>市值</small>${formatNumber(stock.marketCap, 1)}亿</span>
            <span class="window-counts" aria-label="7天、30天、半年机构数">${[["d7", "7天"], ["d30", "30天"], ["d180", "半年"]].map(([windowKey, label]) => {
              const stats = researchStats(stock, windowKey);
              const value = state.researchMode === "research" ? stats.researchInstitutions : stats.ratingInstitutions;
              return `<span class="${windowKey === state.researchWindow ? "active" : ""}"><small>${label}</small><b>${formatNumber(value, 0)}</b></span>`;
            }).join("")}</span>
          </button>`).join("") : `<div class="empty-state">该市值档位暂无${escapeHtml(windowMeta.label)}${state.researchMode === "research" ? "调研" : "买入评级"}数据。</div>`}</div>
      </section>`;
  }).join("");
  document.querySelectorAll(".research-row").forEach(button => button.addEventListener("click", () => openStockDrawer(button.dataset.code)));
}

function renderResearch() {
  renderResearchBubbles();
  renderResearchBuckets();
}

function setupResearchControls() {
  document.getElementById("research-mode-control").addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    state.researchMode = button.dataset.mode;
    event.currentTarget.querySelectorAll("button").forEach(item => item.classList.toggle("active", item === button));
    renderResearch();
  });
  document.getElementById("research-window-control").addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    state.researchWindow = button.dataset.window;
    event.currentTarget.querySelectorAll("button").forEach(item => item.classList.toggle("active", item === button));
    renderResearch();
  });
}

function metricBlock(label, value, tone = null) {
  return `<div class="drawer-metric"><span>${label}</span><strong class="${tone === null ? "" : changeClass(tone)}">${value}</strong></div>`;
}

function openStockDrawer(code) {
  const stock = allResearchStocks().find(item => item.code === code);
  if (!stock) return;
  state.lastFocus = document.activeElement;
  const returns = stock.returns || {};
  const returnEntries = [["5日", returns.d5], ["10日", returns.d10], ["30日", returns.d30], ["半年", returns.d120]];
  const maxReturn = Math.max(1, ...returnEntries.map(([, value]) => Math.abs(finite(value) || 0)));
  const activeStats = researchStats(stock);
  const activeWindow = researchWindowMeta();
  const comparisonWindows = [["d7", "7天"], ["d30", "30天"], ["d180", "半年"]];
  document.getElementById("drawer-content").innerHTML = `
    <header class="drawer-heading"><span class="section-kicker">STOCK PROFILE</span><h2 id="drawer-title">${escapeHtml(stock.name)}</h2><p>${escapeHtml(stock.code)} · ${escapeHtml(stock.industry)} · ${formatNumber(stock.marketCap, 1)}亿元</p></header>
    <section class="drawer-section"><h3>关键指标</h3><div class="drawer-metrics">
      ${metricBlock("当前股价", `${formatNumber(stock.price, 2)}元`)}
      ${metricBlock("总市值", `${formatNumber(stock.marketCap, 1)}亿`)}
      ${metricBlock("动态PE", formatNumber(stock.pe, 1), stock.pe > 0 ? 1 : -1)}
      ${metricBlock("报告期", escapeHtml(stock.reportPeriod || "--"))}
      ${metricBlock("营业收入", `${formatNumber(stock.revenue, 2)}亿`)}
      ${metricBlock("归母净利润", `${formatNumber(stock.netProfit, 2)}亿`, stock.netProfit)}
      ${metricBlock(`${activeWindow.label}接待机构`, `${formatNumber(activeStats.researchInstitutions, 0)}家`)}
      ${metricBlock("营收同比", formatChange(stock.revenueGrowth), stock.revenueGrowth)}
      ${metricBlock("利润同比", formatChange(stock.profitGrowth), stock.profitGrowth)}
      ${metricBlock(`${activeWindow.label}评级机构`, `${formatNumber(activeStats.ratingInstitutions, 0)}家`)}
    </div></section>
    <section class="drawer-section"><h3>机构窗口对比</h3><div class="research-comparison" role="table" aria-label="机构调研时间窗口对比">
      <div class="comparison-row comparison-head" role="row"><span>统计口径</span>${comparisonWindows.map(([, label]) => `<strong>${label}</strong>`).join("")}</div>
      ${[
        ["累计接待机构数", "researchInstitutions", "家"],
        ["调研场次", "researchEvents", "场"],
        ["买入评级机构数", "ratingInstitutions", "家"],
        ["积极评级报告数", "positiveReports", "份"]
      ].map(([label, key, unit]) => `<div class="comparison-row" role="row"><span>${label}</span>${comparisonWindows.map(([windowKey]) => `<strong>${formatNumber(researchStats(stock, windowKey)[key], 0)}${finite(researchStats(stock, windowKey)[key]) === null ? "" : unit}</strong>`).join("")}</div>`).join("")}
    </div></section>
    <section class="drawer-section"><h3>所属概念</h3><div class="concept-tags">${(stock.concepts || []).slice(0, 5).map(item => `<span>${escapeHtml(item)}</span>`).join("") || "--"}</div></section>
    <section class="drawer-section"><h3>主营介绍</h3><p class="business-copy">${escapeHtml(stock.business || "暂无主营介绍。")}</p></section>
    <section class="drawer-section"><h3>区间涨幅</h3><div class="return-bars">${returnEntries.map(([label, value]) => `<div class="return-row"><span>${label}</span><div class="return-track"><i style="width:${Math.abs(finite(value) || 0) / maxReturn * 100}%;background:${finite(value) >= 0 ? "var(--up)" : "var(--down)"}"></i></div><strong class="${changeClass(value)}">${formatChange(value)}</strong></div>`).join("")}</div></section>`;
  const drawer = document.getElementById("stock-drawer");
  const backdrop = document.getElementById("drawer-backdrop");
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  backdrop.hidden = false;
  document.body.style.overflow = "hidden";
  document.getElementById("drawer-close").focus();
}

function closeStockDrawer() {
  const drawer = document.getElementById("stock-drawer");
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  document.getElementById("drawer-backdrop").hidden = true;
  document.body.style.overflow = "";
  if (state.lastFocus instanceof HTMLElement) state.lastFocus.focus();
}

function setupDrawer() {
  document.getElementById("drawer-close").addEventListener("click", closeStockDrawer);
  document.getElementById("drawer-backdrop").addEventListener("click", closeStockDrawer);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && document.getElementById("stock-drawer").classList.contains("open")) closeStockDrawer();
  });
}

const noteStorageKey = "a-share-close-book:notes:v1";

function readAllNotes() {
  try {
    const parsed = JSON.parse(localStorage.getItem(noteStorageKey) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeAllNotes(notes) {
  localStorage.setItem(noteStorageKey, JSON.stringify(notes));
}

function currentNoteDate() {
  return document.getElementById("note-date").value || data.meta.dataDate;
}

function currentSuggestedStage() {
  return data.emotion.daily.find(item => item.date === currentNoteDate())?.stage || selectedEmotion().stage;
}

function renderStageControl(selectedStage) {
  document.getElementById("note-stage-control").innerHTML = stageOrder.map(stage => `
    <button class="stage-option ${stage === selectedStage ? "active" : ""}" type="button" role="radio" aria-checked="${stage === selectedStage}" data-stage="${stage}" style="--stage-color:${stageColors[stage]}">${stage}</button>`).join("");
}

function loadNote() {
  const notes = readAllNotes();
  const note = notes[currentNoteDate()] || {};
  const suggested = currentSuggestedStage();
  document.getElementById("daily-conclusion").value = note.dailyConclusion || "";
  document.getElementById("tomorrow-focus").value = note.tomorrowFocus || "";
  renderStageControl(note.stage || suggested);
  document.getElementById("stage-suggestion").textContent = `系统建议：${suggested}`;
  document.getElementById("autosave-status").textContent = note.updatedAt ? `已保存 ${new Date(note.updatedAt).toLocaleString("zh-CN", {hour12: false})}` : "等待输入";
  if (document.getElementById("global-module-grid")) renderGlobal();
}

function saveNote() {
  try {
    const notes = readAllNotes();
    const date = currentNoteDate();
    const activeStage = document.querySelector(".stage-option.active")?.dataset.stage || currentSuggestedStage();
    notes[date] = {
      stage: activeStage,
      dailyConclusion: document.getElementById("daily-conclusion").value.trim(),
      tomorrowFocus: document.getElementById("tomorrow-focus").value.trim(),
      updatedAt: new Date().toISOString()
    };
    writeAllNotes(notes);
    document.getElementById("autosave-status").textContent = `已自动保存 ${new Date().toLocaleTimeString("zh-CN", {hour12: false})}`;
    renderGlobal();
  } catch {
    document.getElementById("autosave-status").textContent = "浏览器未允许本地保存";
  }
}

function scheduleNoteSave() {
  document.getElementById("autosave-status").textContent = "正在保存…";
  window.clearTimeout(state.noteTimer);
  state.noteTimer = window.setTimeout(saveNote, 350);
}

function exportNotes() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    notes: readAllNotes()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type: "application/json"});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `a-share-review-notes-${data.meta.dataDate.replaceAll("-", "")}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showToast("笔记已导出");
}

function importNotes(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const payload = JSON.parse(String(reader.result));
      if (payload.version !== 1 || !payload.notes || typeof payload.notes !== "object" || Array.isArray(payload.notes)) throw new Error("invalid");
      const current = readAllNotes();
      writeAllNotes({...current, ...payload.notes});
      loadNote();
      showToast(`已导入 ${Object.keys(payload.notes).length} 个交易日笔记`);
    } catch {
      showToast("导入失败：文件格式不正确");
    }
  });
  reader.readAsText(file);
}

function setupNotes() {
  const dateSelect = document.getElementById("note-date");
  const noteDates = [...new Set([...data.tradingDays, data.meta.dataDate].filter(Boolean))].sort().reverse();
  dateSelect.innerHTML = noteDates.map(date => `<option value="${escapeHtml(date)}" ${date === data.meta.dataDate ? "selected" : ""}>${escapeHtml(date)}</option>`).join("");
  dateSelect.addEventListener("change", loadNote);
  document.getElementById("note-stage-control").addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    event.currentTarget.querySelectorAll("button").forEach(item => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-checked", String(active));
    });
    scheduleNoteSave();
  });
  document.getElementById("daily-conclusion").addEventListener("input", scheduleNoteSave);
  document.getElementById("tomorrow-focus").addEventListener("input", scheduleNoteSave);
  document.getElementById("export-notes").addEventListener("click", exportNotes);
  document.getElementById("import-notes").addEventListener("change", event => {
    importNotes(event.target.files?.[0]);
    event.target.value = "";
  });
  document.getElementById("clear-note").addEventListener("click", () => {
    if (!confirm(`确认清空 ${currentNoteDate()} 的复盘笔记？`)) return;
    const notes = readAllNotes();
    delete notes[currentNoteDate()];
    writeAllNotes(notes);
    loadNote();
    showToast("当日笔记已清空");
  });
  loadNote();
}

function renderAll() {
  renderMeta();
  renderTemperatureTape();
  renderGlobal();
  renderOverview();
  renderEmotion();
  renderBoards();
  renderIdentity();
  renderResearch();
}

setupTabs();
setupBoardControls();
setupResearchControls();
setupDrawer();
setupNotes();
renderAll();

// 直接通过 Hash 打开时，保留模块状态但不让原生锚点滚走页首市场温度带。
if (location.hash) {
  requestAnimationFrame(() => window.scrollTo({top: 0, left: 0, behavior: "auto"}));
}
