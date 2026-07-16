function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback
} = React;

// ============================================================
// 定数・メタデータ
// ============================================================
const METRICS = {
  elecKWh: {
    label: "受電電力量",
    unit: "kWh",
    color: "#2563eb",
    kind: "sum",
    group: "電力"
  },
  demandKW: {
    label: "日平均電力(簡易デマンド)",
    unit: "kW",
    color: "#f59e0b",
    kind: "avg",
    group: "電力",
    derived: true
  },
  oilTotalL: {
    label: "重油使用量(合計)",
    unit: "L",
    color: "#dc2626",
    kind: "sum",
    group: "重油"
  },
  oilChillerTotalL: {
    label: "重油(冷温水発生器 計)",
    unit: "L",
    color: "#ea580c",
    kind: "sum",
    group: "重油"
  },
  oilChiller1L: {
    label: "重油(冷温水発生器No.1)",
    unit: "L",
    color: "#fb923c",
    kind: "sum",
    group: "重油"
  },
  oilChiller2L: {
    label: "重油(冷温水発生器No.2)",
    unit: "L",
    color: "#fdba74",
    kind: "sum",
    group: "重油"
  },
  oilBoilerTotalL: {
    label: "重油(ボイラー 計)",
    unit: "L",
    color: "#b45309",
    kind: "sum",
    group: "重油"
  },
  oilBoiler1L: {
    label: "重油(ボイラーNo.1)",
    unit: "L",
    color: "#d97706",
    kind: "sum",
    group: "重油"
  },
  oilBoiler2L: {
    label: "重油(ボイラーNo.2)",
    unit: "L",
    color: "#f59e0b",
    kind: "sum",
    group: "重油"
  },
  coolLoadGJ: {
    label: "冷水負荷",
    unit: "GJ",
    color: "#0891b2",
    kind: "sum",
    group: "熱負荷"
  },
  heatLoadGJ: {
    label: "温水負荷",
    unit: "GJ",
    color: "#be185d",
    kind: "sum",
    group: "熱負荷"
  },
  totalLoadGJ: {
    label: "負荷熱量(合計)",
    unit: "GJ",
    color: "#7c3aed",
    kind: "sum",
    group: "熱負荷",
    derived: true
  },
  tempAvg: {
    label: "外気温度(平均)",
    unit: "℃",
    color: "#16a34a",
    kind: "avg",
    group: "気象"
  },
  humidityAvg: {
    label: "外気湿度(平均)",
    unit: "%RH",
    color: "#4b5563",
    kind: "avg",
    group: "気象"
  },
  efficiencyPct: {
    label: "総合熱源効率",
    unit: "%",
    color: "#0d9488",
    kind: "avg",
    group: "コスト・環境",
    derived: true
  },
  co2T: {
    label: "CO2排出量",
    unit: "t-CO2",
    color: "#0f766e",
    kind: "sum",
    group: "コスト・環境",
    derived: true
  },
  crudeOilKL: {
    label: "原油換算値",
    unit: "kL",
    color: "#92400e",
    kind: "sum",
    group: "コスト・環境",
    derived: true
  },
  costYen: {
    label: "概算コスト",
    unit: "円",
    color: "#ca8a04",
    kind: "sum",
    group: "コスト・環境",
    derived: true
  }
};
const METRIC_GROUPS = ["電力", "重油", "熱負荷", "気象", "コスト・環境"];
const FORECASTABLE = ["elecKWh", "oilTotalL", "oilChillerTotalL", "oilBoilerTotalL", "coolLoadGJ", "heatLoadGJ", "totalLoadGJ", "co2T", "crudeOilKL", "costYen"];
const CHART_TYPE_OPTIONS = [["line", "折れ線"], ["bar", "棒"], ["stackedBar", "積み上げ棒"], ["scatter", "散布図(気温相関)"]];
const FM_LABELS = ["4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月", "1月", "2月", "3月"];
const DAY_TYPE_LABEL = {
  weekday: "平日",
  saturday: "土曜",
  sunday: "日曜",
  holiday: "休日/祝日"
};
const DAY_TYPE_COLOR = {
  weekday: "#3b82f6",
  saturday: "#10b981",
  sunday: "#ef4444",
  holiday: "#f97316"
};
const DEFAULT_SETTINGS = {
  contractKW: 500,
  oilCalorificMJperL: 39.1,
  elecMJperKWh: 3.6,
  elecCO2PerKWh: 0.441,
  oilCO2PerL: 2.71,
  targetElecKWh: 0,
  targetOilL: 0,
  crudeOilGJperKL: 38.2,
  anomalySigmaThreshold: 2,
  demandAlertPct: 100,
  elecPricePerKWh: 30,
  oilPricePerL: 100
};
const LS_DATA_KEY = "energyApp.data.v1";
const LS_SETTINGS_KEY = "energyApp.settings.v1";
const LS_VIEWSTATE_KEY = "energyApp.viewState.v1";
const LS_NOTES_KEY = "energyApp.notes.v1";
const LS_DARKMODE_KEY = "energyApp.darkMode.v1";
const DEFAULT_CHARTS = [{
  id: 1,
  name: "グラフ1",
  chartType: "line",
  selectedMetrics: ["elecKWh"],
  compareEnabled: true,
  showForecast: true,
  forecastMethod: "seasonal",
  dayTypeColoring: false
}];

// ─── Firebase（複数端末間のリアルタイム共有）───
// 使い方：Firebaseコンソール（console.firebase.google.com）で新規プロジェクトを作成し、
// Realtime Databaseを有効化した上で、下記の値を自分のプロジェクトのものに置き換える
// （手順はREADME.md参照）。CDN読み込みに失敗した場合（オフライン等）や、値を置き換えて
// いない場合はdb=nullとなり、以降の同期処理はすべて安全にスキップされ、アプリ自体は
// ローカル（localStorage）のみで動作し続ける。
const firebaseConfig = {
  apiKey: "AIzaSyDs-B-0nqkSgO8c9C-kQGqkPRXfM0A14Pc",
  authDomain: "energy-management-app-9daeb.firebaseapp.com",
  // databaseURLはコンソールの「Add app」画面のスニペットには含まれないため、
  // Realtime Database作成時のデフォルトロケーション(us-central1)を仮定して補完している。
  // 実際のRealtime Databaseのロケーションを変更した場合はURLの形式が変わるので、
  // Firebaseコンソール→Realtime Database画面の上部に表示される実際のURLに置き換えること。
  databaseURL: "https://energy-management-app-9daeb-default-rtdb.firebaseio.com",
  projectId: "energy-management-app-9daeb",
  storageBucket: "energy-management-app-9daeb.firebasestorage.app",
  messagingSenderId: "1048227854865",
  appId: "1:1048227854865:web:e386b0b2a9237458d90fb0"
};
const fbApp = typeof window !== "undefined" && window.firebase && firebaseConfig.apiKey !== "YOUR_API_KEY" ? window.firebase.initializeApp(firebaseConfig) : null;
// databaseURLが実際のRealtime Databaseと一致しない場合、firebase.database()が例外を投げることがある。
// ここで失敗してもアプリ全体が止まらないよう、db=nullにフォールバックする。
let db = null;
if (fbApp) {
  try {
    db = window.firebase.database();
  } catch (e) {
    console.warn("Firebase Database初期化に失敗しました。databaseURLを確認してください。", e);
  }
}
// リポジトリを公開する場合、DBのルールを"auth != null"に絞るため、Firebase Authenticationの
// Email/Passwordプロバイダを有効化し、チームで共有する1アカウントでサインインする方式にしている
// （ソースコードが公開されてもパスワード自体はコード中に含まれないので安全）。
// authがnull（Firebase未設定）の場合はサインイン画面自体を出さず、今まで通りローカルのみで動作する。
let auth = null;
if (fbApp) {
  try {
    auth = window.firebase.auth();
  } catch (e) {
    console.warn("Firebase Auth初期化に失敗しました。", e);
  }
}

// Firebaseへの書き込みは、状態の変化を監視するeffectではなく、実際にユーザーが保存操作をした
// タイミング（各handle*関数）からのみ呼び出す。これにより「リモートの変更を受けて再度書き込む」
// という無限ループを構造的に避けられる（ローカルstateはFirebaseの内容を映すミラーとして扱う）。
function fbSaveRecord(record) {
  if (!db || !record || !record.date) return;
  const {
    demandKW,
    totalLoadGJ,
    ...rest
  } = record;
  db.ref("energyData/" + record.date).set(rest);
}
function fbDeleteRecord(dateStr) {
  if (!db || !dateStr) return;
  db.ref("energyData/" + dateStr).remove();
}
function fbBulkSaveData(rows) {
  if (!db || !rows || !rows.length) return;
  const updates = {};
  rows.forEach(r => {
    const {
      demandKW,
      totalLoadGJ,
      ...rest
    } = r;
    updates["energyData/" + r.date] = rest;
  });
  db.ref().update(updates);
}
function fbSaveNote(dateStr, text) {
  if (!db || !dateStr) return;
  if (text && text.trim()) db.ref("notes/" + dateStr).set(text);else db.ref("notes/" + dateStr).remove();
}
function fbSaveSettings(s) {
  if (!db) return;
  db.ref("settings").set(s);
}
function fbReplaceAll(rows, settingsObj, notesObj) {
  if (!db) return;
  const dataObj = {};
  (rows || []).forEach(r => {
    const {
      demandKW,
      totalLoadGJ,
      ...rest
    } = r;
    dataObj[r.date] = rest;
  });
  db.ref().update({
    energyData: dataObj,
    settings: settingsObj || {},
    notes: notesObj || {}
  });
}

// ============================================================
// ユーティリティ
// ============================================================
function withDerived(row) {
  const totalLoadGJ = (row.coolLoadGJ || 0) + (row.heatLoadGJ || 0);
  const demandKW = (row.elecKWh || 0) / 24;
  return {
    ...row,
    totalLoadGJ,
    demandKW
  };
}

// 設定（換算係数・単価）に依存する項目は、設定変更時に再計算されるよう別関数として分離
function withComputed(row, settings) {
  const elecGJ = (row.elecKWh || 0) * settings.elecMJperKWh / 1000;
  const oilGJ = (row.oilTotalL || 0) * settings.oilCalorificMJperL / 1000;
  const inputGJ = elecGJ + oilGJ;
  const co2T = ((row.elecKWh || 0) * settings.elecCO2PerKWh + (row.oilTotalL || 0) * settings.oilCO2PerL) / 1000;
  const crudeOilKL = settings.crudeOilGJperKL > 0 ? inputGJ / settings.crudeOilGJperKL : null;
  const costYen = (row.elecKWh || 0) * settings.elecPricePerKWh + (row.oilTotalL || 0) * settings.oilPricePerL;
  const efficiencyPct = inputGJ > 0 ? (row.totalLoadGJ || 0) / inputGJ * 100 : null;
  return {
    ...row,
    co2T,
    crudeOilKL,
    costYen,
    efficiencyPct
  };
}

