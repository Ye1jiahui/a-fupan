window.MARKET_REVIEW_FALLBACK = {
  meta: {
    generatedAt: "2026-08-08T09:00:00+08:00",
    dataDate: "2026-08-07",
    mode: "demo",
    status: "fallback",
    confidence: "演示快照",
    warnings: ["当前展示结构化演示数据。运行 AKShare 数据脚本后将自动切换为真实收盘快照。"],
    sources: ["AKShare 接口结构", "本地演示快照"]
  },
  tradingDays: ["2026-07-30", "2026-07-31", "2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07"],
  overview: {
    indices: [
      {code: "000001", name: "上证指数", value: 3658.42, change: 0.36, history: [3618.2, 3635.7, 3626.1, 3642.8, 3629.4, 3645.3, 3658.42]},
      {code: "399001", name: "深证成指", value: 11284.16, change: 0.82, history: [11032.4, 11118.7, 11086.3, 11155.8, 11107.2, 11192.4, 11284.16]},
      {code: "399006", name: "创业板指", value: 2356.71, change: 1.18, history: [2282.5, 2311.8, 2298.4, 2328.9, 2312.1, 2329.2, 2356.71]},
      {code: "000688", name: "科创50", value: 1088.25, change: 1.46, history: [1035.2, 1056.7, 1048.1, 1065.4, 1058.8, 1072.6, 1088.25]},
      {code: "000300", name: "沪深300", value: 4215.63, change: 0.41, history: [4178.8, 4192.3, 4186.9, 4202.4, 4189.7, 4198.4, 4215.63]},
      {code: "000852", name: "中证1000", value: 6842.19, change: 1.27, history: [6642.4, 6708.3, 6681.6, 6762.8, 6724.5, 6756.4, 6842.19]}
    ],
    daily: [
      {date: "2026-07-30", turnover: 15120, up: 2678, down: 2241, flat: 178, median: 0.22, largeSmallSpread: -0.31},
      {date: "2026-07-31", turnover: 16280, up: 3185, down: 1742, flat: 169, median: 0.67, largeSmallSpread: -0.48},
      {date: "2026-08-03", turnover: 15740, up: 2422, down: 2491, flat: 184, median: -0.06, largeSmallSpread: 0.18},
      {date: "2026-08-04", turnover: 17160, up: 3412, down: 1515, flat: 170, median: 0.88, largeSmallSpread: -0.57},
      {date: "2026-08-05", turnover: 16490, up: 2085, down: 2854, flat: 158, median: -0.41, largeSmallSpread: 0.12},
      {date: "2026-08-06", turnover: 15860, up: 1964, down: 2963, flat: 170, median: -0.56, largeSmallSpread: 0.38},
      {date: "2026-08-07", turnover: 17680, up: 3668, down: 1294, flat: 135, median: 1.04, largeSmallSpread: -0.76}
    ]
  },
  emotion: {
    daily: [
      {date: "2026-07-30", limitUp: 43, limitDown: 8, brokenRate: 31.2, maxStreak: 4, previousPremium: 0.42, promotion12: 24.0, promotion23: 18.0, promotionAll: 22.6, score: 42, stage: "修复", confidence: "7日样本"},
      {date: "2026-07-31", limitUp: 52, limitDown: 6, brokenRate: 27.4, maxStreak: 5, previousPremium: 1.16, promotion12: 31.0, promotion23: 25.0, promotionAll: 28.8, score: 55, stage: "启动", confidence: "7日样本"},
      {date: "2026-08-03", limitUp: 38, limitDown: 11, brokenRate: 38.6, maxStreak: 5, previousPremium: -0.35, promotion12: 19.0, promotion23: 16.0, promotionAll: 18.4, score: 34, stage: "分歧", confidence: "7日样本"},
      {date: "2026-08-04", limitUp: 76, limitDown: 3, brokenRate: 18.8, maxStreak: 6, previousPremium: 2.68, promotion12: 42.0, promotion23: 33.0, promotionAll: 38.9, score: 78, stage: "发酵", confidence: "7日样本"},
      {date: "2026-08-05", limitUp: 59, limitDown: 9, brokenRate: 33.1, maxStreak: 6, previousPremium: 0.62, promotion12: 28.0, promotion23: 24.0, promotionAll: 26.7, score: 51, stage: "分歧", confidence: "7日样本"},
      {date: "2026-08-06", limitUp: 45, limitDown: 14, brokenRate: 41.5, maxStreak: 5, previousPremium: -1.12, promotion12: 20.0, promotion23: 14.0, promotionAll: 17.8, score: 27, stage: "退潮", confidence: "7日样本"},
      {date: "2026-08-07", limitUp: 71, limitDown: 5, brokenRate: 22.7, maxStreak: 6, previousPremium: 2.04, promotion12: 38.0, promotion23: 31.0, promotionAll: 34.6, score: 72, stage: "修复", confidence: "7日样本"}
    ]
  },
  boards: {
    industry: [
      {code: "HY001", name: "半导体", d1: 3.82, d3: 7.64, d7: 12.38, leader: {code: "DEMO01", name: "示例芯片A", d1: 8.22, d3: 16.4, d7: 29.7}},
      {code: "HY002", name: "通信设备", d1: 3.14, d3: 5.82, d7: 10.26, leader: {code: "DEMO02", name: "示例通信A", d1: 6.18, d3: 12.2, d7: 21.5}},
      {code: "HY003", name: "软件开发", d1: 2.76, d3: 6.35, d7: 9.42, leader: {code: "DEMO03", name: "示例软件A", d1: 5.63, d3: 13.7, d7: 18.9}},
      {code: "HY004", name: "消费电子", d1: 2.31, d3: 4.12, d7: 8.16, leader: {code: "DEMO04", name: "示例电子A", d1: 4.86, d3: 8.9, d7: 16.3}},
      {code: "HY005", name: "汽车零部件", d1: 1.96, d3: 3.72, d7: 7.83, leader: {code: "DEMO05", name: "示例汽配A", d1: 7.12, d3: 9.8, d7: 17.6}},
      {code: "HY006", name: "电网设备", d1: 1.74, d3: 4.55, d7: 7.24, leader: {code: "DEMO06", name: "示例电气A", d1: 4.23, d3: 10.4, d7: 15.8}},
      {code: "HY007", name: "军工电子", d1: 1.48, d3: 2.16, d7: 6.92, leader: {code: "DEMO07", name: "示例军工A", d1: 3.82, d3: 7.1, d7: 14.2}},
      {code: "HY008", name: "工业金属", d1: 1.22, d3: 3.84, d7: 6.48, leader: {code: "DEMO08", name: "示例金属A", d1: 3.11, d3: 6.6, d7: 12.4}},
      {code: "HY009", name: "光伏设备", d1: 0.94, d3: 2.82, d7: 5.96, leader: {code: "DEMO09", name: "示例光伏A", d1: 2.64, d3: 5.8, d7: 11.7}},
      {code: "HY010", name: "医疗器械", d1: 0.72, d3: 1.68, d7: 4.82, leader: {code: "DEMO10", name: "示例医疗A", d1: 2.42, d3: 4.7, d7: 9.8}},
      {code: "HY011", name: "证券", d1: 0.48, d3: -0.62, d7: 3.25, leader: {code: "DEMO11", name: "示例证券A", d1: 1.65, d3: 1.2, d7: 6.4}},
      {code: "HY012", name: "食品饮料", d1: -0.28, d3: 0.74, d7: 1.52, leader: {code: "DEMO12", name: "示例消费A", d1: 1.04, d3: 2.1, d7: 4.2}}
    ],
    concept: [
      {code: "GN001", name: "先进封装", d1: 5.12, d3: 10.42, d7: 18.36, leader: {code: "DEMO01", name: "示例芯片A", d1: 8.22, d3: 16.4, d7: 29.7}},
      {code: "GN002", name: "光通信模块", d1: 4.48, d3: 8.26, d7: 15.72, leader: {code: "DEMO02", name: "示例通信A", d1: 6.18, d3: 12.2, d7: 21.5}},
      {code: "GN003", name: "国产算力", d1: 4.06, d3: 9.18, d7: 14.65, leader: {code: "DEMO03", name: "示例软件A", d1: 5.63, d3: 13.7, d7: 18.9}},
      {code: "GN004", name: "机器人执行器", d1: 3.61, d3: 6.24, d7: 12.42, leader: {code: "DEMO05", name: "示例汽配A", d1: 7.12, d3: 9.8, d7: 17.6}},
      {code: "GN005", name: "AI终端", d1: 3.28, d3: 5.82, d7: 11.94, leader: {code: "DEMO04", name: "示例电子A", d1: 4.86, d3: 8.9, d7: 16.3}},
      {code: "GN006", name: "特高压", d1: 2.54, d3: 5.48, d7: 10.63, leader: {code: "DEMO06", name: "示例电气A", d1: 4.23, d3: 10.4, d7: 15.8}},
      {code: "GN007", name: "低空经济", d1: 2.22, d3: 3.54, d7: 9.72, leader: {code: "DEMO07", name: "示例军工A", d1: 3.82, d3: 7.1, d7: 14.2}},
      {code: "GN008", name: "稀有金属", d1: 1.86, d3: 4.36, d7: 8.64, leader: {code: "DEMO08", name: "示例金属A", d1: 3.11, d3: 6.6, d7: 12.4}},
      {code: "GN009", name: "固态电池", d1: 1.45, d3: 3.18, d7: 7.82, leader: {code: "DEMO05", name: "示例汽配A", d1: 7.12, d3: 9.8, d7: 17.6}},
      {code: "GN010", name: "创新药", d1: 1.14, d3: 2.48, d7: 6.56, leader: {code: "DEMO10", name: "示例医疗A", d1: 2.42, d3: 4.7, d7: 9.8}},
      {code: "GN011", name: "数据要素", d1: 0.86, d3: 2.02, d7: 5.74, leader: {code: "DEMO03", name: "示例软件A", d1: 5.63, d3: 13.7, d7: 18.9}},
      {code: "GN012", name: "并购重组", d1: -0.38, d3: 1.12, d7: 4.28, leader: {code: "DEMO11", name: "示例证券A", d1: 1.65, d3: 1.2, d7: 6.4}}
    ]
  },
  identity: {
    popular: [
      {rank: 1, code: "DEMO01", name: "示例芯片A", change: 8.22}, {rank: 2, code: "DEMO02", name: "示例通信A", change: 6.18},
      {rank: 3, code: "DEMO05", name: "示例汽配A", change: 7.12}, {rank: 4, code: "DEMO03", name: "示例软件A", change: 5.63},
      {rank: 5, code: "DEMO06", name: "示例电气A", change: 4.23}, {rank: 6, code: "DEMO04", name: "示例电子A", change: 4.86},
      {rank: 7, code: "DEMO07", name: "示例军工A", change: 3.82}, {rank: 8, code: "DEMO08", name: "示例金属A", change: 3.11},
      {rank: 9, code: "DEMO09", name: "示例光伏A", change: 2.64}, {rank: 10, code: "DEMO10", name: "示例医疗A", change: 2.42},
      {rank: 11, code: "DEMO13", name: "示例算力B", change: 2.06}, {rank: 12, code: "DEMO14", name: "示例机器人B", change: 1.82},
      {rank: 13, code: "DEMO15", name: "示例数据B", change: -0.56}, {rank: 14, code: "DEMO16", name: "示例材料B", change: 1.27},
      {rank: 15, code: "DEMO17", name: "示例低空B", change: 3.44}, {rank: 16, code: "DEMO18", name: "示例电池B", change: 0.92},
      {rank: 17, code: "DEMO19", name: "示例医药B", change: -1.18}, {rank: 18, code: "DEMO20", name: "示例消费B", change: 0.42},
      {rank: 19, code: "DEMO21", name: "示例金融B", change: -0.34}, {rank: 20, code: "DEMO22", name: "示例军工B", change: 1.51}
    ],
    ranked: [
      {rank: 1, code: "DEMO01", name: "示例芯片A", score: 92, role: "情绪核心", industry: "半导体", concepts: ["先进封装", "国产算力"], components: {attention: 29, strength: 28, leadership: 23, confirmation: 12}, reasons: ["人气排名第1", "先进封装7日领涨", "5日价格强度位于候选池前5%"], risks: ["30日涨幅偏高", "换手率快速抬升"]},
      {rank: 2, code: "DEMO02", name: "示例通信A", score: 88, role: "趋势核心", industry: "通信设备", concepts: ["光通信模块", "国产算力"], components: {attention: 27, strength: 27, leadership: 22, confirmation: 12}, reasons: ["成交额连续居前", "光通信模块核心成分", "10日趋势保持多头"], risks: ["板块拥挤度上升"]},
      {rank: 3, code: "DEMO05", name: "示例汽配A", score: 84, role: "题材中军", industry: "汽车零部件", concepts: ["机器人执行器", "固态电池"], components: {attention: 26, strength: 25, leadership: 21, confirmation: 12}, reasons: ["双题材共振", "3日量价同步改善", "涨停梯队完整"], risks: ["题材分流风险"]},
      {rank: 4, code: "DEMO03", name: "示例软件A", score: 80, role: "趋势核心", industry: "软件开发", concepts: ["国产算力", "数据要素"], components: {attention: 25, strength: 24, leadership: 21, confirmation: 10}, reasons: ["国产算力强势成分", "7日涨幅保持前列", "人气稳定上升"], risks: ["动态估值偏高"]},
      {rank: 5, code: "DEMO06", name: "示例电气A", score: 76, role: "题材中军", industry: "电网设备", concepts: ["特高压", "智能电网"], components: {attention: 21, strength: 22, leadership: 22, confirmation: 11}, reasons: ["特高压板块领涨", "成交容量较好", "回撤后快速修复"], risks: ["短期上影线增多"]},
      {rank: 6, code: "DEMO04", name: "示例电子A", score: 73, role: "人气博弈", industry: "消费电子", concepts: ["AI终端", "智能穿戴"], components: {attention: 24, strength: 21, leadership: 18, confirmation: 10}, reasons: ["人气排名第6", "AI终端当日走强", "成交额放大"], risks: ["炸板后承接待确认"]},
      {rank: 7, code: "DEMO07", name: "示例军工A", score: 70, role: "题材中军", industry: "军工电子", concepts: ["低空经济", "商业航天"], components: {attention: 20, strength: 21, leadership: 20, confirmation: 9}, reasons: ["低空经济核心成分", "5日趋势转强", "龙虎榜活跃"], risks: ["消息催化依赖较强"]},
      {rank: 8, code: "DEMO08", name: "示例金属A", score: 66, role: "趋势核心", industry: "工业金属", concepts: ["稀有金属"], components: {attention: 18, strength: 22, leadership: 18, confirmation: 8}, reasons: ["商品价格共振", "30日趋势稳健", "板块内相对强度领先"], risks: ["周期价格波动"]}
    ]
  },
  research: {
    windowStart: "2026-07-09",
    windowEnd: "2026-08-07",
    buckets: [
      {
        id: "small", label: "50–100亿", min: 50, max: 100,
        stocks: [
          {code: "DEMO31", name: "示例精工A", marketCap: 68.4, industry: "机械设备", concepts: ["机器人", "专精特新"], business: "精密传动组件及工业自动化设备研发与制造。", revenue: 18.6, netProfit: 2.14, pe: 27.8, revenueGrowth: 21.4, profitGrowth: 32.8, reportPeriod: "2026中报", returns: {d5: 4.8, d10: 8.6, d30: 14.2, d120: 36.7}, researchCount: 86, eventCount: 5, ratingCount: 7, ratingInstitutions: 5},
          {code: "DEMO32", name: "示例材料A", marketCap: 82.7, industry: "新材料", concepts: ["先进封装", "国产替代"], business: "高性能电子材料及半导体封装材料生产。", revenue: 24.3, netProfit: 3.08, pe: 31.2, revenueGrowth: 17.9, profitGrowth: 28.6, reportPeriod: "2026中报", returns: {d5: 2.6, d10: 6.1, d30: 11.8, d120: 22.5}, researchCount: 72, eventCount: 4, ratingCount: 5, ratingInstitutions: 4},
          {code: "DEMO33", name: "示例医疗C", marketCap: 55.9, industry: "医疗器械", concepts: ["医疗AI"], business: "医学影像设备和智能诊断软件研发。", revenue: 12.9, netProfit: 1.52, pe: 35.6, revenueGrowth: 15.3, profitGrowth: 19.7, reportPeriod: "2026中报", returns: {d5: -1.4, d10: 1.8, d30: 7.5, d120: 18.2}, researchCount: 58, eventCount: 3, ratingCount: 4, ratingInstitutions: 4}
        ]
      },
      {
        id: "medium", label: "100–300亿", min: 100, max: 300,
        stocks: [
          {code: "DEMO41", name: "示例控制A", marketCap: 186.5, industry: "自动化设备", concepts: ["机器人", "工业母机"], business: "工业控制器、伺服系统及运动控制平台。", revenue: 46.8, netProfit: 6.72, pe: 29.4, revenueGrowth: 26.8, profitGrowth: 41.5, reportPeriod: "2026中报", returns: {d5: 6.2, d10: 11.4, d30: 20.8, d120: 48.6}, researchCount: 164, eventCount: 8, ratingCount: 12, ratingInstitutions: 9},
          {code: "DEMO42", name: "示例光电A", marketCap: 248.2, industry: "通信设备", concepts: ["光通信模块", "算力基础设施"], business: "高速光通信器件及数据中心互连产品。", revenue: 72.4, netProfit: 9.86, pe: 33.1, revenueGrowth: 38.2, profitGrowth: 55.7, reportPeriod: "2026中报", returns: {d5: 8.8, d10: 16.7, d30: 31.4, d120: 72.5}, researchCount: 142, eventCount: 7, ratingCount: 15, ratingInstitutions: 11},
          {code: "DEMO43", name: "示例药业A", marketCap: 132.6, industry: "生物制品", concepts: ["创新药", "出海"], business: "创新生物药研发、生产和商业化。", revenue: 31.7, netProfit: 4.12, pe: 38.9, revenueGrowth: 19.6, profitGrowth: 24.1, reportPeriod: "2026中报", returns: {d5: 1.9, d10: 4.6, d30: 9.8, d120: 27.4}, researchCount: 118, eventCount: 6, ratingCount: 9, ratingInstitutions: 7}
        ]
      },
      {
        id: "large", label: "300–800亿", min: 300, max: 800,
        stocks: [
          {code: "DEMO51", name: "示例算力A", marketCap: 624.8, industry: "计算机设备", concepts: ["国产算力", "液冷服务器"], business: "高性能计算平台、服务器及数据中心解决方案。", revenue: 186.3, netProfit: 18.72, pe: 36.4, revenueGrowth: 42.6, profitGrowth: 63.8, reportPeriod: "2026中报", returns: {d5: 7.4, d10: 14.6, d30: 26.8, d120: 61.2}, researchCount: 286, eventCount: 12, ratingCount: 22, ratingInstitutions: 16},
          {code: "DEMO52", name: "示例能源A", marketCap: 438.7, industry: "电池", concepts: ["固态电池", "储能"], business: "动力与储能电池材料、系统集成及回收。", revenue: 214.5, netProfit: 16.38, pe: 24.6, revenueGrowth: 22.7, profitGrowth: 34.5, reportPeriod: "2026中报", returns: {d5: 3.7, d10: 7.2, d30: 12.9, d120: 30.6}, researchCount: 235, eventCount: 10, ratingCount: 18, ratingInstitutions: 13},
          {code: "DEMO53", name: "示例智驾A", marketCap: 356.4, industry: "汽车零部件", concepts: ["智能驾驶", "机器人"], business: "智能驾驶感知、域控制器及线控底盘产品。", revenue: 96.8, netProfit: 8.94, pe: 41.2, revenueGrowth: 35.9, profitGrowth: 48.3, reportPeriod: "2026中报", returns: {d5: 5.1, d10: 10.8, d30: 19.3, d120: 44.8}, researchCount: 198, eventCount: 9, ratingCount: 16, ratingInstitutions: 12}
        ]
      }
    ]
  }
};