// ============================================================
// ローカルファイル自動保存（File System Access API + IndexedDB）
// FileSystemFileHandleはlocalStorageに保存できないため、IndexedDBに保管して
// 次回起動時にも同じファイルへ書き込み続けられるようにする。
// ============================================================
const IDB_NAME = "energyAppFS";
const IDB_STORE = "handles";
const IDB_KEY = "autoSaveFile";
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbSaveHandle(handle) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(handle, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbLoadHandle() {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
async function idbClearHandle() {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
function loadInitialData() {
  try {
    const saved = localStorage.getItem(LS_DATA_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length) return parsed.map(withDerived).sort((a, b) => a.date < b.date ? -1 : 1);
    }
  } catch (e) {/* ignore, fall back to bundled data */}
  const base = (window.ENERGY_DATA || []).map(withDerived);
  return base.sort((a, b) => a.date < b.date ? -1 : 1);
}
function loadSettings() {
  try {
    const saved = localStorage.getItem(LS_SETTINGS_KEY);
    if (saved) return {
      ...DEFAULT_SETTINGS,
      ...JSON.parse(saved)
    };
  } catch (e) {/* ignore */}
  return {
    ...DEFAULT_SETTINGS
  };
}
function loadViewState() {
  try {
    const saved = localStorage.getItem(LS_VIEWSTATE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {/* ignore */}
  return null;
}
function loadNotes() {
  try {
    const saved = localStorage.getItem(LS_NOTES_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {/* ignore */}
  return {};
}
function fiscalYear(dateStr) {
  const [y, m] = dateStr.split("-").map(Number);
  return m >= 4 ? y : y - 1;
}
function fiscalMonthIdx(dateStr) {
  const m = Number(dateStr.split("-")[1]);
  return m >= 4 ? m - 4 : m + 8;
}
function fiscalMonthKeys(fy) {
  const keys = [];
  for (let i = 0; i < 12; i++) {
    const y = i < 9 ? fy : fy + 1;
    const m = (i + 3) % 12 + 1;
    keys.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return keys;
}
function daysInMonth(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}
function parseISO(s) {
  return new Date(s + "T00:00:00");
}
function addDays(dateStr, delta) {
  const d = parseISO(dateStr);
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function classifyDay(dateStr, holidayMap) {
  if (holidayMap[dateStr]) return "holiday";
  const dow = parseISO(dateStr).getDay();
  if (dow === 0) return "sunday";
  if (dow === 6) return "saturday";
  return "weekday";
}
function sumMetric(rows, key) {
  return rows.reduce((s, r) => s + (r[key] || 0), 0);
}
function avgMetric(rows, key) {
  const vals = rows.map(r => r[key]).filter(v => v != null && !isNaN(v));
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
function aggMetric(rows, key) {
  const meta = METRICS[key];
  return meta.kind === "avg" ? avgMetric(rows, key) : sumMetric(rows, key);
}
function fmtNum(n, digits = 0) {
  if (n == null || isNaN(n)) return "-";
  return n.toLocaleString("ja-JP", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  });
}
function fmtPct(p) {
  if (p == null || isNaN(p)) return "-";
  const sign = p > 0 ? "+" : "";
  return `${sign}${p.toFixed(1)}%`;
}
function linreg(points) {
  const n = points.length;
  if (n < 2) return {
    slope: 0,
    intercept: points[0] ? points[0][1] : 0
  };
  let sx = 0,
    sy = 0,
    sxx = 0,
    sxy = 0;
  points.forEach(([x, y]) => {
    sx += x;
    sy += y;
    sxx += x * x;
    sxy += x * y;
  });
  const denom = n * sxx - sx * sx;
  if (denom === 0) return {
    slope: 0,
    intercept: sy / n
  };
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return {
    slope,
    intercept
  };
}
function buildRegression(rows, key) {
  const pts = rows.map(r => [r.tempAvg, r[key]]).filter(([x, y]) => x != null && y != null && !isNaN(x) && !isNaN(y));
  return linreg(pts);
}
function historicalAvgTempForCalendarDay(rows, monthDay) {
  const vals = rows.filter(r => r.date.slice(5) === monthDay).map(r => r.tempAvg).filter(v => v != null);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// 月内の残り日数を予測する（日ビューの月末着地予測に使用）
function computeMonthForecast(allRows, ym, key, method) {
  const dim = daysInMonth(ym);
  const monthRows = allRows.filter(r => r.date.startsWith(ym)).sort((a, b) => a.date < b.date ? -1 : 1);
  const actualDates = new Set(monthRows.map(r => r.date));
  const allDates = [];
  for (let d = 1; d <= dim; d++) allDates.push(`${ym}-${String(d).padStart(2, "0")}`);
  const missingDates = allDates.filter(d => !actualDates.has(d));
  if (missingDates.length === 0 || monthRows.length === 0) return null;
  const actualSum = sumMetric(monthRows, key);
  const [y, m] = ym.split("-").map(Number);
  const lastYearYm = `${y - 1}-${String(m).padStart(2, "0")}`;
  const lastYearByDay = {};
  allRows.filter(r => r.date.startsWith(lastYearYm)).forEach(r => {
    lastYearByDay[Number(r.date.split("-")[2])] = r[key];
  });
  const matchedLastYearSoFar = monthRows.map(r => lastYearByDay[Number(r.date.split("-")[2])]).filter(v => v != null);
  const lastYearSoFarSum = matchedLastYearSoFar.reduce((a, b) => a + b, 0);
  const ratio = lastYearSoFarSum > 0 ? actualSum / lastYearSoFarSum : 1;
  const paceAvgPerDay = actualSum / monthRows.length;
  const reg = buildRegression(allRows, key);
  const forecastPoints = missingDates.map(dateStr => {
    const day = Number(dateStr.split("-")[2]);
    let value;
    if (method === "pace") {
      value = paceAvgPerDay;
    } else if (method === "seasonal") {
      const ly = lastYearByDay[day];
      value = ly != null ? ly * ratio : paceAvgPerDay;
    } else {
      const histTemp = historicalAvgTempForCalendarDay(allRows, dateStr.slice(5));
      value = histTemp != null ? reg.slope * histTemp + reg.intercept : paceAvgPerDay;
    }
    return {
      date: dateStr,
      value: Math.max(0, value)
    };
  });
  const forecastSum = forecastPoints.reduce((s, p) => s + p.value, 0);
  return {
    actualSum,
    forecastPoints,
    forecastSum,
    projectedTotal: actualSum + forecastSum
  };
}

// 年度内の残り月を予測する（月ビューの年度末着地予測に使用）
function computeFiscalYearForecast(allRows, fy, key, method, latestDate) {
  const monthKeys = fiscalMonthKeys(fy);
  const prevMonthKeys = fiscalMonthKeys(fy - 1);
  const reg = buildRegression(allRows, key);
  const monthly = monthKeys.map((ym, idx) => {
    const rows = allRows.filter(r => r.date.startsWith(ym));
    const dim = daysInMonth(ym);
    return {
      ym,
      prevYm: prevMonthKeys[idx],
      rows,
      sum: sumMetric(rows, key),
      dim
    };
  });

  // latestDateの月までは「過去（欠測日があっても実績はそのまま集計）」、
  // その月だけ末尾を予測、それより後の月は「未来（丸ごと予測）」として扱う。
  const latestYm = latestDate ? latestDate.slice(0, 7) : null;
  let currentIdx = monthKeys.indexOf(latestYm);
  if (currentIdx === -1) currentIdx = monthKeys.length; // 対象年度にlatestDateが無ければ全月を過去扱い

  let soFarThisFY = 0;
  let forecastRemaining = 0;
  let hasForecast = false;
  const matchedPrevYm = [];
  let monthsElapsed = 0;
  const byIndex = {}; // month index -> 表示用の値（実績、または実績+予測の合算）

  monthly.forEach((m, idx) => {
    if (idx < currentIdx) {
      soFarThisFY += m.sum;
      matchedPrevYm.push(m.prevYm);
      monthsElapsed += 1;
      byIndex[idx] = m.sum;
    } else if (idx === currentIdx) {
      const mf = computeMonthForecast(allRows, m.ym, key, method);
      if (mf) {
        soFarThisFY += mf.actualSum;
        forecastRemaining += mf.forecastSum;
        hasForecast = true;
        byIndex[idx] = mf.projectedTotal;
      } else {
        soFarThisFY += m.sum;
        byIndex[idx] = m.sum;
      }
      matchedPrevYm.push(m.prevYm);
      monthsElapsed += 1;
    }
  });
  const soFarLastFYSum = sumMetric(allRows.filter(r => matchedPrevYm.includes(r.date.slice(0, 7))), key);
  const ratio = soFarLastFYSum > 0 ? soFarThisFY / soFarLastFYSum : 1;
  const paceAvgPerMonth = monthsElapsed > 0 ? soFarThisFY / monthsElapsed : 0;
  const futureMonths = monthly.filter((m, idx) => idx > currentIdx);
  if (futureMonths.length > 0) hasForecast = true;
  let futureSum = 0;
  monthly.forEach((m, idx) => {
    if (idx <= currentIdx) return;
    let est;
    if (method === "seasonal") {
      const lySum = sumMetric(allRows.filter(r => r.date.startsWith(m.prevYm)), key);
      est = lySum * ratio;
    } else if (method === "regression") {
      est = 0;
      for (let d = 1; d <= m.dim; d++) {
        const md = `${m.ym.slice(5)}-${String(d).padStart(2, "0")}`;
        const t = historicalAvgTempForCalendarDay(allRows, md);
        est += t != null ? Math.max(0, reg.slope * t + reg.intercept) : paceAvgPerMonth / m.dim;
      }
    } else {
      est = paceAvgPerMonth;
    }
    est = Math.max(0, est);
    byIndex[idx] = est;
    futureSum += est;
  });
  return {
    monthly,
    currentIdx,
    byIndex,
    soFarThisFY,
    forecastRemaining: forecastRemaining + futureSum,
    projectedTotal: soFarThisFY + forecastRemaining + futureSum,
    hasForecast
  };
}

// ============================================================
// Chart.js 設定ビルダー
// ============================================================
function axisIdForUnit(unit, unitOrder) {
  if (!unitOrder.includes(unit)) unitOrder.push(unit);
  const idx = unitOrder.indexOf(unit);
  return idx === 0 ? "y" : "y1";
}
function buildScales(unitOrder) {
  const scales = {
    y: {
      type: "linear",
      position: "left",
      title: {
        display: true,
        text: unitOrder[0] || ""
      }
    }
  };
  if (unitOrder[1]) {
    scales.y1 = {
      type: "linear",
      position: "right",
      title: {
        display: true,
        text: unitOrder[1]
      },
      grid: {
        drawOnChartArea: false
      }
    };
  }
  return scales;
}
function buildMainChartConfig(opts) {
  const {
    view,
    buckets,
    chartType,
    selectedMetrics,
    showForecast,
    forecastMethod,
    dayTypeColoring,
    holidayMap,
    compareEnabled,
    allRows
  } = opts;
  const metrics = selectedMetrics;
  const unitOrder = [];
  const isBar = chartType === "bar" || chartType === "stackedBar";
  const stacked = chartType === "stackedBar";
  if (chartType === "scatter") {
    const yKey = metrics.find(m => m !== "tempAvg") || metrics[0];
    const meta = METRICS[yKey];
    const points = buckets.rows.filter(r => r.tempAvg != null && r[yKey] != null).map(r => ({
      x: r.tempAvg,
      y: r[yKey],
      _date: r.date,
      _type: classifyDay(r.date, holidayMap)
    }));
    const colors = dayTypeColoring ? points.map(p => DAY_TYPE_COLOR[p._type]) : meta.color;
    return {
      type: "scatter",
      data: {
        datasets: [{
          label: `${meta.label} (${meta.unit})`,
          data: points,
          backgroundColor: colors,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: {
              display: true,
              text: "外気温度(平均) ℃"
            }
          },
          y: {
            title: {
              display: true,
              text: `${meta.label} (${meta.unit})`
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: c => `${c.raw._date}: ${fmtNum(c.raw.y, 1)} ${meta.unit} (${fmtNum(c.raw.x, 1)}℃)`
            }
          }
        }
      }
    };
  }
  const labels = buckets.labels;
  const datasets = [];
  const dayTypeActive = dayTypeColoring && view === "day" && metrics.length === 1;
  const dayTypePointColors = dayTypeActive ? buckets.dateKeys.map(d => d ? DAY_TYPE_COLOR[classifyDay(d, holidayMap)] : null) : null;
  const pushForecastDataset = (key, meta, axisId) => {
    if (!(showForecast && view !== "year" && FORECASTABLE.includes(key))) return;
    const fc = buckets.forecast && buckets.forecast[key];
    if (!fc) return;
    const fcValues = buckets.current.map((rows, i) => fc.byIndex[i] != null ? fc.byIndex[i] : null);
    datasets.push({
      label: `${meta.label}（予測）`,
      data: fcValues,
      borderColor: meta.color,
      borderDash: [5, 5],
      backgroundColor: "transparent",
      yAxisID: axisId,
      tension: 0.25,
      spanGaps: true,
      pointStyle: "triangle"
    });
  };
  if (compareEnabled) {
    metrics.forEach(key => {
      const meta = METRICS[key];
      const axisId = axisIdForUnit(meta.unit, unitOrder);
      datasets.push({
        label: `${meta.label} 今期`,
        data: buckets.current.map(rows => rows.length ? aggMetric(rows, key) : null),
        borderColor: meta.color,
        backgroundColor: dayTypeActive ? dayTypePointColors : meta.color + "55",
        pointBackgroundColor: dayTypeActive ? dayTypePointColors : meta.color,
        pointRadius: dayTypeActive ? 5 : 3,
        yAxisID: axisId,
        tension: 0.25,
        spanGaps: true
      });
      datasets.push({
        label: `${meta.label} 前期`,
        data: buckets.previous.map(rows => rows.length ? aggMetric(rows, key) : null),
        borderColor: meta.color,
        backgroundColor: meta.color + "22",
        borderDash: [4, 4],
        yAxisID: axisId,
        tension: 0.25,
        spanGaps: true
      });
      pushForecastDataset(key, meta, axisId);
    });
  } else {
    metrics.forEach(key => {
      const meta = METRICS[key];
      const axisId = axisIdForUnit(meta.unit, unitOrder);
      const values = buckets.current.map(rows => rows.length ? aggMetric(rows, key) : null);
      const pointColors = dayTypeActive ? dayTypePointColors : meta.color;
      datasets.push({
        label: `${meta.label} (${meta.unit})`,
        data: values,
        borderColor: meta.color,
        backgroundColor: isBar ? Array.isArray(pointColors) ? pointColors : meta.color + "aa" : meta.color + "33",
        pointBackgroundColor: pointColors,
        pointRadius: dayTypeActive ? 5 : 3,
        yAxisID: axisId,
        tension: 0.25,
        spanGaps: true,
        stack: stacked ? "stack1" : undefined
      });
      pushForecastDataset(key, meta, axisId);
    });
  }
  return {
    type: isBar ? "bar" : "line",
    data: {
      labels,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: stacked ? {
        x: {
          stacked: true
        },
        y: {
          stacked: true,
          title: {
            display: true,
            text: unitOrder[0] || ""
          }
        }
      } : {
        x: {},
        ...buildScales(unitOrder)
      },
      plugins: {
        legend: {
          position: "bottom"
        }
      },
      interaction: {
        mode: "index",
        intersect: false
      }
    }
  };
}

// ============================================================
// バケット構築（日/月/年ビュー共通のデータ整形）
// ============================================================
function buildDayViewBuckets(allRows, ym) {
  const dim = daysInMonth(ym);
  const dateKeys = [];
  const labels = [];
  for (let d = 1; d <= dim; d++) {
    dateKeys.push(`${ym}-${String(d).padStart(2, "0")}`);
    labels.push(`${d}日`);
  }
  const byDate = {};
  allRows.filter(r => r.date.startsWith(ym)).forEach(r => {
    byDate[r.date] = r;
  });
  const current = dateKeys.map(d => byDate[d] ? [byDate[d]] : []);
  const [y, m] = ym.split("-").map(Number);
  const prevYm = `${y - 1}-${String(m).padStart(2, "0")}`;
  const prevByDate = {};
  allRows.filter(r => r.date.startsWith(prevYm)).forEach(r => {
    prevByDate[Number(r.date.split("-")[2])] = r;
  });
  const previous = dateKeys.map((d, i) => {
    const pr = prevByDate[i + 1];
    return pr ? [pr] : [];
  });
  return {
    labels,
    current,
    previous,
    dateKeys,
    rows: allRows.filter(r => r.date.startsWith(ym))
  };
}
function buildMonthViewBuckets(allRows, fy) {
  const monthKeys = fiscalMonthKeys(fy);
  const prevMonthKeys = fiscalMonthKeys(fy - 1);
  const current = monthKeys.map(ym => allRows.filter(r => r.date.startsWith(ym)));
  const previous = prevMonthKeys.map(ym => allRows.filter(r => r.date.startsWith(ym)));
  return {
    labels: FM_LABELS,
    current,
    previous,
    dateKeys: monthKeys,
    rows: allRows.filter(r => fiscalYear(r.date) === fy)
  };
}
function buildYearViewBuckets(allRows) {
  const fys = Array.from(new Set(allRows.map(r => fiscalYear(r.date)))).sort((a, b) => a - b);
  const current = fys.map(fy => allRows.filter(r => fiscalYear(r.date) === fy));
  return {
    labels: fys.map(fy => `${fy}年度`),
    current,
    previous: [],
    dateKeys: fys,
    rows: allRows,
    fys
  };
}

// グラフごとに異なる予測方式・対象項目を指定できるよう、予測計算はバケット構築と分離する
function computeForecastMap(allRows, view, selectedYm, selectedFY, forecastMethod, forecastMetrics) {
  const forecast = {};
  if (view === "day") {
    forecastMetrics.forEach(key => {
      const mf = computeMonthForecast(allRows, selectedYm, key, forecastMethod);
      if (mf) {
        const byIndex = {};
        mf.forecastPoints.forEach(p => {
          const day = Number(p.date.split("-")[2]);
          byIndex[day - 1] = p.value;
        });
        forecast[key] = {
          byIndex,
          summary: mf
        };
      }
    });
  } else if (view === "month") {
    forecastMetrics.forEach(key => {
      const ff = computeFiscalYearForecast(allRows, selectedFY, key, forecastMethod, allRows.length ? allRows[allRows.length - 1].date : null);
      if (ff && ff.hasForecast) {
        const byIndex = {};
        ff.monthly.forEach((m, i) => {
          if (i >= ff.currentIdx) byIndex[i] = ff.byIndex[i];
        });
        forecast[key] = {
          byIndex,
          summary: ff
        };
      }
    });
  }
  return forecast;
}

// ============================================================
// Chart キャンバス（マウント時に一度だけ構築、key変更で再構築）
// ============================================================
function ChartCanvas({
  getConfig,
  height
}) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current) return undefined;
    const chart = new Chart(canvasRef.current.getContext("2d"), getConfig());
    return () => chart.destroy();
  }, []);
  return /*#__PURE__*/React.createElement("canvas", {
    ref: canvasRef,
    height: height || 320
  });
}

// ============================================================
// UI パーツ
// ============================================================
function KPICard({
  label,
  current,
  previous,
  unit,
  pct,
  highlight,
  onClick,
  active
}) {
  const Tag = onClick ? "button" : "div";
  const increase = previous != null && pct > 0;
  return /*#__PURE__*/React.createElement(Tag, {
    className: "kpi-card" + (onClick ? " clickable" : "") + (active ? " active" : "") + (increase ? " increase" : ""),
    onClick: onClick
  }, /*#__PURE__*/React.createElement("div", {
    className: "kpi-label"
  }, label), /*#__PURE__*/React.createElement("div", {
    className: "kpi-value"
  }, fmtNum(current, current < 100 ? 1 : 0), " ", /*#__PURE__*/React.createElement("span", {
    className: "kpi-unit"
  }, unit)), previous != null && /*#__PURE__*/React.createElement("div", {
    className: "kpi-delta " + (pct > 0 ? "up" : pct < 0 ? "down" : "")
  }, "\u524D\u671F\u6BD4 ", fmtPct(pct), " ", /*#__PURE__*/React.createElement("span", {
    className: "kpi-prev"
  }, "(\u524D\u671F ", fmtNum(previous, 0), unit, ")")), highlight && /*#__PURE__*/React.createElement("div", {
    className: "kpi-highlight"
  }, highlight));
}
function MetricSelector({
  selected,
  onChange,
  compact
}) {
  const toggle = key => {
    if (selected.includes(key)) onChange(selected.filter(k => k !== key));else onChange([...selected, key]);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "metric-selector" + (compact ? " compact" : "")
  }, METRIC_GROUPS.map(g => /*#__PURE__*/React.createElement("div", {
    className: "metric-group",
    key: g
  }, /*#__PURE__*/React.createElement("div", {
    className: "metric-group-title"
  }, g), Object.keys(METRICS).filter(k => METRICS[k].group === g).map(k => /*#__PURE__*/React.createElement("label", {
    className: "metric-chip",
    key: k,
    style: selected.includes(k) ? {
      borderColor: METRICS[k].color,
      background: METRICS[k].color + "1a"
    } : {}
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: selected.includes(k),
    onChange: () => toggle(k)
  }), METRICS[k].label)))));
}
function ChartSettingsModal({
  name,
  onNameChange,
  chartType,
  onChartTypeChange,
  selected,
  onSelectedChange,
  onDelete,
  onClose
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "modal-backdrop",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("h3", null, "\u30B0\u30E9\u30D5\u8A2D\u5B9A"), /*#__PURE__*/React.createElement("div", {
    className: "form-row"
  }, /*#__PURE__*/React.createElement("label", null, "\u30B0\u30E9\u30D5\u540D"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: name,
    onChange: e => onNameChange(e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "chart-settings-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "control-title"
  }, "\u30B0\u30E9\u30D5\u7A2E\u5225"), /*#__PURE__*/React.createElement("div", {
    className: "chart-type-buttons"
  }, CHART_TYPE_OPTIONS.map(([v, l]) => /*#__PURE__*/React.createElement("button", {
    key: v,
    className: "btn btn-small" + (chartType === v ? " active" : ""),
    onClick: () => onChartTypeChange(v)
  }, l)))), /*#__PURE__*/React.createElement("div", {
    className: "chart-settings-section chart-settings-metrics"
  }, /*#__PURE__*/React.createElement("div", {
    className: "control-title"
  }, "\u8868\u793A\u9805\u76EE"), /*#__PURE__*/React.createElement(MetricSelector, {
    selected: selected,
    onChange: onSelectedChange,
    compact: true
  })), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, onDelete && /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost-red",
    onClick: onDelete
  }, "\u3053\u306E\u30B0\u30E9\u30D5\u3092\u524A\u9664"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: onClose
  }, "\u9589\u3058\u308B"))));
}
function SettingsModal({
  settings,
  onSave,
  onClose,
  onExportBackup,
  onImportBackup,
  autoSaveSupported,
  autoSaveFileName,
  autoSaveStatus,
  needsReauth,
  onConnectAutoSave,
  onReauthorizeAutoSave,
  onDisconnectAutoSave
}) {
  const [form, setForm] = useState(settings);
  const [backupStatus, setBackupStatus] = useState("");
  const handleImportFile = file => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const parsed = JSON.parse(e.target.result);
        onImportBackup(parsed);
        setBackupStatus("復元しました。");
      } catch (err) {
        setBackupStatus("エラー: " + err.message);
      }
    };
    reader.readAsText(file);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "modal-backdrop",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("h3", null, "\u8A2D\u5B9A"), /*#__PURE__*/React.createElement("p", {
    className: "modal-note"
  }, "\u4E0B\u8A18\u306F\u4E00\u822C\u7684\u306A\u76EE\u5B89\u5024\u3067\u3059\u3002\u65BD\u8A2D\u306E\u5951\u7D04\u5185\u5BB9\u30FB\u71C3\u6599\u4ED5\u69D8\u306B\u5408\u308F\u305B\u3066\u7DE8\u96C6\u3057\u3066\u304F\u3060\u3055\u3044\u3002"), /*#__PURE__*/React.createElement("div", {
    className: "form-row"
  }, /*#__PURE__*/React.createElement("label", null, "\u5951\u7D04\u96FB\u529B (kW)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: form.contractKW,
    onChange: e => setForm({
      ...form,
      contractKW: Number(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-row"
  }, /*#__PURE__*/React.createElement("label", null, "\u91CD\u6CB9\u767A\u71B1\u91CF (MJ/L)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: form.oilCalorificMJperL,
    onChange: e => setForm({
      ...form,
      oilCalorificMJperL: Number(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-row"
  }, /*#__PURE__*/React.createElement("label", null, "\u96FB\u529B\u63DB\u7B97\u4FC2\u6570 (MJ/kWh)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: form.elecMJperKWh,
    onChange: e => setForm({
      ...form,
      elecMJperKWh: Number(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-row"
  }, /*#__PURE__*/React.createElement("label", null, "\u96FB\u529BCO2\u6392\u51FA\u4FC2\u6570 (kg-CO2/kWh)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    step: "0.001",
    value: form.elecCO2PerKWh,
    onChange: e => setForm({
      ...form,
      elecCO2PerKWh: Number(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-row"
  }, /*#__PURE__*/React.createElement("label", null, "\u91CD\u6CB9CO2\u6392\u51FA\u4FC2\u6570 (kg-CO2/L)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    step: "0.01",
    value: form.oilCO2PerL,
    onChange: e => setForm({
      ...form,
      oilCO2PerL: Number(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-row"
  }, /*#__PURE__*/React.createElement("label", null, "\u539F\u6CB9\u63DB\u7B97\u4FC2\u6570 (GJ/kL)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    step: "0.1",
    value: form.crudeOilGJperKL,
    onChange: e => setForm({
      ...form,
      crudeOilGJperKL: Number(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-row"
  }, /*#__PURE__*/React.createElement("label", null, "\u5E74\u5EA6\u76EE\u6A19 \u53D7\u96FB\u96FB\u529B\u91CF (kWh)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: form.targetElecKWh || 0,
    onChange: e => setForm({
      ...form,
      targetElecKWh: Number(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-row"
  }, /*#__PURE__*/React.createElement("label", null, "\u5E74\u5EA6\u76EE\u6A19 \u91CD\u6CB9\u4F7F\u7528\u91CF (L)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: form.targetOilL || 0,
    onChange: e => setForm({
      ...form,
      targetOilL: Number(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("p", {
    className: "modal-note"
  }, "\u5E74\u5EA6\u76EE\u6A19\u306F\u300C\u5206\u6790\u300D\u753B\u9762\u306E\u76EE\u6A19\u6BD4\u8F03\u3067\u4F7F\u7528\u3057\u307E\u3059\uFF080\u306E\u307E\u307E\u306A\u3089\u76EE\u6A19\u672A\u8A2D\u5B9A\u3068\u3057\u3066\u6271\u3044\u307E\u3059\uFF09\u3002"), /*#__PURE__*/React.createElement("div", {
    className: "form-row"
  }, /*#__PURE__*/React.createElement("label", null, "\u7570\u5E38\u5024\u691C\u77E5\u306E\u3057\u304D\u3044\u5024 (\u03C3)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    step: "0.1",
    min: "0.5",
    value: form.anomalySigmaThreshold,
    onChange: e => setForm({
      ...form,
      anomalySigmaThreshold: Number(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-row"
  }, /*#__PURE__*/React.createElement("label", null, "\u30C7\u30DE\u30F3\u30C9\u8B66\u544A\u306E\u3057\u304D\u3044\u5024 (\u5951\u7D04\u6BD4%)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    step: "1",
    value: form.demandAlertPct,
    onChange: e => setForm({
      ...form,
      demandAlertPct: Number(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("p", {
    className: "modal-note"
  }, "\u3053\u308C\u3089\u306F\u300C\u5206\u6790\u300D\u753B\u9762\u306E\u7570\u5E38\u5024\u691C\u77E5\u3068\u3001\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u306E\u6CE8\u610F\u4E8B\u9805\u30D0\u30CA\u30FC\u306E\u611F\u5EA6\u306B\u4F7F\u308F\u308C\u307E\u3059\u3002\u6570\u5024\u3092\u5C0F\u3055\u304F\u3059\u308B\u307B\u3069\u691C\u77E5\u3057\u3084\u3059\u304F\u306A\u308A\u307E\u3059\u3002"), /*#__PURE__*/React.createElement("div", {
    className: "form-row"
  }, /*#__PURE__*/React.createElement("label", null, "\u96FB\u529B\u5358\u4FA1 (\u5186/kWh)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    step: "0.1",
    value: form.elecPricePerKWh,
    onChange: e => setForm({
      ...form,
      elecPricePerKWh: Number(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-row"
  }, /*#__PURE__*/React.createElement("label", null, "\u91CD\u6CB9\u5358\u4FA1 (\u5186/L)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    step: "1",
    value: form.oilPricePerL,
    onChange: e => setForm({
      ...form,
      oilPricePerL: Number(e.target.value)
    })
  })), /*#__PURE__*/React.createElement("p", {
    className: "modal-note"
  }, "\u6982\u7B97\u30B3\u30B9\u30C8\u306E\u8A08\u7B97\u306B\u4F7F\u7528\u3057\u307E\u3059\u3002\u5B9F\u969B\u306E\u5951\u7D04\u5358\u4FA1\u306B\u5408\u308F\u305B\u3066\u7DE8\u96C6\u3057\u3066\u304F\u3060\u3055\u3044\uFF08\u76EE\u5B89\u5024\u3067\u3059\uFF09\u3002"), /*#__PURE__*/React.createElement("div", {
    className: "settings-backup-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "control-title"
  }, "\u30C7\u30FC\u30BF\u306E\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7/\u5FA9\u5143"), /*#__PURE__*/React.createElement("p", {
    className: "modal-note"
  }, "\u5168\u30C7\u30FC\u30BF\u30FB\u8A2D\u5B9A\u30921\u3064\u306E\u30D5\u30A1\u30A4\u30EB\u306B\u4FDD\u5B58\u3057\u3001\u5225\u306E\u7AEF\u672B\u3084\u30D6\u30E9\u30A6\u30B6\u3067\u3082\u5FA9\u5143\u3067\u304D\u307E\u3059\u3002"), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions",
    style: {
      justifyContent: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn",
    onClick: onExportBackup
  }, "\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u3092\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9"), /*#__PURE__*/React.createElement("label", {
    className: "btn backup-file-label"
  }, "\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u304B\u3089\u5FA9\u5143", /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "application/json",
    style: {
      display: "none"
    },
    onChange: e => e.target.files[0] && handleImportFile(e.target.files[0])
  }))), backupStatus && /*#__PURE__*/React.createElement("div", {
    className: "modal-status"
  }, backupStatus)), /*#__PURE__*/React.createElement("div", {
    className: "settings-backup-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "control-title"
  }, "\u30ED\u30FC\u30AB\u30EB\u30D5\u30A1\u30A4\u30EB\u3078\u306E\u81EA\u52D5\u4FDD\u5B58"), !autoSaveSupported ? /*#__PURE__*/React.createElement("p", {
    className: "modal-note"
  }, "\u3053\u306E\u30D6\u30E9\u30A6\u30B6\u306F\u5BFE\u5FDC\u3057\u3066\u3044\u307E\u305B\u3093\uFF08Chrome/Edge\u63A8\u5968\uFF09\u3002") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    className: "modal-note"
  }, "PC\u5185\u306E\u30D5\u30A1\u30A4\u30EB\u30921\u3064\u9078\u3076\u3068\u3001\u4EE5\u5F8C\u30C7\u30FC\u30BF\u30FB\u8A2D\u5B9A\u30FB\u30E1\u30E2\u3092\u5909\u66F4\u3059\u308B\u305F\u3073\u306B\u81EA\u52D5\u3067\u305D\u306E\u30D5\u30A1\u30A4\u30EB\u3078 \u4E0A\u66F8\u304D\u4FDD\u5B58\u3057\u307E\u3059\u3002localStorage\u3068\u306F\u5225\u306B\u3001\u7AEF\u672B\u4E0A\u306E\u30D5\u30A1\u30A4\u30EB\u3068\u3057\u3066\u6B8B\u305B\u307E\u3059\u3002"), needsReauth ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "modal-status"
  }, "\u300C", autoSaveFileName, "\u300D\u3078\u306E\u81EA\u52D5\u4FDD\u5B58\u304C\u4E00\u6642\u505C\u6B62\u3057\u3066\u3044\u307E\u3059\uFF08\u518D\u5EA6\u8A31\u53EF\u304C\u5FC5\u8981\u3067\u3059\uFF09\u3002"), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions",
    style: {
      justifyContent: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn",
    onClick: onReauthorizeAutoSave
  }, "\u518D\u9023\u643A\u3059\u308B"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost-red",
    onClick: onDisconnectAutoSave
  }, "\u9023\u643A\u3092\u89E3\u9664"))) : autoSaveFileName ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "modal-status"
  }, "\u81EA\u52D5\u4FDD\u5B58\u5148: \u300C", autoSaveFileName, "\u300D", autoSaveStatus && ` / ${autoSaveStatus}`), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions",
    style: {
      justifyContent: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost-red",
    onClick: onDisconnectAutoSave
  }, "\u9023\u643A\u3092\u89E3\u9664"))) : /*#__PURE__*/React.createElement("div", {
    className: "modal-actions",
    style: {
      justifyContent: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn",
    onClick: onConnectAutoSave
  }, "\u30D5\u30A1\u30A4\u30EB\u3092\u9078\u629E\u3057\u3066\u81EA\u52D5\u4FDD\u5B58\u3092\u958B\u59CB")))), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn",
    onClick: onClose
  }, "\u30AD\u30E3\u30F3\u30BB\u30EB"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: () => {
      onSave(form);
      onClose();
    }
  }, "\u4FDD\u5B58"))));
}
const ENTRY_FIELDS = [{
  key: "tempAvg",
  label: "外気温度(平均)",
  unit: "℃",
  step: "0.1",
  digits: 1
}, {
  key: "humidityAvg",
  label: "外気湿度(平均)",
  unit: "%RH",
  step: "1",
  digits: 0
}, {
  key: "coolLoadGJ",
  label: "冷水負荷",
  unit: "GJ",
  step: "0.01",
  digits: 2
}, {
  key: "heatLoadGJ",
  label: "温水負荷",
  unit: "GJ",
  step: "0.01",
  digits: 2
}, {
  key: "elecKWh",
  label: "受電電力量",
  unit: "kWh",
  step: "1",
  digits: 0
}, {
  key: "oilChiller1L",
  label: "重油(冷温水発生器No.1)",
  unit: "L",
  step: "0.1",
  digits: 1
}, {
  key: "oilChiller2L",
  label: "重油(冷温水発生器No.2)",
  unit: "L",
  step: "0.1",
  digits: 1
}, {
  key: "oilBoiler1L",
  label: "重油(ボイラーNo.1)",
  unit: "L",
  step: "0.1",
  digits: 1
}, {
  key: "oilBoiler2L",
  label: "重油(ボイラーNo.2)",
  unit: "L",
  step: "0.1",
  digits: 1
}];
const ENTRY_LIST_COLUMNS = [...ENTRY_FIELDS.map(f => ({
  ...f,
  calc: false
})), {
  key: "oilChillerTotalL",
  label: "重油(冷温水発生器 計)",
  unit: "L",
  digits: 1,
  calc: true
}, {
  key: "oilBoilerTotalL",
  label: "重油(ボイラー 計)",
  unit: "L",
  digits: 1,
  calc: true
}, {
  key: "oilTotalL",
  label: "重油使用量(合計)",
  unit: "L",
  digits: 1,
  calc: true
}, {
  key: "totalLoadGJ",
  label: "負荷熱量(合計)",
  unit: "GJ",
  digits: 2,
  calc: true
}, {
  key: "demandKW",
  label: "日平均電力(簡易デマンド)",
  unit: "kW",
  digits: 1,
  calc: true
}, {
  key: "efficiencyPct",
  label: "総合熱源効率",
  unit: "%",
  digits: 1,
  calc: true
}, {
  key: "co2T",
  label: "CO2排出量",
  unit: "t-CO2",
  digits: 3,
  calc: true
}, {
  key: "crudeOilKL",
  label: "原油換算値",
  unit: "kL",
  digits: 3,
  calc: true
}, {
  key: "costYen",
  label: "概算コスト",
  unit: "円",
  digits: 0,
  calc: true
}];
function downloadEntryListCsv(ym, cells, dataByDate) {
  const header = ["日付", ...ENTRY_LIST_COLUMNS.map(c => `${c.label}(${c.unit})`)];
  const rows = cells.filter(c => c).map(dateStr => {
    const rec = dataByDate[dateStr];
    return [dateStr, ...ENTRY_LIST_COLUMNS.map(col => rec && rec[col.key] != null ? rec[col.key] : "")];
  });
  const csv = [header, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], {
    type: "text/csv;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `energy-data-${ym}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
function downloadChartCanvasImage(toolbarEl, filename) {
  const wrap = toolbarEl && toolbarEl.nextElementSibling;
  const canvas = wrap && wrap.querySelector("canvas");
  if (!canvas) return;
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}
function emptyEntryForm() {
  const f = {};
  ENTRY_FIELDS.forEach(fld => {
    f[fld.key] = "";
  });
  return f;
}
function formFromRecord(record) {
  const f = {};
  ENTRY_FIELDS.forEach(fld => {
    f[fld.key] = record && record[fld.key] != null ? String(record[fld.key]) : "";
  });
  return f;
}
const NON_NEGATIVE_FIELDS = ["coolLoadGJ", "heatLoadGJ", "elecKWh", "oilChiller1L", "oilChiller2L", "oilBoiler1L", "oilBoiler2L"];
const DEVIATION_CHECK_FIELDS = ["coolLoadGJ", "heatLoadGJ", "elecKWh"];
function validateEntry(form, previousRecord) {
  const errors = [];
  const warnings = [];
  const num = k => parseFloat(form[k]);
  if (form.humidityAvg !== "" && !isNaN(num("humidityAvg")) && (num("humidityAvg") < 0 || num("humidityAvg") > 100)) {
    errors.push("外気湿度(平均)は0〜100の範囲で入力してください。");
  }
  NON_NEGATIVE_FIELDS.forEach(k => {
    const v = num(k);
    if (form[k] !== "" && !isNaN(v) && v < 0) {
      const label = ENTRY_FIELDS.find(f => f.key === k).label;
      errors.push(`${label}はマイナスの値にできません。`);
    }
  });
  if (previousRecord) {
    DEVIATION_CHECK_FIELDS.forEach(k => {
      const prev = previousRecord[k];
      const cur = num(k);
      if (prev != null && prev > 0 && form[k] !== "" && !isNaN(cur)) {
        const ratio = cur / prev;
        if (ratio >= 3 || ratio <= 0.33) {
          const label = ENTRY_FIELDS.find(f => f.key === k).label;
          warnings.push(`${label}が前日の${ratio.toFixed(1)}倍です。入力ミスがないかご確認ください。`);
        }
      }
    });
  }
  return {
    errors,
    warnings
  };
}
function DayEntryForm({
  date,
  record,
  previousDate,
  previousRecord,
  weekAgoRecord,
  note,
  onSaveNote,
  onSave,
  onDelete,
  onNextDay
}) {
  const [form, setForm] = useState(() => formFromRecord(record));
  const [saved, setSaved] = useState(false);
  const [noteText, setNoteText] = useState(note || "");
  const [noteSaved, setNoteSaved] = useState(false);
  useEffect(() => {
    setForm(formFromRecord(record));
    setSaved(false);
    setNoteText(note || "");
    setNoteSaved(false);
  }, [date]);
  const num = k => {
    const v = parseFloat(form[k]);
    return isNaN(v) ? 0 : v;
  };
  const oilChillerTotal = num("oilChiller1L") + num("oilChiller2L");
  const oilBoilerTotal = num("oilBoiler1L") + num("oilBoiler2L");
  const oilTotal = oilChillerTotal + oilBoilerTotal;
  const handleChange = (k, v) => {
    setForm({
      ...form,
      [k]: v
    });
    setSaved(false);
  };
  const validation = useMemo(() => validateEntry(form, previousRecord), [form, previousRecord]);
  const handleSave = () => {
    if (validation.errors.length > 0) return false;
    const rec = {
      date
    };
    ENTRY_FIELDS.forEach(fld => {
      const v = parseFloat(form[fld.key]);
      rec[fld.key] = isNaN(v) ? null : v;
    });
    rec.oilChillerTotalL = oilChillerTotal;
    rec.oilBoilerTotalL = oilBoilerTotal;
    rec.oilTotalL = oilTotal;
    onSave(rec);
    setSaved(true);
    return true;
  };
  const handleDelete = () => {
    onDelete(date);
    setForm(emptyEntryForm());
    setSaved(false);
  };
  const handleCopyPrevious = () => {
    if (!previousRecord) return;
    setForm(formFromRecord(previousRecord));
    setSaved(false);
  };
  const handleSaveNote = () => {
    onSaveNote(date, noteText);
    setNoteSaved(true);
  };
  const handleInputKeyDown = e => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (handleSave() && onNextDay) onNextDay();
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "entry-form"
  }, /*#__PURE__*/React.createElement("div", {
    className: "entry-form-title-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "entry-form-title"
  }, date, " \u306E\u5B9F\u7E3E\u5165\u529B"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-small",
    onClick: handleCopyPrevious,
    disabled: !previousRecord
  }, "\u524D\u65E5\u306E\u5024\u3092\u30B3\u30D4\u30FC")), /*#__PURE__*/React.createElement("div", {
    className: "entry-form-prev-note"
  }, "\u524D\u65E5\uFF08", previousDate, "\uFF09\u5B9F\u7E3E", previousRecord ? "を右に表示しています" : "：データなし"), /*#__PURE__*/React.createElement("div", {
    className: "entry-form-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "entry-form-header-row"
  }, /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", {
    className: "entry-form-prev-head"
  }, "\u5148\u9031\u540C\u66DC\u65E5"), /*#__PURE__*/React.createElement("span", {
    className: "entry-form-prev-head"
  }, "\u524D\u65E5\u5B9F\u7E3E"), /*#__PURE__*/React.createElement("span", {
    className: "entry-form-input-head"
  }, "\u672C\u65E5\u306E\u5165\u529B")), ENTRY_FIELDS.map(fld => /*#__PURE__*/React.createElement("label", {
    key: fld.key,
    className: "entry-form-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "entry-form-label"
  }, fld.label), /*#__PURE__*/React.createElement("span", {
    className: "entry-form-prev-value"
  }, weekAgoRecord && weekAgoRecord[fld.key] != null ? `${fmtNum(weekAgoRecord[fld.key], fld.digits)} ${fld.unit}` : "-"), /*#__PURE__*/React.createElement("span", {
    className: "entry-form-prev-value"
  }, previousRecord && previousRecord[fld.key] != null ? `${fmtNum(previousRecord[fld.key], fld.digits)} ${fld.unit}` : "-"), /*#__PURE__*/React.createElement("span", {
    className: "entry-form-input-wrap"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    step: fld.step,
    value: form[fld.key],
    onChange: e => handleChange(fld.key, e.target.value),
    onKeyDown: handleInputKeyDown
  }), /*#__PURE__*/React.createElement("span", {
    className: "entry-form-unit"
  }, fld.unit))))), /*#__PURE__*/React.createElement("div", {
    className: "entry-form-computed"
  }, /*#__PURE__*/React.createElement("div", null, "\u91CD\u6CB9(\u51B7\u6E29\u6C34\u767A\u751F\u5668 \u8A08): ", /*#__PURE__*/React.createElement("b", null, fmtNum(oilChillerTotal, 1)), " L"), /*#__PURE__*/React.createElement("div", null, "\u91CD\u6CB9(\u30DC\u30A4\u30E9\u30FC \u8A08): ", /*#__PURE__*/React.createElement("b", null, fmtNum(oilBoilerTotal, 1)), " L"), /*#__PURE__*/React.createElement("div", null, "\u91CD\u6CB9\u4F7F\u7528\u91CF(\u5408\u8A08): ", /*#__PURE__*/React.createElement("b", null, fmtNum(oilTotal, 1)), " L")), validation.errors.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "entry-validation entry-validation-error"
  }, validation.errors.map((msg, i) => /*#__PURE__*/React.createElement("div", {
    key: i
  }, "\u26D4 ", msg))), validation.warnings.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "entry-validation entry-validation-warn"
  }, validation.warnings.map((msg, i) => /*#__PURE__*/React.createElement("div", {
    key: i
  }, "\u26A0 ", msg))), /*#__PURE__*/React.createElement("div", {
    className: "entry-form-actions"
  }, record && /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost-red",
    onClick: handleDelete
  }, "\u3053\u306E\u65E5\u306E\u30C7\u30FC\u30BF\u3092\u524A\u9664"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: handleSave,
    disabled: validation.errors.length > 0
  }, "\u4FDD\u5B58")), saved && /*#__PURE__*/React.createElement("div", {
    className: "entry-saved-msg"
  }, "\u4FDD\u5B58\u3057\u307E\u3057\u305F\uFF08Enter\u30AD\u30FC\u3067\u3082\u4FDD\u5B58\u3057\u3066\u7FCC\u65E5\u306B\u9032\u3081\u307E\u3059\uFF09"), /*#__PURE__*/React.createElement("div", {
    className: "entry-note-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "control-title"
  }, "\u30E1\u30E2\uFF08\u70B9\u691C\u30FB\u6A5F\u5668\u4EA4\u63DB\u306A\u3069\u306E\u8A18\u9332\u7528\uFF09"), /*#__PURE__*/React.createElement("textarea", {
    className: "entry-note-textarea",
    rows: 2,
    value: noteText,
    onChange: e => {
      setNoteText(e.target.value);
      setNoteSaved(false);
    },
    placeholder: "\u4F8B: \u51B7\u6E29\u6C34\u767A\u751F\u5668No.1 \u5B9A\u671F\u70B9\u691C\u5B9F\u65BD"
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-small",
    onClick: handleSaveNote
  }, "\u30E1\u30E2\u3092\u4FDD\u5B58"), noteSaved && /*#__PURE__*/React.createElement("span", {
    className: "entry-saved-msg entry-note-saved-msg"
  }, "\u4FDD\u5B58\u3057\u307E\u3057\u305F")));
}
function DataEntryView({
  data,
  onSave,
  onDelete,
  notes,
  onSaveNote
}) {
  const dataByDate = useMemo(() => {
    const m = {};
    data.forEach(r => {
      m[r.date] = r;
    });
    return m;
  }, [data]);
  const latestDate = data.length ? data[data.length - 1].date : null;
  const today = new Date();
  const defaultYm = latestDate ? latestDate.slice(0, 7) : `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [ym, setYm] = useState(defaultYm);
  const [selectedDate, setSelectedDate] = useState(latestDate || `${defaultYm}-01`);
  const [showNotesList, setShowNotesList] = useState(false);
  const [showMissingDays, setShowMissingDays] = useState(false);
  const missingDays = useMemo(() => {
    if (!data.length) return [];
    const known = new Set(data.map(r => r.date));
    const start = parseISO(data[0].date);
    const end = parseISO(data[data.length - 1].date);
    const missing = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!known.has(ds)) missing.push(ds);
    }
    return missing;
  }, [data]);
  const changeMonth = delta => {
    setYm(prevYm => {
      const [y, m] = prevYm.split("-").map(Number);
      const d = new Date(y, m - 1 + delta, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
  };
  const goToNextDay = () => {
    setSelectedDate(prev => {
      const next = addDays(prev, 1);
      setYm(next.slice(0, 7));
      return next;
    });
  };
  const dim = daysInMonth(ym);
  const [y, m] = ym.split("-").map(Number);
  const firstDow = new Date(y, m - 1, 1).getDay();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(`${ym}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7 !== 0) cells.push(null);
  const enteredCount = cells.filter(c => c && dataByDate[c]).length;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("section", {
    className: "entry-layout"
  }, /*#__PURE__*/React.createElement("div", {
    className: "entry-calendar-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "entry-cal-header"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-small",
    onClick: () => changeMonth(-1)
  }, "\u25C0 \u524D\u6708"), /*#__PURE__*/React.createElement("div", {
    className: "entry-cal-title"
  }, y, "\u5E74", m, "\u6708"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-small",
    onClick: () => changeMonth(1)
  }, "\u7FCC\u6708 \u25B6")), /*#__PURE__*/React.createElement("div", {
    className: "entry-cal-summary-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "entry-cal-summary"
  }, "\u5165\u529B\u6E08\u307F: ", enteredCount, " / ", dim, "\u65E5"), /*#__PURE__*/React.createElement("div", {
    className: "entry-cal-summary-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-small",
    onClick: () => setShowMissingDays(true)
  }, "\u672A\u5165\u529B\u65E5\u4E00\u89A7", missingDays.length > 0 && ` (${missingDays.length})`), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-small",
    onClick: () => setShowNotesList(true)
  }, "\uD83D\uDCDD \u30E1\u30E2\u4E00\u89A7"))), /*#__PURE__*/React.createElement("div", {
    className: "entry-cal-grid entry-cal-dow"
  }, ["日", "月", "火", "水", "木", "金", "土"].map(w => /*#__PURE__*/React.createElement("div", {
    key: w,
    className: "entry-cal-dow-cell"
  }, w))), /*#__PURE__*/React.createElement("div", {
    className: "entry-cal-grid"
  }, cells.map((dateStr, i) => {
    if (!dateStr) return /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "entry-cal-cell empty"
    });
    const has = !!dataByDate[dateStr];
    const hasNote = !!(notes && notes[dateStr]);
    const day = Number(dateStr.split("-")[2]);
    const isSelected = dateStr === selectedDate;
    const dow = i % 7;
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      className: "entry-cal-cell" + (has ? " has-data" : "") + (isSelected ? " selected" : "") + (dow === 0 ? " sun" : dow === 6 ? " sat" : ""),
      onClick: () => setSelectedDate(dateStr)
    }, /*#__PURE__*/React.createElement("span", {
      className: "entry-cal-day"
    }, day), hasNote && /*#__PURE__*/React.createElement("span", {
      className: "entry-cal-note-icon",
      title: notes[dateStr]
    }, "\uD83D\uDCDD"), has && /*#__PURE__*/React.createElement("span", {
      className: "entry-cal-dot"
    }));
  })), /*#__PURE__*/React.createElement("div", {
    className: "entry-cal-legend"
  }, /*#__PURE__*/React.createElement("span", {
    className: "legend-item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "entry-cal-dot standalone"
  }), "\u5165\u529B\u6E08\u307F"), /*#__PURE__*/React.createElement("span", {
    className: "legend-item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "entry-cal-dot standalone empty-dot"
  }), "\u672A\u5165\u529B"), /*#__PURE__*/React.createElement("span", {
    className: "legend-item"
  }, "\uD83D\uDCDD \u30E1\u30E2\u3042\u308A"))), /*#__PURE__*/React.createElement("div", {
    className: "entry-form-panel"
  }, selectedDate ? /*#__PURE__*/React.createElement(DayEntryForm, {
    key: selectedDate,
    date: selectedDate,
    record: dataByDate[selectedDate],
    previousDate: addDays(selectedDate, -1),
    previousRecord: dataByDate[addDays(selectedDate, -1)],
    weekAgoRecord: dataByDate[addDays(selectedDate, -7)],
    note: notes && notes[selectedDate],
    onSaveNote: onSaveNote,
    onSave: onSave,
    onDelete: onDelete,
    onNextDay: goToNextDay
  }) : /*#__PURE__*/React.createElement("div", {
    className: "empty-state"
  }, "\u65E5\u4ED8\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044"))), /*#__PURE__*/React.createElement("section", {
    className: "entry-list-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-title-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-title"
  }, y, "\u5E74", m, "\u6708 \u4E00\u89A7\uFF08\u8A08\u7B97\u9805\u76EE\u306F\u6C34\u8272\u80CC\u666F\uFF09"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-small",
    onClick: () => downloadEntryListCsv(ym, cells, dataByDate)
  }, "CSV\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9")), /*#__PURE__*/React.createElement("div", {
    className: "entry-list-scroll"
  }, /*#__PURE__*/React.createElement("table", {
    className: "entry-list-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "entry-list-datecol"
  }, "\u65E5\u4ED8"), ENTRY_LIST_COLUMNS.map(col => /*#__PURE__*/React.createElement("th", {
    key: col.key,
    className: col.calc ? "calc-col" : ""
  }, col.label, /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    className: "entry-list-unit"
  }, "(", col.unit, ")"))))), /*#__PURE__*/React.createElement("tbody", null, cells.filter(c => c).map(dateStr => {
    const rec = dataByDate[dateStr];
    const day = Number(dateStr.split("-")[2]);
    const isSelected = dateStr === selectedDate;
    return /*#__PURE__*/React.createElement("tr", {
      key: dateStr,
      className: isSelected ? "selected" : "",
      onClick: () => setSelectedDate(dateStr)
    }, /*#__PURE__*/React.createElement("td", {
      className: "entry-list-datecol"
    }, m, "/", day), ENTRY_LIST_COLUMNS.map(col => /*#__PURE__*/React.createElement("td", {
      key: col.key,
      className: col.calc ? "calc-col" : ""
    }, rec && rec[col.key] != null ? fmtNum(rec[col.key], col.digits) : "-")));
  }))))), showNotesList && /*#__PURE__*/React.createElement(NotesListModal, {
    notes: notes,
    onClose: () => setShowNotesList(false),
    onJumpToDate: dateStr => {
      setYm(dateStr.slice(0, 7));
      setSelectedDate(dateStr);
      setShowNotesList(false);
    }
  }), showMissingDays && /*#__PURE__*/React.createElement(MissingDaysModal, {
    missingDays: missingDays,
    onClose: () => setShowMissingDays(false),
    onJumpToDate: dateStr => {
      setYm(dateStr.slice(0, 7));
      setSelectedDate(dateStr);
      setShowMissingDays(false);
    }
  }));
}
function MissingDaysModal({
  missingDays,
  onClose,
  onJumpToDate
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "modal-backdrop",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("h3", null, "\u672A\u5165\u529B\u65E5\u4E00\u89A7"), /*#__PURE__*/React.createElement("p", {
    className: "modal-note"
  }, "\u30C7\u30FC\u30BF\u306E\u6700\u521D\u306E\u65E5\u304B\u3089\u6700\u5F8C\u306E\u65E5\u307E\u3067\u306E\u7BC4\u56F2\u3067\u3001\u8A18\u9332\u304C\u7121\u3044\u65E5\u3092\u4E00\u89A7\u8868\u793A\u3057\u3066\u3044\u307E\u3059\uFF08\u5168", missingDays.length, "\u65E5\uFF09\u3002"), missingDays.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "analysis-empty"
  }, "\u672A\u5165\u529B\u65E5\u306F\u3042\u308A\u307E\u305B\u3093\u3002") : /*#__PURE__*/React.createElement("div", {
    className: "notes-list"
  }, missingDays.map(dateStr => /*#__PURE__*/React.createElement("button", {
    key: dateStr,
    className: "notes-list-item missing-day-item",
    onClick: () => onJumpToDate(dateStr)
  }, /*#__PURE__*/React.createElement("div", {
    className: "notes-list-date"
  }, dateStr)))), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: onClose
  }, "\u9589\u3058\u308B"))));
}
function NotesListModal({
  notes,
  onClose,
  onJumpToDate
}) {
  const entries = Object.entries(notes || {}).sort((a, b) => a[0] < b[0] ? 1 : -1);
  return /*#__PURE__*/React.createElement("div", {
    className: "modal-backdrop",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("h3", null, "\u30E1\u30E2\u4E00\u89A7"), entries.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "analysis-empty"
  }, "\u307E\u3060\u30E1\u30E2\u304C\u3042\u308A\u307E\u305B\u3093\u3002") : /*#__PURE__*/React.createElement("div", {
    className: "notes-list"
  }, entries.map(([dateStr, text]) => /*#__PURE__*/React.createElement("button", {
    key: dateStr,
    className: "notes-list-item",
    onClick: () => onJumpToDate(dateStr)
  }, /*#__PURE__*/React.createElement("div", {
    className: "notes-list-date"
  }, dateStr), /*#__PURE__*/React.createElement("div", {
    className: "notes-list-text"
  }, text)))), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: onClose
  }, "\u9589\u3058\u308B"))));
}

// ============================================================
// 分析ビュー（原単位/異常検知/号機バランス/目標比較/ヒートマップ/CO2/デマンド）
// ============================================================
const ANALYSIS_METRIC_CHOICES = ["elecKWh", "oilTotalL", "coolLoadGJ", "heatLoadGJ", "efficiencyPct", "co2T", "crudeOilKL", "costYen"];
function AnalysisView({
  data,
  settings,
  darkMode,
  notes,
  onSaveNote
}) {
  const fiscalYears = useMemo(() => Array.from(new Set(data.map(r => fiscalYear(r.date)))).sort((a, b) => a - b), [data]);
  const [fy, setFy] = useState(() => fiscalYears[fiscalYears.length - 1]);
  const [anomalyMetric, setAnomalyMetric] = useState("elecKWh");
  const [heatmapMetric, setHeatmapMetric] = useState("elecKWh");
  const [overlayMetric, setOverlayMetric] = useState("elecKWh");
  const [overlayYears, setOverlayYears] = useState(() => fiscalYears.slice(-3));
  const [sensitivityMetric, setSensitivityMetric] = useState("elecKWh");
  const [weekdayMetric, setWeekdayMetric] = useState("elecKWh");
  const monthKeys = useMemo(() => fiscalMonthKeys(fy), [fy]);
  const fyRows = useMemo(() => data.filter(r => fiscalYear(r.date) === fy), [data, fy]);
  const prevFyRows = useMemo(() => data.filter(r => fiscalYear(r.date) === fy - 1), [data, fy]);
  const monthlyRows = useMemo(() => monthKeys.map(ym => data.filter(r => r.date.startsWith(ym))), [data, monthKeys]);
  const prevMonthlyRows = useMemo(() => fiscalMonthKeys(fy - 1).map(ym => data.filter(r => r.date.startsWith(ym))), [data, fy]);
  const byDate = useMemo(() => {
    const m = {};
    data.forEach(r => {
      m[r.date] = r;
    });
    return m;
  }, [data]);

  // 1. 原単位トレンド（月次）
  const intensityConfig = () => {
    const elec = monthlyRows.map(rows => {
      const load = sumMetric(rows, "totalLoadGJ");
      return load > 0 ? sumMetric(rows, "elecKWh") / load : null;
    });
    const oil = monthlyRows.map(rows => {
      const load = sumMetric(rows, "totalLoadGJ");
      return load > 0 ? sumMetric(rows, "oilTotalL") / load : null;
    });
    return {
      type: "line",
      data: {
        labels: FM_LABELS,
        datasets: [{
          label: "電力原単位 (kWh/GJ)",
          data: elec,
          borderColor: "#2563eb",
          backgroundColor: "#2563eb33",
          yAxisID: "y",
          tension: 0.25,
          spanGaps: true
        }, {
          label: "重油原単位 (L/GJ)",
          data: oil,
          borderColor: "#dc2626",
          backgroundColor: "#dc262633",
          yAxisID: "y1",
          tension: 0.25,
          spanGaps: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            position: "left",
            title: {
              display: true,
              text: "kWh/GJ"
            }
          },
          y1: {
            position: "right",
            title: {
              display: true,
              text: "L/GJ"
            },
            grid: {
              drawOnChartArea: false
            }
          }
        },
        plugins: {
          legend: {
            position: "bottom"
          }
        },
        interaction: {
          mode: "index",
          intersect: false
        }
      }
    };
  };

  // 2. 異常値検知（気温回帰から±2σ以上乖離した日）
  const anomaly = useMemo(() => {
    const meta = METRICS[anomalyMetric];
    const reg = buildRegression(data, anomalyMetric);
    // 温度・値が数値でない行(空欄や"-"など)が混ざるとσがNaNになるため、必ず数値のみで計算する
    const valid = r => r.tempAvg != null && r[anomalyMetric] != null && !isNaN(r.tempAvg) && !isNaN(r[anomalyMetric]);
    const pts = data.filter(valid);
    if (pts.length < 30) return {
      sd: 0,
      list: [],
      meta
    };
    const resids = pts.map(r => Number(r[anomalyMetric]) - (reg.slope * Number(r.tempAvg) + reg.intercept));
    const sd = Math.sqrt(resids.reduce((s, x) => s + x * x, 0) / resids.length);
    const list = fyRows.filter(valid).map(r => {
      const pred = reg.slope * Number(r.tempAvg) + reg.intercept;
      const resid = Number(r[anomalyMetric]) - pred;
      return {
        date: r.date,
        temp: r.tempAvg,
        actual: r[anomalyMetric],
        pred,
        sigma: sd > 0 ? resid / sd : 0
      };
    }).filter(x => Math.abs(x.sigma) >= (settings.anomalySigmaThreshold || 2)).sort((a, b) => Math.abs(b.sigma) - Math.abs(a.sigma)).slice(0, 15);
    return {
      sd,
      list,
      meta
    };
  }, [data, fyRows, anomalyMetric, settings.anomalySigmaThreshold]);

  // 3. 号機別稼働バランス
  const balanceConfig = () => {
    const keys = ["oilChiller1L", "oilChiller2L", "oilBoiler1L", "oilBoiler2L"];
    return {
      type: "doughnut",
      data: {
        labels: keys.map(k => METRICS[k].label),
        datasets: [{
          data: keys.map(k => sumMetric(fyRows, k)),
          backgroundColor: keys.map(k => METRICS[k].color)
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom"
          }
        }
      }
    };
  };

  // 4. 目標比較
  const targets = [{
    key: "elecKWh",
    label: "受電電力量",
    unit: "kWh",
    target: settings.targetElecKWh,
    actual: sumMetric(fyRows, "elecKWh")
  }, {
    key: "oilTotalL",
    label: "重油使用量",
    unit: "L",
    target: settings.targetOilL,
    actual: sumMetric(fyRows, "oilTotalL")
  }];

  // 5. カレンダーヒートマップ
  const heatmap = useMemo(() => {
    const meta = METRICS[heatmapMetric];
    let max = 0;
    fyRows.forEach(r => {
      const v = r[heatmapMetric];
      if (v != null && v > max) max = v;
    });
    const rows = monthKeys.map((ym, mi) => {
      const dim = daysInMonth(ym);
      const cells = [];
      for (let d = 1; d <= 31; d++) {
        if (d > dim) {
          cells.push(null);
          continue;
        }
        const dateStr = `${ym}-${String(d).padStart(2, "0")}`;
        const rec = byDate[dateStr];
        const v = rec ? rec[heatmapMetric] : null;
        cells.push({
          dateStr,
          v
        });
      }
      return {
        label: FM_LABELS[mi],
        cells
      };
    });
    return {
      rows,
      max,
      meta
    };
  }, [byDate, fyRows, monthKeys, heatmapMetric]);

  // 6. CO2トレンド（月次・前年度比較）
  const co2Of = rows => (sumMetric(rows, "elecKWh") * settings.elecCO2PerKWh + sumMetric(rows, "oilTotalL") * settings.oilCO2PerL) / 1000;
  const co2Config = () => ({
    type: "bar",
    data: {
      labels: FM_LABELS,
      datasets: [{
        label: `${fy}年度 (t-CO2)`,
        data: monthlyRows.map(rows => rows.length ? co2Of(rows) : null),
        backgroundColor: "#0f766eaa"
      }, {
        label: `${fy - 1}年度 (t-CO2)`,
        data: prevMonthlyRows.map(rows => rows.length ? co2Of(rows) : null),
        backgroundColor: "#94a3b8aa"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          title: {
            display: true,
            text: "t-CO2"
          }
        }
      },
      plugins: {
        legend: {
          position: "bottom"
        }
      }
    }
  });
  const co2TotalThis = co2Of(fyRows);
  const co2TotalPrev = prevFyRows.length ? co2Of(prevFyRows) : null;

  // 7. デマンド分析（日平均電力ベース）
  const demandConfig = () => {
    const labels = fyRows.map(r => r.date.slice(5));
    return {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "日平均電力 (kW)",
          data: fyRows.map(r => r.demandKW),
          borderColor: "#f59e0b",
          backgroundColor: "#f59e0b33",
          pointRadius: 0,
          borderWidth: 2,
          tension: 0.2
        }, {
          label: `契約電力 ${fmtNum(settings.contractKW, 0)} kW`,
          data: fyRows.map(() => settings.contractKW),
          borderColor: "#dc2626",
          borderDash: [6, 4],
          pointRadius: 0,
          borderWidth: 1.5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            ticks: {
              autoSkip: true,
              maxTicksLimit: 12
            }
          },
          y: {
            title: {
              display: true,
              text: "kW"
            }
          }
        },
        plugins: {
          legend: {
            position: "bottom"
          }
        },
        interaction: {
          mode: "index",
          intersect: false
        }
      }
    };
  };
  const demandHistogram = useMemo(() => {
    const bins = [{
      label: "〜60%",
      min: -Infinity,
      max: 60,
      count: 0
    }, {
      label: "60〜70%",
      min: 60,
      max: 70,
      count: 0
    }, {
      label: "70〜80%",
      min: 70,
      max: 80,
      count: 0
    }, {
      label: "80〜90%",
      min: 80,
      max: 90,
      count: 0
    }, {
      label: "90〜100%",
      min: 90,
      max: 100,
      count: 0
    }, {
      label: "100%以上",
      min: 100,
      max: Infinity,
      count: 0
    }];
    let over90 = 0,
      over100 = 0;
    fyRows.forEach(r => {
      if (!settings.contractKW) return;
      const pct = r.demandKW / settings.contractKW * 100;
      const bin = bins.find(b => pct >= b.min && pct < b.max);
      if (bin) bin.count += 1;
      if (pct >= 90) over90 += 1;
      if (pct >= 100) over100 += 1;
    });
    return {
      bins,
      over90,
      over100
    };
  }, [fyRows, settings.contractKW]);
  const demandHistConfig = () => ({
    type: "bar",
    data: {
      labels: demandHistogram.bins.map(b => b.label),
      datasets: [{
        label: "日数",
        data: demandHistogram.bins.map(b => b.count),
        backgroundColor: demandHistogram.bins.map(b => b.min >= 100 ? "#dc2626aa" : b.min >= 90 ? "#f59e0baa" : "#2563ebaa")
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          title: {
            display: true,
            text: "日数"
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });

  // 8. 複数年度重ね表示
  const OVERLAY_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2"];
  const toggleOverlayYear = y => {
    setOverlayYears(prev => prev.includes(y) ? prev.filter(x => x !== y) : [...prev, y].sort((a, b) => a - b));
  };
  const overlayConfig = () => {
    const meta = METRICS[overlayMetric];
    const datasets = overlayYears.map((y, i) => {
      const monthly = fiscalMonthKeys(y).map(ym => data.filter(r => r.date.startsWith(ym)));
      return {
        label: `${y}年度`,
        data: monthly.map(rows => rows.length ? aggMetric(rows, overlayMetric) : null),
        borderColor: OVERLAY_COLORS[i % OVERLAY_COLORS.length],
        backgroundColor: "transparent",
        tension: 0.25,
        spanGaps: true
      };
    });
    return {
      type: "line",
      data: {
        labels: FM_LABELS,
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            title: {
              display: true,
              text: meta.unit
            }
          }
        },
        plugins: {
          legend: {
            position: "bottom"
          }
        },
        interaction: {
          mode: "index",
          intersect: false
        }
      }
    };
  };

  // 9. 気温感応度分析（年度別の回帰の傾き＝気温1℃あたりの増減）
  const sensitivity = useMemo(() => {
    const meta = METRICS[sensitivityMetric];
    const byYear = fiscalYears.map(y => {
      const rows = data.filter(r => fiscalYear(r.date) === y);
      const reg = buildRegression(rows, sensitivityMetric);
      return {
        fy: y,
        slope: reg.slope,
        intercept: reg.intercept
      };
    });
    return {
      meta,
      byYear
    };
  }, [data, fiscalYears, sensitivityMetric]);
  const sensitivityConfig = () => ({
    type: "bar",
    data: {
      labels: sensitivity.byYear.map(x => `${x.fy}年度`),
      datasets: [{
        label: `気温感応度 (${sensitivity.meta.unit}/℃)`,
        data: sensitivity.byYear.map(x => x.slope),
        backgroundColor: "#7c3aedaa"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          title: {
            display: true,
            text: `${sensitivity.meta.unit}/℃`
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
  const sensitivityLatest = sensitivity.byYear.length ? sensitivity.byYear[sensitivity.byYear.length - 1] : null;

  // 10. 曜日別パターン
  const WEEKDAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];
  const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
  const WEEKDAY_COLORS = {
    1: DAY_TYPE_COLOR.weekday,
    2: DAY_TYPE_COLOR.weekday,
    3: DAY_TYPE_COLOR.weekday,
    4: DAY_TYPE_COLOR.weekday,
    5: DAY_TYPE_COLOR.weekday,
    6: DAY_TYPE_COLOR.saturday,
    0: DAY_TYPE_COLOR.sunday
  };
  const weekdayPattern = useMemo(() => {
    const buckets = {
      0: [],
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: []
    };
    fyRows.forEach(r => {
      const v = r[weekdayMetric];
      if (v == null || isNaN(v)) return;
      const wd = new Date(`${r.date}T00:00:00`).getDay();
      buckets[wd].push(Number(v));
    });
    return WEEKDAY_ORDER.map(wd => {
      const arr = buckets[wd];
      return arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null;
    });
  }, [fyRows, weekdayMetric]);
  const weekdayConfig = () => ({
    type: "bar",
    data: {
      labels: WEEKDAY_LABELS,
      datasets: [{
        label: `平均 (${METRICS[weekdayMetric].unit}/日)`,
        data: weekdayPattern,
        backgroundColor: WEEKDAY_ORDER.map(wd => WEEKDAY_COLORS[wd])
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          title: {
            display: true,
            text: METRICS[weekdayMetric].unit
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });

  // 11. 年間目標への累積進捗
  const cumulativeProgress = useMemo(() => {
    const totalDays = monthKeys.reduce((s, ym) => s + daysInMonth(ym), 0);
    return targets.filter(t => t.target).map(t => {
      let cumActual = 0;
      const actualSeries = monthlyRows.map(rows => {
        cumActual += sumMetric(rows, t.key);
        return cumActual;
      });
      let cumDays = 0;
      const paceSeries = monthKeys.map(ym => {
        cumDays += daysInMonth(ym);
        return t.target * (cumDays / totalDays);
      });
      return {
        ...t,
        actualSeries,
        paceSeries
      };
    });
  }, [monthlyRows, monthKeys, targets]);
  const cumulativeConfig = t => ({
    type: "line",
    data: {
      labels: FM_LABELS,
      datasets: [{
        label: `累積実績 (${t.unit})`,
        data: t.actualSeries,
        borderColor: "#2563eb",
        backgroundColor: "#2563eb33",
        tension: 0.2,
        spanGaps: true
      }, {
        label: `目標ペース (${t.unit})`,
        data: t.paceSeries,
        borderColor: "#dc2626",
        borderDash: [6, 4],
        pointRadius: 0,
        tension: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          title: {
            display: true,
            text: t.unit
          }
        }
      },
      plugins: {
        legend: {
          position: "bottom"
        }
      },
      interaction: {
        mode: "index",
        intersect: false
      }
    }
  });
  const heatColor = v => {
    if (v == null) return "#f1f5f9";
    if (heatmap.max <= 0) return "#f1f5f9";
    const t = Math.max(0.08, Math.min(1, v / heatmap.max));
    return `rgba(37, 99, 235, ${t})`;
  };
  if (!data.length) return /*#__PURE__*/React.createElement("div", {
    className: "empty-state"
  }, "\u30C7\u30FC\u30BF\u304C\u3042\u308A\u307E\u305B\u3093\u3002");
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("nav", {
    className: "tabs"
  }, /*#__PURE__*/React.createElement("div", {
    className: "analysis-fy-label"
  }, "\u5BFE\u8C61\u5E74\u5EA6:"), /*#__PURE__*/React.createElement("select", {
    value: fy,
    onChange: e => setFy(Number(e.target.value))
  }, fiscalYears.map(y => /*#__PURE__*/React.createElement("option", {
    key: y,
    value: y
  }, y, "\u5E74\u5EA6")))), /*#__PURE__*/React.createElement("section", {
    className: "chart-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-title"
  }, "1. \u539F\u5358\u4F4D\u30C8\u30EC\u30F3\u30C9\uFF08\u4F9B\u7D66\u71B1\u91CF1GJ\u3042\u305F\u308A\u306E\u6295\u5165\u30A8\u30CD\u30EB\u30AE\u30FC\u30FB\u6708\u6B21\uFF09"), /*#__PURE__*/React.createElement("p", {
    className: "analysis-note"
  }, "\u6570\u5024\u304C\u4E0A\u6607\u50BE\u5411\u306A\u3089\u300C\u540C\u3058\u71B1\u3092\u4F5C\u308B\u306E\u306B\u591A\u304F\u306E\u30A8\u30CD\u30EB\u30AE\u30FC\u304C\u5FC5\u8981\u306B\u306A\u3063\u3066\u3044\u308B\u300D\uFF1D\u8A2D\u5099\u52B9\u7387\u4F4E\u4E0B\u306E\u30B5\u30A4\u30F3\u3067\u3059\u3002"), /*#__PURE__*/React.createElement("div", {
    className: "chart-canvas-toolbar"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-small",
    onClick: e => downloadChartCanvasImage(e.currentTarget.parentElement, "原単位トレンド.png")
  }, "\uD83D\uDDBC \u753B\u50CF\u4FDD\u5B58")), /*#__PURE__*/React.createElement("div", {
    className: "chart-canvas-wrap"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    key: `int-${fy}-${darkMode}`,
    getConfig: intensityConfig
  }))), /*#__PURE__*/React.createElement("section", {
    className: "chart-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-title-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-title"
  }, "2. \u7570\u5E38\u5024\u691C\u77E5\uFF08\u6C17\u6E29\u56DE\u5E30\u30E2\u30C7\u30EB\u304B\u3089\xB1", fmtNum(settings.anomalySigmaThreshold, 1), "\u03C3\u4EE5\u4E0A\u4E56\u96E2\u3057\u305F\u65E5\uFF09"), /*#__PURE__*/React.createElement("select", {
    className: "chart-header-select",
    value: anomalyMetric,
    onChange: e => setAnomalyMetric(e.target.value)
  }, ANALYSIS_METRIC_CHOICES.map(k => /*#__PURE__*/React.createElement("option", {
    key: k,
    value: k
  }, METRICS[k].label)))), /*#__PURE__*/React.createElement("p", {
    className: "analysis-note"
  }, "\u5168\u671F\u9593\u30C7\u30FC\u30BF\u3067\u300C\u5916\u6C17\u6E29\u5EA6\u2192", anomaly.meta.label, "\u300D\u306E\u56DE\u5E30\u30E2\u30C7\u30EB\u3092\u4F5C\u308A\u3001\u4E88\u6E2C\u304B\u3089\u5927\u304D\u304F\u5916\u308C\u305F\u65E5\u3092\u691C\u51FA\u3057\u307E\u3059\uFF08\u8A2D\u5099\u7570\u5E38\u30FB\u8AA4\u8A18\u9332\u306E\u65E9\u671F\u767A\u898B\u7528\uFF09\u3002"), anomaly.list.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "analysis-empty"
  }, "\xB12\u03C3\u3092\u8D85\u3048\u308B\u7570\u5E38\u65E5\u306F\u691C\u51FA\u3055\u308C\u307E\u305B\u3093\u3067\u3057\u305F\u3002") : /*#__PURE__*/React.createElement("table", {
    className: "anomaly-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "\u65E5\u4ED8"), /*#__PURE__*/React.createElement("th", null, "\u5916\u6C17\u6E29\u5EA6"), /*#__PURE__*/React.createElement("th", null, "\u5B9F\u7E3E"), /*#__PURE__*/React.createElement("th", null, "\u56DE\u5E30\u4E88\u6E2C"), /*#__PURE__*/React.createElement("th", null, "\u4E56\u96E2"), /*#__PURE__*/React.createElement("th", null, "\u30E1\u30E2"))), /*#__PURE__*/React.createElement("tbody", null, anomaly.list.map(x => {
    const noteMsg = `異常値検知: ${anomaly.meta.label} ${fmtNum(x.actual, 0)}${anomaly.meta.unit}（回帰予測比 ${x.sigma > 0 ? "+" : ""}${fmtNum(x.sigma, 1)}σ）`;
    const existing = notes && notes[x.date];
    const alreadyRecorded = existing && existing.includes(noteMsg);
    return /*#__PURE__*/React.createElement("tr", {
      key: x.date
    }, /*#__PURE__*/React.createElement("td", null, x.date), /*#__PURE__*/React.createElement("td", null, fmtNum(x.temp, 1), "\u2103"), /*#__PURE__*/React.createElement("td", null, fmtNum(x.actual, 0), " ", anomaly.meta.unit), /*#__PURE__*/React.createElement("td", null, fmtNum(x.pred, 0), " ", anomaly.meta.unit), /*#__PURE__*/React.createElement("td", {
      className: x.sigma > 0 ? "dev-up" : "dev-down"
    }, x.sigma > 0 ? "+" : "", fmtNum(x.sigma, 1), "\u03C3"), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("button", {
      className: "btn btn-small",
      disabled: alreadyRecorded,
      onClick: () => onSaveNote(x.date, existing ? `${existing}\n${noteMsg}` : noteMsg)
    }, alreadyRecorded ? "記録済み" : "メモに記録")));
  })))), /*#__PURE__*/React.createElement("section", {
    className: "chart-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-title"
  }, "3. \u91CD\u6CB9 \u53F7\u6A5F\u5225\u7A3C\u50CD\u30D0\u30E9\u30F3\u30B9\uFF08", fy, "\u5E74\u5EA6\u5408\u8A08\uFF09"), /*#__PURE__*/React.createElement("p", {
    className: "analysis-note"
  }, "\u7279\u5B9A\u53F7\u6A5F\u3078\u306E\u6975\u7AEF\u306A\u504F\u308A\u306F\u3001\u7247\u5074\u306E\u4E0D\u8ABF\u30FB\u975E\u52B9\u7387\u3084\u70B9\u691C\u6642\u671F\u306E\u30B5\u30A4\u30F3\u306B\u306A\u308A\u5F97\u307E\u3059\u3002"), /*#__PURE__*/React.createElement("div", {
    className: "chart-canvas-toolbar"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-small",
    onClick: e => downloadChartCanvasImage(e.currentTarget.parentElement, "号機別稼働バランス.png")
  }, "\uD83D\uDDBC \u753B\u50CF\u4FDD\u5B58")), /*#__PURE__*/React.createElement("div", {
    className: "chart-canvas-wrap"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    key: `bal-${fy}-${darkMode}`,
    getConfig: balanceConfig
  }))), /*#__PURE__*/React.createElement("section", {
    className: "chart-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-title"
  }, "4. \u5E74\u5EA6\u76EE\u6A19\u306B\u5BFE\u3059\u308B\u9032\u6357\uFF08", fy, "\u5E74\u5EA6\uFF09"), targets.every(t => !t.target) ? /*#__PURE__*/React.createElement("div", {
    className: "analysis-empty"
  }, "\u5E74\u5EA6\u76EE\u6A19\u304C\u672A\u8A2D\u5B9A\u3067\u3059\u3002\u300C\u8A2D\u5B9A\u300D\u753B\u9762\u304B\u3089\u76EE\u6A19\u5024\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002") : targets.map(t => {
    if (!t.target) return null;
    const pct = t.actual / t.target * 100;
    return /*#__PURE__*/React.createElement("div", {
      key: t.label,
      className: "target-row"
    }, /*#__PURE__*/React.createElement("div", {
      className: "target-label"
    }, t.label, ": ", fmtNum(t.actual, 0), " / \u76EE\u6A19 ", fmtNum(t.target, 0), " ", t.unit, "\uFF08", fmtNum(pct, 1), "%\uFF09"), /*#__PURE__*/React.createElement("div", {
      className: "target-bar-bg"
    }, /*#__PURE__*/React.createElement("div", {
      className: "target-bar" + (pct > 100 ? " over" : ""),
      style: {
        width: `${Math.min(100, pct)}%`
      }
    })));
  })), /*#__PURE__*/React.createElement("section", {
    className: "chart-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-title-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-title"
  }, "5. \u30AB\u30EC\u30F3\u30C0\u30FC\u30D2\u30FC\u30C8\u30DE\u30C3\u30D7\uFF08", fy, "\u5E74\u5EA6\u30FB\u8272\u304C\u6FC3\u3044\u307B\u3069\u5927\uFF09"), /*#__PURE__*/React.createElement("select", {
    className: "chart-header-select",
    value: heatmapMetric,
    onChange: e => setHeatmapMetric(e.target.value)
  }, ANALYSIS_METRIC_CHOICES.map(k => /*#__PURE__*/React.createElement("option", {
    key: k,
    value: k
  }, METRICS[k].label)))), /*#__PURE__*/React.createElement("div", {
    className: "heatmap-scroll"
  }, /*#__PURE__*/React.createElement("div", {
    className: "heatmap-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "heatmap-mlabel"
  }), Array.from({
    length: 31
  }, (_, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "heatmap-dlabel"
  }, (i + 1) % 5 === 0 || i === 0 ? i + 1 : "")), heatmap.rows.map(row => /*#__PURE__*/React.createElement(React.Fragment, {
    key: row.label
  }, /*#__PURE__*/React.createElement("div", {
    className: "heatmap-mlabel"
  }, row.label), row.cells.map((c, i) => c == null ? /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "heatmap-cell blank"
  }) : /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "heatmap-cell",
    style: {
      background: heatColor(c.v)
    },
    title: `${c.dateStr}: ${c.v != null ? fmtNum(c.v, 0) + " " + heatmap.meta.unit : "未入力"}`
  }))))))), /*#__PURE__*/React.createElement("section", {
    className: "chart-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-title"
  }, "6. CO2\u6392\u51FA\u91CF\u30C8\u30EC\u30F3\u30C9\uFF08\u6708\u6B21\u30FB\u524D\u5E74\u5EA6\u6BD4\u8F03\uFF09"), /*#__PURE__*/React.createElement("p", {
    className: "analysis-note"
  }, fy, "\u5E74\u5EA6\u5408\u8A08: ", /*#__PURE__*/React.createElement("b", null, fmtNum(co2TotalThis, 0), " t-CO2"), co2TotalPrev != null && /*#__PURE__*/React.createElement("span", null, "\uFF08\u524D\u5E74\u5EA6 ", fmtNum(co2TotalPrev, 0), " t-CO2 / ", fmtPct((co2TotalThis - co2TotalPrev) / co2TotalPrev * 100), "\uFF09")), /*#__PURE__*/React.createElement("div", {
    className: "chart-canvas-toolbar"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-small",
    onClick: e => downloadChartCanvasImage(e.currentTarget.parentElement, "CO2排出量トレンド.png")
  }, "\uD83D\uDDBC \u753B\u50CF\u4FDD\u5B58")), /*#__PURE__*/React.createElement("div", {
    className: "chart-canvas-wrap"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    key: `co2-${fy}-${darkMode}`,
    getConfig: co2Config
  }))), /*#__PURE__*/React.createElement("section", {
    className: "chart-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-title"
  }, "7. \u30C7\u30DE\u30F3\u30C9\u5206\u6790\uFF08\u65E5\u5E73\u5747\u96FB\u529B\u3068\u5951\u7D04\u96FB\u529B\uFF09"), /*#__PURE__*/React.createElement("p", {
    className: "analysis-note"
  }, "\u203B\u65E5\u6B21\u30C7\u30FC\u30BF\u306E\u305F\u308130\u5206\u30C7\u30DE\u30F3\u30C9\u5B9F\u6E2C\u3067\u306F\u306A\u304F\u300C\u65E5\u5E73\u5747\u96FB\u529B\uFF08kWh\xF724\uFF09\u300D\u306B\u57FA\u3065\u304F\u53C2\u8003\u5024\u3067\u3059\u3002 \u5951\u7D04\u6BD490%\u4EE5\u4E0A: ", /*#__PURE__*/React.createElement("b", null, demandHistogram.over90, "\u65E5"), " / 100%\u4EE5\u4E0A: ", /*#__PURE__*/React.createElement("b", {
    className: "dev-up"
  }, demandHistogram.over100, "\u65E5")), /*#__PURE__*/React.createElement("div", {
    className: "chart-canvas-toolbar"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-small",
    onClick: e => downloadChartCanvasImage(e.currentTarget.parentElement, "デマンド分析.png")
  }, "\uD83D\uDDBC \u753B\u50CF\u4FDD\u5B58")), /*#__PURE__*/React.createElement("div", {
    className: "chart-canvas-wrap"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    key: `dem-${fy}-${darkMode}`,
    getConfig: demandConfig
  })), /*#__PURE__*/React.createElement("div", {
    className: "panel-title",
    style: {
      marginTop: 16
    }
  }, "\u5951\u7D04\u96FB\u529B\u6BD4\u306E\u5206\u5E03\uFF08\u65E5\u6570\uFF09"), /*#__PURE__*/React.createElement("div", {
    className: "chart-canvas-toolbar"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-small",
    onClick: e => downloadChartCanvasImage(e.currentTarget.parentElement, "契約電力比の分布.png")
  }, "\uD83D\uDDBC \u753B\u50CF\u4FDD\u5B58")), /*#__PURE__*/React.createElement("div", {
    className: "chart-canvas-wrap",
    style: {
      height: 200
    }
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    key: `demh-${fy}-${darkMode}`,
    getConfig: demandHistConfig,
    height: 180
  }))), /*#__PURE__*/React.createElement("section", {
    className: "chart-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-title-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-title"
  }, "8. \u8907\u6570\u5E74\u5EA6\u91CD\u306D\u8868\u793A"), /*#__PURE__*/React.createElement("select", {
    className: "chart-header-select",
    value: overlayMetric,
    onChange: e => setOverlayMetric(e.target.value)
  }, ANALYSIS_METRIC_CHOICES.map(k => /*#__PURE__*/React.createElement("option", {
    key: k,
    value: k
  }, METRICS[k].label)))), /*#__PURE__*/React.createElement("p", {
    className: "analysis-note"
  }, "\u8907\u6570\u306E\u5E74\u5EA6\u3092\u9078\u3093\u3067\u3001\u6708\u5225\u306E\u63A8\u79FB\u3092\u91CD\u306D\u3066\u6BD4\u8F03\u3067\u304D\u307E\u3059\uFF08\u9577\u671F\u30C8\u30EC\u30F3\u30C9\u306E\u628A\u63E1\u7528\uFF09\u3002"), /*#__PURE__*/React.createElement("div", {
    className: "overlay-year-checks"
  }, fiscalYears.map(y => /*#__PURE__*/React.createElement("label", {
    key: y,
    className: "metric-chip",
    style: overlayYears.includes(y) ? {
      borderColor: OVERLAY_COLORS[overlayYears.indexOf(y) % OVERLAY_COLORS.length],
      background: OVERLAY_COLORS[overlayYears.indexOf(y) % OVERLAY_COLORS.length] + "1a"
    } : {}
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: overlayYears.includes(y),
    onChange: () => toggleOverlayYear(y)
  }), y, "\u5E74\u5EA6"))), overlayYears.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "analysis-empty"
  }, "\u6BD4\u8F03\u3059\u308B\u5E74\u5EA6\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "chart-canvas-toolbar"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-small",
    onClick: e => downloadChartCanvasImage(e.currentTarget.parentElement, "複数年度重ね表示.png")
  }, "\uD83D\uDDBC \u753B\u50CF\u4FDD\u5B58")), /*#__PURE__*/React.createElement("div", {
    className: "chart-canvas-wrap"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    key: `overlay-${overlayYears.join(",")}-${overlayMetric}-${darkMode}`,
    getConfig: overlayConfig
  })))), /*#__PURE__*/React.createElement("section", {
    className: "chart-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-title-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-title"
  }, "9. \u6C17\u6E29\u611F\u5FDC\u5EA6\u5206\u6790\uFF08\u5E74\u5EA6\u5225\u30FB\u6C17\u6E291\u2103\u3042\u305F\u308A\u306E\u5897\u6E1B\uFF09"), /*#__PURE__*/React.createElement("select", {
    className: "chart-header-select",
    value: sensitivityMetric,
    onChange: e => setSensitivityMetric(e.target.value)
  }, ANALYSIS_METRIC_CHOICES.map(k => /*#__PURE__*/React.createElement("option", {
    key: k,
    value: k
  }, METRICS[k].label)))), /*#__PURE__*/React.createElement("p", {
    className: "analysis-note"
  }, "\u5916\u6C17\u6E29\u5EA6\u3068", sensitivity.meta.label, "\u306E\u5E74\u5EA6\u3054\u3068\u306E\u56DE\u5E30\u304B\u3089\u50BE\u304D\u3092\u7B97\u51FA\u3002\u5024\u304C\u5E74\u3005\u5927\u304D\u304F\u306A\u3063\u3066\u3044\u308C\u3070 \u300C\u540C\u3058\u6C17\u6E29\u3067\u3082\u3088\u308A\u591A\u304F\u4F7F\u3046\u3088\u3046\u306B\u306A\u3063\u3066\u3044\u308B\u300D\uFF1D\u6E29\u5EA6\u4F9D\u5B58\u306E\u52B9\u7387\u4F4E\u4E0B\u306E\u30B5\u30A4\u30F3\u3067\u3059\u3002", sensitivityLatest && /*#__PURE__*/React.createElement("span", null, " ", sensitivityLatest.fy, "\u5E74\u5EA6: ", /*#__PURE__*/React.createElement("b", null, fmtNum(sensitivityLatest.slope, 2), " ", sensitivity.meta.unit, "/\u2103"))), /*#__PURE__*/React.createElement("div", {
    className: "chart-canvas-toolbar"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-small",
    onClick: e => downloadChartCanvasImage(e.currentTarget.parentElement, "気温感応度分析.png")
  }, "\uD83D\uDDBC \u753B\u50CF\u4FDD\u5B58")), /*#__PURE__*/React.createElement("div", {
    className: "chart-canvas-wrap"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    key: `sens-${sensitivityMetric}-${fiscalYears.join(",")}-${darkMode}`,
    getConfig: sensitivityConfig
  }))), /*#__PURE__*/React.createElement("section", {
    className: "chart-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-title-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-title"
  }, "10. \u66DC\u65E5\u5225\u30D1\u30BF\u30FC\u30F3\uFF08", fy, "\u5E74\u5EA6\u30FB\u65E5\u5E73\u5747\uFF09"), /*#__PURE__*/React.createElement("select", {
    className: "chart-header-select",
    value: weekdayMetric,
    onChange: e => setWeekdayMetric(e.target.value)
  }, ANALYSIS_METRIC_CHOICES.map(k => /*#__PURE__*/React.createElement("option", {
    key: k,
    value: k
  }, METRICS[k].label)))), /*#__PURE__*/React.createElement("p", {
    className: "analysis-note"
  }, "\u66DC\u65E5\u3054\u3068\u306E\u5E73\u5747\u5024\u3092\u6BD4\u8F03\u3057\u307E\u3059\u3002\u571F\u65E5\u3067\u6975\u7AEF\u306B\u9AD8\u3044/\u4F4E\u3044\u5834\u5408\u3001\u4F11\u65E5\u904B\u8EE2\u306E\u898B\u76F4\u3057\u4F59\u5730\u304C\u3042\u308B\u304B\u3082\u3057\u308C\u307E\u305B\u3093\u3002"), /*#__PURE__*/React.createElement("div", {
    className: "chart-canvas-toolbar"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-small",
    onClick: e => downloadChartCanvasImage(e.currentTarget.parentElement, "曜日別パターン.png")
  }, "\uD83D\uDDBC \u753B\u50CF\u4FDD\u5B58")), /*#__PURE__*/React.createElement("div", {
    className: "chart-canvas-wrap"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    key: `wd-${fy}-${weekdayMetric}-${darkMode}`,
    getConfig: weekdayConfig
  }))), /*#__PURE__*/React.createElement("section", {
    className: "chart-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-title"
  }, "11. \u5E74\u9593\u76EE\u6A19\u3078\u306E\u7D2F\u7A4D\u9032\u6357\uFF08", fy, "\u5E74\u5EA6\uFF09"), cumulativeProgress.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "analysis-empty"
  }, "\u5E74\u5EA6\u76EE\u6A19\u304C\u672A\u8A2D\u5B9A\u3067\u3059\u3002\u300C\u8A2D\u5B9A\u300D\u753B\u9762\u304B\u3089\u76EE\u6A19\u5024\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002") : cumulativeProgress.map(t => /*#__PURE__*/React.createElement(React.Fragment, {
    key: t.key
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-title",
    style: {
      marginTop: 8
    }
  }, t.label), /*#__PURE__*/React.createElement("div", {
    className: "chart-canvas-toolbar"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-small",
    onClick: e => downloadChartCanvasImage(e.currentTarget.parentElement, `累積進捗_${t.label}.png`)
  }, "\uD83D\uDDBC \u753B\u50CF\u4FDD\u5B58")), /*#__PURE__*/React.createElement("div", {
    className: "chart-canvas-wrap"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    key: `cum-${t.key}-${fy}-${darkMode}`,
    getConfig: () => cumulativeConfig(t)
  }))))));
}
function DataUpdateModal({
  onImport,
  onClose
}) {
  const [status, setStatus] = useState("");
  const fileRef = useRef(null);
  const handleFile = file => {
    setStatus("読み込み中…");
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, {
          type: "array",
          cellDates: true
        });
        const sheet = wb.Sheets["Sheet1"];
        if (!sheet) {
          setStatus("エラー: Sheet1 が見つかりません");
          return;
        }
        const rows = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          raw: true,
          defval: null
        });
        const newRecords = [];
        // 日付が過去に巻き戻る行は、コピペミス等で日付ラベルが壊れている可能性が高いため除外する
        let maxDateSoFar = null;
        let skippedBackward = 0;
        for (let i = 2; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row[0] == null) continue;
          let dateVal = row[0];
          let dateStr;
          if (dateVal instanceof Date) {
            dateStr = `${dateVal.getFullYear()}-${String(dateVal.getMonth() + 1).padStart(2, "0")}-${String(dateVal.getDate()).padStart(2, "0")}`;
          } else if (typeof dateVal === "number") {
            const d = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
            dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
          } else continue;
          if (maxDateSoFar && dateStr < maxDateSoFar) {
            skippedBackward += 1;
            continue;
          }
          if (!maxDateSoFar || dateStr > maxDateSoFar) maxDateSoFar = dateStr;
          newRecords.push({
            date: dateStr,
            tempAvg: row[1],
            humidityAvg: row[2],
            coolLoadGJ: row[3],
            heatLoadGJ: row[4],
            elecKWh: row[5],
            oilChiller1L: row[6],
            oilChiller2L: row[7],
            oilChillerTotalL: row[8],
            oilBoiler1L: row[9],
            oilBoiler2L: row[10],
            oilBoilerTotalL: row[11],
            oilTotalL: row[12]
          });
        }
        if (!newRecords.length) {
          setStatus("エラー: 有効なデータ行が見つかりませんでした");
          return;
        }
        onImport(newRecords);
        setStatus(`${newRecords.length}件のデータを取り込みました（既存データとマージ済み）` + (skippedBackward ? `。日付が前後している${skippedBackward}行は日付誤りの可能性があるため除外しました。` : ""));
      } catch (err) {
        setStatus("エラー: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "modal-backdrop",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("h3", null, "\u30C7\u30FC\u30BF\u66F4\u65B0"), /*#__PURE__*/React.createElement("p", {
    className: "modal-note"
  }, "\u6700\u65B0\u306E\u300C\u30A8\u30CD\u30EB\u30AE\u30FC.xlsx\u300D\uFF08Sheet1\uFF09\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u540C\u3058\u65E5\u4ED8\u306E\u30C7\u30FC\u30BF\u306F\u65B0\u3057\u3044\u5024\u3067\u4E0A\u66F8\u304D\u3055\u308C\u307E\u3059\u3002"), /*#__PURE__*/React.createElement("input", {
    ref: fileRef,
    type: "file",
    accept: ".xlsx,.xls",
    onChange: e => e.target.files[0] && handleFile(e.target.files[0])
  }), status && /*#__PURE__*/React.createElement("div", {
    className: "modal-status"
  }, status), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: onClose
  }, "\u9589\u3058\u308B"))));
}

// ============================================================
// メインアプリ
// ============================================================
function App() {
  const [data, setData] = useState(loadInitialData);
  const [settings, setSettings] = useState(loadSettings);
  const [notes, setNotes] = useState(loadNotes);
  const [holidayMap] = useState(() => window.HOLIDAY_MAP || {});

  // Firebaseとのリアルタイム同期（他端末での変更を受信）。dbがnullなら何もしない。
  useEffect(() => {
    if (!db) return;
    const ref = db.ref("energyData");
    const handler = snap => {
      if (snap.exists()) {
        const merged = Object.values(snap.val()).map(withDerived).sort((a, b) => a.date < b.date ? -1 : 1);
        setData(merged);
        try {
          localStorage.setItem(LS_DATA_KEY, JSON.stringify(merged.map(({
            demandKW,
            totalLoadGJ,
            ...rest
          }) => rest)));
        } catch (e) {/* ignore */}
      } else {
        fbBulkSaveData(data);
      }
    };
    ref.on("value", handler);
    return () => ref.off("value", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!db) return;
    const ref = db.ref("settings");
    const handler = snap => {
      if (snap.exists()) {
        const merged = {
          ...DEFAULT_SETTINGS,
          ...snap.val()
        };
        setSettings(merged);
        try {
          localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(merged));
        } catch (e) {/* ignore */}
      } else {
        fbSaveSettings(settings);
      }
    };
    ref.on("value", handler);
    return () => ref.off("value", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!db) return;
    const ref = db.ref("notes");
    const handler = snap => {
      if (snap.exists()) {
        const remoteNotes = snap.val();
        setNotes(remoteNotes);
        try {
          localStorage.setItem(LS_NOTES_KEY, JSON.stringify(remoteNotes));
        } catch (e) {/* ignore */}
      } else if (Object.keys(notes).length) {
        db.ref("notes").set(notes);
      }
    };
    ref.on("value", handler);
    return () => ref.off("value", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const savedViewState = useState(loadViewState)[0];
  const [view, setView] = useState(() => savedViewState && savedViewState.view !== "year" && savedViewState.view || "day");
  const [charts, setCharts] = useState(() => savedViewState && savedViewState.charts && savedViewState.charts.length ? savedViewState.charts : DEFAULT_CHARTS);
  const [nextChartId, setNextChartId] = useState(() => savedViewState && savedViewState.nextChartId || 2);
  const [openChartSettings, setOpenChartSettings] = useState(null);
  const [fullscreenChartId, setFullscreenChartId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showDataUpdate, setShowDataUpdate] = useState(false);
  const [showReportPreview, setShowReportPreview] = useState(false);
  const [mode, setMode] = useState(() => savedViewState && savedViewState.mode || "dashboard");
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem(LS_DARKMODE_KEY) === "1";
    } catch (e) {
      return false;
    }
  });
  const latestDate = data.length ? data[data.length - 1].date : null;
  const fiscalYears = useMemo(() => Array.from(new Set(data.map(r => fiscalYear(r.date)))).sort((a, b) => a - b), [data]);
  const dataGaps = useMemo(() => {
    const gaps = [];
    for (let i = 1; i < data.length; i++) {
      const diffDays = Math.round((parseISO(data[i].date) - parseISO(data[i - 1].date)) / 86400000);
      if (diffDays > 14) gaps.push({
        from: data[i - 1].date,
        to: data[i].date,
        days: diffDays - 1
      });
    }
    return gaps;
  }, [data]);

  // 直近7日分のデマンド超過・異常値を検知して通知バナーに使う
  const recentAlerts = useMemo(() => {
    if (!data.length) return [];
    const alerts = [];
    const recent = data.slice(-7);
    const demandThreshold = (settings.demandAlertPct || 100) / 100;
    recent.forEach(r => {
      if (settings.contractKW > 0 && r.demandKW != null && r.demandKW / settings.contractKW >= demandThreshold) {
        alerts.push({
          key: `demand-${r.date}`,
          date: r.date,
          message: `${r.date}: 日平均電力が契約比${fmtNum(settings.demandAlertPct, 0)}%を超過（契約比${fmtNum(r.demandKW / settings.contractKW * 100, 0)}%）`
        });
      }
    });
    const sigmaThreshold = settings.anomalySigmaThreshold || 2;
    ["elecKWh", "oilTotalL", "coolLoadGJ", "heatLoadGJ"].forEach(metricKey => {
      const isValid = r => r.tempAvg != null && r[metricKey] != null && !isNaN(r.tempAvg) && !isNaN(r[metricKey]);
      const validAll = data.filter(isValid);
      if (validAll.length < 30) return;
      const reg = buildRegression(data, metricKey);
      const resids = validAll.map(r => Number(r[metricKey]) - (reg.slope * Number(r.tempAvg) + reg.intercept));
      const sd = Math.sqrt(resids.reduce((s, x) => s + x * x, 0) / resids.length);
      if (sd <= 0) return;
      recent.filter(isValid).forEach(r => {
        const resid = Number(r[metricKey]) - (reg.slope * Number(r.tempAvg) + reg.intercept);
        const sigma = resid / sd;
        if (Math.abs(sigma) >= sigmaThreshold) {
          alerts.push({
            key: `anomaly-${metricKey}-${r.date}`,
            date: r.date,
            message: `${r.date}: ${METRICS[metricKey].label}が気温からの予測より${sigma > 0 ? "大幅に多い" : "大幅に少ない"}（${sigma > 0 ? "+" : ""}${fmtNum(sigma, 1)}σ）`
          });
        }
      });
    });
    return alerts.sort((a, b) => a.date < b.date ? -1 : 1);
  }, [data, settings.contractKW, settings.demandAlertPct, settings.anomalySigmaThreshold]);
  const [dismissedAlertSig, setDismissedAlertSig] = useState(null);
  const alertSig = recentAlerts.map(a => a.key).join(",");
  const showAlertBanner = recentAlerts.length > 0 && dismissedAlertSig !== alertSig;
  const [selectedYm, setSelectedYm] = useState(() => savedViewState && savedViewState.selectedYm || (latestDate ? latestDate.slice(0, 7) : ""));
  const [selectedFY, setSelectedFY] = useState(() => savedViewState && savedViewState.selectedFY || (latestDate ? fiscalYear(latestDate) : new Date().getFullYear()));
  useEffect(() => {
    if (latestDate && !savedViewState) {
      setSelectedYm(latestDate.slice(0, 7));
      setSelectedFY(fiscalYear(latestDate));
    }
  }, [data.length === 0]);
  useEffect(() => {
    try {
      localStorage.setItem(LS_VIEWSTATE_KEY, JSON.stringify({
        view,
        charts,
        nextChartId,
        mode,
        selectedYm,
        selectedFY
      }));
    } catch (e) {/* ignore quota errors */}
  }, [view, charts, nextChartId, mode, selectedYm, selectedFY]);
  useEffect(() => {
    try {
      localStorage.setItem(LS_DARKMODE_KEY, darkMode ? "1" : "0");
    } catch (e) {/* ignore */}
    Chart.defaults.color = darkMode ? "#cbd5e1" : "#334155";
    Chart.defaults.borderColor = darkMode ? "#334155" : "#e2e8f0";
    document.body.style.background = darkMode ? "#0b1220" : "#f1f5f9";
  }, [darkMode]);
  const handleImportData = newRecords => {
    const byDate = {};
    data.forEach(r => {
      byDate[r.date] = r;
    });
    newRecords.forEach(r => {
      byDate[r.date] = r;
    });
    const merged = Object.values(byDate).map(withDerived).sort((a, b) => a.date < b.date ? -1 : 1);
    setData(merged);
    try {
      localStorage.setItem(LS_DATA_KEY, JSON.stringify(merged.map(({
        demandKW,
        totalLoadGJ,
        ...rest
      }) => rest)));
    } catch (e) {/* ignore quota errors */}
    fbBulkSaveData(newRecords);
    if (merged.length) {
      const newLatest = merged[merged.length - 1].date;
      setSelectedYm(newLatest.slice(0, 7));
      setSelectedFY(fiscalYear(newLatest));
    }
  };
  const handleSaveSettings = s => {
    setSettings(s);
    try {
      localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(s));
    } catch (e) {/* ignore */}
    fbSaveSettings(s);
  };
  const buildBackupPayload = () => ({
    exportedAt: new Date().toISOString(),
    data: data.map(({
      demandKW,
      totalLoadGJ,
      ...rest
    }) => rest),
    settings,
    notes
  });
  const handleExportBackup = () => {
    const blob = new Blob([JSON.stringify(buildBackupPayload(), null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `energy-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ローカルファイルへの自動保存（File System Access API）
  const autoSaveSupported = typeof window !== "undefined" && "showSaveFilePicker" in window;
  const [fileHandle, setFileHandle] = useState(null);
  const [autoSaveFileName, setAutoSaveFileName] = useState(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState("");
  const [needsReauth, setNeedsReauth] = useState(false);
  const pendingHandleRef = useRef(null);
  useEffect(() => {
    if (!autoSaveSupported) return;
    (async () => {
      try {
        const handle = await idbLoadHandle();
        if (!handle) return;
        const perm = await handle.queryPermission({
          mode: "readwrite"
        });
        if (perm === "granted") {
          setFileHandle(handle);
          setAutoSaveFileName(handle.name);
        } else {
          pendingHandleRef.current = handle;
          setAutoSaveFileName(handle.name);
          setNeedsReauth(true);
        }
      } catch (e) {/* IndexedDBが使えない環境等は無視 */}
    })();
  }, [autoSaveSupported]);
  useEffect(() => {
    if (!fileHandle) return;
    (async () => {
      try {
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(buildBackupPayload(), null, 2));
        await writable.close();
        setAutoSaveStatus(`自動保存しました（${new Date().toLocaleTimeString("ja-JP")}）`);
      } catch (e) {
        setAutoSaveStatus(`自動保存エラー: ${e.message}`);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, settings, notes, fileHandle]);
  const handleConnectAutoSaveFile = async () => {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: "energy-dashboard-autosave.json",
        types: [{
          description: "JSON",
          accept: {
            "application/json": [".json"]
          }
        }]
      });
      await idbSaveHandle(handle);
      setFileHandle(handle);
      setAutoSaveFileName(handle.name);
      setNeedsReauth(false);
    } catch (e) {
      if (e.name !== "AbortError") setAutoSaveStatus(`連携エラー: ${e.message}`);
    }
  };
  const handleReauthorizeAutoSaveFile = async () => {
    const handle = pendingHandleRef.current;
    if (!handle) return;
    try {
      const perm = await handle.requestPermission({
        mode: "readwrite"
      });
      if (perm === "granted") {
        setFileHandle(handle);
        setAutoSaveFileName(handle.name);
        setNeedsReauth(false);
      }
    } catch (e) {
      setAutoSaveStatus(`再連携エラー: ${e.message}`);
    }
  };
  const handleDisconnectAutoSaveFile = async () => {
    try {
      await idbClearHandle();
    } catch (e) {/* ignore */}
    pendingHandleRef.current = null;
    setFileHandle(null);
    setAutoSaveFileName(null);
    setAutoSaveStatus("");
    setNeedsReauth(false);
  };
  const handleImportBackup = parsed => {
    let merged = data;
    if (Array.isArray(parsed.data) && parsed.data.length) {
      merged = parsed.data.map(withDerived).sort((a, b) => a.date < b.date ? -1 : 1);
      persistData(merged);
    }
    const mergedSettings = parsed.settings ? {
      ...DEFAULT_SETTINGS,
      ...parsed.settings
    } : settings;
    if (parsed.settings) {
      setSettings(mergedSettings);
      try {
        localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(mergedSettings));
      } catch (e) {/* ignore */}
    }
    const notesObj = parsed.notes || notes;
    if (parsed.notes) {
      setNotes(parsed.notes);
      try {
        localStorage.setItem(LS_NOTES_KEY, JSON.stringify(parsed.notes));
      } catch (e) {/* ignore */}
    }
    // バックアップ復元は「この内容が正」の全置換なので、個別set/updateではなくenergyData/settings/notesを丸ごと置き換える
    fbReplaceAll(merged, mergedSettings, notesObj);
  };
  const persistData = merged => {
    setData(merged);
    try {
      localStorage.setItem(LS_DATA_KEY, JSON.stringify(merged.map(({
        demandKW,
        totalLoadGJ,
        ...rest
      }) => rest)));
    } catch (e) {/* ignore quota errors */}
  };
  const handleSaveRecord = record => {
    const byDate = {};
    data.forEach(r => {
      byDate[r.date] = r;
    });
    byDate[record.date] = record;
    persistData(Object.values(byDate).map(withDerived).sort((a, b) => a.date < b.date ? -1 : 1));
    fbSaveRecord(record);
  };
  const handleDeleteRecord = dateStr => {
    persistData(data.filter(r => r.date !== dateStr));
    fbDeleteRecord(dateStr);
  };
  const handleSaveNote = (dateStr, text) => {
    setNotes(prev => {
      const next = {
        ...prev
      };
      if (text && text.trim()) next[dateStr] = text;else delete next[dateStr];
      try {
        localStorage.setItem(LS_NOTES_KEY, JSON.stringify(next));
      } catch (e) {/* ignore */}
      return next;
    });
    fbSaveNote(dateStr, text);
  };
  const updateChart = (id, patch) => {
    setCharts(prev => prev.map(c => c.id === id ? {
      ...c,
      ...patch
    } : c));
  };
  const addChart = () => {
    const id = nextChartId;
    setCharts(prev => [...prev, {
      id,
      name: `グラフ${id}`,
      chartType: "line",
      selectedMetrics: [Object.keys(METRICS)[0]],
      compareEnabled: true,
      showForecast: true,
      forecastMethod: "seasonal",
      dayTypeColoring: false
    }]);
    setNextChartId(id + 1);
    setOpenChartSettings(id);
  };
  const removeChart = id => {
    setCharts(prev => prev.filter(c => c.id !== id));
    setOpenChartSettings(null);
  };
  const toggleChartMetric = (chart, key) => {
    const has = chart.selectedMetrics.includes(key);
    updateChart(chart.id, {
      selectedMetrics: has ? chart.selectedMetrics.filter(k => k !== key) : [...chart.selectedMetrics, key]
    });
  };
  const toggleMetricInFirstChart = key => {
    if (!charts.length) return;
    toggleChartMetric(charts[0], key);
  };
  const stepPeriod = delta => {
    if (view === "day") {
      setSelectedYm(ym => {
        const [y, m] = ym.split("-").map(Number);
        const d = new Date(y, m - 1 + delta, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      });
    } else if (view === "month") {
      setSelectedFY(fy => fy + delta);
    }
  };

  // 設定に依存するコスト/CO2/効率等の項目をグラフ・一覧でも使えるよう、表示用データに付与する
  const dataDisplay = useMemo(() => data.map(r => withComputed(r, settings)), [data, settings]);
  const buckets = useMemo(() => {
    if (!dataDisplay.length) return null;
    if (view === "day") return buildDayViewBuckets(dataDisplay, selectedYm);
    if (view === "month") return buildMonthViewBuckets(dataDisplay, selectedFY);
    return buildYearViewBuckets(dataDisplay);
  }, [dataDisplay, view, selectedYm, selectedFY]);
  const periodWeather = useMemo(() => {
    if (!buckets || !buckets.rows || !buckets.rows.length) return null;
    return {
      temp: avgMetric(buckets.rows, "tempAvg"),
      humidity: avgMetric(buckets.rows, "humidityAvg")
    };
  }, [buckets]);

  // KPI用の当期・前期行
  const {
    kpiCurrentRows,
    kpiPreviousRows,
    kpiLabel,
    periodDays
  } = useMemo(() => {
    if (!data.length) return {
      kpiCurrentRows: [],
      kpiPreviousRows: [],
      kpiLabel: "",
      periodDays: 0
    };
    if (view === "day") {
      const cur = data.filter(r => r.date.startsWith(selectedYm));
      const [y, m] = selectedYm.split("-").map(Number);
      const prevYm = `${y - 1}-${String(m).padStart(2, "0")}`;
      return {
        kpiCurrentRows: cur,
        kpiPreviousRows: data.filter(r => r.date.startsWith(prevYm)),
        kpiLabel: `${y}年${m}月`,
        periodDays: daysInMonth(selectedYm)
      };
    }
    if (view === "month") {
      const cur = data.filter(r => fiscalYear(r.date) === selectedFY);
      const monthsPresent = new Set(cur.map(r => r.date.slice(5, 7)));
      const prev = data.filter(r => fiscalYear(r.date) === selectedFY - 1 && monthsPresent.has(r.date.slice(5, 7)));
      const fyDays = fiscalMonthKeys(selectedFY).reduce((s, ym) => s + daysInMonth(ym), 0);
      return {
        kpiCurrentRows: cur,
        kpiPreviousRows: prev,
        kpiLabel: `${selectedFY}年度`,
        periodDays: fyDays
      };
    }
    const latestFY = fiscalYears[fiscalYears.length - 1];
    const fyDays = fiscalMonthKeys(latestFY).reduce((s, ym) => s + daysInMonth(ym), 0);
    return {
      kpiCurrentRows: data.filter(r => fiscalYear(r.date) === latestFY),
      kpiPreviousRows: data.filter(r => fiscalYear(r.date) === latestFY - 1),
      kpiLabel: `${latestFY}年度(最新)`,
      periodDays: fyDays
    };
  }, [data, view, selectedYm, selectedFY, fiscalYears]);
  const kpiList = useMemo(() => {
    const keys = ["elecKWh", "oilTotalL", "coolLoadGJ", "heatLoadGJ"];
    return keys.map(k => {
      const cur = sumMetric(kpiCurrentRows, k);
      const prev = sumMetric(kpiPreviousRows, k);
      const pct = prev > 0 ? (cur - prev) / prev * 100 : null;
      return {
        key: k,
        label: METRICS[k].label,
        unit: METRICS[k].unit,
        current: cur,
        previous: kpiPreviousRows.length ? prev : null,
        pct
      };
    });
  }, [kpiCurrentRows, kpiPreviousRows]);
  const peak = useMemo(() => {
    if (!kpiCurrentRows.length) return null;
    let best = kpiCurrentRows[0];
    kpiCurrentRows.forEach(r => {
      if ((r.demandKW || 0) > (best.demandKW || 0)) best = r;
    });
    return best;
  }, [kpiCurrentRows]);
  const efficiency = useMemo(() => {
    const elecGJ = sumMetric(kpiCurrentRows, "elecKWh") * settings.elecMJperKWh / 1000;
    const oilGJ = sumMetric(kpiCurrentRows, "oilTotalL") * settings.oilCalorificMJperL / 1000;
    const loadGJ = sumMetric(kpiCurrentRows, "totalLoadGJ") || sumMetric(kpiCurrentRows, "coolLoadGJ") + sumMetric(kpiCurrentRows, "heatLoadGJ");
    const inputGJ = elecGJ + oilGJ;
    const co2 = (sumMetric(kpiCurrentRows, "elecKWh") * settings.elecCO2PerKWh + sumMetric(kpiCurrentRows, "oilTotalL") * settings.oilCO2PerL) / 1000;
    const crudeOilKL = settings.crudeOilGJperKL > 0 ? inputGJ / settings.crudeOilGJperKL : null;
    const costYen = sumMetric(kpiCurrentRows, "elecKWh") * settings.elecPricePerKWh + sumMetric(kpiCurrentRows, "oilTotalL") * settings.oilPricePerL;
    return {
      inputGJ,
      loadGJ,
      ratio: inputGJ > 0 ? loadGJ / inputGJ * 100 : null,
      co2,
      crudeOilKL,
      costYen
    };
  }, [kpiCurrentRows, settings]);
  return /*#__PURE__*/React.createElement("div", {
    className: "app-shell" + (showReportPreview ? " report-preview" : ""),
    "data-theme": darkMode ? "dark" : "light"
  }, showReportPreview && /*#__PURE__*/React.createElement("div", {
    className: "report-preview-bar no-print"
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDCC4 \u30EC\u30DD\u30FC\u30C8\u30D7\u30EC\u30D3\u30E5\u30FC\u8868\u793A\u4E2D\uFF08\u3053\u306E\u5185\u5BB9\u304C\u5370\u5237/PDF\u5316\u3055\u308C\u307E\u3059\uFF09"), /*#__PURE__*/React.createElement("div", {
    className: "report-preview-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: () => window.print()
  }, "\uD83D\uDDA8 \u5370\u5237\u3059\u308B"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost",
    onClick: () => setShowReportPreview(false)
  }, "\u2715 \u30D7\u30EC\u30D3\u30E5\u30FC\u3092\u9589\u3058\u308B"))), /*#__PURE__*/React.createElement("header", {
    className: "app-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "app-title-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "app-title"
  }, "\u30A8\u30CD\u30EB\u30AE\u30FC\u7BA1\u7406\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9"), /*#__PURE__*/React.createElement("span", {
    className: "latest-date"
  }, "\u30C7\u30FC\u30BF\u6700\u7D42\u65E5: ", latestDate || "なし"), db && /*#__PURE__*/React.createElement("span", {
    className: "sync-badge",
    title: "\u4ED6\u7AEF\u672B\u3068Firebase\u3067\u30EA\u30A2\u30EB\u30BF\u30A4\u30E0\u540C\u671F\u3057\u3066\u3044\u307E\u3059"
  }, "\uD83D\uDD25 \u540C\u671F\u4E2D")), /*#__PURE__*/React.createElement("div", {
    className: "app-header-row2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mode-toggle"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost" + (mode === "dashboard" ? " active" : ""),
    onClick: () => setMode("dashboard")
  }, "\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost" + (mode === "analysis" ? " active" : ""),
    onClick: () => setMode("analysis")
  }, "\u5206\u6790"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost" + (mode === "entry" ? " active" : ""),
    onClick: () => setMode("entry")
  }, "\u30C7\u30FC\u30BF\u5165\u529B")), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost",
    onClick: () => setShowDataUpdate(true)
  }, "\u30C7\u30FC\u30BF\u66F4\u65B0"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost",
    onClick: () => setShowReportPreview(true),
    title: "\u5370\u5237/PDF\u4FDD\u5B58\u524D\u306B\u30EC\u30DD\u30FC\u30C8\u306E\u30D7\u30EC\u30D3\u30E5\u30FC\u3092\u8868\u793A\u3057\u307E\u3059"
  }, "\u30EC\u30DD\u30FC\u30C8\u4F5C\u6210(PDF)"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost header-settings-btn",
    onClick: () => setDarkMode(v => !v)
  }, darkMode ? "☀ ライト" : "🌙 ダーク"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost",
    onClick: () => setShowSettings(true)
  }, "\u8A2D\u5B9A"))), mode === "entry" && /*#__PURE__*/React.createElement(DataEntryView, {
    data: dataDisplay,
    onSave: handleSaveRecord,
    onDelete: handleDeleteRecord,
    notes: notes,
    onSaveNote: handleSaveNote
  }), mode === "analysis" && (data.length ? /*#__PURE__*/React.createElement(AnalysisView, {
    data: dataDisplay,
    settings: settings,
    darkMode: darkMode,
    notes: notes,
    onSaveNote: handleSaveNote
  }) : /*#__PURE__*/React.createElement("div", {
    className: "empty-state"
  }, "\u30C7\u30FC\u30BF\u304C\u3042\u308A\u307E\u305B\u3093\u3002")), mode === "dashboard" && !data.length && /*#__PURE__*/React.createElement("div", {
    className: "empty-state"
  }, "\u30C7\u30FC\u30BF\u304C\u3042\u308A\u307E\u305B\u3093\u3002\u300C\u30C7\u30FC\u30BF\u5165\u529B\u300D\u307E\u305F\u306F\u300C\u30C7\u30FC\u30BF\u66F4\u65B0\u300D\u304B\u3089\u53D6\u308A\u8FBC\u3093\u3067\u304F\u3060\u3055\u3044\u3002"), mode === "dashboard" && data.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "print-only-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "print-report-title"
  }, "\u30A8\u30CD\u30EB\u30AE\u30FC\u7BA1\u7406\u30EC\u30DD\u30FC\u30C8"), /*#__PURE__*/React.createElement("div", {
    className: "print-report-meta"
  }, "\u5BFE\u8C61\u671F\u9593: ", kpiLabel, " \uFF0F \u51FA\u529B\u65E5\u6642: ", new Date().toLocaleString("ja-JP"))), dataGaps.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "gap-banner"
  }, "\u30C7\u30FC\u30BF\u6B20\u843D\u671F\u9593\u306E\u53EF\u80FD\u6027: ", dataGaps.map((g, i) => /*#__PURE__*/React.createElement("span", {
    key: i
  }, i > 0 && "、", g.from, " \u301C ", g.to, "\uFF08\u7D04", g.days, "\u65E5\u5206\uFF09")), "\u3002\u5143\u30C7\u30FC\u30BF\uFF08\u30A8\u30CD\u30EB\u30AE\u30FC.xlsx\uFF09\u3092\u3054\u78BA\u8A8D\u306E\u3046\u3048\u3001\u5FC5\u8981\u3067\u3042\u308C\u3070\u4FEE\u6B63\u5F8C\u306B\u300C\u30C7\u30FC\u30BF\u66F4\u65B0\u300D\u304B\u3089\u518D\u53D6\u8FBC\u307F\u3057\u3066\u304F\u3060\u3055\u3044\u3002"), showAlertBanner && /*#__PURE__*/React.createElement("div", {
    className: "alert-banner no-print"
  }, /*#__PURE__*/React.createElement("div", {
    className: "alert-banner-header"
  }, /*#__PURE__*/React.createElement("span", null, "\u26A0 \u76F4\u8FD17\u65E5\u3067", recentAlerts.length, "\u4EF6\u306E\u6CE8\u610F\u4E8B\u9805\u304C\u3042\u308A\u307E\u3059"), /*#__PURE__*/React.createElement("div", {
    className: "alert-banner-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-small",
    onClick: () => setMode("analysis")
  }, "\u5206\u6790\u3067\u8A73\u3057\u304F\u898B\u308B"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-small",
    onClick: () => setDismissedAlertSig(alertSig)
  }, "\u9589\u3058\u308B"))), /*#__PURE__*/React.createElement("ul", {
    className: "alert-list"
  }, recentAlerts.map(a => {
    const existing = notes[a.date];
    const alreadyRecorded = existing && existing.includes(a.message);
    return /*#__PURE__*/React.createElement("li", {
      key: a.key
    }, a.message, /*#__PURE__*/React.createElement("button", {
      className: "btn btn-small alert-note-btn",
      disabled: alreadyRecorded,
      onClick: () => handleSaveNote(a.date, existing ? `${existing}\n${a.message}` : a.message)
    }, alreadyRecorded ? "記録済み" : "メモに記録"));
  }))), (() => {
    const renderChartBody = (chart, hideTitle) => {
      const forecastMetrics = chart.selectedMetrics.filter(m => FORECASTABLE.includes(m));
      const forecastMap = buckets && chart.showForecast && view !== "year" ? computeForecastMap(dataDisplay, view, selectedYm, selectedFY, chart.forecastMethod, forecastMetrics) : {};
      const chartBuckets = buckets ? {
        ...buckets,
        forecast: forecastMap
      } : null;
      const projectedKey = forecastMetrics[0];
      const projected = projectedKey && forecastMap[projectedKey] ? {
        key: projectedKey,
        total: forecastMap[projectedKey].summary.projectedTotal
      } : null;
      return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
        className: "panel-title-row"
      }, /*#__PURE__*/React.createElement("div", {
        className: "panel-title-left"
      }, !hideTitle && /*#__PURE__*/React.createElement("div", {
        className: "panel-title"
      }, chart.name), /*#__PURE__*/React.createElement("label", {
        className: "inline-toggle chart-header-toggle"
      }, /*#__PURE__*/React.createElement("input", {
        type: "checkbox",
        checked: chart.selectedMetrics.includes("tempAvg"),
        onChange: () => toggleChartMetric(chart, "tempAvg")
      }), "\u5916\u6C17\u6E29\u5EA6"), periodWeather && /*#__PURE__*/React.createElement("span", {
        className: "chart-weather"
      }, "\u6E7F\u5EA6 ", fmtNum(periodWeather.humidity, 0), "%RH\uFF08\u671F\u9593\u5E73\u5747\uFF09")), /*#__PURE__*/React.createElement("label", {
        className: "inline-toggle chart-header-toggle"
      }, /*#__PURE__*/React.createElement("input", {
        type: "checkbox",
        checked: chart.showForecast,
        onChange: e => updateChart(chart.id, {
          showForecast: e.target.checked
        }),
        disabled: view === "year"
      }), "\u4E88\u6E2C\u3092\u8868\u793A"), /*#__PURE__*/React.createElement("select", {
        className: "chart-header-select",
        value: chart.forecastMethod,
        onChange: e => updateChart(chart.id, {
          forecastMethod: e.target.value
        }),
        disabled: !chart.showForecast || view === "year"
      }, /*#__PURE__*/React.createElement("option", {
        value: "pace"
      }, "\u30DA\u30FC\u30B9\u4E88\u6E2C"), /*#__PURE__*/React.createElement("option", {
        value: "seasonal"
      }, "\u5B63\u7BC0\u6027(\u524D\u5E74\u6BD4)\u4E88\u6E2C"), /*#__PURE__*/React.createElement("option", {
        value: "regression"
      }, "\u6C17\u6E29\u56DE\u5E30\u4E88\u6E2C")), /*#__PURE__*/React.createElement("label", {
        className: "inline-toggle chart-header-toggle"
      }, /*#__PURE__*/React.createElement("input", {
        type: "checkbox",
        checked: chart.dayTypeColoring,
        onChange: e => updateChart(chart.id, {
          dayTypeColoring: e.target.checked
        })
      }), "\u5E73\u65E5/\u4F11\u65E5\u3067\u8272\u5206\u3051"), view !== "year" && /*#__PURE__*/React.createElement("label", {
        className: "inline-toggle chart-header-toggle"
      }, /*#__PURE__*/React.createElement("input", {
        type: "checkbox",
        checked: chart.compareEnabled,
        onChange: e => updateChart(chart.id, {
          compareEnabled: e.target.checked
        })
      }), "\u524D\u671F\u6BD4\u8F03"), /*#__PURE__*/React.createElement("button", {
        className: "gear-btn",
        onClick: () => setFullscreenChartId(chart.id),
        title: "\u62E1\u5927\u8868\u793A"
      }, /*#__PURE__*/React.createElement("span", {
        className: "gear-icon"
      }, "\u2922"), " \u62E1\u5927"), /*#__PURE__*/React.createElement("button", {
        className: "gear-btn",
        onClick: () => setOpenChartSettings(chart.id)
      }, /*#__PURE__*/React.createElement("span", {
        className: "gear-icon"
      }, "\u2699"), " \u30B0\u30E9\u30D5\u8A2D\u5B9A")), chart.dayTypeColoring && view === "day" && /*#__PURE__*/React.createElement("div", {
        className: "day-type-legend"
      }, Object.keys(DAY_TYPE_LABEL).map(k => /*#__PURE__*/React.createElement("span", {
        key: k,
        className: "legend-item"
      }, /*#__PURE__*/React.createElement("span", {
        className: "legend-dot",
        style: {
          background: DAY_TYPE_COLOR[k]
        }
      }), DAY_TYPE_LABEL[k]))), chart.selectedMetrics.length > 0 && /*#__PURE__*/React.createElement("div", {
        className: "chart-canvas-toolbar"
      }, /*#__PURE__*/React.createElement("button", {
        className: "btn btn-small",
        onClick: e => downloadChartCanvasImage(e.currentTarget.parentElement, `${chart.name}.png`)
      }, "\uD83D\uDDBC \u753B\u50CF\u4FDD\u5B58")), /*#__PURE__*/React.createElement("div", {
        className: "chart-canvas-wrap"
      }, chart.selectedMetrics.length > 0 ? /*#__PURE__*/React.createElement(ChartCanvas, {
        key: `chart${chart.id}-${view}-${selectedYm}-${selectedFY}-${chart.chartType}-${chart.selectedMetrics.join(",")}-${chart.showForecast}-${chart.forecastMethod}-${chart.dayTypeColoring}-${chart.compareEnabled}-${darkMode}`,
        getConfig: () => buildMainChartConfig({
          view,
          buckets: chartBuckets,
          chartType: chart.chartType,
          selectedMetrics: chart.selectedMetrics,
          showForecast: chart.showForecast,
          forecastMethod: chart.forecastMethod,
          dayTypeColoring: chart.dayTypeColoring,
          holidayMap,
          compareEnabled: chart.compareEnabled && view !== "year",
          allRows: dataDisplay
        })
      }) : /*#__PURE__*/React.createElement("div", {
        className: "chart-empty"
      }, "\u300C\u30B0\u30E9\u30D5\u8A2D\u5B9A\u300D\u304B\u3089\u8868\u793A\u3059\u308B\u9805\u76EE\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044")), chart.showForecast && projected != null && /*#__PURE__*/React.createElement("div", {
        className: "forecast-banner"
      }, METRICS[projected.key].label, " \u7740\u5730\u4E88\u6E2C: ", /*#__PURE__*/React.createElement("b", null, fmtNum(projected.total, 0), " ", METRICS[projected.key].unit), "\uFF08\u65B9\u5F0F: ", chart.forecastMethod === "pace" ? "ペース" : chart.forecastMethod === "seasonal" ? "季節性(前年比)" : "気温回帰", "\uFF09"), fullscreenChartId === chart.id && /*#__PURE__*/React.createElement("div", {
        className: "modal-backdrop",
        onClick: () => setFullscreenChartId(null)
      }, /*#__PURE__*/React.createElement("div", {
        className: "fullscreen-modal",
        onClick: e => e.stopPropagation()
      }, /*#__PURE__*/React.createElement("div", {
        className: "fullscreen-modal-header"
      }, /*#__PURE__*/React.createElement("input", {
        type: "text",
        className: "fullscreen-modal-title-input",
        value: chart.name,
        onChange: e => updateChart(chart.id, {
          name: e.target.value
        })
      }), /*#__PURE__*/React.createElement("button", {
        className: "btn",
        onClick: () => setFullscreenChartId(null)
      }, "\u9589\u3058\u308B \u2715")), /*#__PURE__*/React.createElement("div", {
        className: "panel-title-row"
      }, /*#__PURE__*/React.createElement("label", {
        className: "inline-toggle chart-header-toggle"
      }, /*#__PURE__*/React.createElement("input", {
        type: "checkbox",
        checked: chart.selectedMetrics.includes("tempAvg"),
        onChange: () => toggleChartMetric(chart, "tempAvg")
      }), "\u5916\u6C17\u6E29\u5EA6"), periodWeather && /*#__PURE__*/React.createElement("span", {
        className: "chart-weather"
      }, "\u6E7F\u5EA6 ", fmtNum(periodWeather.humidity, 0), "%RH\uFF08\u671F\u9593\u5E73\u5747\uFF09"), /*#__PURE__*/React.createElement("label", {
        className: "inline-toggle chart-header-toggle"
      }, /*#__PURE__*/React.createElement("input", {
        type: "checkbox",
        checked: chart.showForecast,
        onChange: e => updateChart(chart.id, {
          showForecast: e.target.checked
        }),
        disabled: view === "year"
      }), "\u4E88\u6E2C\u3092\u8868\u793A"), /*#__PURE__*/React.createElement("select", {
        className: "chart-header-select",
        value: chart.forecastMethod,
        onChange: e => updateChart(chart.id, {
          forecastMethod: e.target.value
        }),
        disabled: !chart.showForecast || view === "year"
      }, /*#__PURE__*/React.createElement("option", {
        value: "pace"
      }, "\u30DA\u30FC\u30B9\u4E88\u6E2C"), /*#__PURE__*/React.createElement("option", {
        value: "seasonal"
      }, "\u5B63\u7BC0\u6027(\u524D\u5E74\u6BD4)\u4E88\u6E2C"), /*#__PURE__*/React.createElement("option", {
        value: "regression"
      }, "\u6C17\u6E29\u56DE\u5E30\u4E88\u6E2C")), /*#__PURE__*/React.createElement("label", {
        className: "inline-toggle chart-header-toggle"
      }, /*#__PURE__*/React.createElement("input", {
        type: "checkbox",
        checked: chart.dayTypeColoring,
        onChange: e => updateChart(chart.id, {
          dayTypeColoring: e.target.checked
        })
      }), "\u5E73\u65E5/\u4F11\u65E5\u3067\u8272\u5206\u3051"), view !== "year" && /*#__PURE__*/React.createElement("label", {
        className: "inline-toggle chart-header-toggle"
      }, /*#__PURE__*/React.createElement("input", {
        type: "checkbox",
        checked: chart.compareEnabled,
        onChange: e => updateChart(chart.id, {
          compareEnabled: e.target.checked
        })
      }), "\u524D\u671F\u6BD4\u8F03"), /*#__PURE__*/React.createElement("button", {
        className: "gear-btn",
        onClick: () => setOpenChartSettings(chart.id)
      }, /*#__PURE__*/React.createElement("span", {
        className: "gear-icon"
      }, "\u2699"), " \u30B0\u30E9\u30D5\u8A2D\u5B9A")), /*#__PURE__*/React.createElement("div", {
        className: "fullscreen-chart-wrap"
      }, chart.selectedMetrics.length > 0 && /*#__PURE__*/React.createElement(ChartCanvas, {
        key: `fs-chart${chart.id}-${view}-${selectedYm}-${selectedFY}-${chart.chartType}-${chart.selectedMetrics.join(",")}-${chart.showForecast}-${chart.forecastMethod}-${chart.dayTypeColoring}-${chart.compareEnabled}-${darkMode}`,
        getConfig: () => buildMainChartConfig({
          view,
          buckets: chartBuckets,
          chartType: chart.chartType,
          selectedMetrics: chart.selectedMetrics,
          showForecast: chart.showForecast,
          forecastMethod: chart.forecastMethod,
          dayTypeColoring: chart.dayTypeColoring,
          holidayMap,
          compareEnabled: chart.compareEnabled && view !== "year",
          allRows: dataDisplay
        })
      })))));
    };
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("section", {
      className: "kpi-row"
    }, /*#__PURE__*/React.createElement("div", {
      className: "kpi-period-header"
    }, /*#__PURE__*/React.createElement("div", {
      className: "kpi-period-left"
    }, view !== "year" && /*#__PURE__*/React.createElement("div", {
      className: "kpi-period-nav"
    }, /*#__PURE__*/React.createElement("button", {
      className: "period-nav-btn",
      onClick: () => stepPeriod(-1),
      "aria-label": "\u524D\u306E\u671F\u9593"
    }, "\u25C1"), /*#__PURE__*/React.createElement("button", {
      className: "period-nav-btn",
      onClick: () => stepPeriod(1),
      "aria-label": "\u6B21\u306E\u671F\u9593"
    }, "\u25B7")), /*#__PURE__*/React.createElement("div", {
      className: "kpi-period-label"
    }, kpiLabel, " ", /*#__PURE__*/React.createElement("span", {
      className: "kpi-period-sub"
    }, "\u5B9F\u7E3E\uFF08", kpiCurrentRows.length, "/", periodDays, "\u65E5 \u5165\u529B\u6E08\u307F\uFF09"))), /*#__PURE__*/React.createElement("nav", {
      className: "tabs"
    }, [["day", "月"], ["month", "年"]].map(([v, label]) => /*#__PURE__*/React.createElement("button", {
      key: v,
      className: "tab" + (view === v ? " active" : ""),
      onClick: () => setView(v)
    }, label)), /*#__PURE__*/React.createElement("div", {
      className: "period-picker"
    }, view === "day" && /*#__PURE__*/React.createElement("input", {
      type: "month",
      value: selectedYm,
      onChange: e => setSelectedYm(e.target.value)
    }), view === "month" && /*#__PURE__*/React.createElement("select", {
      value: selectedFY,
      onChange: e => setSelectedFY(Number(e.target.value))
    }, fiscalYears.map(fy => /*#__PURE__*/React.createElement("option", {
      key: fy,
      value: fy
    }, fy, "\u5E74\u5EA6")))))), /*#__PURE__*/React.createElement("div", {
      className: "kpi-cards"
    }, kpiList.map(k => /*#__PURE__*/React.createElement(KPICard, _extends({
      key: k.key
    }, k, {
      active: !!charts[0] && charts[0].selectedMetrics.includes(k.key),
      onClick: () => toggleMetricInFirstChart(k.key)
    }))), peak && /*#__PURE__*/React.createElement(KPICard, {
      label: "\u65E5\u5E73\u5747\u96FB\u529B\u30D4\u30FC\u30AF(\u7C21\u6613\u30C7\u30DE\u30F3\u30C9)",
      current: peak.demandKW,
      unit: "kW",
      highlight: `${peak.date} / 契約比 ${fmtNum(peak.demandKW / settings.contractKW * 100, 0)}%`,
      active: !!charts[0] && charts[0].selectedMetrics.includes("demandKW"),
      onClick: () => toggleMetricInFirstChart("demandKW")
    }), /*#__PURE__*/React.createElement(KPICard, {
      label: "\u7DCF\u5408\u71B1\u6E90\u52B9\u7387(\u4F9B\u7D66\u71B1\u91CF/\u6295\u5165\u71B1\u91CF)",
      current: efficiency.ratio,
      unit: "%",
      active: !!charts[0] && charts[0].selectedMetrics.includes("efficiencyPct"),
      onClick: () => toggleMetricInFirstChart("efficiencyPct")
    }), /*#__PURE__*/React.createElement(KPICard, {
      label: "CO2\u6392\u51FA\u91CF",
      current: efficiency.co2,
      unit: "t-CO2",
      active: !!charts[0] && charts[0].selectedMetrics.includes("co2T"),
      onClick: () => toggleMetricInFirstChart("co2T")
    }), /*#__PURE__*/React.createElement(KPICard, {
      label: "\u539F\u6CB9\u63DB\u7B97\u5024",
      current: efficiency.crudeOilKL,
      unit: "kL",
      active: !!charts[0] && charts[0].selectedMetrics.includes("crudeOilKL"),
      onClick: () => toggleMetricInFirstChart("crudeOilKL")
    }), /*#__PURE__*/React.createElement(KPICard, {
      label: "\u6982\u7B97\u30B3\u30B9\u30C8",
      current: efficiency.costYen,
      unit: "\u5186",
      active: !!charts[0] && charts[0].selectedMetrics.includes("costYen"),
      onClick: () => toggleMetricInFirstChart("costYen")
    })), charts[0] && /*#__PURE__*/React.createElement("div", {
      className: "combined-chart-wrap"
    }, renderChartBody(charts[0], true))), charts.slice(1).map(chart => /*#__PURE__*/React.createElement("section", {
      className: "chart-panel chart-main",
      key: chart.id
    }, renderChartBody(chart))));
  })(), /*#__PURE__*/React.createElement("button", {
    className: "add-chart-btn",
    onClick: addChart
  }, "\uFF0B \u30B0\u30E9\u30D5\u3092\u8FFD\u52A0"), openChartSettings != null && (() => {
    const chart = charts.find(c => c.id === openChartSettings);
    if (!chart) return null;
    return /*#__PURE__*/React.createElement(ChartSettingsModal, {
      name: chart.name,
      onNameChange: v => updateChart(chart.id, {
        name: v
      }),
      chartType: chart.chartType,
      onChartTypeChange: v => updateChart(chart.id, {
        chartType: v
      }),
      selected: chart.selectedMetrics,
      onSelectedChange: v => updateChart(chart.id, {
        selectedMetrics: v
      }),
      onDelete: charts.length > 1 ? () => removeChart(chart.id) : null,
      onClose: () => setOpenChartSettings(null)
    });
  })()), showSettings && /*#__PURE__*/React.createElement(SettingsModal, {
    settings: settings,
    onSave: handleSaveSettings,
    onClose: () => setShowSettings(false),
    onExportBackup: handleExportBackup,
    onImportBackup: handleImportBackup,
    autoSaveSupported: autoSaveSupported,
    autoSaveFileName: autoSaveFileName,
    autoSaveStatus: autoSaveStatus,
    needsReauth: needsReauth,
    onConnectAutoSave: handleConnectAutoSaveFile,
    onReauthorizeAutoSave: handleReauthorizeAutoSaveFile,
    onDisconnectAutoSave: handleDisconnectAutoSaveFile
  }), showDataUpdate && /*#__PURE__*/React.createElement(DataUpdateModal, {
    onImport: handleImportData,
    onClose: () => setShowDataUpdate(false)
  }), /*#__PURE__*/React.createElement("style", null, `
        .app-shell { max-width: 1280px; margin: 0 auto; padding: 16px 20px 60px; }
        .app-header { padding:14px 20px; background:#0f172a; color:#fff; border-radius:12px; margin-bottom:16px; }
        .app-title-row { margin-bottom:12px; display:flex; align-items:baseline; gap:12px; flex-wrap:wrap; }
        .app-title { font-size:18px; font-weight:700; }
        .app-header-row2 { display:flex; align-items:center; gap:10px; font-size:13px; flex-wrap:wrap; }
        .header-settings-btn { margin-left:auto; }
        .latest-date { opacity:0.8; margin-right:6px; }
        .sync-badge { font-size:12px; background:#134e33; color:#86efac; padding:3px 8px; border-radius:12px; }
        .btn { border:1px solid #cbd5e1; background:#fff; border-radius:8px; padding:6px 14px; font-size:13px; cursor:pointer; color:#0f172a; }
        .btn:hover { background:#f1f5f9; }
        .btn-ghost { background:rgba(255,255,255,0.08); border-color:rgba(255,255,255,0.3); color:#fff; }
        .btn-ghost:hover { background:rgba(255,255,255,0.18); }
        .btn-primary { background:#2563eb; border-color:#2563eb; color:#fff; }
        .btn-small { padding:5px 10px; font-size:12px; }
        .btn-small.active, .tab.active { background:#2563eb; border-color:#2563eb; color:#fff; }
        .gap-banner { background:#fff7ed; border:1px solid #fed7aa; color:#9a3412; font-size:12px; padding:8px 14px; border-radius:8px; margin-bottom:12px; }
        .alert-banner { background:#fef2f2; border:1px solid #fecaca; color:#991b1b; font-size:12px; padding:10px 14px; border-radius:8px; margin-bottom:12px; }
        .alert-banner-header { display:flex; align-items:center; justify-content:space-between; font-weight:700; gap:10px; flex-wrap:wrap; }
        .alert-banner-actions { display:flex; gap:8px; }
        .alert-banner-actions .btn-small { background:#fff; }
        .alert-list { margin:8px 0 0; padding-left:18px; }
        .alert-list li { margin-bottom:4px; display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; }
        .alert-note-btn { background:#fff; flex-shrink:0; }
        .anomaly-table td button:disabled, .alert-note-btn:disabled { opacity:0.5; cursor:default; }
        .tabs { display:flex; align-items:center; gap:6px; flex-wrap:wrap; background:#fff; border:1px solid #cbd5e1; border-radius:10px; padding:6px 10px; box-shadow:0 1px 3px rgba(0,0,0,0.06); }
        .tab { border:none; background:transparent; padding:8px 20px; border-radius:8px; cursor:pointer; font-size:14px; }
        .period-picker { padding-left:12px; border-left:1px solid #e2e8f0; display:flex; align-items:center; }
        .period-picker select, .period-picker input { padding:6px 10px; border-radius:8px; border:1px solid #cbd5e1; font-size:13px; }
        .inline-toggle { font-size:13px; display:flex; align-items:center; gap:6px; margin-left:8px; }
        .kpi-row { background:#fff; border-radius:12px; padding:16px 20px; margin-bottom:16px; box-shadow:0 1px 3px rgba(0,0,0,0.06); }
        .combined-chart-wrap { margin-top:20px; padding-top:18px; border-top:1px solid #e2e8f0; }
        .kpi-period-header { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:12px; }
        .kpi-period-left { display:flex; flex-direction:column; gap:4px; }
        .kpi-period-nav { display:flex; gap:6px; }
        .period-nav-btn { border:1px solid #cbd5e1; background:#fff; border-radius:6px; width:30px; height:24px; font-size:12px; line-height:1; cursor:pointer; color:#475569; }
        .period-nav-btn:hover { background:#f1f5f9; }
        .kpi-period-label { font-size:20px; color:#0f172a; font-weight:700; }
        .kpi-period-sub { font-size:13px; color:#64748b; font-weight:400; }
        .kpi-cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; }
        .kpi-card { background:#f8fafc; border-radius:10px; padding:12px 14px; border:2px solid transparent; text-align:left; font-family:inherit; }
        .kpi-card.clickable { cursor:pointer; }
        .kpi-card.clickable:hover { background:#f1f5f9; }
        .kpi-card.active { border-color:#2563eb; }
        .kpi-card.increase { background:#fef2f2; }
        .kpi-card.active.increase { background:#fee2e2; }
        .kpi-label { font-size:12px; color:#64748b; margin-bottom:4px; }
        .kpi-value { font-size:20px; font-weight:700; }
        .kpi-unit { font-size:12px; font-weight:400; color:#64748b; }
        .kpi-delta { font-size:12px; margin-top:4px; color:#64748b; }
        .kpi-delta.up { color:#dc2626; }
        .kpi-delta.down { color:#2563eb; }
        .kpi-prev { color:#94a3b8; display:block; margin-top:2px; }
        .kpi-highlight { font-size:11px; color:#ea580c; margin-top:4px; }
        .forecast-banner { margin-top:12px; padding:10px 14px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; font-size:13px; color:#1e3a8a; }
        .controls-row { display:flex; flex-wrap:wrap; gap:16px; background:#fff; border-radius:12px; padding:14px 18px; margin-bottom:16px; box-shadow:0 1px 3px rgba(0,0,0,0.06); }
        .metric-selector { display:flex; gap:18px; flex-wrap:wrap; }
        .metric-selector.compact { flex-direction:column; gap:12px; }
        .metric-group-title { font-size:11px; color:#94a3b8; margin-bottom:6px; font-weight:700; }
        .metric-chip { display:inline-flex; align-items:center; gap:5px; border:1px solid #e2e8f0; border-radius:16px; padding:4px 10px; font-size:12px; margin:0 6px 6px 0; cursor:pointer; }
        .metric-selector.compact .metric-chip { display:flex; width:fit-content; }
        .chart-controls { display:flex; gap:20px; flex-wrap:wrap; flex:1; min-width:280px; }
        .control-title { font-size:11px; color:#94a3b8; margin-bottom:6px; font-weight:700; }
        .control-block select { margin-left:8px; padding:4px 8px; border-radius:6px; border:1px solid #cbd5e1; font-size:12px; }
        .chart-panel { background:#fff; border-radius:12px; padding:16px 18px; margin-bottom:16px; box-shadow:0 1px 3px rgba(0,0,0,0.06); }
        .chart-canvas-wrap { position:relative; height:300px; }
        .chart-canvas-toolbar { display:flex; justify-content:flex-end; margin-bottom:6px; }
        .chart-main { display:flex; flex-direction:column; }
        .chart-empty { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:13px; }
        .panel-title-row { display:flex; align-items:center; flex-wrap:wrap; gap:14px; margin-bottom:8px; }
        .panel-title-left { display:flex; align-items:center; gap:14px; margin-right:auto; }
        .panel-title-row .panel-title { margin-bottom:0; }
        .chart-header-toggle { margin-left:0; font-size:12px; color:#64748b; white-space:nowrap; }
        .chart-weather { font-size:12px; color:#16a34a; white-space:nowrap; }
        .chart-header-select { font-size:12px; padding:4px 6px; border-radius:6px; border:1px solid #cbd5e1; }
        .gear-btn { display:flex; align-items:center; gap:5px; background:none; border:none; font-size:13px; line-height:1; cursor:pointer; color:#64748b; padding:5px 10px; border-radius:6px; }
        .gear-btn .gear-icon { font-size:16px; }
        .gear-btn:hover { background:#f1f5f9; color:#0f172a; }
        .chart-settings-section { margin-top:16px; }
        .chart-type-buttons { display:flex; flex-wrap:wrap; gap:6px; }
        .chart-settings-metrics { max-height:320px; overflow-y:auto; }
        .panel-title { font-size:13px; font-weight:700; color:#334155; margin-bottom:8px; }
        .day-type-legend { display:flex; gap:16px; margin:-4px 0 10px 0; font-size:12px; color:#64748b; }
        .add-chart-btn { width:100%; background:#fff; border:2px dashed #cbd5e1; border-radius:12px; padding:14px; margin-bottom:16px; color:#64748b; font-size:14px; cursor:pointer; }
        .add-chart-btn:hover { background:#f8fafc; border-color:#94a3b8; color:#334155; }
        .legend-item { display:flex; align-items:center; gap:5px; }
        .legend-dot { width:10px; height:10px; border-radius:50%; display:inline-block; }
        .empty-state { padding:60px; text-align:center; color:#64748b; }
        .modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,0.5); display:flex; align-items:center; justify-content:center; z-index:1000; }
        .modal { background:#fff; border-radius:12px; padding:22px 24px; width:420px; max-width:90vw; max-height:85vh; overflow:auto; }
        .fullscreen-modal { background:#fff; border-radius:12px; padding:20px 24px; width:min(1100px, 92vw); max-height:90vh; display:flex; flex-direction:column; overflow:auto; }
        .fullscreen-modal-header { display:flex; align-items:center; justify-content:space-between; gap:14px; margin-bottom:12px; }
        .fullscreen-modal-title-input { flex:1; font-size:18px; font-weight:700; border:1px solid transparent; border-radius:8px; padding:6px 8px; font-family:inherit; }
        .fullscreen-modal-title-input:hover, .fullscreen-modal-title-input:focus { border-color:#cbd5e1; }
        .fullscreen-chart-wrap { position:relative; height:min(60vh, 560px); flex-shrink:0; margin-top:14px; }
        .modal h3 { margin:0 0 10px; }
        .modal-note { font-size:12px; color:#64748b; margin-bottom:14px; }
        .settings-backup-section { margin:16px 0; padding-top:14px; border-top:1px solid #e2e8f0; }
        .backup-file-label { display:inline-flex; align-items:center; cursor:pointer; }
        .form-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; font-size:13px; }
        .form-row input { width:120px; padding:5px 8px; border-radius:6px; border:1px solid #cbd5e1; }
        .modal-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:16px; }
        .modal-status { margin-top:10px; font-size:12px; color:#2563eb; }
        .mode-toggle { display:flex; gap:4px; margin-right:6px; }
        .mode-toggle .btn.active { background:#2563eb; border-color:#2563eb; color:#fff; }
        .analysis-fy-label { font-size:13px; color:#64748b; }
        .tabs select { padding:6px 10px; border-radius:8px; border:1px solid #cbd5e1; font-size:13px; }
        .analysis-note { font-size:12px; color:#64748b; margin:0 0 12px; }
        .analysis-empty { padding:24px; text-align:center; color:#94a3b8; font-size:13px; }
        .overlay-year-checks { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:14px; }
        .anomaly-table { width:100%; border-collapse:collapse; font-size:12px; }
        .anomaly-table th, .anomaly-table td { padding:6px 10px; border-bottom:1px solid #f1f5f9; text-align:right; }
        .anomaly-table th:first-child, .anomaly-table td:first-child { text-align:left; }
        .anomaly-table th { color:#94a3b8; font-weight:700; background:#f8fafc; }
        .dev-up { color:#dc2626; font-weight:700; }
        .dev-down { color:#2563eb; font-weight:700; }
        .target-row { margin-bottom:14px; }
        .target-label { font-size:13px; margin-bottom:6px; color:#334155; }
        .target-bar-bg { height:14px; background:#f1f5f9; border-radius:7px; overflow:hidden; }
        .target-bar { height:100%; background:#2563eb; border-radius:7px; }
        .target-bar.over { background:#dc2626; }
        .heatmap-scroll { overflow-x:auto; }
        .heatmap-grid { display:grid; grid-template-columns:44px repeat(31, minmax(16px, 1fr)); gap:3px; min-width:640px; }
        .heatmap-mlabel { font-size:11px; color:#64748b; display:flex; align-items:center; }
        .heatmap-dlabel { font-size:10px; color:#94a3b8; text-align:center; }
        .heatmap-cell { aspect-ratio:1; border-radius:3px; }
        .heatmap-cell.blank { background:transparent; }
        .entry-layout { display:flex; gap:16px; flex-wrap:wrap; align-items:flex-start; }
        .entry-calendar-panel { background:#fff; border-radius:12px; padding:16px 18px; box-shadow:0 1px 3px rgba(0,0,0,0.06); flex:1; min-width:320px; max-width:420px; }
        .entry-cal-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
        .entry-cal-title { font-size:15px; font-weight:700; }
        .entry-cal-summary { font-size:12px; color:#64748b; }
        .entry-cal-summary-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; gap:8px; flex-wrap:wrap; }
        .entry-cal-summary-actions { display:flex; gap:6px; flex-wrap:wrap; }
        .missing-day-item { color:#b45309; }
        .notes-list { max-height:400px; overflow-y:auto; display:flex; flex-direction:column; gap:8px; }
        .notes-list-item { display:block; width:100%; text-align:left; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px 12px; cursor:pointer; }
        .notes-list-item:hover { background:#f1f5f9; }
        .notes-list-date { font-size:12px; font-weight:700; color:#2563eb; margin-bottom:4px; }
        .notes-list-text { font-size:13px; color:#334155; white-space:pre-wrap; }
        .entry-cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:4px; }
        .entry-cal-dow { margin-bottom:4px; }
        .entry-cal-dow-cell { text-align:center; font-size:11px; color:#94a3b8; font-weight:700; }
        .entry-cal-cell { position:relative; aspect-ratio:1; border:1px solid #e2e8f0; border-radius:8px; background:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0; }
        .entry-cal-cell.empty { border:none; cursor:default; }
        .entry-cal-cell.sun .entry-cal-day { color:#dc2626; }
        .entry-cal-cell.sat .entry-cal-day { color:#2563eb; }
        .entry-cal-cell.has-data { background:#ecfdf5; border-color:#6ee7b7; }
        .entry-cal-cell.selected { outline:2px solid #2563eb; outline-offset:-2px; }
        .entry-cal-day { font-size:12px; }
        .entry-cal-dot { position:absolute; bottom:3px; width:5px; height:5px; border-radius:50%; background:#10b981; }
        .entry-cal-note-icon { position:absolute; top:1px; right:2px; font-size:9px; line-height:1; }
        .entry-cal-dot.standalone { position:static; display:inline-block; margin-right:4px; }
        .entry-cal-dot.empty-dot { background:#e2e8f0; }
        .entry-cal-legend { display:flex; gap:14px; margin-top:10px; font-size:11px; color:#64748b; }
        .entry-form-panel { flex:1; min-width:320px; background:#fff; border-radius:12px; padding:18px 20px; box-shadow:0 1px 3px rgba(0,0,0,0.06); }
        .entry-list-panel { background:#fff; border-radius:12px; padding:18px 20px; margin-top:16px; box-shadow:0 1px 3px rgba(0,0,0,0.06); }
        .entry-list-scroll { overflow-x:auto; margin-top:10px; }
        .entry-list-table { border-collapse:collapse; font-size:12px; white-space:nowrap; }
        .entry-list-table th, .entry-list-table td { padding:6px 10px; border:1px solid #e2e8f0; text-align:right; }
        .entry-list-table th { background:#f8fafc; color:#475569; font-weight:700; font-size:11px; }
        .entry-list-unit { font-weight:400; color:#94a3b8; }
        .entry-list-datecol { text-align:left !important; position:sticky; left:0; background:#fff; font-weight:700; }
        .entry-list-table th.entry-list-datecol { background:#f8fafc; z-index:1; }
        .entry-list-table td.calc-col { background:#ecfeff; }
        .entry-list-table th.calc-col { background:#cffafe; }
        .entry-list-table tbody tr:hover { background:#f8fafc; cursor:pointer; }
        .entry-list-table tbody tr:hover td.calc-col { background:#e0f7fa; }
        .entry-list-table tbody tr.selected td { background:#dbeafe; }
        .entry-list-table tbody tr.selected td.calc-col { background:#bfe3fb; }
        .entry-form-title { font-size:15px; font-weight:700; }
        .entry-form-title-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; gap:10px; }
        .entry-form-prev-note { font-size:12px; color:#64748b; margin-bottom:10px; }
        .entry-form-grid { display:grid; grid-template-columns:1fr; gap:8px; }
        .entry-form-header-row { display:grid; grid-template-columns:1fr 90px 90px 156px; font-size:11px; color:#94a3b8; font-weight:700; padding:0 2px 2px; }
        .entry-form-prev-head, .entry-form-input-head { text-align:right; padding-right:4px; }
        .entry-form-row { display:grid; grid-template-columns:1fr 90px 90px 156px; align-items:center; font-size:13px; gap:8px; padding:4px 0; border-bottom:1px dashed #f1f5f9; }
        .entry-form-label { color:#334155; }
        .entry-form-prev-value { text-align:right; color:#94a3b8; font-size:12px; padding-right:4px; }
        .entry-form-input-wrap { display:flex; align-items:center; gap:6px; justify-self:end; }
        .entry-form-input-wrap input { width:110px; padding:6px 8px; border-radius:6px; border:1px solid #cbd5e1; font-size:13px; }
        .entry-form-unit { font-size:12px; color:#94a3b8; width:36px; }
        .entry-form-computed { margin-top:14px; padding:10px 12px; background:#f8fafc; border-radius:8px; font-size:12px; color:#475569; display:flex; flex-direction:column; gap:4px; }
        .entry-form-actions { display:flex; justify-content:space-between; align-items:center; margin-top:16px; }
        .entry-form-actions .btn-primary:disabled { opacity:0.5; cursor:not-allowed; }
        .entry-validation { margin-top:12px; padding:8px 12px; border-radius:8px; font-size:12px; }
        .entry-validation-error { background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; }
        .entry-validation-warn { background:#fffbeb; color:#92400e; border:1px solid #fde68a; }
        .entry-note-section { margin-top:20px; padding-top:14px; border-top:1px solid #e2e8f0; }
        .entry-note-textarea { width:100%; padding:8px 10px; border-radius:8px; border:1px solid #cbd5e1; font-size:13px; font-family:inherit; resize:vertical; margin-bottom:8px; }
        .entry-note-saved-msg { margin-left:10px; }
        .btn-ghost-red { border-color:#fecaca; color:#dc2626; background:#fff; }
        .btn-ghost-red:hover { background:#fef2f2; }
        .entry-saved-msg { margin-top:10px; font-size:12px; color:#16a34a; }

        .app-shell[data-theme="dark"] { color:#e2e8f0; }
        .app-shell[data-theme="dark"] .kpi-row, .app-shell[data-theme="dark"] .chart-panel,
        .app-shell[data-theme="dark"] .chart-side-selector, .app-shell[data-theme="dark"] .entry-calendar-panel,
        .app-shell[data-theme="dark"] .entry-form-panel, .app-shell[data-theme="dark"] .entry-list-panel,
        .app-shell[data-theme="dark"] .controls-row, .app-shell[data-theme="dark"] .modal,
        .app-shell[data-theme="dark"] .alert-banner { background:#3f1d1d; color:#fecaca; box-shadow:none; border:1px solid #7f1d1d; }
        .app-shell[data-theme="dark"] .alert-banner-actions .btn-small { background:#1e293b; color:#e2e8f0; }
        .app-shell[data-theme="dark"] .kpi-card { background:#0f172a; }
        .app-shell[data-theme="dark"] .kpi-card.increase { background:#3f1d1d; }
        .app-shell[data-theme="dark"] .kpi-card.clickable:hover { background:#334155; }
        .app-shell[data-theme="dark"] .kpi-label, .app-shell[data-theme="dark"] .panel-title, .app-shell[data-theme="dark"] .control-title,
        .app-shell[data-theme="dark"] .chart-header-toggle, .app-shell[data-theme="dark"] .analysis-note,
        .app-shell[data-theme="dark"] .kpi-period-sub, .app-shell[data-theme="dark"] .entry-cal-summary { color:#94a3b8; }
        .app-shell[data-theme="dark"] .kpi-period-label { color:#f1f5f9; }
        .app-shell[data-theme="dark"] .kpi-value, .app-shell[data-theme="dark"] .entry-form-label,
        .app-shell[data-theme="dark"] .entry-cal-title { color:#f1f5f9; }
        .app-shell[data-theme="dark"] input, .app-shell[data-theme="dark"] select, .app-shell[data-theme="dark"] textarea {
          background:#0f172a; color:#e2e8f0; border-color:#334155;
        }
        .app-shell[data-theme="dark"] .btn { background:#1e293b; color:#e2e8f0; border-color:#334155; }
        .app-shell[data-theme="dark"] .btn:hover { background:#334155; }
        .app-shell[data-theme="dark"] .tabs { background:#1e293b; border-color:#334155; }
        .app-shell[data-theme="dark"] .tab { background:transparent; color:#e2e8f0; }
        .app-shell[data-theme="dark"] .period-picker { border-left-color:#334155; }
        .app-shell[data-theme="dark"] .period-nav-btn { background:#1e293b; color:#e2e8f0; border-color:#334155; }
        .app-shell[data-theme="dark"] .period-nav-btn:hover { background:#334155; }
        .app-shell[data-theme="dark"] .entry-cal-cell { background:#0f172a; border-color:#334155; }
        .app-shell[data-theme="dark"] .notes-list-item { background:#0f172a; border-color:#334155; }
        .app-shell[data-theme="dark"] .notes-list-item:hover { background:#1e293b; }
        .app-shell[data-theme="dark"] .notes-list-text { color:#e2e8f0; }
        .app-shell[data-theme="dark"] .entry-cal-cell.has-data { background:#134e33; border-color:#15803d; }
        .app-shell[data-theme="dark"] .entry-list-table th { background:#0f172a; }
        .app-shell[data-theme="dark"] .entry-list-table td, .app-shell[data-theme="dark"] .entry-list-table th { border-color:#334155; }
        .app-shell[data-theme="dark"] .entry-list-table td.calc-col { background:#0e3b3f; }
        .app-shell[data-theme="dark"] .entry-list-datecol { background:#1e293b; }
        .app-shell[data-theme="dark"] .forecast-banner { background:#0c2a4a; border-color:#1d4ed8; color:#bfdbfe; }
        .app-shell[data-theme="dark"] .combined-chart-wrap { border-color:#334155; }
        .app-shell[data-theme="dark"] .anomaly-table th { background:#0f172a; }
        .app-shell[data-theme="dark"] .anomaly-table td, .app-shell[data-theme="dark"] .anomaly-table th { border-color:#334155; }
        .app-shell[data-theme="dark"] .add-chart-btn { background:#1e293b; border-color:#334155; color:#94a3b8; }
        .app-shell[data-theme="dark"] .empty-state, .app-shell[data-theme="dark"] .chart-empty,
        .app-shell[data-theme="dark"] .analysis-empty { color:#64748b; }
        .app-shell[data-theme="dark"] .target-bar-bg { background:#0f172a; }
        .app-shell[data-theme="dark"] .gap-banner { background:#3f2d0d; border-color:#92400e; color:#fde68a; }
        .app-shell[data-theme="dark"] .modal-note { color:#94a3b8; }

        .print-only-header { display:none; }
        .print-report-title { font-size:20px; font-weight:700; }
        .print-report-meta { font-size:12px; color:#475569; margin-top:4px; }

        .report-preview-bar {
          position:sticky; top:0; z-index:500; display:flex; align-items:center; justify-content:space-between;
          gap:12px; background:#0f172a; color:#fff; padding:10px 16px; border-radius:10px; margin-bottom:16px;
        }
        .report-preview-bar span { font-size:13px; }
        .report-preview-actions { display:flex; gap:8px; }

        /* 画面上でのレポートプレビュー表示（実際の印刷用CSSと同じ内容を画面にも適用） */
        .app-shell.report-preview .no-print:not(.report-preview-bar),
        .app-shell.report-preview .app-header-row2, .app-shell.report-preview .tabs,
        .app-shell.report-preview .gear-btn, .app-shell.report-preview .chart-header-toggle,
        .app-shell.report-preview .chart-header-select, .app-shell.report-preview .add-chart-btn,
        .app-shell.report-preview .mode-toggle, .app-shell.report-preview .entry-list-panel,
        .app-shell.report-preview .day-type-legend, .app-shell.report-preview .chart-canvas-toolbar,
        .app-shell.report-preview .alert-banner-actions, .app-shell.report-preview .kpi-period-header
          { display:none !important; }
        .app-shell.report-preview { background:#fff; }
        .app-shell.report-preview .app-header { background:#fff; color:#0f172a; box-shadow:none; padding:0 0 8px; }
        .app-shell.report-preview .print-only-header { display:block; margin-bottom:14px; border-bottom:2px solid #0f172a; padding-bottom:10px; }
        .app-shell.report-preview .chart-panel, .app-shell.report-preview .kpi-row,
        .app-shell.report-preview .combined-chart-wrap, .app-shell.report-preview .chart-side-selector
          { box-shadow:none !important; border:1px solid #cbd5e1; }

        @media print {
          .no-print, .app-header-row2, .tabs, .gear-btn, .chart-header-toggle, .chart-header-select,
          .add-chart-btn, .mode-toggle, .entry-list-panel, .day-type-legend, .chart-canvas-toolbar,
          .alert-banner-actions, .kpi-period-header { display:none !important; }
          body { background:#fff; }
          .app-shell { padding:0; max-width:100%; }
          .app-header { background:#fff; color:#0f172a; border-radius:0; box-shadow:none; padding:0 0 8px; }
          .print-only-header { display:block; margin-bottom:14px; border-bottom:2px solid #0f172a; padding-bottom:10px; }
          .gap-banner, .alert-banner { break-inside:avoid; page-break-inside:avoid; }
          .chart-panel, .kpi-row, .combined-chart-wrap, .chart-side-selector { box-shadow:none !important; border:1px solid #cbd5e1; break-inside:avoid; page-break-inside:avoid; }
          .kpi-card { break-inside:avoid; }
          .chart-canvas-wrap { height:260px !important; }
        }
      `));
}
function AuthGate() {
  const [authState, setAuthState] = useState(() => auth ? "checking" : "none");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  useEffect(() => {
    if (!auth) return;
    const unsub = auth.onAuthStateChanged(user => setAuthState(user ? "signedIn" : "signedOut"));
    return unsub;
  }, []);
  if (authState === "none" || authState === "signedIn") return /*#__PURE__*/React.createElement(App, null);
  if (authState === "checking") return /*#__PURE__*/React.createElement("div", {
    className: "auth-gate"
  }, /*#__PURE__*/React.createElement("div", {
    className: "auth-loading"
  }, "\u78BA\u8A8D\u4E2D\u2026"));
  const handleLogin = async e => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    const form = e.target;
    try {
      await auth.signInWithEmailAndPassword(form.email.value, form.password.value);
    } catch (err) {
      setLoginError("サインインできませんでした。メールアドレスとパスワードをご確認ください。");
    } finally {
      setLoginLoading(false);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "auth-gate"
  }, /*#__PURE__*/React.createElement("form", {
    className: "auth-form",
    onSubmit: handleLogin
  }, /*#__PURE__*/React.createElement("div", {
    className: "auth-title"
  }, "\u30A8\u30CD\u30EB\u30AE\u30FC\u7BA1\u7406\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9"), /*#__PURE__*/React.createElement("p", {
    className: "modal-note"
  }, "\u540C\u671F\u7528\u30A2\u30AB\u30A6\u30F3\u30C8\u3067\u30B5\u30A4\u30F3\u30A4\u30F3\u3057\u3066\u304F\u3060\u3055\u3044\u3002"), /*#__PURE__*/React.createElement("div", {
    className: "form-row"
  }, /*#__PURE__*/React.createElement("label", null, "\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9"), /*#__PURE__*/React.createElement("input", {
    type: "email",
    name: "email",
    required: true,
    autoComplete: "username"
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-row"
  }, /*#__PURE__*/React.createElement("label", null, "\u30D1\u30B9\u30EF\u30FC\u30C9"), /*#__PURE__*/React.createElement("input", {
    type: "password",
    name: "password",
    required: true,
    autoComplete: "current-password"
  })), loginError && /*#__PURE__*/React.createElement("div", {
    className: "entry-validation entry-validation-error"
  }, loginError), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "btn btn-primary",
    disabled: loginLoading,
    style: {
      width: "100%",
      marginTop: 12
    }
  }, loginLoading ? "サインイン中…" : "サインイン")), /*#__PURE__*/React.createElement("style", null, `
        .auth-gate { min-height:100vh; display:flex; align-items:center; justify-content:center; background:#f1f5f9; padding:20px; }
        .auth-form { background:#fff; border-radius:12px; padding:28px 26px; width:340px; max-width:100%; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
        .auth-title { font-size:17px; font-weight:700; margin-bottom:6px; }
        .auth-loading { font-size:14px; color:#64748b; }
      `));
}
const rootEl = document.getElementById("root");
if (window.ReactDOM.createRoot) {
  window.ReactDOM.createRoot(rootEl).render(/*#__PURE__*/React.createElement(App, null));
} else {
  window.ReactDOM.render(/*#__PURE__*/React.createElement(App, null), rootEl);
}