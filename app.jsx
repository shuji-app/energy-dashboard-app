const { useState, useEffect, useMemo, useRef, useCallback } = React;

// ============================================================
// 定数・メタデータ
// ============================================================
const METRICS = {
  elecKWh:          { label: "受電電力量",            unit: "kWh", color: "#2563eb", kind: "sum", group: "電力" },
  demandKW:         { label: "日平均電力(簡易デマンド)", unit: "kW",  color: "#f59e0b", kind: "avg", group: "電力", derived: true },
  oilTotalL:        { label: "重油使用量(合計)",       unit: "L",   color: "#dc2626", kind: "sum", group: "重油" },
  oilChillerTotalL: { label: "重油(冷温水発生器 計)",  unit: "L",   color: "#ea580c", kind: "sum", group: "重油" },
  oilChiller1L:     { label: "重油(冷温水発生器No.1)", unit: "L",   color: "#fb923c", kind: "sum", group: "重油" },
  oilChiller2L:     { label: "重油(冷温水発生器No.2)", unit: "L",   color: "#fdba74", kind: "sum", group: "重油" },
  oilBoilerTotalL:  { label: "重油(ボイラー 計)",      unit: "L",   color: "#b45309", kind: "sum", group: "重油" },
  oilBoiler1L:      { label: "重油(ボイラーNo.1)",     unit: "L",   color: "#d97706", kind: "sum", group: "重油" },
  oilBoiler2L:      { label: "重油(ボイラーNo.2)",     unit: "L",   color: "#f59e0b", kind: "sum", group: "重油" },
  coolLoadGJ:       { label: "冷水負荷",               unit: "GJ",  color: "#0891b2", kind: "sum", group: "熱負荷" },
  heatLoadGJ:        { label: "温水負荷",               unit: "GJ",  color: "#be185d", kind: "sum", group: "熱負荷" },
  totalLoadGJ:       { label: "負荷熱量(合計)",         unit: "GJ",  color: "#7c3aed", kind: "sum", group: "熱負荷", derived: true },
  tempAvg:           { label: "外気温度(平均)",         unit: "℃",   color: "#16a34a", kind: "avg", group: "気象" },
  humidityAvg:       { label: "外気湿度(平均)",         unit: "%RH", color: "#4b5563", kind: "avg", group: "気象" },
  enthalpyKJkg:      { label: "比エンタルピー(外気)",     unit: "kJ/kg", color: "#0ea5e9", kind: "avg", group: "気象", derived: true },
  efficiencyPct:     { label: "総合熱源効率",           unit: "%",   color: "#0d9488", kind: "avg", group: "コスト・環境", derived: true },
  co2T:              { label: "CO2排出量",              unit: "t-CO2", color: "#0f766e", kind: "sum", group: "コスト・環境", derived: true },
  crudeOilKL:        { label: "原油換算値",             unit: "kL",  color: "#92400e", kind: "sum", group: "コスト・環境", derived: true },
  costYen:           { label: "概算コスト",              unit: "円",  color: "#ca8a04", kind: "sum", group: "コスト・環境", derived: true },
  equipUtilPct:      { label: "設備稼働率(負荷/定格能力)", unit: "%",   color: "#65a30d", kind: "avg", group: "コスト・環境", derived: true },
};
const METRIC_GROUPS = ["電力", "重油", "熱負荷", "気象", "コスト・環境"];
const FORECASTABLE = ["elecKWh", "oilTotalL", "oilChillerTotalL", "oilBoilerTotalL", "coolLoadGJ", "heatLoadGJ", "totalLoadGJ", "co2T", "crudeOilKL", "costYen"];
// ダッシュボードのKPIカードと同じ項目（分析ビューの日付比較で比較対象にする）
const DASHBOARD_KPI_KEYS = ["elecKWh", "oilTotalL", "coolLoadGJ", "heatLoadGJ", "demandKW", "efficiencyPct", "co2T", "crudeOilKL", "costYen", "enthalpyKJkg", "equipUtilPct"];
const CHART_TYPE_OPTIONS = [["line", "折れ線"], ["bar", "棒"], ["stackedBar", "積み上げ棒"], ["scatter", "散布図(気温相関)"]];

const FM_LABELS = ["4月","5月","6月","7月","8月","9月","10月","11月","12月","1月","2月","3月"];
const DAY_TYPE_LABEL = { weekday: "平日", saturday: "土曜", sunday: "日曜", holiday: "休日/祝日" };
const DAY_TYPE_COLOR = { weekday: "#3b82f6", saturday: "#10b981", sunday: "#ef4444", holiday: "#f97316" };

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
  oilPricePerL: 100,
  // 熱源機器の定格能力(kW)。現時点では架空の仮数値。竣工図・機器リストの実際の値に
  // 置き換えること（設定画面「熱源機器の定格能力」から編集可能）。
  chiller1CapacityKW: 500,
  chiller2CapacityKW: 500,
  boiler1CapacityKW: 300,
  boiler2CapacityKW: 300,
};

const LS_DATA_KEY = "energyApp.data.v1";
const LS_SETTINGS_KEY = "energyApp.settings.v1";
const LS_VIEWSTATE_KEY = "energyApp.viewState.v1";
const LS_NOTES_KEY = "energyApp.notes.v1";
const LS_DARKMODE_KEY = "energyApp.darkMode.v1";
const DEFAULT_CHARTS = [
  { id: 1, name: "グラフ1", chartType: "line", selectedMetrics: ["elecKWh"], compareEnabled: true, showForecast: true, forecastMethod: "seasonal", dayTypeColoring: false },
];

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
  appId: "1:1048227854865:web:e386b0b2a9237458d90fb0",
};
const fbApp = (typeof window !== "undefined" && window.firebase && firebaseConfig.apiKey !== "YOUR_API_KEY")
  ? window.firebase.initializeApp(firebaseConfig) : null;
// databaseURLが実際のRealtime Databaseと一致しない場合、firebase.database()が例外を投げることがある。
// ここで失敗してもアプリ全体が止まらないよう、db=nullにフォールバックする。
let db = null;
if (fbApp) {
  try { db = window.firebase.database(); } catch (e) { console.warn("Firebase Database初期化に失敗しました。databaseURLを確認してください。", e); }
}
// リポジトリを公開する場合、DBのルールを"auth != null"に絞るため、Firebase Authenticationの
// Email/Passwordプロバイダを有効化し、チームで共有する1アカウントでサインインする方式にしている
// （ソースコードが公開されてもパスワード自体はコード中に含まれないので安全）。
// authがnull（Firebase未設定）の場合はサインイン画面自体を出さず、今まで通りローカルのみで動作する。
let auth = null;
if (fbApp) {
  try { auth = window.firebase.auth(); } catch (e) { console.warn("Firebase Auth初期化に失敗しました。", e); }
}
// 中央監視画面（PDF/JPEG/PNG）を他端末とも共有する場合は、Firebase Storageではなく
// 既存のRealtime Database（無料枠）にbase64文字列として保存する
// （Firebase Storageは2024年10月以降の新規プロジェクトでは無料プランで使えなくなったため）。
// dbが使えるときだけ「同期あり」とし、そうでない場合はIndexedDBのみで完結する。
const monitorSyncEnabled = !!db;

// ─── Gemini連携（分析コメントの生成）───
// GeminiのAPIキーはこのアプリ（公開リポジトリ）には一切含めない。代わりに、ユーザー自身の
// Googleアカウントで作成したGoogle Apps Scriptのウェブアプリ（APIキーはApps Script側の
// 「スクリプトプロパティ」に保管）を簡易バックエンドとして経由する。
// 使い方：Apps Scriptのウェブアプリ公開後に発行されるURLをここに貼り付ける。
// 未設定（プレースホルダーのまま）の場合は「🤖 Geminiで分析」ボタンがエラーメッセージを表示するだけで、
// 他の機能には一切影響しない。
const GEMINI_PROXY_URL = "https://script.google.com/macros/s/AKfycbxJMqMLXZJKqKjGtCwMYI-I1jlOpcAwTKsEq9TuXzHd0Xj7-gkx9-8im8Tp1tL2764UiQ/exec";

async function fetchGeminiComment(prompt) {
  if (!GEMINI_PROXY_URL || GEMINI_PROXY_URL === "YOUR_APPS_SCRIPT_WEB_APP_URL") {
    throw new Error("Apps ScriptのURLが未設定です（app.jsx内のGEMINI_PROXY_URLを設定してください）。");
  }
  // Content-Typeを明示すると事前のCORSプリフライト(OPTIONS)が発生し、Apps Script側が
  // これに対応していないため失敗する。text/plain（既定値）のまま送ることでこれを回避する。
  const res = await fetch(GEMINI_PROXY_URL, { method: "POST", body: JSON.stringify({ prompt }) });
  if (!res.ok) throw new Error(`通信エラー（${res.status}）`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.comment || "(コメントを取得できませんでした)";
}

// 中央監視画面（PDF/JPEG/PNG）をGeminiのマルチモーダル入力として渡し、画像/文書の内容を分析してもらう。
// dataUrlは "data:<mimeType>;base64,<data>" 形式の文字列を想定（monitorGetFileDataUrlの戻り値）。
async function fetchGeminiImageComment(prompt, dataUrl, mimeType) {
  if (!GEMINI_PROXY_URL || GEMINI_PROXY_URL === "YOUR_APPS_SCRIPT_WEB_APP_URL") {
    throw new Error("Apps ScriptのURLが未設定です（app.jsx内のGEMINI_PROXY_URLを設定してください）。");
  }
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const res = await fetch(GEMINI_PROXY_URL, {
    method: "POST",
    body: JSON.stringify({ prompt, imageBase64: base64, imageMimeType: mimeType || "image/jpeg" }),
  });
  if (!res.ok) throw new Error(`通信エラー（${res.status}）`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.comment || "(コメントを取得できませんでした)";
}

// 複数枚の画像/PDFを1回のGemini呼び出しでまとめて渡す（カメラで複数の監視画面を撮影し、
// 画面をまたいだ機器をまとめて分析したい場合など）。images = [{ dataUrl, mimeType }, ...]。
// Apps Script側（doPost）がbody.imagesの配列を読み取れるよう対応している必要がある。
async function fetchGeminiMultiImageComment(prompt, images) {
  if (!GEMINI_PROXY_URL || GEMINI_PROXY_URL === "YOUR_APPS_SCRIPT_WEB_APP_URL") {
    throw new Error("Apps ScriptのURLが未設定です（app.jsx内のGEMINI_PROXY_URLを設定してください）。");
  }
  const imagesPayload = images.map(({ dataUrl, mimeType }) => ({
    data: dataUrl.slice(dataUrl.indexOf(",") + 1),
    mimeType: mimeType || "image/jpeg",
  }));
  const res = await fetch(GEMINI_PROXY_URL, {
    method: "POST",
    body: JSON.stringify({ prompt, images: imagesPayload }),
  });
  if (!res.ok) throw new Error(`通信エラー（${res.status}）`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.comment || "(コメントを取得できませんでした)";
}

// 中央監視画面1枚を単体で分析させるプロンプト。
function buildMonitorImagePrompt(dateStr, fileName) {
  return `あなたは工場設備のエネルギー管理の専門家です。添付は${dateStr}の中央監視装置の画面（${fileName}）です。表示されている数値・稼働状態・警報表示などを読み取り、注意すべき点や異常の兆候があれば日本語で150字程度で指摘してください。画像/文書から内容が読み取れない場合はその旨を述べてください。`;
}
// 機器ごとの読み取り結果をアプリ側で表として描画できるよう、回答の最後の1行にだけ
// 機械可読なJSON配列を出力させる共通の指示文（parseLoadTableで抜き出す）。
const LOAD_TABLE_OUTPUT_INSTRUCTION =
  `アドバイス本文には太字記号(**)や見出し記号(#)、罫線(---)などの装飾は使わず、プレーンな` +
  `日本語の文章だけにしてください。そのうえで、回答の最後の行にだけ、各機器の読み取り結果を` +
  `次のJSON形式で出力してください（説明文を混ぜないこと）：\n` +
  `LOAD_TABLE: [{"name":"機器名","outputKW":数値またはnull,"capacityKW":数値,"loadPct":数値またはnull}, ...]`;

// Geminiの回答から末尾のLOAD_TABLE:行を取り出し、本文コメント（装飾記号は念のため除去）と
// 機器ごとの表データに分離する。
function parseLoadTable(rawText) {
  const m = rawText.match(/LOAD_TABLE:\s*(\[[\s\S]*?\])\s*$/i);
  if (!m) return { comment: stripMarkdownDecoration(rawText), table: null };
  let table = null;
  try { table = JSON.parse(m[1]); } catch (e) { table = null; }
  return { comment: stripMarkdownDecoration(rawText.slice(0, m.index).trim()), table };
}
function stripMarkdownDecoration(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^-{3,}\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// 中央監視画面に表示された各機器の「瞬間出力」を読み取り、定格能力（設定画面で入力済み）と
// 突き合わせて、今この瞬間の運転をより効率的にする組み合わせ・負荷配分のアドバイスを求める。
function buildOptimalOperationPrompt(dateStr, fileName, settings) {
  const capacityLines = [
    `冷温水発生器No.1: 定格 ${settings.chiller1CapacityKW || 0} kW`,
    `冷温水発生器No.2: 定格 ${settings.chiller2CapacityKW || 0} kW`,
    `ボイラーNo.1: 定格 ${settings.boiler1CapacityKW || 0} kW`,
    `ボイラーNo.2: 定格 ${settings.boiler2CapacityKW || 0} kW`,
  ].join("\n");
  return `あなたは工場設備のエネルギー管理の専門家です。添付は${dateStr}に撮影した中央監視装置の画面（${fileName}）で、各熱源機器の現在の瞬間出力（kW等）が表示されています。\n\n` +
    `各機器の定格能力は次の通りです：\n${capacityLines}\n\n` +
    `画面から各機器の現在の出力を読み取り、定格能力に対する負荷率(%)を機器ごとに算出してください。` +
    `熱源機器は一般に、定格に対して極端に低い負荷（部分負荷）で運転すると効率が下がる傾向があります。` +
    `現在の稼働状況（どの機器が動いていて、どのくらいの負荷率か）を踏まえ、機器の組み合わせや負荷配分を` +
    `見直すことでより効率的な運転にできないか、日本語で300字程度のアドバイスを述べてください。` +
    `画面から数値が読み取れない場合は、その旨と読み取れた範囲の情報を述べてください。\n\n` +
    LOAD_TABLE_OUTPUT_INSTRUCTION;
}
// buildOptimalOperationPromptの複数画像版。監視画面が1枚に収まらず複数枚に分けて撮影した
// 場合など、全画像をまとめて1回のGemini呼び出しで見比べながらアドバイスさせたいときに使う。
function buildOptimalOperationMultiPrompt(dateStr, fileNames, settings) {
  const capacityLines = [
    `冷温水発生器No.1: 定格 ${settings.chiller1CapacityKW || 0} kW`,
    `冷温水発生器No.2: 定格 ${settings.chiller2CapacityKW || 0} kW`,
    `ボイラーNo.1: 定格 ${settings.boiler1CapacityKW || 0} kW`,
    `ボイラーNo.2: 定格 ${settings.boiler2CapacityKW || 0} kW`,
  ].join("\n");
  return `あなたは工場設備のエネルギー管理の専門家です。添付は${dateStr}に撮影した中央監視装置の画面${fileNames.length}枚（${fileNames.join("、")}）です。監視画面が1台では収まらず複数枚に分けて撮影されている場合があり、各熱源機器の現在の瞬間出力（kW等）がいずれかの画像に表示されています。\n\n` +
    `各機器の定格能力は次の通りです：\n${capacityLines}\n\n` +
    `すべての画像を確認し、各機器の現在の出力を読み取って、定格能力に対する負荷率(%)を機器ごとに算出してください。` +
    `熱源機器は一般に、定格に対して極端に低い負荷（部分負荷）で運転すると効率が下がる傾向があります。` +
    `画像全体を通して見た現在の稼働状況（どの機器が動いていて、どのくらいの負荷率か）を踏まえ、機器の組み合わせや` +
    `負荷配分を見直すことでより効率的な運転にできないか、日本語で300字程度のアドバイスを述べてください。` +
    `一部の画像から数値が読み取れない場合は、その旨と読み取れた範囲の情報を述べてください。\n\n` +
    LOAD_TABLE_OUTPUT_INSTRUCTION;
}
// 複数画面それぞれの個別分析結果を踏まえて、その日全体としての総括をさせるプロンプト（テキストのみ）。
function buildMonitorSummaryPrompt(dateStr, perFileComments) {
  return `あなたは工場設備のエネルギー管理の専門家です。以下は${dateStr}に取り込まれた中央監視装置の複数の画面について、それぞれ個別に分析した結果です。\n\n${perFileComments.join("\n")}\n\nこれらを踏まえて、その日の設備全体としての状態を200字程度の日本語でまとめてください。画面間で関連する異常や矛盾があれば特に指摘してください。`;
}

// 竣工図・機器リストのPDF/画像から、熱源機器4台の定格能力(kW)を読み取らせるプロンプト。
// 回答の最後の1行だけに機械可読なJSON形式で出力させ、parseExtractedCapacityで抜き出す。
function buildEquipCapacityExtractionPrompt() {
  return `あなたは設備台帳の読み取りアシスタントです。添付は熱源機器の竣工図または機器リストです。` +
    `次の4つの機器について、記載されている定格能力(kW)を読み取ってください。` +
    `冷凍能力がUSRt(米国冷凍トン、1USRt≈3.517kW)やkcal/h(1kcal/h≈1.163W)などkW以外の単位で` +
    `書かれている場合はkWに換算してください。読み取れない機器はnullにしてください。\n` +
    `1. 冷温水発生器No.1\n2. 冷温水発生器No.2\n3. ボイラーNo.1\n4. ボイラーNo.2\n\n` +
    `回答は他の説明文を含めず、最後の行にだけ次のJSON形式で出力してください：\n` +
    `EXTRACTED_CAPACITY: {"chiller1": 数値またはnull, "chiller2": 数値またはnull, "boiler1": 数値またはnull, "boiler2": 数値またはnull}`;
}
function parseExtractedCapacity(rawText) {
  const m = rawText.match(/EXTRACTED_CAPACITY:\s*(\{[\s\S]*?\})/i);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch (e) { return null; }
}

function buildAnalysisPrompt(title, dataText, extraInstruction) {
  return `あなたは工場設備のエネルギー管理の専門家です。次のデータについて、200字程度の日本語で実務的な分析コメントを1つだけ書いてください。数値の解説だけでなく、可能なら改善のヒントも添えてください。前置きや見出しは不要で、コメント本文だけを返してください。\n\n【${title}】\n${dataText}${extraInstruction ? "\n\n" + extraInstruction : ""}`;
}
function seriesText(labels, values, unit) {
  return labels.map((l, i) => `${l}: ${values[i] != null ? fmtNum(values[i], 2) + unit : "欠測"}`).join(" / ");
}

// GeminiにKPIの数値分析と合わせて「グラフ化すると役立つ項目の組み合わせ」を提案してもらうための
// 追加指示文。回答の末尾1行だけに機械可読な形式で書かせ、それ以外の行はコメント本文として表示する。
function buildChartSuggestionInstruction() {
  const keyList = Object.entries(METRICS).map(([k, v]) => `${k}(${v.label})`).join("、");
  return `さらに、分析コメントとは別に、グラフとして並べて見ると特に参考になりそうな項目を2〜3個提案してください。` +
    `回答の一番最後の行にだけ、次の形式で書いてください（この行に説明文を混ぜないこと）：\n` +
    `SUGGEST_CHART: キー1,キー2\n` +
    `使用できるキー: ${keyList}`;
}
// Geminiの回答文字列から末尾の "SUGGEST_CHART: ..." 行を取り出し、本文コメントと分離する。
function parseChartSuggestion(rawText) {
  const m = rawText.match(/SUGGEST_CHART:\s*([^\n]+)\s*$/i);
  if (!m) return { comment: rawText.trim(), suggestedKeys: null };
  const keys = m[1].split(/[,、]/).map((s) => s.trim()).filter((k) => METRICS[k]);
  const comment = rawText.slice(0, m.index).trim();
  return { comment, suggestedKeys: keys.length ? keys : null };
}

// Firebaseへの書き込みは、状態の変化を監視するeffectではなく、実際にユーザーが保存操作をした
// タイミング（各handle*関数）からのみ呼び出す。これにより「リモートの変更を受けて再度書き込む」
// という無限ループを構造的に避けられる（ローカルstateはFirebaseの内容を映すミラーとして扱う）。
function fbSaveRecord(record) {
  if (!db || !record || !record.date) return;
  const { demandKW, totalLoadGJ, ...rest } = record;
  db.ref("energyData/" + record.date).set(rest);
}
function fbDeleteRecord(dateStr) {
  if (!db || !dateStr) return;
  db.ref("energyData/" + dateStr).remove();
}
function fbBulkSaveData(rows) {
  if (!db || !rows || !rows.length) return;
  const updates = {};
  rows.forEach((r) => {
    const { demandKW, totalLoadGJ, ...rest } = r;
    updates["energyData/" + r.date] = rest;
  });
  db.ref().update(updates);
}
function fbSaveNote(dateStr, text) {
  if (!db || !dateStr) return;
  if (text && text.trim()) db.ref("notes/" + dateStr).set(text);
  else db.ref("notes/" + dateStr).remove();
}
function fbSaveSettings(s) {
  if (!db) return;
  db.ref("settings").set(s);
}
function fbReplaceAll(rows, settingsObj, notesObj) {
  if (!db) return;
  const dataObj = {};
  (rows || []).forEach((r) => {
    const { demandKW, totalLoadGJ, ...rest } = r;
    dataObj[r.date] = rest;
  });
  db.ref().update({ energyData: dataObj, settings: settingsObj || {}, notes: notesObj || {} });
}

// ============================================================
// ユーティリティ
// ============================================================
// 外気温度・湿度から比エンタルピー（乾き空気1kgあたりの熱量, kJ/kg(DA)）を計算する。
// 飽和水蒸気圧はTetens近似式、大気圧は標準大気圧(1013.25hPa)を前提とする。
function calcSpecificEnthalpy(tempC, rhPct) {
  if (tempC == null || rhPct == null || isNaN(tempC) || isNaN(rhPct)) return null;
  const satPressureHpa = 6.1078 * Math.pow(10, (7.5 * tempC) / (tempC + 237.3));
  const vaporPressureHpa = (rhPct / 100) * satPressureHpa;
  const atmPressureHpa = 1013.25;
  const humidityRatio = (0.622 * vaporPressureHpa) / (atmPressureHpa - vaporPressureHpa);
  return 1.006 * tempC + humidityRatio * (2501 + 1.805 * tempC);
}

function withDerived(row) {
  const totalLoadGJ = (row.coolLoadGJ || 0) + (row.heatLoadGJ || 0);
  const demandKW = (row.elecKWh || 0) / 24;
  const enthalpyKJkg = calcSpecificEnthalpy(row.tempAvg, row.humidityAvg);
  return { ...row, totalLoadGJ, demandKW, enthalpyKJkg };
}

// 設定（換算係数・単価）に依存する項目は、設定変更時に再計算されるよう別関数として分離
function withComputed(row, settings) {
  const elecGJ = ((row.elecKWh || 0) * settings.elecMJperKWh) / 1000;
  const oilGJ = ((row.oilTotalL || 0) * settings.oilCalorificMJperL) / 1000;
  const inputGJ = elecGJ + oilGJ;
  const co2T = ((row.elecKWh || 0) * settings.elecCO2PerKWh + (row.oilTotalL || 0) * settings.oilCO2PerL) / 1000;
  const crudeOilKL = settings.crudeOilGJperKL > 0 ? inputGJ / settings.crudeOilGJperKL : null;
  const costYen = (row.elecKWh || 0) * settings.elecPricePerKWh + (row.oilTotalL || 0) * settings.oilPricePerL;
  const efficiencyPct = inputGJ > 0 ? ((row.totalLoadGJ || 0) / inputGJ) * 100 : null;
  // 設備稼働率＝その日の負荷熱量 ÷ 熱源機器の定格能力から算出できる1日あたりの理論上限熱量。
  // 定格能力(kW)は現時点で竣工図・機器リストの実際の値が未入力の場合、設定画面の仮数値が使われる。
  const totalRatedCapacityKW = (settings.chiller1CapacityKW || 0) + (settings.chiller2CapacityKW || 0)
    + (settings.boiler1CapacityKW || 0) + (settings.boiler2CapacityKW || 0);
  const dailyMaxCapacityGJ = totalRatedCapacityKW * 24 * 0.0036; // kW→GJ/日 (1kWh=0.0036GJ)
  const equipUtilPct = dailyMaxCapacityGJ > 0 ? ((row.totalLoadGJ || 0) / dailyMaxCapacityGJ) * 100 : null;
  return { ...row, co2T, crudeOilKL, costYen, efficiencyPct, equipUtilPct };
}

// ============================================================
// ローカルファイル自動保存（File System Access API + IndexedDB）
// FileSystemFileHandleはlocalStorageに保存できないため、IndexedDBに保管して
// 次回起動時にも同じファイルへ書き込み続けられるようにする。
// ============================================================
const IDB_NAME = "energyAppFS";
const IDB_VERSION = 3;
const IDB_STORE = "handles";
const IDB_KEY = "autoSaveFile";
const IDB_MONITOR_STORE = "monitorFiles"; // 旧形式（1日1ファイル）。読み書きはしないがストア自体は残す。
const IDB_MONITOR_STORE_V2 = "monitorFilesV2"; // 新形式（1日に複数ファイル）。keyPathは"date__fileId"。
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const dbInst = req.result;
      if (!dbInst.objectStoreNames.contains(IDB_STORE)) dbInst.createObjectStore(IDB_STORE);
      if (!dbInst.objectStoreNames.contains(IDB_MONITOR_STORE)) dbInst.createObjectStore(IDB_MONITOR_STORE, { keyPath: "date" });
      if (!dbInst.objectStoreNames.contains(IDB_MONITOR_STORE_V2)) {
        const store = dbInst.createObjectStore(IDB_MONITOR_STORE_V2, { keyPath: "id" });
        store.createIndex("date", "date", { unique: false });
      }
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

// 中央監視装置の熱源画面（PDF/JPEG/PNG）を日付ごとに保管する。Firebaseが使えるなら
// Realtime Databaseで他端末とも共有し、使えない場合のみこの端末のIndexedDBにのみ保存する
// （monitorSyncEnabledで自動的に切り替わる。呼び出し側はどちらか意識しなくてよい）。
// 1日に複数ファイルを保管できるよう、日付＋ファイルID（fileId）の組み合わせをキーにする。
async function idbSaveMonitorFile(dateStr, fileId, file) {
  const dbInst = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = dbInst.transaction(IDB_MONITOR_STORE_V2, "readwrite");
    tx.objectStore(IDB_MONITOR_STORE_V2).put({
      id: dateStr + "__" + fileId, date: dateStr, fileId,
      fileName: file.name, fileType: file.type, blob: file, uploadedAt: Date.now(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbGetMonitorFile(dateStr, fileId) {
  const dbInst = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = dbInst.transaction(IDB_MONITOR_STORE_V2, "readonly");
    const req = tx.objectStore(IDB_MONITOR_STORE_V2).get(dateStr + "__" + fileId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
async function idbDeleteMonitorFile(dateStr, fileId) {
  const dbInst = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = dbInst.transaction(IDB_MONITOR_STORE_V2, "readwrite");
    tx.objectStore(IDB_MONITOR_STORE_V2).delete(dateStr + "__" + fileId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbListMonitorFiles() {
  const dbInst = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = dbInst.transaction(IDB_MONITOR_STORE_V2, "readonly");
    const req = tx.objectStore(IDB_MONITOR_STORE_V2).getAll();
    req.onsuccess = () => {
      // 一覧表示ではblob本体は不要なので除いて返す（メモリ節約）
      const list = (req.result || []).map(({ date, fileId, fileName, fileType, uploadedAt }) => ({ date, fileId, fileName, fileType, uploadedAt }));
      resolve(list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (a.uploadedAt || 0) - (b.uploadedAt || 0))));
    };
    req.onerror = () => reject(req.error);
  });
}

// Realtime Databaseへの書き込みが（ルール未設定等で）応答無しのままになることがあるため、
// 一定時間で明示的にエラーとして扱う。
function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

const MONITOR_FILE_MAX_BYTES = 8 * 1024 * 1024; // Realtime Databaseの無料枠を圧迫しすぎないよう8MBを目安に制限
const MONITOR_IMAGE_MAX_DIM = 1600; // 長辺をこのピクセル数まで縮小（監視画面の数値が読み取れる範囲を想定）
const MONITOR_IMAGE_QUALITY = 0.75; // JPEG圧縮品質

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// 1日に複数ファイルを保管できるよう、各ファイルを識別するIDを発行する（日付内で一意であればよい）。
function genMonitorFileId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// 画像ファイルを指定の長辺サイズ・JPEG品質に圧縮する。iPadのカメラ撮影画像は数MB〜十数MBに
// なりがちで、複数枚×毎日保存するとRealtime Databaseの無料枠（1GB）をすぐ圧迫してしまうため、
// アップロード前に必ず縮小する。PDFは圧縮できないのでそのまま返す。
function compressImageFile(file, maxDim, quality) {
  if (!file.type.startsWith("image/")) return Promise.resolve(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > height && width > maxDim) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else if (height >= width && height > maxDim) {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error("画像の圧縮に失敗しました。")); return; }
        resolve(new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }));
      }, "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("画像の読み込みに失敗しました。")); };
    img.src = objectUrl;
  });
}

// monitorSyncEnabled(=Realtime Databaseが使える)なら他端末とも共有される保存先
// （Realtime Databaseにbase64文字列として保存）を使い、そうでなければこの端末の
// IndexedDBだけで完結させる。呼び出し側（コンポーネント）はどちらが使われているか
// 意識しなくてよいようにラップしている。1日に複数ファイルを持てるよう、日付ごとに
// fileIdをキーとしたマップとして保存する。
async function monitorSaveFile(dateStr, fileId, file) {
  if (monitorSyncEnabled) {
    if (file.size > MONITOR_FILE_MAX_BYTES) {
      throw new Error(`ファイルサイズが大きすぎます（${MONITOR_FILE_MAX_BYTES / 1024 / 1024}MB以下にしてください）。`);
    }
    const dataUrl = await fileToDataUrl(file);
    await withTimeout(
      db.ref("monitorFileBlobs/" + dateStr + "/" + fileId).set(dataUrl),
      15000,
      "保存がタイムアウトしました。Realtime Databaseのルールに monitorFileBlobs / monitorFilesMeta が含まれているかご確認ください。"
    );
    await db.ref("monitorFilesMeta/" + dateStr + "/" + fileId).set({ fileName: file.name, fileType: file.type, uploadedAt: Date.now() });
  } else {
    await idbSaveMonitorFile(dateStr, fileId, file);
  }
}
async function monitorDeleteFile(dateStr, fileId) {
  if (monitorSyncEnabled) {
    await db.ref("monitorFileBlobs/" + dateStr + "/" + fileId).remove();
    await db.ref("monitorFilesMeta/" + dateStr + "/" + fileId).remove();
  } else {
    await idbDeleteMonitorFile(dateStr, fileId);
  }
}
// プレビュー用のURLを返す。Firebase同期時はdata URL文字列（revoke不要）、
// IndexedDB利用時はBlobから作ったオブジェクトURL（呼び出し側でrevoke必須）を返す。
async function monitorGetPreviewSrc(dateStr, fileId) {
  if (monitorSyncEnabled) {
    const snap = await withTimeout(
      db.ref("monitorFileBlobs/" + dateStr + "/" + fileId).once("value"),
      15000,
      "読み込みがタイムアウトしました。"
    );
    if (!snap.exists()) return null;
    return { url: snap.val(), revoke: false };
  }
  const rec = await idbGetMonitorFile(dateStr, fileId);
  if (!rec) return null;
  return { url: URL.createObjectURL(rec.blob), revoke: true };
}
// Gemini画像分析用に、表示方法（data URL/オブジェクトURL）によらず必ずbase64のdata URLを返す。
async function monitorGetFileDataUrl(dateStr, fileId) {
  if (monitorSyncEnabled) {
    const snap = await withTimeout(
      db.ref("monitorFileBlobs/" + dateStr + "/" + fileId).once("value"),
      15000,
      "読み込みがタイムアウトしました。"
    );
    return snap.exists() ? snap.val() : null;
  }
  const rec = await idbGetMonitorFile(dateStr, fileId);
  if (!rec) return null;
  return fileToDataUrl(rec.blob);
}

function loadInitialData() {
  try {
    const saved = localStorage.getItem(LS_DATA_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length) return parsed.map(withDerived).sort((a, b) => (a.date < b.date ? -1 : 1));
    }
  } catch (e) { /* ignore, fall back to bundled data */ }
  const base = (window.ENERGY_DATA || []).map(withDerived);
  return base.sort((a, b) => (a.date < b.date ? -1 : 1));
}

function loadSettings() {
  try {
    const saved = localStorage.getItem(LS_SETTINGS_KEY);
    if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
  } catch (e) { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

function loadViewState() {
  try {
    const saved = localStorage.getItem(LS_VIEWSTATE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) { /* ignore */ }
  return null;
}

function loadNotes() {
  try {
    const saved = localStorage.getItem(LS_NOTES_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) { /* ignore */ }
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
    const m = ((i + 3) % 12) + 1;
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
// 月単位で日付をずらす（前月・前年比較用）。ずらした先の月に同じ日が無い場合
// （例：3/31の前月=2/31）は、その月の末日にクランプする。
function addMonthsClamped(dateStr, monthsDelta) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const totalMonths = (y * 12 + (m - 1)) + monthsDelta;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = totalMonths % 12; // 0-based
  const ym = `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}`;
  const targetDay = Math.min(d, daysInMonth(ym));
  return `${ym}-${String(targetDay).padStart(2, "0")}`;
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
  const vals = rows.map((r) => r[key]).filter((v) => v != null && !isNaN(v));
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
function aggMetric(rows, key) {
  const meta = METRICS[key];
  return meta.kind === "avg" ? avgMetric(rows, key) : sumMetric(rows, key);
}
function fmtNum(n, digits = 0) {
  if (n == null || isNaN(n)) return "-";
  return n.toLocaleString("ja-JP", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}
function fmtPct(p) {
  if (p == null || isNaN(p)) return "-";
  const sign = p > 0 ? "+" : "";
  return `${sign}${p.toFixed(1)}%`;
}

function linreg(points) {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0] ? points[0][1] : 0 };
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  points.forEach(([x, y]) => { sx += x; sy += y; sxx += x * x; sxy += x * y; });
  const denom = n * sxx - sx * sx;
  if (denom === 0) return { slope: 0, intercept: sy / n };
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept };
}
function buildRegression(rows, key) {
  const pts = rows
    .map((r) => [r.tempAvg, r[key]])
    .filter(([x, y]) => x != null && y != null && !isNaN(x) && !isNaN(y));
  return linreg(pts);
}
// ============================================================
// 分析コメントの自動生成（実際のLLM呼び出しは行わない、数値ベースのルール生成）
// ============================================================
// 系列（labels/valuesが対応、nullは欠測扱い）から傾向・最大最小を短文コメントにする
function trendInsight(labels, values, unit, digits = 1) {
  const pts = values.map((v, i) => ({ v, i })).filter((p) => p.v != null && !isNaN(p.v));
  if (pts.length < 2) return "データが少なく、傾向を判定できません。";
  const first = pts[0], last = pts[pts.length - 1];
  const reg = linreg(pts.map((p) => [p.i, p.v]));
  const base = Math.abs(first.v) > 0.0001 ? first.v : (pts.reduce((s, p) => s + Math.abs(p.v), 0) / pts.length || 1);
  const pct = ((last.v - first.v) / Math.abs(base)) * 100;
  const dir = Math.abs(pct) < 3 ? "ほぼ横ばい" : pct > 0 ? "上昇傾向" : "低下傾向";
  const maxPt = pts.reduce((a, b) => (b.v > a.v ? b : a));
  const minPt = pts.reduce((a, b) => (b.v < a.v ? b : a));
  let s = `${labels[first.i]}から${labels[last.i]}にかけて${dir}です`;
  if (Math.abs(pct) >= 3) s += `（${pct > 0 ? "+" : ""}${pct.toFixed(1)}%）`;
  s += `。最大は${labels[maxPt.i]}（${fmtNum(maxPt.v, digits)}${unit}）、最小は${labels[minPt.i]}（${fmtNum(minPt.v, digits)}${unit}）でした。`;
  return s;
}
function historicalAvgTempForCalendarDay(rows, monthDay) {
  const vals = rows.filter((r) => r.date.slice(5) === monthDay).map((r) => r.tempAvg).filter((v) => v != null && !isNaN(v));
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// 月内の残り日数を予測する（日ビューの月末着地予測に使用）。実績が1件も無い月でも、
// 「まだ来ていない（最新実績日より後の）月」であれば、過去の実績・気象データだけをもとに
// その月を丸ごと予測する。ただし過去の月に実績が全く無い場合はデータ欠落の可能性があるため、
// 憶測で埋めない（3.2節のデータ破損対応と同じ方針）。latestDateは最新実績日（省略可、
// 省略時は「実績が1件も無い月は予測しない」という従来通りの安全側の挙動になる）。
function computeMonthForecast(allRows, ym, key, method, latestDate) {
  const dim = daysInMonth(ym);
  const monthRows = allRows.filter((r) => r.date.startsWith(ym)).sort((a, b) => (a.date < b.date ? -1 : 1));
  const actualDates = new Set(monthRows.map((r) => r.date));
  const allDates = [];
  for (let d = 1; d <= dim; d++) allDates.push(`${ym}-${String(d).padStart(2, "0")}`);
  const missingDates = allDates.filter((d) => !actualDates.has(d));
  if (missingDates.length === 0) return null;
  if (monthRows.length === 0) {
    const latestYm = latestDate ? latestDate.slice(0, 7) : null;
    if (!latestYm || ym <= latestYm) return null; // 過去の欠測は補正しない
  }

  const actualSum = sumMetric(monthRows, key);
  const [y, m] = ym.split("-").map(Number);
  const lastYearYm = `${y - 1}-${String(m).padStart(2, "0")}`;
  const lastYearRows = allRows.filter((r) => r.date.startsWith(lastYearYm));
  const lastYearByDay = {};
  lastYearRows.forEach((r) => {
    lastYearByDay[Number(r.date.split("-")[2])] = r[key];
  });
  // 当月の実績が1件も無い場合のフォールバック：前年同月の1日あたり平均、それも無ければ全実績の平均。
  const lastYearMonthAvgPerDay = lastYearRows.length ? sumMetric(lastYearRows, key) / lastYearRows.length : null;
  const overallAvgPerDay = allRows.length ? sumMetric(allRows, key) / allRows.length : 0;

  const matchedLastYearSoFar = monthRows
    .map((r) => lastYearByDay[Number(r.date.split("-")[2])])
    .filter((v) => v != null);
  const lastYearSoFarSum = matchedLastYearSoFar.reduce((a, b) => a + b, 0);
  const ratio = monthRows.length > 0 && lastYearSoFarSum > 0 ? actualSum / lastYearSoFarSum : 1;
  const paceAvgPerDay = monthRows.length > 0
    ? actualSum / monthRows.length
    : (lastYearMonthAvgPerDay != null ? lastYearMonthAvgPerDay : overallAvgPerDay);
  const reg = buildRegression(allRows, key);

  const forecastPoints = missingDates.map((dateStr) => {
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
    return { date: dateStr, value: value != null && !isNaN(value) ? Math.max(0, value) : 0 };
  });
  const forecastSum = forecastPoints.reduce((s, p) => s + p.value, 0);
  return { actualSum, forecastPoints, forecastSum, projectedTotal: actualSum + forecastSum };
}

// 年度内の残り月を予測する（月ビューの年度末着地予測に使用）
function computeFiscalYearForecast(allRows, fy, key, method, latestDate) {
  const monthKeys = fiscalMonthKeys(fy);
  const prevMonthKeys = fiscalMonthKeys(fy - 1);
  const reg = buildRegression(allRows, key);

  const monthly = monthKeys.map((ym, idx) => {
    const rows = allRows.filter((r) => r.date.startsWith(ym));
    const dim = daysInMonth(ym);
    return { ym, prevYm: prevMonthKeys[idx], rows, sum: sumMetric(rows, key), dim };
  });

  // latestDateの月までは「過去（欠測日があっても実績はそのまま集計）」、
  // その月だけ末尾を予測、それより後の月は「未来（丸ごと予測）」として扱う。
  const latestYm = latestDate ? latestDate.slice(0, 7) : null;
  let currentIdx = monthKeys.indexOf(latestYm);
  if (currentIdx === -1) {
    const latestFY = latestDate ? fiscalYear(latestDate) : null;
    // 対象年度が最新実績よりまだ先（=丸ごと未来の年度）なら、全月を「未来」として予測対象にする。
    // 過去の年度に実績が無いのはデータ欠落の可能性があるため、その場合は補正しない
    // （従来通り全月を過去扱いにして、予測は出さない）。
    currentIdx = (latestFY != null && fy > latestFY) ? -1 : monthKeys.length;
  }

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
      const mf = computeMonthForecast(allRows, m.ym, key, method, latestDate);
      if (mf) { soFarThisFY += mf.actualSum; forecastRemaining += mf.forecastSum; hasForecast = true; byIndex[idx] = mf.projectedTotal; }
      else { soFarThisFY += m.sum; byIndex[idx] = m.sum; }
      matchedPrevYm.push(m.prevYm);
      monthsElapsed += 1;
    }
  });

  const soFarLastFYSum = sumMetric(allRows.filter((r) => matchedPrevYm.includes(r.date.slice(0, 7))), key);
  const ratio = soFarLastFYSum > 0 ? soFarThisFY / soFarLastFYSum : 1;
  // 今年度の実績がまだ1ヶ月も無い（丸ごと未来の年度を見ている）場合のフォールバック：
  // 前年度全体の月平均を使う。
  const lastFYFullSum = sumMetric(allRows.filter((r) => prevMonthKeys.includes(r.date.slice(0, 7))), key);
  const lastFYMonthsWithData = prevMonthKeys.filter((pym) => allRows.some((r) => r.date.startsWith(pym))).length;
  const paceAvgPerMonth = monthsElapsed > 0
    ? soFarThisFY / monthsElapsed
    : (lastFYMonthsWithData > 0 ? lastFYFullSum / lastFYMonthsWithData : 0);

  const futureMonths = monthly.filter((m, idx) => idx > currentIdx);
  if (futureMonths.length > 0) hasForecast = true;
  let futureSum = 0;
  monthly.forEach((m, idx) => {
    if (idx <= currentIdx) return;
    let est;
    if (method === "seasonal") {
      const lySum = sumMetric(allRows.filter((r) => r.date.startsWith(m.prevYm)), key);
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
    hasForecast,
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
    y: { type: "linear", position: "left", title: { display: true, text: unitOrder[0] || "" } },
  };
  if (unitOrder[1]) {
    scales.y1 = { type: "linear", position: "right", title: { display: true, text: unitOrder[1] }, grid: { drawOnChartArea: false } };
  }
  return scales;
}

function buildMainChartConfig(opts) {
  const { view, buckets, chartType, selectedMetrics, showForecast, forecastMethod, dayTypeColoring, holidayMap, compareEnabled, allRows } = opts;
  const metrics = selectedMetrics;
  const unitOrder = [];
  const isBar = chartType === "bar" || chartType === "stackedBar";
  const stacked = chartType === "stackedBar";

  if (chartType === "scatter") {
    const yKey = metrics.find((m) => m !== "tempAvg") || metrics[0];
    const meta = METRICS[yKey];
    const points = buckets.rows
      .filter((r) => r.tempAvg != null && r[yKey] != null)
      .map((r) => ({ x: r.tempAvg, y: r[yKey], _date: r.date, _type: classifyDay(r.date, holidayMap) }));
    const colors = dayTypeColoring ? points.map((p) => DAY_TYPE_COLOR[p._type]) : meta.color;
    return {
      type: "scatter",
      data: { datasets: [{ label: `${meta.label} (${meta.unit})`, data: points, backgroundColor: colors, pointRadius: 4 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { title: { display: true, text: "外気温度(平均) ℃" } },
          y: { title: { display: true, text: `${meta.label} (${meta.unit})` } },
        },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.raw._date}: ${fmtNum(c.raw.y, 1)} ${meta.unit} (${fmtNum(c.raw.x, 1)}℃)` } } },
      },
    };
  }

  const labels = buckets.labels;
  const datasets = [];

  const dayTypeActive = dayTypeColoring && view === "day" && metrics.length === 1;
  const dayTypePointColors = dayTypeActive
    ? buckets.dateKeys.map((d) => (d ? DAY_TYPE_COLOR[classifyDay(d, holidayMap)] : null))
    : null;

  const pushForecastDataset = (key, meta, axisId) => {
    if (!(showForecast && view !== "year" && FORECASTABLE.includes(key))) return;
    const fc = buckets.forecast && buckets.forecast[key];
    if (!fc) return;
    const fcValues = buckets.current.map((rows, i) => (fc.byIndex[i] != null ? fc.byIndex[i] : null));
    datasets.push({
      label: `${meta.label}（予測）`, data: fcValues, borderColor: meta.color, borderDash: [5, 5],
      backgroundColor: "transparent", yAxisID: axisId, tension: 0.25, spanGaps: true, pointStyle: "triangle",
    });
  };

  if (compareEnabled) {
    metrics.forEach((key) => {
      const meta = METRICS[key];
      const axisId = axisIdForUnit(meta.unit, unitOrder);
      datasets.push({
        label: `${meta.label} 今期`, data: buckets.current.map((rows) => (rows.length ? aggMetric(rows, key) : null)),
        borderColor: meta.color, backgroundColor: dayTypeActive ? dayTypePointColors : meta.color + "55",
        pointBackgroundColor: dayTypeActive ? dayTypePointColors : meta.color,
        pointRadius: dayTypeActive ? 5 : 3, yAxisID: axisId, tension: 0.25, spanGaps: true,
      });
      datasets.push({
        label: `${meta.label} 前期`, data: buckets.previous.map((rows) => (rows.length ? aggMetric(rows, key) : null)),
        borderColor: meta.color, backgroundColor: meta.color + "22", borderDash: [4, 4], yAxisID: axisId, tension: 0.25, spanGaps: true,
      });
      pushForecastDataset(key, meta, axisId);
    });
  } else {
    metrics.forEach((key) => {
      const meta = METRICS[key];
      const axisId = axisIdForUnit(meta.unit, unitOrder);
      const values = buckets.current.map((rows) => (rows.length ? aggMetric(rows, key) : null));
      const pointColors = dayTypeActive ? dayTypePointColors : meta.color;
      datasets.push({
        label: `${meta.label} (${meta.unit})`, data: values, borderColor: meta.color,
        backgroundColor: isBar ? (Array.isArray(pointColors) ? pointColors : meta.color + "aa") : meta.color + "33",
        pointBackgroundColor: pointColors, pointRadius: dayTypeActive ? 5 : 3, yAxisID: axisId, tension: 0.25, spanGaps: true,
        stack: stacked ? "stack1" : undefined,
      });
      pushForecastDataset(key, meta, axisId);
    });
  }

  return {
    type: isBar ? "bar" : "line",
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: stacked
        ? { x: { stacked: true }, y: { stacked: true, title: { display: true, text: unitOrder[0] || "" } } }
        : { x: {}, ...buildScales(unitOrder) },
      plugins: { legend: { position: "bottom" } },
      interaction: { mode: "index", intersect: false },
    },
  };
}

// ============================================================
// バケット構築（日/月/年ビュー共通のデータ整形）
// ============================================================
function buildDayViewBuckets(allRows, ym) {
  const dim = daysInMonth(ym);
  const dateKeys = [];
  const labels = [];
  for (let d = 1; d <= dim; d++) { dateKeys.push(`${ym}-${String(d).padStart(2, "0")}`); labels.push(`${d}日`); }
  const byDate = {};
  allRows.filter((r) => r.date.startsWith(ym)).forEach((r) => { byDate[r.date] = r; });
  const current = dateKeys.map((d) => (byDate[d] ? [byDate[d]] : []));

  const [y, m] = ym.split("-").map(Number);
  const prevYm = `${y - 1}-${String(m).padStart(2, "0")}`;
  const prevByDate = {};
  allRows.filter((r) => r.date.startsWith(prevYm)).forEach((r) => { prevByDate[Number(r.date.split("-")[2])] = r; });
  const previous = dateKeys.map((d, i) => { const pr = prevByDate[i + 1]; return pr ? [pr] : []; });

  return { labels, current, previous, dateKeys, rows: allRows.filter((r) => r.date.startsWith(ym)) };
}

function buildMonthViewBuckets(allRows, fy) {
  const monthKeys = fiscalMonthKeys(fy);
  const prevMonthKeys = fiscalMonthKeys(fy - 1);
  const current = monthKeys.map((ym) => allRows.filter((r) => r.date.startsWith(ym)));
  const previous = prevMonthKeys.map((ym) => allRows.filter((r) => r.date.startsWith(ym)));

  return { labels: FM_LABELS, current, previous, dateKeys: monthKeys, rows: allRows.filter((r) => fiscalYear(r.date) === fy) };
}

function buildYearViewBuckets(allRows) {
  const fys = Array.from(new Set(allRows.map((r) => fiscalYear(r.date)))).sort((a, b) => a - b);
  const current = fys.map((fy) => allRows.filter((r) => fiscalYear(r.date) === fy));
  return { labels: fys.map((fy) => `${fy}年度`), current, previous: [], dateKeys: fys, rows: allRows, fys };
}

// グラフごとに異なる予測方式・対象項目を指定できるよう、予測計算はバケット構築と分離する
function computeForecastMap(allRows, view, selectedYm, selectedFY, forecastMethod, forecastMetrics) {
  const forecast = {};
  const latestDate = allRows.length ? allRows[allRows.length - 1].date : null;
  if (view === "day") {
    forecastMetrics.forEach((key) => {
      const mf = computeMonthForecast(allRows, selectedYm, key, forecastMethod, latestDate);
      if (mf) {
        const byIndex = {};
        mf.forecastPoints.forEach((p) => { const day = Number(p.date.split("-")[2]); byIndex[day - 1] = p.value; });
        forecast[key] = { byIndex, summary: mf };
      }
    });
  } else if (view === "month") {
    forecastMetrics.forEach((key) => {
      const ff = computeFiscalYearForecast(allRows, selectedFY, key, forecastMethod, latestDate);
      if (ff && ff.hasForecast) {
        const byIndex = {};
        ff.monthly.forEach((m, i) => { if (i >= ff.currentIdx) byIndex[i] = ff.byIndex[i]; });
        forecast[key] = { byIndex, summary: ff };
      }
    });
  }
  return forecast;
}

// ============================================================
// Chart キャンバス（マウント時に一度だけ構築、key変更で再構築）
// ============================================================
function ChartCanvas({ getConfig, height }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current) return undefined;
    const chart = new Chart(canvasRef.current.getContext("2d"), getConfig());
    return () => chart.destroy();
  }, []);
  return <canvas ref={canvasRef} height={height || 320}></canvas>;
}

// ============================================================
// UI パーツ
// ============================================================
function KPICard({ label, current, previous, unit, pct, highlight, onClick, active }) {
  const Tag = onClick ? "button" : "div";
  const increase = previous != null && pct > 0;
  return (
    <Tag className={"kpi-card" + (onClick ? " clickable" : "") + (active ? " active" : "") + (increase ? " increase" : "")} onClick={onClick}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{fmtNum(current, current < 100 ? 1 : 0)} <span className="kpi-unit">{unit}</span></div>
      {previous != null && (
        <div className={"kpi-delta " + (pct > 0 ? "up" : pct < 0 ? "down" : "")}>
          前期比 {fmtPct(pct)} <span className="kpi-prev">(前期 {fmtNum(previous, 0)}{unit})</span>
        </div>
      )}
      {highlight && <div className="kpi-highlight">{highlight}</div>}
    </Tag>
  );
}

function MetricSelector({ selected, onChange, compact }) {
  const toggle = (key) => {
    if (selected.includes(key)) onChange(selected.filter((k) => k !== key));
    else onChange([...selected, key]);
  };
  return (
    <div className={"metric-selector" + (compact ? " compact" : "")}>
      {METRIC_GROUPS.map((g) => (
        <div className="metric-group" key={g}>
          <div className="metric-group-title">{g}</div>
          {Object.keys(METRICS).filter((k) => METRICS[k].group === g).map((k) => (
            <label className="metric-chip" key={k} style={selected.includes(k) ? { borderColor: METRICS[k].color, background: METRICS[k].color + "1a" } : {}}>
              <input type="checkbox" checked={selected.includes(k)} onChange={() => toggle(k)} />
              {METRICS[k].label}
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}

function ChartSettingsModal({ name, onNameChange, chartType, onChartTypeChange, selected, onSelectedChange, onDelete, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>グラフ設定</h3>
        <div className="form-row">
          <label>グラフ名</label>
          <input type="text" value={name} onChange={(e) => onNameChange(e.target.value)} />
        </div>
        <div className="chart-settings-section">
          <div className="control-title">グラフ種別</div>
          <div className="chart-type-buttons">
            {CHART_TYPE_OPTIONS.map(([v, l]) => (
              <button key={v} className={"btn btn-small" + (chartType === v ? " active" : "")} onClick={() => onChartTypeChange(v)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="chart-settings-section chart-settings-metrics">
          <div className="control-title">表示項目</div>
          <MetricSelector selected={selected} onChange={onSelectedChange} compact />
        </div>
        <div className="modal-actions">
          {onDelete && <button className="btn btn-ghost-red" onClick={onDelete}>このグラフを削除</button>}
          <button className="btn btn-primary" onClick={onClose}>閉じる</button>
        </div>
      </div>
    </div>
  );
}

function SettingsModal({
  settings, onSave, onClose, onExportBackup, onImportBackup,
  autoSaveSupported, autoSaveFileName, autoSaveStatus, needsReauth,
  onConnectAutoSave, onReauthorizeAutoSave, onDisconnectAutoSave,
}) {
  const [form, setForm] = useState(settings);
  const [backupStatus, setBackupStatus] = useState("");
  const [extractStatus, setExtractStatus] = useState("idle"); // idle | loading | done | error
  const [extractMessage, setExtractMessage] = useState("");
  const equipFileRef = useRef(null);

  const handleExtractEquipFile = async (file) => {
    if (!file) return;
    if (!MONITOR_FILE_TYPES.includes(file.type)) {
      setExtractStatus("error");
      setExtractMessage("PDF・JPEG・PNGのみ読み込めます。");
      return;
    }
    setExtractStatus("loading");
    setExtractMessage("");
    try {
      const processed = await compressImageFile(file, MONITOR_IMAGE_MAX_DIM, MONITOR_IMAGE_QUALITY);
      if (processed.size > MONITOR_FILE_MAX_BYTES) {
        throw new Error(`ファイルサイズが大きすぎます（${MONITOR_FILE_MAX_BYTES / 1024 / 1024}MB以下にしてください）。`);
      }
      const dataUrl = await fileToDataUrl(processed);
      const rawText = await fetchGeminiImageComment(buildEquipCapacityExtractionPrompt(), dataUrl, processed.type);
      const extracted = parseExtractedCapacity(rawText);
      if (!extracted) throw new Error("読み取り結果を解析できませんでした。お手数ですが手入力してください。");
      const fieldMap = { chiller1: "chiller1CapacityKW", chiller2: "chiller2CapacityKW", boiler1: "boiler1CapacityKW", boiler2: "boiler2CapacityKW" };
      const updates = {};
      let foundCount = 0;
      Object.entries(fieldMap).forEach(([extKey, formKey]) => {
        const v = extracted[extKey];
        if (v != null && !isNaN(v)) { updates[formKey] = Number(v); foundCount += 1; }
      });
      if (foundCount === 0) throw new Error("機器の定格能力を読み取れませんでした。お手数ですが手入力してください。");
      setForm((prev) => ({ ...prev, ...updates }));
      setExtractStatus("done");
      setExtractMessage(`${foundCount}件の項目を読み取りました。内容を確認し、問題なければ「保存」を押してください。`);
    } catch (e) {
      setExtractStatus("error");
      setExtractMessage(e.message);
    }
  };

  const handleImportFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
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
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>設定</h3>
        <p className="modal-note">下記は一般的な目安値です。施設の契約内容・燃料仕様に合わせて編集してください。</p>
        <div className="form-row">
          <label>契約電力 (kW)</label>
          <input type="number" value={form.contractKW} onChange={(e) => setForm({ ...form, contractKW: Number(e.target.value) })} />
        </div>
        <div className="form-row">
          <label>重油発熱量 (MJ/L)</label>
          <input type="number" value={form.oilCalorificMJperL} onChange={(e) => setForm({ ...form, oilCalorificMJperL: Number(e.target.value) })} />
        </div>
        <div className="form-row">
          <label>電力換算係数 (MJ/kWh)</label>
          <input type="number" value={form.elecMJperKWh} onChange={(e) => setForm({ ...form, elecMJperKWh: Number(e.target.value) })} />
        </div>
        <div className="form-row">
          <label>電力CO2排出係数 (kg-CO2/kWh)</label>
          <input type="number" step="0.001" value={form.elecCO2PerKWh} onChange={(e) => setForm({ ...form, elecCO2PerKWh: Number(e.target.value) })} />
        </div>
        <div className="form-row">
          <label>重油CO2排出係数 (kg-CO2/L)</label>
          <input type="number" step="0.01" value={form.oilCO2PerL} onChange={(e) => setForm({ ...form, oilCO2PerL: Number(e.target.value) })} />
        </div>
        <div className="form-row">
          <label>原油換算係数 (GJ/kL)</label>
          <input type="number" step="0.1" value={form.crudeOilGJperKL} onChange={(e) => setForm({ ...form, crudeOilGJperKL: Number(e.target.value) })} />
        </div>
        <div className="form-row">
          <label>年度目標 受電電力量 (kWh)</label>
          <input type="number" value={form.targetElecKWh || 0} onChange={(e) => setForm({ ...form, targetElecKWh: Number(e.target.value) })} />
        </div>
        <div className="form-row">
          <label>年度目標 重油使用量 (L)</label>
          <input type="number" value={form.targetOilL || 0} onChange={(e) => setForm({ ...form, targetOilL: Number(e.target.value) })} />
        </div>
        <p className="modal-note">年度目標は「分析」画面の目標比較で使用します（0のままなら目標未設定として扱います）。</p>

        <div className="form-row">
          <label>異常値検知のしきい値 (σ)</label>
          <input type="number" step="0.1" min="0.5" value={form.anomalySigmaThreshold} onChange={(e) => setForm({ ...form, anomalySigmaThreshold: Number(e.target.value) })} />
        </div>
        <div className="form-row">
          <label>デマンド警告のしきい値 (契約比%)</label>
          <input type="number" step="1" value={form.demandAlertPct} onChange={(e) => setForm({ ...form, demandAlertPct: Number(e.target.value) })} />
        </div>
        <p className="modal-note">これらは「分析」画面の異常値検知と、ダッシュボードの注意事項バナーの感度に使われます。数値を小さくするほど検知しやすくなります。</p>

        <div className="form-row">
          <label>電力単価 (円/kWh)</label>
          <input type="number" step="0.1" value={form.elecPricePerKWh} onChange={(e) => setForm({ ...form, elecPricePerKWh: Number(e.target.value) })} />
        </div>
        <div className="form-row">
          <label>重油単価 (円/L)</label>
          <input type="number" step="1" value={form.oilPricePerL} onChange={(e) => setForm({ ...form, oilPricePerL: Number(e.target.value) })} />
        </div>
        <p className="modal-note">概算コストの計算に使用します。実際の契約単価に合わせて編集してください（目安値です）。</p>

        <div className="control-title">熱源機器の定格能力 (kW)</div>
        <p className="modal-note">⚠ 現在は仮の数値が入っています。竣工図・機器リストに記載の実際の定格能力に置き換えてください。ダッシュボードの「設備稼働率」の計算に使用します。</p>
        <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
          <button className="btn" onClick={() => equipFileRef.current && equipFileRef.current.click()} disabled={extractStatus === "loading"}>
            {extractStatus === "loading" ? "🤖 読み取り中…" : "📄 機器表(PDF/画像)から自動入力"}
          </button>
          <input
            type="file"
            ref={equipFileRef}
            accept={MONITOR_FILE_ACCEPT}
            style={{ display: "none" }}
            onChange={(e) => { handleExtractEquipFile(e.target.files[0]); e.target.value = ""; }}
          />
        </div>
        {extractMessage && <div className="modal-status">{extractMessage}</div>}
        <div className="form-row">
          <label>冷温水発生器No.1</label>
          <input type="number" value={form.chiller1CapacityKW} onChange={(e) => setForm({ ...form, chiller1CapacityKW: Number(e.target.value) })} />
        </div>
        <div className="form-row">
          <label>冷温水発生器No.2</label>
          <input type="number" value={form.chiller2CapacityKW} onChange={(e) => setForm({ ...form, chiller2CapacityKW: Number(e.target.value) })} />
        </div>
        <div className="form-row">
          <label>ボイラーNo.1</label>
          <input type="number" value={form.boiler1CapacityKW} onChange={(e) => setForm({ ...form, boiler1CapacityKW: Number(e.target.value) })} />
        </div>
        <div className="form-row">
          <label>ボイラーNo.2</label>
          <input type="number" value={form.boiler2CapacityKW} onChange={(e) => setForm({ ...form, boiler2CapacityKW: Number(e.target.value) })} />
        </div>

        <div className="settings-backup-section">
          <div className="control-title">データのバックアップ/復元</div>
          <p className="modal-note">全データ・設定を1つのファイルに保存し、別の端末やブラウザでも復元できます。</p>
          <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
            <button className="btn" onClick={onExportBackup}>バックアップをダウンロード</button>
            <label className="btn backup-file-label">
              バックアップから復元
              <input type="file" accept="application/json" style={{ display: "none" }} onChange={(e) => e.target.files[0] && handleImportFile(e.target.files[0])} />
            </label>
          </div>
          {backupStatus && <div className="modal-status">{backupStatus}</div>}
        </div>

        <div className="settings-backup-section">
          <div className="control-title">ローカルファイルへの自動保存</div>
          {!autoSaveSupported ? (
            <p className="modal-note">このブラウザは対応していません（Chrome/Edge推奨）。</p>
          ) : (
            <React.Fragment>
              <p className="modal-note">
                PC内のファイルを1つ選ぶと、以後データ・設定・メモを変更するたびに自動でそのファイルへ
                上書き保存します。localStorageとは別に、端末上のファイルとして残せます。
              </p>
              {needsReauth ? (
                <React.Fragment>
                  <div className="modal-status">「{autoSaveFileName}」への自動保存が一時停止しています（再度許可が必要です）。</div>
                  <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
                    <button className="btn" onClick={onReauthorizeAutoSave}>再連携する</button>
                    <button className="btn btn-ghost-red" onClick={onDisconnectAutoSave}>連携を解除</button>
                  </div>
                </React.Fragment>
              ) : autoSaveFileName ? (
                <React.Fragment>
                  <div className="modal-status">自動保存先: 「{autoSaveFileName}」{autoSaveStatus && ` / ${autoSaveStatus}`}</div>
                  <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
                    <button className="btn btn-ghost-red" onClick={onDisconnectAutoSave}>連携を解除</button>
                  </div>
                </React.Fragment>
              ) : (
                <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
                  <button className="btn" onClick={onConnectAutoSave}>ファイルを選択して自動保存を開始</button>
                </div>
              )}
            </React.Fragment>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>キャンセル</button>
          <button className="btn btn-primary" onClick={() => { onSave(form); onClose(); }}>保存</button>
        </div>
      </div>
    </div>
  );
}

const ENTRY_FIELDS = [
  { key: "tempAvg", label: "外気温度(平均)", unit: "℃", step: "0.1", digits: 1 },
  { key: "humidityAvg", label: "外気湿度(平均)", unit: "%RH", step: "1", digits: 0 },
  { key: "coolLoadGJ", label: "冷水負荷", unit: "GJ", step: "0.01", digits: 2 },
  { key: "heatLoadGJ", label: "温水負荷", unit: "GJ", step: "0.01", digits: 2 },
  { key: "elecKWh", label: "受電電力量", unit: "kWh", step: "1", digits: 0 },
  { key: "oilChiller1L", label: "重油(冷温水発生器No.1)", unit: "L", step: "0.1", digits: 1 },
  { key: "oilChiller2L", label: "重油(冷温水発生器No.2)", unit: "L", step: "0.1", digits: 1 },
  { key: "oilBoiler1L", label: "重油(ボイラーNo.1)", unit: "L", step: "0.1", digits: 1 },
  { key: "oilBoiler2L", label: "重油(ボイラーNo.2)", unit: "L", step: "0.1", digits: 1 },
];
const ENTRY_LIST_COLUMNS = [
  ...ENTRY_FIELDS.map((f) => ({ ...f, calc: false })),
  { key: "oilChillerTotalL", label: "重油(冷温水発生器 計)", unit: "L", digits: 1, calc: true },
  { key: "oilBoilerTotalL", label: "重油(ボイラー 計)", unit: "L", digits: 1, calc: true },
  { key: "oilTotalL", label: "重油使用量(合計)", unit: "L", digits: 1, calc: true },
  { key: "totalLoadGJ", label: "負荷熱量(合計)", unit: "GJ", digits: 2, calc: true },
  { key: "demandKW", label: "日平均電力(簡易デマンド)", unit: "kW", digits: 1, calc: true },
  { key: "efficiencyPct", label: "総合熱源効率", unit: "%", digits: 1, calc: true },
  { key: "co2T", label: "CO2排出量", unit: "t-CO2", digits: 3, calc: true },
  { key: "crudeOilKL", label: "原油換算値", unit: "kL", digits: 3, calc: true },
  { key: "costYen", label: "概算コスト", unit: "円", digits: 0, calc: true },
];
function downloadEntryListCsv(ym, cells, dataByDate) {
  const header = ["日付", ...ENTRY_LIST_COLUMNS.map((c) => `${c.label}(${c.unit})`)];
  const rows = cells.filter((c) => c).map((dateStr) => {
    const rec = dataByDate[dateStr];
    return [dateStr, ...ENTRY_LIST_COLUMNS.map((col) => (rec && rec[col.key] != null ? rec[col.key] : ""))];
  });
  const csv = [header, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
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
  ENTRY_FIELDS.forEach((fld) => { f[fld.key] = ""; });
  return f;
}
function formFromRecord(record) {
  const f = {};
  ENTRY_FIELDS.forEach((fld) => { f[fld.key] = record && record[fld.key] != null ? String(record[fld.key]) : ""; });
  return f;
}

const NON_NEGATIVE_FIELDS = ["coolLoadGJ", "heatLoadGJ", "elecKWh", "oilChiller1L", "oilChiller2L", "oilBoiler1L", "oilBoiler2L"];
const DEVIATION_CHECK_FIELDS = ["coolLoadGJ", "heatLoadGJ", "elecKWh"];

function validateEntry(form, previousRecord) {
  const errors = [];
  const warnings = [];
  const num = (k) => parseFloat(form[k]);

  if (form.humidityAvg !== "" && !isNaN(num("humidityAvg")) && (num("humidityAvg") < 0 || num("humidityAvg") > 100)) {
    errors.push("外気湿度(平均)は0〜100の範囲で入力してください。");
  }
  NON_NEGATIVE_FIELDS.forEach((k) => {
    const v = num(k);
    if (form[k] !== "" && !isNaN(v) && v < 0) {
      const label = ENTRY_FIELDS.find((f) => f.key === k).label;
      errors.push(`${label}はマイナスの値にできません。`);
    }
  });

  if (previousRecord) {
    DEVIATION_CHECK_FIELDS.forEach((k) => {
      const prev = previousRecord[k];
      const cur = num(k);
      if (prev != null && prev > 0 && form[k] !== "" && !isNaN(cur)) {
        const ratio = cur / prev;
        if (ratio >= 3 || ratio <= 0.33) {
          const label = ENTRY_FIELDS.find((f) => f.key === k).label;
          warnings.push(`${label}が前日の${ratio.toFixed(1)}倍です。入力ミスがないかご確認ください。`);
        }
      }
    });
  }
  return { errors, warnings };
}

function DayEntryForm({ date, record, previousDate, previousRecord, weekAgoRecord, note, onSaveNote, onSave, onDelete, onNextDay }) {
  const [form, setForm] = useState(() => formFromRecord(record));
  const [saved, setSaved] = useState(false);
  const [noteText, setNoteText] = useState(note || "");
  const [noteSaved, setNoteSaved] = useState(false);

  useEffect(() => { setForm(formFromRecord(record)); setSaved(false); setNoteText(note || ""); setNoteSaved(false); }, [date]);

  const num = (k) => { const v = parseFloat(form[k]); return isNaN(v) ? 0 : v; };
  const oilChillerTotal = num("oilChiller1L") + num("oilChiller2L");
  const oilBoilerTotal = num("oilBoiler1L") + num("oilBoiler2L");
  const oilTotal = oilChillerTotal + oilBoilerTotal;

  const handleChange = (k, v) => { setForm({ ...form, [k]: v }); setSaved(false); };

  const validation = useMemo(() => validateEntry(form, previousRecord), [form, previousRecord]);

  const handleSave = () => {
    if (validation.errors.length > 0) return false;
    const rec = { date };
    ENTRY_FIELDS.forEach((fld) => { const v = parseFloat(form[fld.key]); rec[fld.key] = isNaN(v) ? null : v; });
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

  const handleInputKeyDown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (handleSave() && onNextDay) onNextDay();
  };

  return (
    <div className="entry-form">
      <div className="entry-form-title-row">
        <div className="entry-form-title">{date} の実績入力</div>
        <button className="btn btn-small" onClick={handleCopyPrevious} disabled={!previousRecord}>前日の値をコピー</button>
      </div>
      <div className="entry-form-prev-note">
        前日（{previousDate}）実績{previousRecord ? "を右に表示しています" : "：データなし"}
      </div>
      <div className="entry-form-grid">
        <div className="entry-form-header-row">
          <span></span>
          <span className="entry-form-prev-head">先週同曜日</span>
          <span className="entry-form-prev-head">前日実績</span>
          <span className="entry-form-input-head">本日の入力</span>
        </div>
        {ENTRY_FIELDS.map((fld) => (
          <label key={fld.key} className="entry-form-row">
            <span className="entry-form-label">{fld.label}</span>
            <span className="entry-form-prev-value">
              {weekAgoRecord && weekAgoRecord[fld.key] != null ? `${fmtNum(weekAgoRecord[fld.key], fld.digits)} ${fld.unit}` : "-"}
            </span>
            <span className="entry-form-prev-value">
              {previousRecord && previousRecord[fld.key] != null ? `${fmtNum(previousRecord[fld.key], fld.digits)} ${fld.unit}` : "-"}
            </span>
            <span className="entry-form-input-wrap">
              <input type="number" inputMode="decimal" step={fld.step} value={form[fld.key]} onChange={(e) => handleChange(fld.key, e.target.value)} onKeyDown={handleInputKeyDown} />
              <span className="entry-form-unit">{fld.unit}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="entry-form-computed">
        <div>重油(冷温水発生器 計): <b>{fmtNum(oilChillerTotal, 1)}</b> L</div>
        <div>重油(ボイラー 計): <b>{fmtNum(oilBoilerTotal, 1)}</b> L</div>
        <div>重油使用量(合計): <b>{fmtNum(oilTotal, 1)}</b> L</div>
      </div>
      {validation.errors.length > 0 && (
        <div className="entry-validation entry-validation-error">
          {validation.errors.map((msg, i) => <div key={i}>⛔ {msg}</div>)}
        </div>
      )}
      {validation.warnings.length > 0 && (
        <div className="entry-validation entry-validation-warn">
          {validation.warnings.map((msg, i) => <div key={i}>⚠ {msg}</div>)}
        </div>
      )}
      <div className="entry-form-actions">
        {record && <button className="btn btn-ghost-red" onClick={handleDelete}>この日のデータを削除</button>}
        <button className="btn btn-primary" onClick={handleSave} disabled={validation.errors.length > 0}>保存</button>
      </div>
      {saved && <div className="entry-saved-msg">保存しました（Enterキーでも保存して翌日に進めます）</div>}

      <div className="entry-note-section">
        <div className="control-title">メモ（点検・機器交換などの記録用）</div>
        <textarea
          className="entry-note-textarea"
          rows={2}
          value={noteText}
          onChange={(e) => { setNoteText(e.target.value); setNoteSaved(false); }}
          placeholder="例: 冷温水発生器No.1 定期点検実施"
        />
        <button className="btn btn-small" onClick={handleSaveNote}>メモを保存</button>
        {noteSaved && <span className="entry-saved-msg entry-note-saved-msg">保存しました</span>}
      </div>
    </div>
  );
}

function DataEntryView({ data, onSave, onDelete, notes, onSaveNote, monitorFiles, onDeleteMonitorFile, onOpenMonitorPreview }) {
  const dataByDate = useMemo(() => {
    const m = {};
    data.forEach((r) => { m[r.date] = r; });
    return m;
  }, [data]);

  const latestDate = data.length ? data[data.length - 1].date : null;
  const today = new Date();
  const defaultYm = latestDate ? latestDate.slice(0, 7) : `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [ym, setYm] = useState(defaultYm);
  const [selectedDate, setSelectedDate] = useState(latestDate || `${defaultYm}-01`);
  const [showNotesList, setShowNotesList] = useState(false);
  const [showMissingDays, setShowMissingDays] = useState(false);
  const [showMonitorList, setShowMonitorList] = useState(false);

  const monitorDateSet = useMemo(() => new Set(monitorFiles.map((f) => f.date)), [monitorFiles]);
  const handleDeleteMonitorFile = (dateStr, fileId) => {
    onDeleteMonitorFile(dateStr, fileId);
  };

  const missingDays = useMemo(() => {
    if (!data.length) return [];
    const known = new Set(data.map((r) => r.date));
    const start = parseISO(data[0].date);
    const end = parseISO(data[data.length - 1].date);
    const missing = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!known.has(ds)) missing.push(ds);
    }
    return missing;
  }, [data]);

  const changeMonth = (delta) => {
    setYm((prevYm) => {
      const [y, m] = prevYm.split("-").map(Number);
      const d = new Date(y, m - 1 + delta, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
  };

  const goToNextDay = () => {
    setSelectedDate((prev) => {
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

  const enteredCount = cells.filter((c) => c && dataByDate[c]).length;

  return (
    <React.Fragment>
    <section className="entry-layout">
      <div className="entry-calendar-panel">
        <div className="entry-cal-header">
          <button className="btn btn-small" onClick={() => changeMonth(-1)}>◀ 前月</button>
          <div className="entry-cal-title">{y}年{m}月</div>
          <button className="btn btn-small" onClick={() => changeMonth(1)}>翌月 ▶</button>
        </div>
        <div className="entry-cal-summary-row">
          <div className="entry-cal-summary">入力済み: {enteredCount} / {dim}日</div>
          <div className="entry-cal-summary-actions">
            <button className="btn btn-small" onClick={() => setShowMissingDays(true)}>未入力日一覧{missingDays.length > 0 && ` (${missingDays.length})`}</button>
            <button className="btn btn-small" onClick={() => setShowNotesList(true)}>📝 メモ一覧</button>
            <button className="btn btn-small" onClick={() => setShowMonitorList(true)}>🖥 中央監視画面一覧{monitorFiles.length > 0 && ` (${monitorFiles.length})`}</button>
          </div>
        </div>
        <div className="entry-cal-grid entry-cal-dow">
          {["日", "月", "火", "水", "木", "金", "土"].map((w) => <div key={w} className="entry-cal-dow-cell">{w}</div>)}
        </div>
        <div className="entry-cal-grid">
          {cells.map((dateStr, i) => {
            if (!dateStr) return <div key={i} className="entry-cal-cell empty"></div>;
            const has = !!dataByDate[dateStr];
            const hasNote = !!(notes && notes[dateStr]);
            const hasMonitor = monitorDateSet.has(dateStr);
            const day = Number(dateStr.split("-")[2]);
            const isSelected = dateStr === selectedDate;
            const dow = i % 7;
            return (
              <button
                key={i}
                className={"entry-cal-cell" + (has ? " has-data" : "") + (isSelected ? " selected" : "") + (dow === 0 ? " sun" : dow === 6 ? " sat" : "")}
                onClick={() => setSelectedDate(dateStr)}
              >
                <span className="entry-cal-day">{day}</span>
                {hasMonitor && (
                  <span
                    className="entry-cal-monitor-icon"
                    title="中央監視画面あり（クリックでプレビュー）"
                    onClick={(e) => { e.stopPropagation(); onOpenMonitorPreview(dateStr); }}
                  >🖥</span>
                )}
                {hasNote && <span className="entry-cal-note-icon" title={notes[dateStr]}>📝</span>}
                {has && <span className="entry-cal-dot"></span>}
              </button>
            );
          })}
        </div>
        <div className="entry-cal-legend">
          <span className="legend-item"><span className="entry-cal-dot standalone"></span>入力済み</span>
          <span className="legend-item"><span className="entry-cal-dot standalone empty-dot"></span>未入力</span>
          <span className="legend-item">📝 メモあり</span>
          <span className="legend-item">🖥 中央監視画面あり</span>
        </div>
      </div>
      <div className="entry-form-panel">
        {selectedDate ? (
          <DayEntryForm
            key={selectedDate}
            date={selectedDate}
            record={dataByDate[selectedDate]}
            previousDate={addDays(selectedDate, -1)}
            previousRecord={dataByDate[addDays(selectedDate, -1)]}
            weekAgoRecord={dataByDate[addDays(selectedDate, -7)]}
            note={notes && notes[selectedDate]}
            onSaveNote={onSaveNote}
            onSave={onSave}
            onDelete={onDelete}
            onNextDay={goToNextDay}
          />
        ) : (
          <div className="empty-state">日付を選択してください</div>
        )}
      </div>
    </section>
    <section className="entry-list-panel">
        <div className="panel-title-row">
          <div className="panel-title">{y}年{m}月 一覧（計算項目は水色背景）</div>
          <button className="btn btn-small" onClick={() => downloadEntryListCsv(ym, cells, dataByDate)}>CSVダウンロード</button>
        </div>
        <div className="entry-list-scroll">
          <table className="entry-list-table">
            <thead>
              <tr>
                <th className="entry-list-datecol">日付</th>
                {ENTRY_LIST_COLUMNS.map((col) => (
                  <th key={col.key} className={col.calc ? "calc-col" : ""}>{col.label}<br /><span className="entry-list-unit">({col.unit})</span></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cells.filter((c) => c).map((dateStr) => {
                const rec = dataByDate[dateStr];
                const day = Number(dateStr.split("-")[2]);
                const isSelected = dateStr === selectedDate;
                return (
                  <tr key={dateStr} className={isSelected ? "selected" : ""} onClick={() => setSelectedDate(dateStr)}>
                    <td className="entry-list-datecol">{m}/{day}</td>
                    {ENTRY_LIST_COLUMNS.map((col) => (
                      <td key={col.key} className={col.calc ? "calc-col" : ""}>
                        {rec && rec[col.key] != null ? fmtNum(rec[col.key], col.digits) : "-"}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      {showNotesList && (
        <NotesListModal
          notes={notes}
          onClose={() => setShowNotesList(false)}
          onJumpToDate={(dateStr) => {
            setYm(dateStr.slice(0, 7));
            setSelectedDate(dateStr);
            setShowNotesList(false);
          }}
        />
      )}
      {showMissingDays && (
        <MissingDaysModal
          missingDays={missingDays}
          onClose={() => setShowMissingDays(false)}
          onJumpToDate={(dateStr) => {
            setYm(dateStr.slice(0, 7));
            setSelectedDate(dateStr);
            setShowMissingDays(false);
          }}
        />
      )}
      {showMonitorList && (
        <MonitorFilesListModal
          files={monitorFiles}
          onClose={() => setShowMonitorList(false)}
          onPreview={onOpenMonitorPreview}
          onDelete={handleDeleteMonitorFile}
        />
      )}
    </React.Fragment>
  );
}

function MissingDaysModal({ missingDays, onClose, onJumpToDate }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>未入力日一覧</h3>
        <p className="modal-note">データの最初の日から最後の日までの範囲で、記録が無い日を一覧表示しています（全{missingDays.length}日）。</p>
        {missingDays.length === 0 ? (
          <div className="analysis-empty">未入力日はありません。</div>
        ) : (
          <div className="notes-list">
            {missingDays.map((dateStr) => (
              <button key={dateStr} className="notes-list-item missing-day-item" onClick={() => onJumpToDate(dateStr)}>
                <div className="notes-list-date">{dateStr}</div>
              </button>
            ))}
          </div>
        )}
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>閉じる</button>
        </div>
      </div>
    </div>
  );
}

function NotesListModal({ notes, onClose, onJumpToDate }) {
  const entries = Object.entries(notes || {}).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>メモ一覧</h3>
        {entries.length === 0 ? (
          <div className="analysis-empty">まだメモがありません。</div>
        ) : (
          <div className="notes-list">
            {entries.map(([dateStr, text]) => (
              <button key={dateStr} className="notes-list-item" onClick={() => onJumpToDate(dateStr)}>
                <div className="notes-list-date">{dateStr}</div>
                <div className="notes-list-text">{text}</div>
              </button>
            ))}
          </div>
        )}
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>閉じる</button>
        </div>
      </div>
    </div>
  );
}

const MONITOR_FILE_ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
const MONITOR_FILE_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];

function MonitorImportModal({ onClose, defaultDate, onUploaded, onSavedAndAnalyze, monitorFiles, onOpenExistingPreview }) {
  const [date, setDate] = useState(defaultDate);
  const [calMonth, setCalMonth] = useState(defaultDate.slice(0, 7));
  const [status, setStatus] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]); // [{tempId, file, status: compressing|ready|error, errorMsg, previewUrl}]
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [existingPreviews, setExistingPreviews] = useState({}); // fileId -> { url, revoke }
  const fileRef = useRef(null);
  const cameraRef = useRef(null);

  const monitorDateSet = useMemo(() => new Set(monitorFiles.map((f) => f.date)), [monitorFiles]);
  const existingFilesForDate = useMemo(() => monitorFiles.filter((f) => f.date === date), [monitorFiles, date]);
  // カレンダーの下に表示する「画面を保存した日」一覧（新しい日付順）
  const savedDatesList = useMemo(() => {
    const counts = {};
    monitorFiles.forEach((f) => { counts[f.date] = (counts[f.date] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([d, count]) => ({ date: d, count }));
  }, [monitorFiles]);

  const pickDate = (d) => {
    setDate(d);
    setCalMonth(d.slice(0, 7));
  };
  const shiftCalMonth = (delta) => {
    setCalMonth((prev) => {
      const [y, m] = prev.split("-").map(Number);
      const d = new Date(y, m - 1 + delta, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
  };
  const calDim = daysInMonth(calMonth);
  const [calY, calM] = calMonth.split("-").map(Number);
  const calFirstDow = new Date(calY, calM - 1, 1).getDay();
  const calCells = [];
  for (let i = 0; i < calFirstDow; i++) calCells.push(null);
  for (let d = 1; d <= calDim; d++) calCells.push(`${calMonth}-${String(d).padStart(2, "0")}`);

  // 選択中の日付にすでに登録済みのファイルがあれば、サムネイルを読み込んで表示する。
  useEffect(() => {
    let cancelled = false;
    const revokeUrls = [];
    setExistingPreviews({});
    existingFilesForDate.forEach((f) => {
      monitorGetPreviewSrc(date, f.fileId).then((result) => {
        if (cancelled || !result) return;
        if (result.revoke) revokeUrls.push(result.url);
        setExistingPreviews((prev) => ({ ...prev, [f.fileId]: result.url }));
      }).catch(() => {});
    });
    return () => { cancelled = true; revokeUrls.forEach((u) => URL.revokeObjectURL(u)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, existingFilesForDate.map((f) => f.fileId).join(",")]);

  const acceptFiles = (fileList) => {
    const files = Array.from(fileList || []);
    files.forEach(async (file) => {
      if (!MONITOR_FILE_TYPES.includes(file.type)) {
        setStatus(`${file.name}: PDF・JPEG・PNGのみアップロードできます。`);
        return;
      }
      const tempId = genMonitorFileId();
      setSelectedFiles((prev) => [...prev, { tempId, file, status: "compressing", previewUrl: null }]);
      try {
        const processed = await compressImageFile(file, MONITOR_IMAGE_MAX_DIM, MONITOR_IMAGE_QUALITY);
        if (processed.size > MONITOR_FILE_MAX_BYTES) {
          setSelectedFiles((prev) => prev.map((f) => (f.tempId === tempId ? { ...f, status: "error", errorMsg: "圧縮後もサイズが大きすぎます" } : f)));
          return;
        }
        const previewUrl = URL.createObjectURL(processed);
        setSelectedFiles((prev) => prev.map((f) => (f.tempId === tempId ? { ...f, file: processed, status: "ready", previewUrl } : f)));
      } catch (e) {
        setSelectedFiles((prev) => prev.map((f) => (f.tempId === tempId ? { ...f, status: "error", errorMsg: e.message } : f)));
      }
    });
  };

  const removeSelected = (tempId) => setSelectedFiles((prev) => {
    const target = prev.find((f) => f.tempId === tempId);
    if (target && target.previewUrl) URL.revokeObjectURL(target.previewUrl);
    return prev.filter((f) => f.tempId !== tempId);
  });

  const readyFiles = selectedFiles.filter((f) => f.status === "ready");

  // andAnalyze=trueの場合（「保存してGemini分析」）は、保存後この取り込みモーダルを閉じて
  // プレビュー画面（Gemini分析ボタン群がある画面）を開く。andAnalyze=false（「保存のみ」）は
  // 従来通りこのモーダルを開いたまま完了メッセージだけ表示する。
  const handleUpload = async (andAnalyze) => {
    if (!date) { setStatus("対象日を選択してください。"); return; }
    if (!readyFiles.length) { setStatus("ファイルを選択してください。"); return; }
    setUploading(true);
    try {
      for (const f of readyFiles) {
        await monitorSaveFile(date, genMonitorFileId(), f.file);
      }
      readyFiles.forEach((f) => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); });
      const savedDate = date;
      const savedCount = readyFiles.length;
      setSelectedFiles([]);
      if (fileRef.current) fileRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
      onUploaded();
      if (andAnalyze) {
        onSavedAndAnalyze(savedDate);
      } else {
        setStatus(`${savedDate} に${savedCount}枚保存しました（データ入力画面のカレンダーからプレビューできます）。`);
      }
    } catch (e) {
      setStatus("保存エラー: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="monitor-import-panel">
        <h3>中央監視画面取り込み</h3>
        <p className="modal-note">
          中央監視装置の熱源画面（PDF・JPEG・PNG、複数可）を日付ごとに取り込みます。画像は自動的に
          圧縮・縮小されてから保存されます。
          {monitorSyncEnabled ? "Firebaseに保存され、他端末とも共有されます。" : "この端末（ブラウザ）内にのみ保存されます。"}
        </p>
        <div className="form-row">
          <label>対象日</label>
          <input type="date" value={date} onChange={(e) => pickDate(e.target.value)} />
        </div>

        {selectedFiles.length === 0 && (
          <React.Fragment>
            <div className="monitor-import-cal">
              <div className="monitor-import-cal-header">
                <button className="btn btn-small" onClick={() => shiftCalMonth(-1)}>◀ 前月</button>
                <div>{calY}年{calM}月</div>
                <button className="btn btn-small" onClick={() => shiftCalMonth(1)}>翌月 ▶</button>
              </div>
              <div className="monitor-import-cal-grid monitor-import-cal-dow">
                {["日", "月", "火", "水", "木", "金", "土"].map((w) => <div key={w}>{w}</div>)}
              </div>
              <div className="monitor-import-cal-grid">
                {calCells.map((d, i) => (
                  d ? (
                    <button
                      key={d}
                      className={"monitor-import-cal-cell" + (d === date ? " selected" : "")}
                      onClick={() => pickDate(d)}
                    >
                      {Number(d.slice(-2))}
                      {monitorDateSet.has(d) && <span className="monitor-import-cal-dot">🖥</span>}
                    </button>
                  ) : <div key={"empty" + i} className="monitor-import-cal-cell empty"></div>
                ))}
              </div>
            </div>

            <div className="monitor-import-saved-list">
              <div className="monitor-import-saved-list-title">画面を保存した日（{savedDatesList.length}日）</div>
              {savedDatesList.length === 0 ? (
                <div className="modal-note">まだ登録がありません。</div>
              ) : (
                <div className="monitor-import-saved-list-items">
                  {savedDatesList.map((s) => (
                    <button
                      key={s.date}
                      className={"monitor-import-saved-list-item" + (s.date === date ? " selected" : "")}
                      onClick={() => pickDate(s.date)}
                    >
                      {s.date}{s.count > 1 && ` (${s.count}件)`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {existingFilesForDate.length > 0 && (
              <div className="monitor-import-existing">
                <p className="modal-note">この日にはすでに{existingFilesForDate.length}件登録されています（クリックして開く）：</p>
                <div className="monitor-preview-list">
                  {existingFilesForDate.map((f) => (
                    <div
                      key={f.fileId}
                      className="monitor-preview-item monitor-preview-item-clickable"
                      onClick={() => onOpenExistingPreview && onOpenExistingPreview(date)}
                    >
                      <div className="monitor-preview-item-thumb">
                        {existingPreviews[f.fileId] && (
                          f.fileType === "application/pdf" ? (
                            <iframe src={existingPreviews[f.fileId]} className="monitor-preview-item-pdf" title={f.fileName}></iframe>
                          ) : (
                            <img src={existingPreviews[f.fileId]} alt={f.fileName} />
                          )
                        )}
                      </div>
                      <div className="monitor-preview-item-info">
                        <div className="monitor-preview-item-name">{f.fileName}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </React.Fragment>
        )}

        <div
          className={"monitor-dropzone" + (dragOver ? " drag-over" : "")}
          onClick={() => fileRef.current && fileRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            acceptFiles(e.dataTransfer.files);
          }}
        >
          <div>ここにファイルをドラッグ＆ドロップ（複数可）<br />または クリックしてファイルを選択（PDF・JPEG・PNG）</div>
          <input
            type="file"
            ref={fileRef}
            accept={MONITOR_FILE_ACCEPT}
            multiple
            style={{ display: "none" }}
            onChange={(e) => { acceptFiles(e.target.files); e.target.value = ""; }}
          />
        </div>
        <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
          <button className="btn" onClick={(e) => { e.stopPropagation(); cameraRef.current && cameraRef.current.click(); }}>
            {selectedFiles.length > 0 ? "📷 続けてカメラ撮影する" : "📷 カメラで撮影"}
          </button>
          <input
            type="file"
            ref={cameraRef}
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={(e) => { acceptFiles(e.target.files); e.target.value = ""; }}
          />
        </div>

        {selectedFiles.length > 0 && (
          <div className="monitor-import-preview-step">
            <p className="modal-note">この画像で保存しますか？（対象日: {date}）</p>
            <div className="monitor-preview-list monitor-preview-list-large">
              {selectedFiles.map((f) => (
                <div key={f.tempId} className="monitor-preview-item">
                  <div className="monitor-preview-item-thumb">
                    {f.status === "ready" && f.previewUrl && (
                      f.file.type === "application/pdf" ? (
                        <iframe src={f.previewUrl} className="monitor-preview-item-pdf" title={f.file.name}></iframe>
                      ) : (
                        <img src={f.previewUrl} alt={f.file.name} />
                      )
                    )}
                    {f.status === "compressing" && <div className="monitor-preview-item-loading">圧縮中…</div>}
                    {f.status === "error" && <div className="monitor-preview-item-error">⚠</div>}
                  </div>
                  <div className="monitor-preview-item-info">
                    <div className="monitor-preview-item-name">{f.file.name}</div>
                    {f.status === "ready" && <div className="monitor-selected-status">{Math.round(f.file.size / 1024)}KB</div>}
                    {f.status === "error" && <div className="monitor-selected-status error">{f.errorMsg}</div>}
                    <button className="btn btn-small" onClick={() => removeSelected(f.tempId)}>× 削除</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
              <button className="btn btn-primary" onClick={() => handleUpload(false)} disabled={uploading || readyFiles.length === 0}>
                {uploading ? "保存中…" : `保存のみ${readyFiles.length > 0 ? `（${readyFiles.length}枚）` : ""}`}
              </button>
              <button className="btn" onClick={() => handleUpload(true)} disabled={uploading || readyFiles.length === 0}>
                {uploading ? "保存中…" : "🤖 保存してGeminiで分析"}
              </button>
            </div>
          </div>
        )}
        {status && <div className="modal-status">{status}</div>}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>閉じる</button>
        </div>
    </section>
  );
}

function MonitorFilesListModal({ files, onClose, onPreview, onDelete }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>中央監視画面一覧</h3>
        {files.length === 0 ? (
          <div className="analysis-empty">まだ取り込まれた画面がありません。</div>
        ) : (
          <div className="notes-list">
            {files.map((f) => (
              <div key={f.date + "_" + f.fileId} className="notes-list-item monitor-list-item">
                <div>
                  <div className="notes-list-date">{f.date}</div>
                  <div className="notes-list-text">{f.fileName}</div>
                </div>
                <div className="monitor-list-actions">
                  <button className="btn btn-small" onClick={() => onPreview(f.date)}>プレビュー</button>
                  <button className="btn btn-small btn-ghost-red" onClick={() => onDelete(f.date, f.fileId)}>削除</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>閉じる</button>
        </div>
      </div>
    </div>
  );
}

// 1日に複数の中央監視画面が登録されている場合、まとめてプレビューし、画面ごとの個別分析と
// 全画面を踏まえた総括の両方をGeminiに依頼できるようにしている。
// 最適運転アドバイスに付随するLOAD_TABLEをHTMLの表として描画する。
function LoadTableView({ table }) {
  if (!table || !table.length) return null;
  return (
    <div className="entry-list-scroll" style={{ marginTop: 6 }}>
      <table className="entry-list-table load-table">
        <thead>
          <tr>
            <th className="entry-list-datecol">機器</th>
            <th>出力(kW)</th>
            <th>定格(kW)</th>
            <th>負荷率(%)</th>
          </tr>
        </thead>
        <tbody>
          {table.map((row, i) => (
            <tr key={i}>
              <td className="entry-list-datecol">{row.name || "-"}</td>
              <td>{row.outputKW != null ? fmtNum(row.outputKW, 0) : "-"}</td>
              <td>{row.capacityKW != null ? fmtNum(row.capacityKW, 0) : "-"}</td>
              <td>{row.loadPct != null ? fmtNum(row.loadPct, 1) : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MonitorPreviewModal({ date, files, settings, onClose, onDelete }) {
  const [previews, setPreviews] = useState({}); // fileId -> { url, status }
  const [fileComments, setFileComments] = useState({}); // fileId -> { status, comment }
  const [adviceState, setAdviceState] = useState({}); // fileId -> { status, comment }
  const [summaryStatus, setSummaryStatus] = useState("idle"); // idle | loading | done | error
  const [summaryComment, setSummaryComment] = useState("");
  const [multiAdviceStatus, setMultiAdviceStatus] = useState("idle"); // idle | loading | done | error
  const [multiAdviceComment, setMultiAdviceComment] = useState("");
  const [multiAdviceTable, setMultiAdviceTable] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const revokeUrls = [];
    setPreviews({});
    setFileComments({});
    setSummaryStatus("idle");
    setSummaryComment("");
    setMultiAdviceStatus("idle");
    setMultiAdviceComment("");
    setMultiAdviceTable(null);
    files.forEach((f) => {
      setPreviews((prev) => ({ ...prev, [f.fileId]: { url: null, status: "読み込み中…" } }));
      monitorGetPreviewSrc(date, f.fileId).then((result) => {
        if (cancelled) return;
        if (!result) { setPreviews((prev) => ({ ...prev, [f.fileId]: { url: null, status: "見つかりませんでした。" } })); return; }
        if (result.revoke) revokeUrls.push(result.url);
        setPreviews((prev) => ({ ...prev, [f.fileId]: { url: result.url, status: "" } }));
      }).catch((e) => {
        if (!cancelled) setPreviews((prev) => ({ ...prev, [f.fileId]: { url: null, status: "読み込みエラー: " + e.message } }));
      });
    });
    return () => { cancelled = true; revokeUrls.forEach((u) => URL.revokeObjectURL(u)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, files.map((f) => f.fileId).join(",")]);

  const analyzeOneFile = async (f) => {
    setFileComments((prev) => ({ ...prev, [f.fileId]: { status: "loading", comment: "" } }));
    try {
      const dataUrl = await monitorGetFileDataUrl(date, f.fileId);
      if (!dataUrl) throw new Error("画像データが見つかりませんでした。");
      const text = await fetchGeminiImageComment(buildMonitorImagePrompt(date, f.fileName), dataUrl, f.fileType);
      setFileComments((prev) => ({ ...prev, [f.fileId]: { status: "done", comment: text } }));
      return text;
    } catch (e) {
      setFileComments((prev) => ({ ...prev, [f.fileId]: { status: "error", comment: e.message } }));
      throw e;
    }
  };

  const analyzeOptimalOperation = async (f) => {
    setAdviceState((prev) => ({ ...prev, [f.fileId]: { status: "loading", comment: "", table: null } }));
    try {
      const dataUrl = await monitorGetFileDataUrl(date, f.fileId);
      if (!dataUrl) throw new Error("画像データが見つかりませんでした。");
      const raw = await fetchGeminiImageComment(buildOptimalOperationPrompt(date, f.fileName, settings), dataUrl, f.fileType);
      const { comment, table } = parseLoadTable(raw);
      setAdviceState((prev) => ({ ...prev, [f.fileId]: { status: "done", comment, table } }));
    } catch (e) {
      setAdviceState((prev) => ({ ...prev, [f.fileId]: { status: "error", comment: e.message, table: null } }));
    }
  };

  const handleSummarize = async () => {
    setSummaryStatus("loading");
    try {
      const perFileTexts = [];
      for (const f of files) {
        const existing = fileComments[f.fileId];
        const comment = existing && existing.status === "done" ? existing.comment : await analyzeOneFile(f);
        perFileTexts.push(`【${f.fileName}】${comment}`);
      }
      const summary = await fetchGeminiComment(buildMonitorSummaryPrompt(date, perFileTexts));
      setSummaryComment(summary);
      setSummaryStatus("done");
    } catch (e) {
      setSummaryComment(e.message);
      setSummaryStatus("error");
    }
  };

  // 全画像を1回のGemini呼び出しでまとめて渡し、画面をまたいだ機器も含めて横断的に
  // 最適運転アドバイスをもらう（監視画面が1枚に収まらない場合など）。
  const handleMultiAdvice = async () => {
    setMultiAdviceStatus("loading");
    try {
      const images = [];
      for (const f of files) {
        const dataUrl = await monitorGetFileDataUrl(date, f.fileId);
        if (dataUrl) images.push({ dataUrl, mimeType: f.fileType });
      }
      if (!images.length) throw new Error("画像データが見つかりませんでした。");
      const raw = await fetchGeminiMultiImageComment(buildOptimalOperationMultiPrompt(date, files.map((f) => f.fileName), settings), images);
      const { comment, table } = parseLoadTable(raw);
      setMultiAdviceComment(comment);
      setMultiAdviceTable(table);
      setMultiAdviceStatus("done");
    } catch (e) {
      setMultiAdviceComment(e.message);
      setMultiAdviceTable(null);
      setMultiAdviceStatus("error");
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="fullscreen-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fullscreen-modal-header">
          <div className="panel-title">中央監視画面：{date}{files.length > 0 && `（${files.length}枚）`}</div>
          <button className="btn" onClick={onClose}>閉じる ✕</button>
        </div>
        {files.length > 1 && (
          <div className="ai-gemini-box monitor-ai-box monitor-summary-box">
            <button className="btn btn-small btn-primary" onClick={handleSummarize} disabled={summaryStatus === "loading"}>
              {summaryStatus === "loading" ? "🤖 総括中…" : "🤖 Geminiで総括（全画面まとめて分析）"}
            </button>
            {summaryComment && (
              <p className={"analysis-note ai-comment" + (summaryStatus === "error" ? " ai-comment-error" : "")}>
                {summaryStatus === "error" ? "⚠ " : "📋 "}{summaryComment}
              </p>
            )}
            <button className="btn btn-small" onClick={handleMultiAdvice} disabled={multiAdviceStatus === "loading"} style={{ marginTop: 8 }}>
              {multiAdviceStatus === "loading" ? "🤖 提案作成中…" : "🤖 最適運転アドバイス（全画面まとめて）"}
            </button>
            {multiAdviceComment && (
              <p className={"analysis-note ai-comment" + (multiAdviceStatus === "error" ? " ai-comment-error" : "")}>
                {multiAdviceStatus === "error" ? "⚠ " : "💡 "}{multiAdviceComment}
              </p>
            )}
            <LoadTableView table={multiAdviceTable} />
          </div>
        )}
        {files.map((f) => {
          const preview = previews[f.fileId] || {};
          const aiState = fileComments[f.fileId] || { status: "idle", comment: "" };
          const advice = adviceState[f.fileId] || { status: "idle", comment: "", table: null };
          return (
            <div key={f.fileId} className="monitor-file-card">
              <div className="monitor-file-card-header">
                <div className="panel-title">{f.fileName}</div>
                <div className="monitor-file-card-actions">
                  {preview.url && <a className="btn btn-small" href={preview.url} download={f.fileName} target="_blank" rel="noreferrer">ダウンロード</a>}
                  <button className="btn btn-small btn-ghost-red" onClick={() => onDelete(date, f.fileId)}>削除</button>
                </div>
              </div>
              <div className="monitor-preview-body">
                {preview.status && <div className="analysis-empty">{preview.status}</div>}
                {preview.url && f.fileType === "application/pdf" && (
                  <iframe src={preview.url} className="monitor-preview-frame" title={f.fileName}></iframe>
                )}
                {preview.url && f.fileType !== "application/pdf" && (
                  <img src={preview.url} className="monitor-preview-image" alt={f.fileName} />
                )}
              </div>
              {preview.url && (
                <div className="ai-gemini-box monitor-ai-box">
                  <button
                    className="btn btn-small"
                    onClick={() => { analyzeOneFile(f); analyzeOptimalOperation(f); }}
                    disabled={aiState.status === "loading" || advice.status === "loading"}
                  >
                    {(aiState.status === "loading" || advice.status === "loading") ? "🤖 分析中…" : "🤖 Geminiで分析"}
                  </button>
                  {aiState.comment && (
                    <p className={"analysis-note ai-comment" + (aiState.status === "error" ? " ai-comment-error" : "")}>
                      {aiState.status === "error" ? "⚠ " : "🤖 "}{aiState.comment}
                    </p>
                  )}
                  {advice.comment && (
                    <p className={"analysis-note ai-comment" + (advice.status === "error" ? " ai-comment-error" : "")}>
                      {advice.status === "error" ? "⚠ " : "💡 "}{advice.comment}
                    </p>
                  )}
                  <LoadTableView table={advice.table} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// 分析ビュー（原単位/異常検知/号機バランス/目標比較/ヒートマップ/CO2/デマンド）
// ============================================================
const ANALYSIS_METRIC_CHOICES = ["elecKWh", "oilTotalL", "coolLoadGJ", "heatLoadGJ", "efficiencyPct", "co2T", "crudeOilKL", "costYen"];

function GranularityToggle({ value, onChange }) {
  return (
    <div className="granularity-toggle">
      {[["day", "日"], ["month", "月"], ["year", "年"]].map(([v, l]) => (
        <button key={v} className={"btn btn-small" + (value === v ? " active" : "")} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  );
}

function AiCommentBox({ buildPrompt, onAddChart, autoRunKey }) {
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [comment, setComment] = useState("");
  const [suggestedKeys, setSuggestedKeys] = useState(null);
  const [chartAdded, setChartAdded] = useState(false);
  const lastAutoRunKeyRef = useRef(null);

  const handleClick = async () => {
    setStatus("loading");
    setSuggestedKeys(null);
    setChartAdded(false);
    try {
      const rawText = await fetchGeminiComment(buildPrompt());
      if (onAddChart) {
        const parsed = parseChartSuggestion(rawText);
        setComment(parsed.comment);
        setSuggestedKeys(parsed.suggestedKeys);
      } else {
        setComment(rawText);
      }
      setStatus("done");
    } catch (e) {
      setComment(e.message);
      setStatus("error");
    }
  };

  const handleAddChart = () => {
    const chartName = `Gemini提案: ${suggestedKeys.map((k) => METRICS[k].label).join(" × ")}`;
    onAddChart(suggestedKeys, chartName);
    setChartAdded(true);
  };

  // ダッシュボードの注意事項バナーから「分析で詳しく見る」を選んだ場合など、外部から
  // 指定されたキーが新しく届いたときだけ自動的に分析を実行する（同じキーでは再実行しない）。
  useEffect(() => {
    if (autoRunKey == null || lastAutoRunKeyRef.current === autoRunKey) return;
    lastAutoRunKeyRef.current = autoRunKey;
    handleClick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRunKey]);

  return (
    <div className="ai-gemini-box">
      <button className="btn btn-small" onClick={handleClick} disabled={status === "loading"}>
        {status === "loading" ? "🤖 分析中…" : "🤖 Geminiで分析"}
      </button>
      {comment && (
        <p className={"analysis-note ai-comment" + (status === "error" ? " ai-comment-error" : "")}>
          {status === "error" ? "⚠ " : "🤖 "}{comment}
        </p>
      )}
      {suggestedKeys && !chartAdded && (
        <div className="ai-chart-suggestion">
          📊 おすすめグラフの組み合わせ: {suggestedKeys.map((k) => METRICS[k].label).join(" × ")}
          <button className="btn btn-small" onClick={handleAddChart}>＋ このグラフを追加</button>
        </div>
      )}
      {chartAdded && <p className="ai-chart-added-note">✅ 下にグラフを追加しました</p>}
    </div>
  );
}

function AnalysisView({ data, settings, darkMode, notes, onSaveNote, focus }) {
  const fiscalYears = useMemo(() => Array.from(new Set(data.map((r) => fiscalYear(r.date)))).sort((a, b) => a - b), [data]);
  const [fy, setFy] = useState(() => fiscalYears[fiscalYears.length - 1]);
  const [anomalyMetric, setAnomalyMetric] = useState("elecKWh");
  const anomalyPanelRef = useRef(null);
  const demandPanelRef = useRef(null);
  const handledFocusTokenRef = useRef(null);

  // ダッシュボードの注意事項バナーから「分析で詳しく見る」で来た場合、該当する項目
  // （異常値検知パネルなら該当metric、デマンド超過ならデマンドパネル）までスクロールする。
  useEffect(() => {
    if (!focus || !focus.token || handledFocusTokenRef.current === focus.token) return;
    if (focus.type === "anomaly" && focus.metric && anomalyMetric !== focus.metric) {
      setAnomalyMetric(focus.metric);
      return; // anomalyMetricが更新された次のレンダーで再度この副作用が走る
    }
    handledFocusTokenRef.current = focus.token;
    const targetRef = focus.type === "anomaly" ? anomalyPanelRef : demandPanelRef;
    requestAnimationFrame(() => {
      if (targetRef.current) targetRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [focus, anomalyMetric]);
  const [heatmapMetric, setHeatmapMetric] = useState("elecKWh");
  const [overlayMetric, setOverlayMetric] = useState("elecKWh");
  const [overlayYears, setOverlayYears] = useState(() => fiscalYears.slice(-3));
  const [sensitivityMetric, setSensitivityMetric] = useState("elecKWh");
  const [weekdayMetric, setWeekdayMetric] = useState("elecKWh");
  const [intensityGranularity, setIntensityGranularity] = useState("month");
  const [co2Granularity, setCo2Granularity] = useState("month");
  const [demandGranularity, setDemandGranularity] = useState("day");
  const [compareDate, setCompareDate] = useState(() => (data.length ? data[data.length - 1].date : ""));

  const monthKeys = useMemo(() => fiscalMonthKeys(fy), [fy]);
  const fyRows = useMemo(() => data.filter((r) => fiscalYear(r.date) === fy), [data, fy]);
  const prevFyRows = useMemo(() => data.filter((r) => fiscalYear(r.date) === fy - 1), [data, fy]);
  const monthlyRows = useMemo(() => monthKeys.map((ym) => data.filter((r) => r.date.startsWith(ym))), [data, monthKeys]);
  const prevMonthlyRows = useMemo(() => fiscalMonthKeys(fy - 1).map((ym) => data.filter((r) => r.date.startsWith(ym))), [data, fy]);
  const byDate = useMemo(() => { const m = {}; data.forEach((r) => { m[r.date] = r; }); return m; }, [data]);

  // 12. 日付比較分析：選択した日付を基準に、前日・前週・前月・前年の同項目と比較する
  const dateCompare = useMemo(() => {
    if (!compareDate) return null;
    const baseRow = byDate[compareDate] || null;
    const periods = [
      { key: "prevDay", label: "前日", date: addDays(compareDate, -1) },
      { key: "prevWeek", label: "前週", date: addDays(compareDate, -7) },
      { key: "prevMonth", label: "前月", date: addMonthsClamped(compareDate, -1) },
      { key: "prevYear", label: "前年", date: addMonthsClamped(compareDate, -12) },
    ];
    const rows = DASHBOARD_KPI_KEYS.map((key) => {
      const meta = METRICS[key];
      const baseVal = baseRow && baseRow[key] != null && !isNaN(baseRow[key]) ? baseRow[key] : null;
      const comps = periods.map((p) => {
        const cmpRow = byDate[p.date];
        const cmpVal = cmpRow && cmpRow[key] != null && !isNaN(cmpRow[key]) ? cmpRow[key] : null;
        const pct = baseVal != null && cmpVal != null && cmpVal !== 0 ? ((baseVal - cmpVal) / cmpVal) * 100 : null;
        return { ...p, value: cmpVal, pct };
      });
      return { key, label: meta.label, unit: meta.unit, baseValue: baseVal, comps };
    });
    return { baseRow, periods, rows };
  }, [compareDate, byDate]);

  // グラフごとの日/月/年切替：選択中の年度内の日次、年度内の月次、または全年度の年次で束ねる
  const granularityData = (gran) => {
    if (gran === "day") return { labels: fyRows.map((r) => r.date.slice(5)), buckets: fyRows.map((r) => [r]) };
    if (gran === "year") return { labels: fiscalYears.map((y) => `${y}年度`), buckets: fiscalYears.map((y) => data.filter((r) => fiscalYear(r.date) === y)) };
    return { labels: FM_LABELS, buckets: monthlyRows };
  };

  // 1. 原単位トレンド
  const intensityData = useMemo(() => {
    const { labels, buckets } = granularityData(intensityGranularity);
    const elec = buckets.map((rows) => { const load = sumMetric(rows, "totalLoadGJ"); return load > 0 ? sumMetric(rows, "elecKWh") / load : null; });
    const oil = buckets.map((rows) => { const load = sumMetric(rows, "totalLoadGJ"); return load > 0 ? sumMetric(rows, "oilTotalL") / load : null; });
    return { labels, elec, oil };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, fy, intensityGranularity, monthlyRows]);
  const intensityConfig = () => ({
    type: "line",
    data: { labels: intensityData.labels, datasets: [
      { label: "電力原単位 (kWh/GJ)", data: intensityData.elec, borderColor: "#2563eb", backgroundColor: "#2563eb33", yAxisID: "y", tension: 0.25, spanGaps: true },
      { label: "重油原単位 (L/GJ)", data: intensityData.oil, borderColor: "#dc2626", backgroundColor: "#dc262633", yAxisID: "y1", tension: 0.25, spanGaps: true },
    ]},
    options: { responsive: true, maintainAspectRatio: false,
      scales: { y: { position: "left", title: { display: true, text: "kWh/GJ" } }, y1: { position: "right", title: { display: true, text: "L/GJ" }, grid: { drawOnChartArea: false } } },
      plugins: { legend: { position: "bottom" } }, interaction: { mode: "index", intersect: false } },
  });
  const intensityComment = `電力原単位：${trendInsight(intensityData.labels, intensityData.elec, "kWh/GJ", 2)} 重油原単位：${trendInsight(intensityData.labels, intensityData.oil, "L/GJ", 2)}`;

  // 2. 異常値検知（気温回帰から±2σ以上乖離した日）
  const anomaly = useMemo(() => {
    const meta = METRICS[anomalyMetric];
    const reg = buildRegression(data, anomalyMetric);
    // 温度・値が数値でない行(空欄や"-"など)が混ざるとσがNaNになるため、必ず数値のみで計算する
    const valid = (r) => r.tempAvg != null && r[anomalyMetric] != null && !isNaN(r.tempAvg) && !isNaN(r[anomalyMetric]);
    const pts = data.filter(valid);
    if (pts.length < 30) return { sd: 0, list: [], meta };
    const resids = pts.map((r) => Number(r[anomalyMetric]) - (reg.slope * Number(r.tempAvg) + reg.intercept));
    const sd = Math.sqrt(resids.reduce((s, x) => s + x * x, 0) / resids.length);
    const list = fyRows
      .filter(valid)
      .map((r) => {
        const pred = reg.slope * Number(r.tempAvg) + reg.intercept;
        const resid = Number(r[anomalyMetric]) - pred;
        return { date: r.date, temp: r.tempAvg, actual: r[anomalyMetric], pred, sigma: sd > 0 ? resid / sd : 0 };
      })
      .filter((x) => Math.abs(x.sigma) >= (settings.anomalySigmaThreshold || 2))
      .sort((a, b) => Math.abs(b.sigma) - Math.abs(a.sigma))
      .slice(0, 15);
    return { sd, list, meta };
  }, [data, fyRows, anomalyMetric, settings.anomalySigmaThreshold]);
  const anomalyComment = anomaly.list.length === 0
    ? `しきい値（±${fmtNum(settings.anomalySigmaThreshold, 1)}σ）を超える異常日は検出されませんでした。`
    : `${anomaly.list.length}件の異常日を検出。最大乖離は${anomaly.list[0].date}で${anomaly.list[0].sigma > 0 ? "+" : ""}${fmtNum(anomaly.list[0].sigma, 1)}σ（実績${fmtNum(anomaly.list[0].actual, 0)}${anomaly.meta.unit} / 回帰予測${fmtNum(anomaly.list[0].pred, 0)}${anomaly.meta.unit}）でした。`;

  // 3. 号機別稼働バランス
  const BALANCE_KEYS = ["oilChiller1L", "oilChiller2L", "oilBoiler1L", "oilBoiler2L"];
  const balanceConfig = () => ({
    type: "doughnut",
    data: { labels: BALANCE_KEYS.map((k) => METRICS[k].label), datasets: [{ data: BALANCE_KEYS.map((k) => sumMetric(fyRows, k)), backgroundColor: BALANCE_KEYS.map((k) => METRICS[k].color) }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } },
  });
  const balanceComment = (() => {
    const totals = BALANCE_KEYS.map((k) => ({ key: k, label: METRICS[k].label, v: sumMetric(fyRows, k) }));
    const sum = totals.reduce((s, t) => s + t.v, 0);
    if (sum <= 0) return "データが不足しており判定できません。";
    const top = totals.reduce((a, b) => (b.v > a.v ? b : a));
    const share = (top.v / sum) * 100;
    const note = share >= 60 ? "特定号機への偏りが大きく、非効率や不調のサインの可能性があります。" : "各号機への負荷はおおむね分散しています。";
    return `最も稼働比率が高いのは${top.label}（全体の${fmtNum(share, 1)}%）です。${note}`;
  })();

  // 4. 目標比較
  const targets = [
    { key: "elecKWh", label: "受電電力量", unit: "kWh", target: settings.targetElecKWh, actual: sumMetric(fyRows, "elecKWh") },
    { key: "oilTotalL", label: "重油使用量", unit: "L", target: settings.targetOilL, actual: sumMetric(fyRows, "oilTotalL") },
  ];
  const targetsComment = (() => {
    const active = targets.filter((t) => t.target);
    if (!active.length) return null;
    const totalDaysInFY = monthKeys.reduce((s, ym) => s + daysInMonth(ym), 0);
    const elapsedFrac = totalDaysInFY > 0 ? Math.min(1, fyRows.length / totalDaysInFY) : 0;
    const expectedPct = elapsedFrac * 100;
    return active.map((t) => {
      const pct = (t.actual / t.target) * 100;
      const diff = pct - expectedPct;
      const pace = Math.abs(diff) < 5 ? "ほぼ想定ペース通り" : diff > 0 ? "想定ペースより速いペース" : "想定ペースより遅いペース";
      return `${t.label}：実績${fmtNum(pct, 1)}%（経過日数ベースの目安${fmtNum(expectedPct, 1)}%に対して${pace}）`;
    }).join(" / ");
  })();

  // 5. カレンダーヒートマップ
  const heatmap = useMemo(() => {
    const meta = METRICS[heatmapMetric];
    let max = 0;
    fyRows.forEach((r) => { const v = r[heatmapMetric]; if (v != null && v > max) max = v; });
    const rows = monthKeys.map((ym, mi) => {
      const dim = daysInMonth(ym);
      const cells = [];
      for (let d = 1; d <= 31; d++) {
        if (d > dim) { cells.push(null); continue; }
        const dateStr = `${ym}-${String(d).padStart(2, "0")}`;
        const rec = byDate[dateStr];
        const v = rec ? rec[heatmapMetric] : null;
        cells.push({ dateStr, v });
      }
      return { label: FM_LABELS[mi], cells };
    });
    return { rows, max, meta };
  }, [byDate, fyRows, monthKeys, heatmapMetric]);
  const heatmapComment = (() => {
    const vals = heatmap.rows.flatMap((r) => r.cells.filter((c) => c && c.v != null));
    if (!vals.length) return "データが不足しており判定できません。";
    const maxCell = vals.reduce((a, b) => (b.v > a.v ? b : a));
    const avg = vals.reduce((s, c) => s + c.v, 0) / vals.length;
    return `最大値は${maxCell.dateStr}（${fmtNum(maxCell.v, 1)} ${heatmap.meta.unit}）。期間平均は${fmtNum(avg, 1)} ${heatmap.meta.unit}です。`;
  })();

  // 6. CO2トレンド
  const co2Of = (rows) => (sumMetric(rows, "elecKWh") * settings.elecCO2PerKWh + sumMetric(rows, "oilTotalL") * settings.oilCO2PerL) / 1000;
  const co2Data = useMemo(() => {
    const { labels, buckets } = granularityData(co2Granularity);
    const current = buckets.map((rows) => (rows.length ? co2Of(rows) : null));
    // 月次表示のときだけ前年度比較の第2系列も出す（日次・年次では対応する「前期」の定義が曖昧なため）
    const prev = co2Granularity === "month" ? prevMonthlyRows.map((rows) => (rows.length ? co2Of(rows) : null)) : null;
    return { labels, current, prev };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, fy, co2Granularity, monthlyRows, prevMonthlyRows, settings.elecCO2PerKWh, settings.oilCO2PerL]);
  const co2Config = () => ({
    type: "bar",
    data: { labels: co2Data.labels, datasets: [
      { label: `${fy}年度 (t-CO2)`, data: co2Data.current, backgroundColor: "#0f766eaa" },
      ...(co2Data.prev ? [{ label: `${fy - 1}年度 (t-CO2)`, data: co2Data.prev, backgroundColor: "#94a3b8aa" }] : []),
    ]},
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { title: { display: true, text: "t-CO2" } } }, plugins: { legend: { position: "bottom" } } },
  });
  const co2TotalThis = co2Of(fyRows);
  const co2TotalPrev = prevFyRows.length ? co2Of(prevFyRows) : null;
  const co2Comment = trendInsight(co2Data.labels, co2Data.current, "t-CO2", 1);

  // 7. デマンド分析（日平均電力ベース）
  const demandData = useMemo(() => {
    const { labels, buckets } = granularityData(demandGranularity);
    const values = buckets.map((rows) => (rows.length ? aggMetric(rows, "demandKW") : null));
    return { labels, values };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, fy, demandGranularity, monthlyRows]);
  const demandConfig = () => ({
    type: "line",
    data: { labels: demandData.labels, datasets: [
      { label: demandGranularity === "day" ? "日平均電力 (kW)" : "平均電力 (kW)", data: demandData.values, borderColor: "#f59e0b", backgroundColor: "#f59e0b33", pointRadius: 0, borderWidth: 2, tension: 0.2 },
      { label: `契約電力 ${fmtNum(settings.contractKW, 0)} kW`, data: demandData.labels.map(() => settings.contractKW), borderColor: "#dc2626", borderDash: [6, 4], pointRadius: 0, borderWidth: 1.5 },
    ]},
    options: { responsive: true, maintainAspectRatio: false,
      scales: { x: { ticks: { autoSkip: true, maxTicksLimit: 12 } }, y: { title: { display: true, text: "kW" } } },
      plugins: { legend: { position: "bottom" } }, interaction: { mode: "index", intersect: false } },
  });
  const demandComment = trendInsight(demandData.labels, demandData.values, "kW", 0);
  const demandHistogram = useMemo(() => {
    const bins = [
      { label: "〜60%", min: -Infinity, max: 60, count: 0 },
      { label: "60〜70%", min: 60, max: 70, count: 0 },
      { label: "70〜80%", min: 70, max: 80, count: 0 },
      { label: "80〜90%", min: 80, max: 90, count: 0 },
      { label: "90〜100%", min: 90, max: 100, count: 0 },
      { label: "100%以上", min: 100, max: Infinity, count: 0 },
    ];
    let over90 = 0, over100 = 0;
    fyRows.forEach((r) => {
      if (!settings.contractKW) return;
      const pct = (r.demandKW / settings.contractKW) * 100;
      const bin = bins.find((b) => pct >= b.min && pct < b.max);
      if (bin) bin.count += 1;
      if (pct >= 90) over90 += 1;
      if (pct >= 100) over100 += 1;
    });
    return { bins, over90, over100 };
  }, [fyRows, settings.contractKW]);
  const demandHistComment = demandHistogram.over100 > 0
    ? `契約電力を超過した日が${demandHistogram.over100}日あります。契約電力の見直し、またはピーク時の使用量抑制をご検討ください。`
    : demandHistogram.over90 > 0
    ? `契約電力の90%以上に達した日が${demandHistogram.over90}日あります。契約超過の兆候として注意が必要です。`
    : "契約電力の90%を超えた日はなく、余裕を持って運用できています。";
  const demandHistConfig = () => ({
    type: "bar",
    data: { labels: demandHistogram.bins.map((b) => b.label), datasets: [{ label: "日数", data: demandHistogram.bins.map((b) => b.count), backgroundColor: demandHistogram.bins.map((b) => (b.min >= 100 ? "#dc2626aa" : b.min >= 90 ? "#f59e0baa" : "#2563ebaa")) }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { title: { display: true, text: "日数" } } }, plugins: { legend: { display: false } } },
  });

  // 8. 複数年度重ね表示
  const OVERLAY_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2"];
  const toggleOverlayYear = (y) => {
    setOverlayYears((prev) => (prev.includes(y) ? prev.filter((x) => x !== y) : [...prev, y].sort((a, b) => a - b)));
  };
  const overlayConfig = () => {
    const meta = METRICS[overlayMetric];
    const datasets = overlayYears.map((y, i) => {
      const monthly = fiscalMonthKeys(y).map((ym) => data.filter((r) => r.date.startsWith(ym)));
      return {
        label: `${y}年度`,
        data: monthly.map((rows) => (rows.length ? aggMetric(rows, overlayMetric) : null)),
        borderColor: OVERLAY_COLORS[i % OVERLAY_COLORS.length],
        backgroundColor: "transparent",
        tension: 0.25,
        spanGaps: true,
      };
    });
    return {
      type: "line",
      data: { labels: FM_LABELS, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { y: { title: { display: true, text: meta.unit } } },
        plugins: { legend: { position: "bottom" } },
        interaction: { mode: "index", intersect: false },
      },
    };
  };
  const overlayComment = (() => {
    if (overlayYears.length < 2) return "比較する年度を2つ以上選ぶと、年度間の傾向差を比較できます。";
    const totals = overlayYears.map((y) => {
      const monthly = fiscalMonthKeys(y).map((ym) => data.filter((r) => r.date.startsWith(ym)));
      return { y, total: sumMetric(monthly.flat(), overlayMetric) };
    });
    const latest = totals[totals.length - 1];
    const prevAvg = totals.slice(0, -1).reduce((s, t) => s + t.total, 0) / (totals.length - 1);
    const pct = prevAvg > 0 ? ((latest.total - prevAvg) / prevAvg) * 100 : null;
    if (pct == null) return `${latest.y}年度の合計は${fmtNum(latest.total, 0)} ${METRICS[overlayMetric].unit}です。`;
    return `${latest.y}年度の合計は${fmtNum(latest.total, 0)} ${METRICS[overlayMetric].unit}で、他の選択年度の平均比${fmtPct(pct)}です。`;
  })();

  // 9. 気温感応度分析（年度別の回帰の傾き＝気温1℃あたりの増減）
  const sensitivity = useMemo(() => {
    const meta = METRICS[sensitivityMetric];
    const byYear = fiscalYears.map((y) => {
      const rows = data.filter((r) => fiscalYear(r.date) === y);
      const reg = buildRegression(rows, sensitivityMetric);
      return { fy: y, slope: reg.slope, intercept: reg.intercept };
    });
    return { meta, byYear };
  }, [data, fiscalYears, sensitivityMetric]);
  const sensitivityConfig = () => ({
    type: "bar",
    data: {
      labels: sensitivity.byYear.map((x) => `${x.fy}年度`),
      datasets: [{ label: `気温感応度 (${sensitivity.meta.unit}/℃)`, data: sensitivity.byYear.map((x) => x.slope), backgroundColor: "#7c3aedaa" }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { y: { title: { display: true, text: `${sensitivity.meta.unit}/℃` } } },
      plugins: { legend: { display: false } },
    },
  });
  const sensitivityLatest = sensitivity.byYear.length ? sensitivity.byYear[sensitivity.byYear.length - 1] : null;
  const sensitivityComment = (() => {
    const valid = sensitivity.byYear.filter((x) => x.slope != null && !isNaN(x.slope));
    if (valid.length < 2) return "年度データが少なく、傾向を判定できません。";
    const first = valid[0], last = valid[valid.length - 1];
    const diff = last.slope - first.slope;
    const dir = Math.abs(diff) < Math.abs(first.slope) * 0.05 ? "ほぼ横ばい" : diff > 0 ? "年々大きくなっています（温度依存の効率低下の可能性）" : "年々小さくなっています（温度依存の効率改善の可能性）";
    return `${first.fy}年度は${fmtNum(first.slope, 2)}、${last.fy}年度は${fmtNum(last.slope, 2)} ${sensitivity.meta.unit}/℃で、気温感応度は${dir}。`;
  })();

  // 10. 曜日別パターン
  const WEEKDAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];
  const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
  const WEEKDAY_COLORS = { 1: DAY_TYPE_COLOR.weekday, 2: DAY_TYPE_COLOR.weekday, 3: DAY_TYPE_COLOR.weekday, 4: DAY_TYPE_COLOR.weekday, 5: DAY_TYPE_COLOR.weekday, 6: DAY_TYPE_COLOR.saturday, 0: DAY_TYPE_COLOR.sunday };
  const weekdayPattern = useMemo(() => {
    const buckets = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    fyRows.forEach((r) => {
      const v = r[weekdayMetric];
      if (v == null || isNaN(v)) return;
      const wd = new Date(`${r.date}T00:00:00`).getDay();
      buckets[wd].push(Number(v));
    });
    return WEEKDAY_ORDER.map((wd) => {
      const arr = buckets[wd];
      return arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null;
    });
  }, [fyRows, weekdayMetric]);
  const weekdayConfig = () => ({
    type: "bar",
    data: {
      labels: WEEKDAY_LABELS,
      datasets: [{ label: `平均 (${METRICS[weekdayMetric].unit}/日)`, data: weekdayPattern, backgroundColor: WEEKDAY_ORDER.map((wd) => WEEKDAY_COLORS[wd]) }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { y: { title: { display: true, text: METRICS[weekdayMetric].unit } } },
      plugins: { legend: { display: false } },
    },
  });
  const weekdayComment = (() => {
    const withIdx = WEEKDAY_ORDER.map((wd, i) => ({ wd, label: WEEKDAY_LABELS[i], v: weekdayPattern[i] })).filter((x) => x.v != null);
    if (withIdx.length < 2) return "データが少なく、傾向を判定できません。";
    const max = withIdx.reduce((a, b) => (b.v > a.v ? b : a));
    const min = withIdx.reduce((a, b) => (b.v < a.v ? b : a));
    const weekdayAvg = withIdx.filter((x) => x.wd >= 1 && x.wd <= 5).reduce((s, x, _, arr) => s + x.v / arr.length, 0);
    const weekendAvg = withIdx.filter((x) => x.wd === 0 || x.wd === 6).reduce((s, x, _, arr) => s + x.v / (arr.length || 1), 0);
    const gap = weekendAvg > 0 ? ((weekdayAvg - weekendAvg) / weekendAvg) * 100 : null;
    let s = `最も高いのは${max.label}曜日（${fmtNum(max.v, 1)}）、最も低いのは${min.label}曜日（${fmtNum(min.v, 1)}）です。`;
    if (gap != null) s += `平日は休日より平均${fmtPct(gap)}${gap >= 0 ? "多い" : "少ない"}使用量です。`;
    return s;
  })();

  // 11. 年間目標への累積進捗
  const cumulativeProgress = useMemo(() => {
    const totalDays = monthKeys.reduce((s, ym) => s + daysInMonth(ym), 0);
    return targets.filter((t) => t.target).map((t) => {
      let cumActual = 0;
      const actualSeries = monthlyRows.map((rows) => { cumActual += sumMetric(rows, t.key); return cumActual; });
      let cumDays = 0;
      const paceSeries = monthKeys.map((ym) => { cumDays += daysInMonth(ym); return t.target * (cumDays / totalDays); });
      return { ...t, actualSeries, paceSeries };
    });
  }, [monthlyRows, monthKeys, targets]);
  const cumulativeConfig = (t) => ({
    type: "line",
    data: {
      labels: FM_LABELS,
      datasets: [
        { label: `累積実績 (${t.unit})`, data: t.actualSeries, borderColor: "#2563eb", backgroundColor: "#2563eb33", tension: 0.2, spanGaps: true },
        { label: `目標ペース (${t.unit})`, data: t.paceSeries, borderColor: "#dc2626", borderDash: [6, 4], pointRadius: 0, tension: 0 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { y: { title: { display: true, text: t.unit } } },
      plugins: { legend: { position: "bottom" } },
      interaction: { mode: "index", intersect: false },
    },
  });

  const heatColor = (v) => {
    if (v == null) return "#f1f5f9";
    if (heatmap.max <= 0) return "#f1f5f9";
    const t = Math.max(0.08, Math.min(1, v / heatmap.max));
    return `rgba(37, 99, 235, ${t})`;
  };

  if (!data.length) return <div className="empty-state">データがありません。</div>;

  return (
    <div>
      <nav className="tabs">
        <div className="analysis-fy-label">対象年度:</div>
        <select value={fy} onChange={(e) => setFy(Number(e.target.value))}>
          {fiscalYears.map((y) => <option key={y} value={y}>{y}年度</option>)}
        </select>
      </nav>

      <section className="chart-panel">
        <div className="panel-title-row">
          <div className="panel-title">1. 原単位トレンド（供給熱量1GJあたりの投入エネルギー）</div>
          <GranularityToggle value={intensityGranularity} onChange={setIntensityGranularity} />
        </div>
        <p className="analysis-note">数値が上昇傾向なら「同じ熱を作るのに多くのエネルギーが必要になっている」＝設備効率低下のサインです。</p>
        <div className="chart-canvas-toolbar">
          <button className="btn btn-small" onClick={(e) => downloadChartCanvasImage(e.currentTarget.parentElement, "原単位トレンド.png")}>🖼 画像保存</button>
        </div>
        <div className="chart-canvas-wrap">
          <ChartCanvas key={`int-${fy}-${intensityGranularity}-${darkMode}`} getConfig={intensityConfig} />
        </div>
        <p className="analysis-note ai-comment">💬 {intensityComment}</p>
        <AiCommentBox buildPrompt={() => buildAnalysisPrompt("原単位トレンド（電力・重油）",
          `電力原単位(kWh/GJ): ${seriesText(intensityData.labels, intensityData.elec, "")}\n重油原単位(L/GJ): ${seriesText(intensityData.labels, intensityData.oil, "")}`)} />
      </section>

      <section className="chart-panel" ref={anomalyPanelRef}>
        <div className="panel-title-row">
          <div className="panel-title">2. 異常値検知（気温回帰モデルから±{fmtNum(settings.anomalySigmaThreshold, 1)}σ以上乖離した日）</div>
          <select className="chart-header-select" value={anomalyMetric} onChange={(e) => setAnomalyMetric(e.target.value)}>
            {ANALYSIS_METRIC_CHOICES.map((k) => <option key={k} value={k}>{METRICS[k].label}</option>)}
          </select>
        </div>
        <p className="analysis-note">全期間データで「外気温度→{anomaly.meta.label}」の回帰モデルを作り、予測から大きく外れた日を検出します（設備異常・誤記録の早期発見用）。</p>
        <p className="analysis-note ai-comment">💬 {anomalyComment}</p>
        <AiCommentBox
          autoRunKey={focus && focus.type === "anomaly" && focus.metric === anomalyMetric ? focus.token : null}
          buildPrompt={() => buildAnalysisPrompt(`異常値検知（${anomaly.meta.label}）`,
          anomaly.list.length === 0 ? "異常日は検出されていません。"
            : anomaly.list.slice(0, 5).map((x) => `${x.date}: 実績${fmtNum(x.actual, 0)}${anomaly.meta.unit}, 回帰予測${fmtNum(x.pred, 0)}${anomaly.meta.unit}, 乖離${fmtNum(x.sigma, 1)}σ`).join("\n"))} />
        {anomaly.list.length === 0 ? (
          <div className="analysis-empty">±2σを超える異常日は検出されませんでした。</div>
        ) : (
          <table className="anomaly-table">
            <thead><tr><th>日付</th><th>外気温度</th><th>実績</th><th>回帰予測</th><th>乖離</th><th>メモ</th></tr></thead>
            <tbody>
              {anomaly.list.map((x) => {
                const noteMsg = `異常値検知: ${anomaly.meta.label} ${fmtNum(x.actual, 0)}${anomaly.meta.unit}（回帰予測比 ${x.sigma > 0 ? "+" : ""}${fmtNum(x.sigma, 1)}σ）`;
                const existing = notes && notes[x.date];
                const alreadyRecorded = existing && existing.includes(noteMsg);
                const isFocused = focus && focus.type === "anomaly" && focus.metric === anomalyMetric && focus.date === x.date;
                return (
                  <tr key={x.date} className={isFocused ? "row-focused" : ""}>
                    <td>{x.date}</td>
                    <td>{fmtNum(x.temp, 1)}℃</td>
                    <td>{fmtNum(x.actual, 0)} {anomaly.meta.unit}</td>
                    <td>{fmtNum(x.pred, 0)} {anomaly.meta.unit}</td>
                    <td className={x.sigma > 0 ? "dev-up" : "dev-down"}>{x.sigma > 0 ? "+" : ""}{fmtNum(x.sigma, 1)}σ</td>
                    <td>
                      <button
                        className="btn btn-small"
                        disabled={alreadyRecorded}
                        onClick={() => onSaveNote(x.date, existing ? `${existing}\n${noteMsg}` : noteMsg)}
                      >
                        {alreadyRecorded ? "記録済み" : "メモに記録"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="chart-panel">
        <div className="panel-title">3. 重油 号機別稼働バランス（{fy}年度合計）</div>
        <p className="analysis-note">特定号機への極端な偏りは、片側の不調・非効率や点検時期のサインになり得ます。</p>
        <div className="chart-canvas-toolbar">
          <button className="btn btn-small" onClick={(e) => downloadChartCanvasImage(e.currentTarget.parentElement, "号機別稼働バランス.png")}>🖼 画像保存</button>
        </div>
        <div className="chart-canvas-wrap">
          <ChartCanvas key={`bal-${fy}-${darkMode}`} getConfig={balanceConfig} />
        </div>
        <p className="analysis-note ai-comment">💬 {balanceComment}</p>
        <AiCommentBox buildPrompt={() => buildAnalysisPrompt("重油 号機別稼働バランス",
          BALANCE_KEYS.map((k) => `${METRICS[k].label}: ${fmtNum(sumMetric(fyRows, k), 0)} L`).join(" / "))} />
      </section>

      <section className="chart-panel">
        <div className="panel-title">4. 年度目標に対する進捗（{fy}年度）</div>
        {targets.every((t) => !t.target) ? (
          <div className="analysis-empty">年度目標が未設定です。「設定」画面から目標値を入力してください。</div>
        ) : (
          <React.Fragment>
            {targets.map((t) => {
              if (!t.target) return null;
              const pct = (t.actual / t.target) * 100;
              return (
                <div key={t.label} className="target-row">
                  <div className="target-label">{t.label}: {fmtNum(t.actual, 0)} / 目標 {fmtNum(t.target, 0)} {t.unit}（{fmtNum(pct, 1)}%）</div>
                  <div className="target-bar-bg">
                    <div className={"target-bar" + (pct > 100 ? " over" : "")} style={{ width: `${Math.min(100, pct)}%` }}></div>
                  </div>
                </div>
              );
            })}
            <p className="analysis-note ai-comment">💬 {targetsComment}</p>
            <AiCommentBox buildPrompt={() => buildAnalysisPrompt("年度目標に対する進捗",
              targets.filter((t) => t.target).map((t) => `${t.label}: 実績${fmtNum(t.actual, 0)}${t.unit} / 目標${fmtNum(t.target, 0)}${t.unit}`).join(" / "))} />
          </React.Fragment>
        )}
      </section>

      <section className="chart-panel">
        <div className="panel-title-row">
          <div className="panel-title">5. カレンダーヒートマップ（{fy}年度・色が濃いほど大）</div>
          <select className="chart-header-select" value={heatmapMetric} onChange={(e) => setHeatmapMetric(e.target.value)}>
            {ANALYSIS_METRIC_CHOICES.map((k) => <option key={k} value={k}>{METRICS[k].label}</option>)}
          </select>
        </div>
        <div className="heatmap-scroll">
          <div className="heatmap-grid">
            <div className="heatmap-mlabel"></div>
            {Array.from({ length: 31 }, (_, i) => <div key={i} className="heatmap-dlabel">{(i + 1) % 5 === 0 || i === 0 ? i + 1 : ""}</div>)}
            {heatmap.rows.map((row) => (
              <React.Fragment key={row.label}>
                <div className="heatmap-mlabel">{row.label}</div>
                {row.cells.map((c, i) => (
                  c == null
                    ? <div key={i} className="heatmap-cell blank"></div>
                    : <div key={i} className="heatmap-cell" style={{ background: heatColor(c.v) }}
                        title={`${c.dateStr}: ${c.v != null ? fmtNum(c.v, 0) + " " + heatmap.meta.unit : "未入力"}`}></div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
        <p className="analysis-note ai-comment">💬 {heatmapComment}</p>
        <AiCommentBox buildPrompt={() => buildAnalysisPrompt(`カレンダーヒートマップ（${heatmap.meta.label}）`, heatmapComment)} />
      </section>

      <section className="chart-panel">
        <div className="panel-title-row">
          <div className="panel-title">6. CO2排出量トレンド</div>
          <GranularityToggle value={co2Granularity} onChange={setCo2Granularity} />
        </div>
        <p className="analysis-note">
          {fy}年度合計: <b>{fmtNum(co2TotalThis, 0)} t-CO2</b>
          {co2TotalPrev != null && <span>（前年度 {fmtNum(co2TotalPrev, 0)} t-CO2 / {fmtPct(((co2TotalThis - co2TotalPrev) / co2TotalPrev) * 100)}）</span>}
        </p>
        <div className="chart-canvas-toolbar">
          <button className="btn btn-small" onClick={(e) => downloadChartCanvasImage(e.currentTarget.parentElement, "CO2排出量トレンド.png")}>🖼 画像保存</button>
        </div>
        <div className="chart-canvas-wrap">
          <ChartCanvas key={`co2-${fy}-${co2Granularity}-${darkMode}`} getConfig={co2Config} />
        </div>
        <p className="analysis-note ai-comment">💬 {co2Comment}</p>
        <AiCommentBox buildPrompt={() => buildAnalysisPrompt("CO2排出量トレンド", seriesText(co2Data.labels, co2Data.current, "t-CO2"))} />
      </section>

      <section className="chart-panel" ref={demandPanelRef}>
        <div className="panel-title-row">
          <div className="panel-title">7. デマンド分析（日平均電力と契約電力）</div>
          <GranularityToggle value={demandGranularity} onChange={setDemandGranularity} />
        </div>
        <p className="analysis-note">
          ※日次データのため30分デマンド実測ではなく「日平均電力（kWh÷24）」に基づく参考値です。
          契約比90%以上: <b>{demandHistogram.over90}日</b> / 100%以上: <b className="dev-up">{demandHistogram.over100}日</b>
        </p>
        <div className="chart-canvas-toolbar">
          <button className="btn btn-small" onClick={(e) => downloadChartCanvasImage(e.currentTarget.parentElement, "デマンド分析.png")}>🖼 画像保存</button>
        </div>
        <div className="chart-canvas-wrap">
          <ChartCanvas key={`dem-${fy}-${demandGranularity}-${darkMode}`} getConfig={demandConfig} />
        </div>
        <p className="analysis-note ai-comment">💬 {demandComment}</p>
        <AiCommentBox
          autoRunKey={focus && focus.type === "demand" ? focus.token : null}
          buildPrompt={() => buildAnalysisPrompt("デマンド分析（日平均電力）",
          seriesText(demandData.labels, demandData.values, "kW") + `\n契約電力: ${fmtNum(settings.contractKW, 0)}kW`)} />
        <div className="panel-title" style={{ marginTop: 16 }}>契約電力比の分布（日数）</div>
        <div className="chart-canvas-toolbar">
          <button className="btn btn-small" onClick={(e) => downloadChartCanvasImage(e.currentTarget.parentElement, "契約電力比の分布.png")}>🖼 画像保存</button>
        </div>
        <div className="chart-canvas-wrap" style={{ height: 200 }}>
          <ChartCanvas key={`demh-${fy}-${darkMode}`} getConfig={demandHistConfig} height={180} />
        </div>
        <p className="analysis-note ai-comment">💬 {demandHistComment}</p>
        <AiCommentBox buildPrompt={() => buildAnalysisPrompt("契約電力比の分布",
          demandHistogram.bins.map((b) => `${b.label}: ${b.count}日`).join(" / "))} />
      </section>

      <section className="chart-panel">
        <div className="panel-title-row">
          <div className="panel-title">8. 複数年度重ね表示</div>
          <select className="chart-header-select" value={overlayMetric} onChange={(e) => setOverlayMetric(e.target.value)}>
            {ANALYSIS_METRIC_CHOICES.map((k) => <option key={k} value={k}>{METRICS[k].label}</option>)}
          </select>
        </div>
        <p className="analysis-note">複数の年度を選んで、月別の推移を重ねて比較できます（長期トレンドの把握用）。</p>
        <div className="overlay-year-checks">
          {fiscalYears.map((y) => (
            <label key={y} className="metric-chip" style={overlayYears.includes(y) ? { borderColor: OVERLAY_COLORS[overlayYears.indexOf(y) % OVERLAY_COLORS.length], background: OVERLAY_COLORS[overlayYears.indexOf(y) % OVERLAY_COLORS.length] + "1a" } : {}}>
              <input type="checkbox" checked={overlayYears.includes(y)} onChange={() => toggleOverlayYear(y)} />
              {y}年度
            </label>
          ))}
        </div>
        {overlayYears.length === 0 ? (
          <div className="analysis-empty">比較する年度を選択してください。</div>
        ) : (
          <React.Fragment>
            <div className="chart-canvas-toolbar">
              <button className="btn btn-small" onClick={(e) => downloadChartCanvasImage(e.currentTarget.parentElement, "複数年度重ね表示.png")}>🖼 画像保存</button>
            </div>
            <div className="chart-canvas-wrap">
              <ChartCanvas key={`overlay-${overlayYears.join(",")}-${overlayMetric}-${darkMode}`} getConfig={overlayConfig} />
            </div>
            <p className="analysis-note ai-comment">💬 {overlayComment}</p>
            <AiCommentBox buildPrompt={() => buildAnalysisPrompt(`複数年度重ね表示（${METRICS[overlayMetric].label}）`,
              overlayYears.map((y) => {
                const monthly = fiscalMonthKeys(y).map((ym) => data.filter((r) => r.date.startsWith(ym)));
                return `${y}年度: ${fmtNum(sumMetric(monthly.flat(), overlayMetric), 0)} ${METRICS[overlayMetric].unit}`;
              }).join(" / "))} />
          </React.Fragment>
        )}
      </section>

      <section className="chart-panel">
        <div className="panel-title-row">
          <div className="panel-title">9. 気温感応度分析（年度別・気温1℃あたりの増減）</div>
          <select className="chart-header-select" value={sensitivityMetric} onChange={(e) => setSensitivityMetric(e.target.value)}>
            {ANALYSIS_METRIC_CHOICES.map((k) => <option key={k} value={k}>{METRICS[k].label}</option>)}
          </select>
        </div>
        <p className="analysis-note">
          外気温度と{sensitivity.meta.label}の年度ごとの回帰から傾きを算出。値が年々大きくなっていれば
          「同じ気温でもより多く使うようになっている」＝温度依存の効率低下のサインです。
          {sensitivityLatest && <span> {sensitivityLatest.fy}年度: <b>{fmtNum(sensitivityLatest.slope, 2)} {sensitivity.meta.unit}/℃</b></span>}
        </p>
        <div className="chart-canvas-toolbar">
          <button className="btn btn-small" onClick={(e) => downloadChartCanvasImage(e.currentTarget.parentElement, "気温感応度分析.png")}>🖼 画像保存</button>
        </div>
        <div className="chart-canvas-wrap">
          <ChartCanvas key={`sens-${sensitivityMetric}-${fiscalYears.join(",")}-${darkMode}`} getConfig={sensitivityConfig} />
        </div>
        <p className="analysis-note ai-comment">💬 {sensitivityComment}</p>
        <AiCommentBox buildPrompt={() => buildAnalysisPrompt("気温感応度分析（年度別）",
          sensitivity.byYear.map((x) => `${x.fy}年度: ${fmtNum(x.slope, 2)} ${sensitivity.meta.unit}/℃`).join(" / "))} />
      </section>

      <section className="chart-panel">
        <div className="panel-title-row">
          <div className="panel-title">10. 曜日別パターン（{fy}年度・日平均）</div>
          <select className="chart-header-select" value={weekdayMetric} onChange={(e) => setWeekdayMetric(e.target.value)}>
            {ANALYSIS_METRIC_CHOICES.map((k) => <option key={k} value={k}>{METRICS[k].label}</option>)}
          </select>
        </div>
        <p className="analysis-note">曜日ごとの平均値を比較します。土日で極端に高い/低い場合、休日運転の見直し余地があるかもしれません。</p>
        <div className="chart-canvas-toolbar">
          <button className="btn btn-small" onClick={(e) => downloadChartCanvasImage(e.currentTarget.parentElement, "曜日別パターン.png")}>🖼 画像保存</button>
        </div>
        <div className="chart-canvas-wrap">
          <ChartCanvas key={`wd-${fy}-${weekdayMetric}-${darkMode}`} getConfig={weekdayConfig} />
        </div>
        <p className="analysis-note ai-comment">💬 {weekdayComment}</p>
        <AiCommentBox buildPrompt={() => buildAnalysisPrompt(`曜日別パターン（${METRICS[weekdayMetric].label}）`, seriesText(WEEKDAY_LABELS, weekdayPattern, ""))} />
      </section>

      <section className="chart-panel">
        <div className="panel-title">11. 年間目標への累積進捗（{fy}年度）</div>
        {cumulativeProgress.length === 0 ? (
          <div className="analysis-empty">年度目標が未設定です。「設定」画面から目標値を入力してください。</div>
        ) : (
          cumulativeProgress.map((t) => {
            let lastActualIdx = -1;
            t.actualSeries.forEach((v, i) => { if (v != null && data.some((r) => r.date.startsWith(monthKeys[i]))) lastActualIdx = i; });
            const comment = lastActualIdx >= 0
              ? (() => {
                  const actual = t.actualSeries[lastActualIdx];
                  const pace = t.paceSeries[lastActualIdx];
                  const diff = pace > 0 ? ((actual - pace) / pace) * 100 : 0;
                  const state = Math.abs(diff) < 3 ? "ほぼ目標ペース通り" : diff > 0 ? "目標ペースより進んでいます" : "目標ペースより遅れています";
                  return `${FM_LABELS[lastActualIdx]}時点で累積${fmtNum(actual, 0)} ${t.unit}（目標ペース${fmtNum(pace, 0)} ${t.unit}に対して${state}、${fmtPct(diff)}）。`;
                })()
              : "データが不足しており判定できません。";
            return (
              <React.Fragment key={t.key}>
                <div className="panel-title" style={{ marginTop: 8 }}>{t.label}</div>
                <div className="chart-canvas-toolbar">
                  <button className="btn btn-small" onClick={(e) => downloadChartCanvasImage(e.currentTarget.parentElement, `累積進捗_${t.label}.png`)}>🖼 画像保存</button>
                </div>
                <div className="chart-canvas-wrap">
                  <ChartCanvas key={`cum-${t.key}-${fy}-${darkMode}`} getConfig={() => cumulativeConfig(t)} />
                </div>
                <p className="analysis-note ai-comment">💬 {comment}</p>
                <AiCommentBox buildPrompt={() => buildAnalysisPrompt(`年間目標への累積進捗（${t.label}）`,
                  seriesText(FM_LABELS, t.actualSeries, t.unit) + `\n目標ペース: ` + seriesText(FM_LABELS, t.paceSeries, t.unit))} />
              </React.Fragment>
            );
          })
        )}
      </section>

      <section className="chart-panel">
        <div className="panel-title">12. 日付比較分析（前日・前週・前月・前年）</div>
        <div className="form-row">
          <label>比較する日付</label>
          <input type="date" value={compareDate} onChange={(e) => setCompareDate(e.target.value)} />
        </div>
        {!dateCompare || !dateCompare.baseRow ? (
          <div className="analysis-empty">選択した日付の実績データがありません。</div>
        ) : (
          <div className="entry-list-scroll">
            <table className="entry-list-table compare-table">
              <thead>
                <tr>
                  <th className="entry-list-datecol">項目</th>
                  <th>{compareDate}<br /><span className="entry-list-unit">基準日</span></th>
                  {dateCompare.periods.map((p) => (
                    <th key={p.key}>{p.label}<br /><span className="entry-list-unit">{p.date}</span></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dateCompare.rows.map((r) => (
                  <tr key={r.key}>
                    <td className="entry-list-datecol">{r.label}</td>
                    <td>{r.baseValue != null ? `${fmtNum(r.baseValue, Math.abs(r.baseValue) < 100 ? 1 : 0)} ${r.unit}` : "-"}</td>
                    {r.comps.map((c) => (
                      <td key={c.key}>
                        {c.value != null ? (
                          <React.Fragment>
                            {fmtNum(c.value, Math.abs(c.value) < 100 ? 1 : 0)} {r.unit}
                            {c.pct != null && (
                              <React.Fragment><br /><span className={"kpi-delta " + (c.pct > 0 ? "up" : c.pct < 0 ? "down" : "")}>{fmtPct(c.pct)}</span></React.Fragment>
                            )}
                          </React.Fragment>
                        ) : "データなし"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {dateCompare && dateCompare.baseRow && (
          <AiCommentBox buildPrompt={() => buildAnalysisPrompt(
            `${compareDate}の各項目比較（前日・前週・前月・前年）`,
            dateCompare.rows.map((r) => `${r.label}: 基準日${fmtNum(r.baseValue, 1)}${r.unit}`
              + r.comps.map((c) => `／${c.label}比${c.pct != null ? fmtPct(c.pct) : "データなし"}`).join("")).join("\n")
          )} />
        )}
      </section>
    </div>
  );
}

function DataUpdateModal({ onImport, onClose }) {
  const [status, setStatus] = useState("");
  const fileRef = useRef(null);

  const handleFile = (file) => {
    setStatus("読み込み中…");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array", cellDates: true });
        const sheet = wb.Sheets["Sheet1"];
        if (!sheet) { setStatus("エラー: Sheet1 が見つかりません"); return; }
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
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
          if (maxDateSoFar && dateStr < maxDateSoFar) { skippedBackward += 1; continue; }
          if (!maxDateSoFar || dateStr > maxDateSoFar) maxDateSoFar = dateStr;
          newRecords.push({
            date: dateStr, tempAvg: row[1], humidityAvg: row[2], coolLoadGJ: row[3], heatLoadGJ: row[4],
            elecKWh: row[5], oilChiller1L: row[6], oilChiller2L: row[7], oilChillerTotalL: row[8],
            oilBoiler1L: row[9], oilBoiler2L: row[10], oilBoilerTotalL: row[11], oilTotalL: row[12],
          });
        }
        if (!newRecords.length) { setStatus("エラー: 有効なデータ行が見つかりませんでした"); return; }
        onImport(newRecords);
        setStatus(`${newRecords.length}件のデータを取り込みました（既存データとマージ済み）`
          + (skippedBackward ? `。日付が前後している${skippedBackward}行は日付誤りの可能性があるため除外しました。` : ""));
      } catch (err) {
        setStatus("エラー: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>データ更新</h3>
        <p className="modal-note">最新の「エネルギー.xlsx」（Sheet1）を選択してください。同じ日付のデータは新しい値で上書きされます。</p>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])} />
        {status && <div className="modal-status">{status}</div>}
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>閉じる</button>
        </div>
      </div>
    </div>
  );
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
    const handler = (snap) => {
      if (snap.exists()) {
        const merged = Object.values(snap.val()).map(withDerived).sort((a, b) => (a.date < b.date ? -1 : 1));
        setData(merged);
        try { localStorage.setItem(LS_DATA_KEY, JSON.stringify(merged.map(({ demandKW, totalLoadGJ, ...rest }) => rest))); } catch (e) { /* ignore */ }
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
    const handler = (snap) => {
      if (snap.exists()) {
        const merged = { ...DEFAULT_SETTINGS, ...snap.val() };
        setSettings(merged);
        try { localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(merged)); } catch (e) { /* ignore */ }
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
    const handler = (snap) => {
      if (snap.exists()) {
        const remoteNotes = snap.val();
        setNotes(remoteNotes);
        try { localStorage.setItem(LS_NOTES_KEY, JSON.stringify(remoteNotes)); } catch (e) { /* ignore */ }
      } else if (Object.keys(notes).length) {
        db.ref("notes").set(notes);
      }
    };
    ref.on("value", handler);
    return () => ref.off("value", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [showMonitorImport, setShowMonitorImport] = useState(false);
  const [monitorFiles, setMonitorFiles] = useState([]);
  const [monitorTick, setMonitorTick] = useState(0);
  const [previewMonitorDate, setPreviewMonitorDate] = useState(null);
  const previewMonitorFiles = useMemo(
    () => (previewMonitorDate ? monitorFiles.filter((f) => f.date === previewMonitorDate) : []),
    [monitorFiles, previewMonitorDate]
  );

  // 中央監視画面の一覧：Firebase同期が有効ならリアルタイム購読、そうでなければ
  // IndexedDBから読み込む（monitorTickが変わるたびに再読み込み）。1日に複数ファイルを
  // 持てるよう monitorFilesMeta/{date}/{fileId} というネスト構造を前提に平坦なリストへ
  // 変換する。旧形式（1日1ファイル、{date}直下にfileName等が入る）のデータが残っていても
  // 読み取れるよう、フォールバックも入れている。
  useEffect(() => {
    if (monitorSyncEnabled) {
      const ref = db.ref("monitorFilesMeta");
      const handler = (snap) => {
        const obj = snap.val() || {};
        const list = [];
        Object.entries(obj).forEach(([dateKey, val]) => {
          if (val && val.fileName) {
            // 旧形式（複数ファイル対応前に保存されたデータ）との互換
            list.push({ date: dateKey, fileId: "legacy", ...val });
          } else {
            Object.entries(val || {}).forEach(([fileId, meta]) => {
              list.push({ date: dateKey, fileId, ...meta });
            });
          }
        });
        list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (a.uploadedAt || 0) - (b.uploadedAt || 0)));
        setMonitorFiles(list);
      };
      ref.on("value", handler);
      return () => ref.off("value", handler);
    }
    idbListMonitorFiles().then(setMonitorFiles).catch(() => {});
  }, [monitorTick]);

  const handleUploadedMonitorFile = () => {
    if (!monitorSyncEnabled) setMonitorTick((t) => t + 1);
  };
  const handleDeleteMonitorFile = (dateStr, fileId) => {
    monitorDeleteFile(dateStr, fileId).then(() => {
      if (!monitorSyncEnabled) setMonitorTick((t) => t + 1);
    });
  };

  const savedViewState = useState(loadViewState)[0];
  const [view, setView] = useState(() => (savedViewState && savedViewState.view !== "year" && savedViewState.view) || "day");
  const [charts, setCharts] = useState(() => (savedViewState && savedViewState.charts && savedViewState.charts.length ? savedViewState.charts : DEFAULT_CHARTS));
  const [nextChartId, setNextChartId] = useState(() => (savedViewState && savedViewState.nextChartId) || 2);
  const [openChartSettings, setOpenChartSettings] = useState(null);
  const [fullscreenChartId, setFullscreenChartId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showDataUpdate, setShowDataUpdate] = useState(false);
  const [mode, setMode] = useState(() => (savedViewState && savedViewState.mode) || "dashboard");
  const [analysisFocus, setAnalysisFocus] = useState(null); // { type: "anomaly"|"demand", metric?, token }
  const [darkMode, setDarkMode] = useState(() => { try { return localStorage.getItem(LS_DARKMODE_KEY) === "1"; } catch (e) { return false; } });

  const latestDate = data.length ? data[data.length - 1].date : null;
  const fiscalYears = useMemo(() => Array.from(new Set(data.map((r) => fiscalYear(r.date)))).sort((a, b) => a - b), [data]);
  const dataGaps = useMemo(() => {
    const gaps = [];
    for (let i = 1; i < data.length; i++) {
      const diffDays = Math.round((parseISO(data[i].date) - parseISO(data[i - 1].date)) / 86400000);
      if (diffDays > 14) gaps.push({ from: data[i - 1].date, to: data[i].date, days: diffDays - 1 });
    }
    return gaps;
  }, [data]);

  // 直近7日分のデマンド超過・異常値を検知して通知バナーに使う
  const recentAlerts = useMemo(() => {
    if (!data.length) return [];
    const alerts = [];
    const recent = data.slice(-7);
    const demandThreshold = (settings.demandAlertPct || 100) / 100;
    recent.forEach((r) => {
      if (settings.contractKW > 0 && r.demandKW != null && r.demandKW / settings.contractKW >= demandThreshold) {
        alerts.push({ key: `demand-${r.date}`, date: r.date, type: "demand", message: `${r.date}: 日平均電力が契約比${fmtNum(settings.demandAlertPct, 0)}%を超過（契約比${fmtNum((r.demandKW / settings.contractKW) * 100, 0)}%）` });
      }
    });
    const sigmaThreshold = settings.anomalySigmaThreshold || 2;
    ["elecKWh", "oilTotalL", "coolLoadGJ", "heatLoadGJ"].forEach((metricKey) => {
      const isValid = (r) => r.tempAvg != null && r[metricKey] != null && !isNaN(r.tempAvg) && !isNaN(r[metricKey]);
      const validAll = data.filter(isValid);
      if (validAll.length < 30) return;
      const reg = buildRegression(data, metricKey);
      const resids = validAll.map((r) => Number(r[metricKey]) - (reg.slope * Number(r.tempAvg) + reg.intercept));
      const sd = Math.sqrt(resids.reduce((s, x) => s + x * x, 0) / resids.length);
      if (sd <= 0) return;
      recent.filter(isValid).forEach((r) => {
        const resid = Number(r[metricKey]) - (reg.slope * Number(r.tempAvg) + reg.intercept);
        const sigma = resid / sd;
        if (Math.abs(sigma) >= sigmaThreshold) {
          alerts.push({
            key: `anomaly-${metricKey}-${r.date}`,
            date: r.date,
            type: "anomaly",
            metricKey,
            message: `${r.date}: ${METRICS[metricKey].label}が気温からの予測より${sigma > 0 ? "大幅に多い" : "大幅に少ない"}（${sigma > 0 ? "+" : ""}${fmtNum(sigma, 1)}σ）`,
          });
        }
      });
    });
    return alerts.sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [data, settings.contractKW, settings.demandAlertPct, settings.anomalySigmaThreshold]);
  const [dismissedAlertSig, setDismissedAlertSig] = useState(null);
  const alertSig = recentAlerts.map((a) => a.key).join(",");
  const showAlertBanner = recentAlerts.length > 0 && dismissedAlertSig !== alertSig;

  const [selectedYm, setSelectedYm] = useState(() => (savedViewState && savedViewState.selectedYm) || (latestDate ? latestDate.slice(0, 7) : ""));
  const [selectedFY, setSelectedFY] = useState(() => (savedViewState && savedViewState.selectedFY) || (latestDate ? fiscalYear(latestDate) : new Date().getFullYear()));

  useEffect(() => { if (latestDate && !savedViewState) { setSelectedYm(latestDate.slice(0, 7)); setSelectedFY(fiscalYear(latestDate)); } }, [data.length === 0]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_VIEWSTATE_KEY, JSON.stringify({ view, charts, nextChartId, mode, selectedYm, selectedFY }));
    } catch (e) { /* ignore quota errors */ }
  }, [view, charts, nextChartId, mode, selectedYm, selectedFY]);

  useEffect(() => {
    try { localStorage.setItem(LS_DARKMODE_KEY, darkMode ? "1" : "0"); } catch (e) { /* ignore */ }
    Chart.defaults.color = darkMode ? "#cbd5e1" : "#334155";
    Chart.defaults.borderColor = darkMode ? "#334155" : "#e2e8f0";
    document.body.style.background = darkMode ? "#0b1220" : "#f1f5f9";
  }, [darkMode]);

  const handleImportData = (newRecords) => {
    const byDate = {};
    data.forEach((r) => { byDate[r.date] = r; });
    newRecords.forEach((r) => { byDate[r.date] = r; });
    const merged = Object.values(byDate).map(withDerived).sort((a, b) => (a.date < b.date ? -1 : 1));
    setData(merged);
    try { localStorage.setItem(LS_DATA_KEY, JSON.stringify(merged.map(({ demandKW, totalLoadGJ, ...rest }) => rest))); } catch (e) { /* ignore quota errors */ }
    fbBulkSaveData(newRecords);
    if (merged.length) {
      const newLatest = merged[merged.length - 1].date;
      setSelectedYm(newLatest.slice(0, 7));
      setSelectedFY(fiscalYear(newLatest));
    }
  };
  const handleSaveSettings = (s) => {
    setSettings(s);
    try { localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
    fbSaveSettings(s);
  };

  const buildBackupPayload = () => ({
    exportedAt: new Date().toISOString(),
    data: data.map(({ demandKW, totalLoadGJ, ...rest }) => rest),
    settings,
    notes,
  });

  const handleExportBackup = () => {
    const blob = new Blob([JSON.stringify(buildBackupPayload(), null, 2)], { type: "application/json" });
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
        const perm = await handle.queryPermission({ mode: "readwrite" });
        if (perm === "granted") {
          setFileHandle(handle);
          setAutoSaveFileName(handle.name);
        } else {
          pendingHandleRef.current = handle;
          setAutoSaveFileName(handle.name);
          setNeedsReauth(true);
        }
      } catch (e) { /* IndexedDBが使えない環境等は無視 */ }
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
        types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
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
      const perm = await handle.requestPermission({ mode: "readwrite" });
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
    try { await idbClearHandle(); } catch (e) { /* ignore */ }
    pendingHandleRef.current = null;
    setFileHandle(null);
    setAutoSaveFileName(null);
    setAutoSaveStatus("");
    setNeedsReauth(false);
  };

  const handleImportBackup = (parsed) => {
    let merged = data;
    if (Array.isArray(parsed.data) && parsed.data.length) {
      merged = parsed.data.map(withDerived).sort((a, b) => (a.date < b.date ? -1 : 1));
      persistData(merged);
    }
    const mergedSettings = parsed.settings ? { ...DEFAULT_SETTINGS, ...parsed.settings } : settings;
    if (parsed.settings) {
      setSettings(mergedSettings);
      try { localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(mergedSettings)); } catch (e) { /* ignore */ }
    }
    const notesObj = parsed.notes || notes;
    if (parsed.notes) {
      setNotes(parsed.notes);
      try { localStorage.setItem(LS_NOTES_KEY, JSON.stringify(parsed.notes)); } catch (e) { /* ignore */ }
    }
    // バックアップ復元は「この内容が正」の全置換なので、個別set/updateではなくenergyData/settings/notesを丸ごと置き換える
    fbReplaceAll(merged, mergedSettings, notesObj);
  };

  const persistData = (merged) => {
    setData(merged);
    try { localStorage.setItem(LS_DATA_KEY, JSON.stringify(merged.map(({ demandKW, totalLoadGJ, ...rest }) => rest))); } catch (e) { /* ignore quota errors */ }
  };
  const handleSaveRecord = (record) => {
    const byDate = {};
    data.forEach((r) => { byDate[r.date] = r; });
    byDate[record.date] = record;
    persistData(Object.values(byDate).map(withDerived).sort((a, b) => (a.date < b.date ? -1 : 1)));
    fbSaveRecord(record);
  };
  const handleDeleteRecord = (dateStr) => {
    persistData(data.filter((r) => r.date !== dateStr));
    fbDeleteRecord(dateStr);
  };

  const handleSaveNote = (dateStr, text) => {
    setNotes((prev) => {
      const next = { ...prev };
      if (text && text.trim()) next[dateStr] = text; else delete next[dateStr];
      try { localStorage.setItem(LS_NOTES_KEY, JSON.stringify(next)); } catch (e) { /* ignore */ }
      return next;
    });
    fbSaveNote(dateStr, text);
  };

  const updateChart = (id, patch) => {
    setCharts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };
  const addChart = () => {
    const id = nextChartId;
    setCharts((prev) => [...prev, {
      id, name: `グラフ${id}`, chartType: "line", selectedMetrics: [Object.keys(METRICS)[0]],
      compareEnabled: true, showForecast: true, forecastMethod: "seasonal", dayTypeColoring: false,
    }]);
    setNextChartId(id + 1);
    setOpenChartSettings(id);
  };
  const addChartWithMetrics = (keys, name) => {
    const id = nextChartId;
    const valid = keys.filter((k) => METRICS[k]);
    setCharts((prev) => [...prev, {
      id, name: name || `グラフ${id}`, chartType: "line", selectedMetrics: valid.length ? valid : [Object.keys(METRICS)[0]],
      compareEnabled: true, showForecast: true, forecastMethod: "seasonal", dayTypeColoring: false,
    }]);
    setNextChartId(id + 1);
  };
  const removeChart = (id) => {
    setCharts((prev) => prev.filter((c) => c.id !== id));
    setOpenChartSettings(null);
  };
  const toggleChartMetric = (chart, key) => {
    const has = chart.selectedMetrics.includes(key);
    updateChart(chart.id, { selectedMetrics: has ? chart.selectedMetrics.filter((k) => k !== key) : [...chart.selectedMetrics, key] });
  };
  const toggleMetricInFirstChart = (key) => {
    if (!charts.length) return;
    toggleChartMetric(charts[0], key);
  };
  const stepPeriod = (delta) => {
    if (view === "day") {
      setSelectedYm((ym) => {
        const [y, m] = ym.split("-").map(Number);
        const d = new Date(y, m - 1 + delta, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      });
    } else if (view === "month") {
      setSelectedFY((fy) => fy + delta);
    }
  };

  // 設定に依存するコスト/CO2/効率等の項目をグラフ・一覧でも使えるよう、表示用データに付与する
  const dataDisplay = useMemo(() => data.map((r) => withComputed(r, settings)), [data, settings]);

  const buckets = useMemo(() => {
    if (!dataDisplay.length) return null;
    if (view === "day") return buildDayViewBuckets(dataDisplay, selectedYm);
    if (view === "month") return buildMonthViewBuckets(dataDisplay, selectedFY);
    return buildYearViewBuckets(dataDisplay);
  }, [dataDisplay, view, selectedYm, selectedFY]);

  const periodWeather = useMemo(() => {
    if (!buckets || !buckets.rows || !buckets.rows.length) return null;
    return { temp: avgMetric(buckets.rows, "tempAvg"), humidity: avgMetric(buckets.rows, "humidityAvg") };
  }, [buckets]);

  // KPI用の当期・前期行
  const { kpiCurrentRows, kpiPreviousRows, kpiLabel, periodDays } = useMemo(() => {
    if (!data.length) return { kpiCurrentRows: [], kpiPreviousRows: [], kpiLabel: "", periodDays: 0 };
    if (view === "day") {
      const cur = data.filter((r) => r.date.startsWith(selectedYm));
      const [y, m] = selectedYm.split("-").map(Number);
      const prevYm = `${y - 1}-${String(m).padStart(2, "0")}`;
      return { kpiCurrentRows: cur, kpiPreviousRows: data.filter((r) => r.date.startsWith(prevYm)), kpiLabel: `${y}年${m}月`, periodDays: daysInMonth(selectedYm) };
    }
    if (view === "month") {
      const cur = data.filter((r) => fiscalYear(r.date) === selectedFY);
      const monthsPresent = new Set(cur.map((r) => r.date.slice(5, 7)));
      const prev = data.filter((r) => fiscalYear(r.date) === selectedFY - 1 && monthsPresent.has(r.date.slice(5, 7)));
      const fyDays = fiscalMonthKeys(selectedFY).reduce((s, ym) => s + daysInMonth(ym), 0);
      return { kpiCurrentRows: cur, kpiPreviousRows: prev, kpiLabel: `${selectedFY}年度`, periodDays: fyDays };
    }
    const latestFY = fiscalYears[fiscalYears.length - 1];
    const fyDays = fiscalMonthKeys(latestFY).reduce((s, ym) => s + daysInMonth(ym), 0);
    return {
      kpiCurrentRows: data.filter((r) => fiscalYear(r.date) === latestFY),
      kpiPreviousRows: data.filter((r) => fiscalYear(r.date) === latestFY - 1),
      kpiLabel: `${latestFY}年度(最新)`,
      periodDays: fyDays,
    };
  }, [data, view, selectedYm, selectedFY, fiscalYears]);

  const kpiList = useMemo(() => {
    const keys = ["elecKWh", "oilTotalL", "coolLoadGJ", "heatLoadGJ"];
    return keys.map((k) => {
      const cur = sumMetric(kpiCurrentRows, k);
      const prev = sumMetric(kpiPreviousRows, k);
      const pct = prev > 0 ? ((cur - prev) / prev) * 100 : null;
      return { key: k, label: METRICS[k].label, unit: METRICS[k].unit, current: cur, previous: kpiPreviousRows.length ? prev : null, pct };
    });
  }, [kpiCurrentRows, kpiPreviousRows]);

  const peak = useMemo(() => {
    if (!kpiCurrentRows.length) return null;
    let best = kpiCurrentRows[0];
    kpiCurrentRows.forEach((r) => { if ((r.demandKW || 0) > (best.demandKW || 0)) best = r; });
    return best;
  }, [kpiCurrentRows]);

  const efficiency = useMemo(() => {
    const elecGJ = (sumMetric(kpiCurrentRows, "elecKWh") * settings.elecMJperKWh) / 1000;
    const oilGJ = (sumMetric(kpiCurrentRows, "oilTotalL") * settings.oilCalorificMJperL) / 1000;
    const loadGJ = sumMetric(kpiCurrentRows, "totalLoadGJ") || (sumMetric(kpiCurrentRows, "coolLoadGJ") + sumMetric(kpiCurrentRows, "heatLoadGJ"));
    const inputGJ = elecGJ + oilGJ;
    const co2 = (sumMetric(kpiCurrentRows, "elecKWh") * settings.elecCO2PerKWh + sumMetric(kpiCurrentRows, "oilTotalL") * settings.oilCO2PerL) / 1000;
    const crudeOilKL = settings.crudeOilGJperKL > 0 ? inputGJ / settings.crudeOilGJperKL : null;
    const costYen = sumMetric(kpiCurrentRows, "elecKWh") * settings.elecPricePerKWh + sumMetric(kpiCurrentRows, "oilTotalL") * settings.oilPricePerL;
    const totalRatedCapacityKW = (settings.chiller1CapacityKW || 0) + (settings.chiller2CapacityKW || 0)
      + (settings.boiler1CapacityKW || 0) + (settings.boiler2CapacityKW || 0);
    const maxCapacityGJ = totalRatedCapacityKW * 24 * 0.0036 * periodDays;
    const equipUtilPct = maxCapacityGJ > 0 ? (loadGJ / maxCapacityGJ) * 100 : null;
    return { inputGJ, loadGJ, ratio: inputGJ > 0 ? (loadGJ / inputGJ) * 100 : null, co2, crudeOilKL, costYen, equipUtilPct };
  }, [kpiCurrentRows, settings, periodDays]);

  const enthalpyStat = useMemo(() => {
    const cur = avgMetric(kpiCurrentRows, "enthalpyKJkg");
    const prev = kpiPreviousRows.length ? avgMetric(kpiPreviousRows, "enthalpyKJkg") : null;
    const pct = prev != null && prev !== 0 ? ((cur - prev) / prev) * 100 : null;
    return { current: cur, previous: prev, pct };
  }, [kpiCurrentRows, kpiPreviousRows]);

  return (
    <div className="app-shell" data-theme={darkMode ? "dark" : "light"}>
      <div className="app-sticky-top">
      <header className="app-header">
        <div className="app-title-row">
          <div className="app-title">エネルギー管理ダッシュボード</div>
          <span className="latest-date">データ最終日: {latestDate || "なし"}</span>
          {db && <span className="sync-badge" title="他端末とFirebaseでリアルタイム同期しています">🔥 同期中</span>}
        </div>
        <div className="app-header-row2">
          <div className="mode-toggle">
            <button className={"btn btn-ghost" + (mode === "dashboard" ? " active" : "")} onClick={() => setMode("dashboard")}>ダッシュボード</button>
            <button className={"btn btn-ghost" + (mode === "analysis" ? " active" : "")} onClick={() => setMode("analysis")}>分析</button>
            <button className={"btn btn-ghost" + (mode === "entry" ? " active" : "")} onClick={() => setMode("entry")}>データ入力</button>
          </div>
          <button className="btn btn-ghost" onClick={() => setShowDataUpdate(true)}>データ更新</button>
          <button className="btn btn-ghost" onClick={() => setShowMonitorImport(true)}>🖥 中央監視画面取り込み</button>
          <button className="btn btn-ghost header-settings-btn" onClick={() => setDarkMode((v) => !v)}>{darkMode ? "☀ ライト" : "🌙 ダーク"}</button>
          <button className="btn btn-ghost" onClick={() => setShowSettings(true)}>設定</button>
        </div>
      </header>

      {!showMonitorImport && showAlertBanner && (
        <div className="alert-banner">
          <div className="alert-banner-header">
            <span>⚠ 直近7日で{recentAlerts.length}件の注意事項があります</span>
            <div className="alert-banner-actions">
              <button
                className="btn btn-small"
                onClick={() => {
                  const first = recentAlerts[0];
                  if (first) {
                    setAnalysisFocus({ type: first.type, metric: first.metricKey, date: first.date, token: Date.now() });
                  }
                  setMode("analysis");
                }}
              >
                分析で詳しく見る
              </button>
              <button className="btn btn-small" onClick={() => setDismissedAlertSig(alertSig)}>閉じる</button>
            </div>
          </div>
          <ul className="alert-list">
            {recentAlerts.map((a) => {
              const existing = notes[a.date];
              const alreadyRecorded = existing && existing.includes(a.message);
              return (
                <li key={a.key}>
                  {a.message}
                  <button
                    className="btn btn-small alert-note-btn"
                    disabled={alreadyRecorded}
                    onClick={() => handleSaveNote(a.date, existing ? `${existing}\n${a.message}` : a.message)}
                  >
                    {alreadyRecorded ? "記録済み" : "メモに記録"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      </div>

      {showMonitorImport ? (
        <MonitorImportModal
          defaultDate={latestDate || new Date().toISOString().slice(0, 10)}
          onClose={() => setShowMonitorImport(false)}
          onUploaded={handleUploadedMonitorFile}
          onSavedAndAnalyze={setPreviewMonitorDate}
          monitorFiles={monitorFiles}
          onOpenExistingPreview={setPreviewMonitorDate}
        />
      ) : (
      <React.Fragment>

      {mode === "entry" && <DataEntryView data={dataDisplay} onSave={handleSaveRecord} onDelete={handleDeleteRecord} notes={notes} onSaveNote={handleSaveNote} monitorFiles={monitorFiles} onDeleteMonitorFile={handleDeleteMonitorFile} onOpenMonitorPreview={setPreviewMonitorDate} />}

      {mode === "analysis" && (data.length ? <AnalysisView data={dataDisplay} settings={settings} darkMode={darkMode} notes={notes} onSaveNote={handleSaveNote} focus={analysisFocus} /> : <div className="empty-state">データがありません。</div>)}

      {mode === "dashboard" && !data.length && (
        <div className="empty-state">データがありません。「データ入力」または「データ更新」から取り込んでください。</div>
      )}

      {mode === "dashboard" && data.length > 0 && (
      <React.Fragment>
      {dataGaps.length > 0 && (
        <div className="gap-banner">
          データ欠落期間の可能性: {dataGaps.map((g, i) => (
            <span key={i}>{i > 0 && "、"}{g.from} 〜 {g.to}（約{g.days}日分）</span>
          ))}
          。元データ（エネルギー.xlsx）をご確認のうえ、必要であれば修正後に「データ更新」から再取込みしてください。
        </div>
      )}

      {(() => {
        const renderChartBody = (chart, hideTitle) => {
          const forecastMetrics = chart.selectedMetrics.filter((m) => FORECASTABLE.includes(m));
          const forecastMap = buckets && chart.showForecast && view !== "year"
            ? computeForecastMap(dataDisplay, view, selectedYm, selectedFY, chart.forecastMethod, forecastMetrics)
            : {};
          const chartBuckets = buckets ? { ...buckets, forecast: forecastMap } : null;
          const projectedKey = forecastMetrics[0];
          const projected = projectedKey && forecastMap[projectedKey]
            ? { key: projectedKey, total: forecastMap[projectedKey].summary.projectedTotal }
            : null;
          return (
            <React.Fragment>
              <div className="panel-title-row">
                <div className="panel-title-left">
                  {!hideTitle && <div className="panel-title">{chart.name}</div>}
                  <label className="inline-toggle chart-header-toggle">
                    <input type="checkbox" checked={chart.selectedMetrics.includes("tempAvg")} onChange={() => toggleChartMetric(chart, "tempAvg")} />
                    外気温度
                  </label>
                  {periodWeather && (
                    <span className="chart-weather">湿度 {fmtNum(periodWeather.humidity, 0)}%RH（期間平均）</span>
                  )}
                </div>
                <label className="inline-toggle chart-header-toggle">
                  <input type="checkbox" checked={chart.showForecast} onChange={(e) => updateChart(chart.id, { showForecast: e.target.checked })} disabled={view === "year"} />
                  予測を表示
                </label>
                <select className="chart-header-select" value={chart.forecastMethod} onChange={(e) => updateChart(chart.id, { forecastMethod: e.target.value })} disabled={!chart.showForecast || view === "year"}>
                  <option value="pace">ペース予測</option>
                  <option value="seasonal">季節性(前年比)予測</option>
                  <option value="regression">気温回帰予測</option>
                </select>
                <label className="inline-toggle chart-header-toggle">
                  <input type="checkbox" checked={chart.dayTypeColoring} onChange={(e) => updateChart(chart.id, { dayTypeColoring: e.target.checked })} />
                  平日/休日で色分け
                </label>
                {view !== "year" && (
                  <label className="inline-toggle chart-header-toggle">
                    <input type="checkbox" checked={chart.compareEnabled} onChange={(e) => updateChart(chart.id, { compareEnabled: e.target.checked })} />
                    前期比較
                  </label>
                )}
                <button className="gear-btn" onClick={() => setFullscreenChartId(chart.id)} title="拡大表示">
                  <span className="gear-icon">⤢</span> 拡大
                </button>
                <button className="gear-btn" onClick={() => setOpenChartSettings(chart.id)}>
                  <span className="gear-icon">⚙</span> グラフ設定
                </button>
              </div>
              {chart.dayTypeColoring && view === "day" && (
                <div className="day-type-legend">
                  {Object.keys(DAY_TYPE_LABEL).map((k) => (
                    <span key={k} className="legend-item"><span className="legend-dot" style={{ background: DAY_TYPE_COLOR[k] }}></span>{DAY_TYPE_LABEL[k]}</span>
                  ))}
                </div>
              )}
              {chart.selectedMetrics.length > 0 && (
                <div className="chart-canvas-toolbar">
                  <button className="btn btn-small" onClick={(e) => downloadChartCanvasImage(e.currentTarget.parentElement, `${chart.name}.png`)}>🖼 画像保存</button>
                </div>
              )}
              <div className="chart-canvas-wrap">
                {chart.selectedMetrics.length > 0 ? (
                  <ChartCanvas
                    key={`chart${chart.id}-${view}-${selectedYm}-${selectedFY}-${chart.chartType}-${chart.selectedMetrics.join(",")}-${chart.showForecast}-${chart.forecastMethod}-${chart.dayTypeColoring}-${chart.compareEnabled}-${darkMode}`}
                    getConfig={() => buildMainChartConfig({ view, buckets: chartBuckets, chartType: chart.chartType, selectedMetrics: chart.selectedMetrics, showForecast: chart.showForecast, forecastMethod: chart.forecastMethod, dayTypeColoring: chart.dayTypeColoring, holidayMap, compareEnabled: chart.compareEnabled && view !== "year", allRows: dataDisplay })}
                  />
                ) : (
                  <div className="chart-empty">「グラフ設定」から表示する項目を選択してください</div>
                )}
              </div>
              {chart.showForecast && projected != null && (
                <div className="forecast-banner">
                  {METRICS[projected.key].label} 着地予測: <b>{fmtNum(projected.total, 0)} {METRICS[projected.key].unit}</b>
                  （方式: {chart.forecastMethod === "pace" ? "ペース" : chart.forecastMethod === "seasonal" ? "季節性(前年比)" : "気温回帰"}）
                </div>
              )}
              {fullscreenChartId === chart.id && (
                <div className="modal-backdrop" onClick={() => setFullscreenChartId(null)}>
                  <div className="fullscreen-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="fullscreen-modal-header">
                      <input type="text" className="fullscreen-modal-title-input" value={chart.name} onChange={(e) => updateChart(chart.id, { name: e.target.value })} />
                      <button className="btn" onClick={() => setFullscreenChartId(null)}>閉じる ✕</button>
                    </div>
                    <div className="panel-title-row">
                      <label className="inline-toggle chart-header-toggle">
                        <input type="checkbox" checked={chart.selectedMetrics.includes("tempAvg")} onChange={() => toggleChartMetric(chart, "tempAvg")} />
                        外気温度
                      </label>
                      {periodWeather && (
                        <span className="chart-weather">湿度 {fmtNum(periodWeather.humidity, 0)}%RH（期間平均）</span>
                      )}
                      <label className="inline-toggle chart-header-toggle">
                        <input type="checkbox" checked={chart.showForecast} onChange={(e) => updateChart(chart.id, { showForecast: e.target.checked })} disabled={view === "year"} />
                        予測を表示
                      </label>
                      <select className="chart-header-select" value={chart.forecastMethod} onChange={(e) => updateChart(chart.id, { forecastMethod: e.target.value })} disabled={!chart.showForecast || view === "year"}>
                        <option value="pace">ペース予測</option>
                        <option value="seasonal">季節性(前年比)予測</option>
                        <option value="regression">気温回帰予測</option>
                      </select>
                      <label className="inline-toggle chart-header-toggle">
                        <input type="checkbox" checked={chart.dayTypeColoring} onChange={(e) => updateChart(chart.id, { dayTypeColoring: e.target.checked })} />
                        平日/休日で色分け
                      </label>
                      {view !== "year" && (
                        <label className="inline-toggle chart-header-toggle">
                          <input type="checkbox" checked={chart.compareEnabled} onChange={(e) => updateChart(chart.id, { compareEnabled: e.target.checked })} />
                          前期比較
                        </label>
                      )}
                      <button className="gear-btn" onClick={() => setOpenChartSettings(chart.id)}>
                        <span className="gear-icon">⚙</span> グラフ設定
                      </button>
                    </div>
                    <div className="fullscreen-chart-wrap">
                      {chart.selectedMetrics.length > 0 && (
                        <ChartCanvas
                          key={`fs-chart${chart.id}-${view}-${selectedYm}-${selectedFY}-${chart.chartType}-${chart.selectedMetrics.join(",")}-${chart.showForecast}-${chart.forecastMethod}-${chart.dayTypeColoring}-${chart.compareEnabled}-${darkMode}`}
                          getConfig={() => buildMainChartConfig({ view, buckets: chartBuckets, chartType: chart.chartType, selectedMetrics: chart.selectedMetrics, showForecast: chart.showForecast, forecastMethod: chart.forecastMethod, dayTypeColoring: chart.dayTypeColoring, holidayMap, compareEnabled: chart.compareEnabled && view !== "year", allRows: dataDisplay })}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        };

        return (
          <React.Fragment>
            <section className="kpi-row">
              <div className="kpi-period-header">
                <div className="kpi-period-left">
                  {view !== "year" && (
                    <div className="kpi-period-nav">
                      <button className="period-nav-btn" onClick={() => stepPeriod(-1)} aria-label="前の期間">◁</button>
                      <button className="period-nav-btn" onClick={() => stepPeriod(1)} aria-label="次の期間">▷</button>
                    </div>
                  )}
                  <div className="kpi-period-label">
                    {kpiLabel} <span className="kpi-period-sub">実績（{kpiCurrentRows.length}/{periodDays}日 入力済み）</span>
                  </div>
                </div>
                <nav className="tabs">
                  {[["day", "月"], ["month", "年"]].map(([v, label]) => (
                    <button key={v} className={"tab" + (view === v ? " active" : "")} onClick={() => setView(v)}>{label}</button>
                  ))}
                  <div className="period-picker">
                    {view === "day" && <input type="month" value={selectedYm} onChange={(e) => setSelectedYm(e.target.value)} />}
                    {view === "month" && (
                      <select value={selectedFY} onChange={(e) => setSelectedFY(Number(e.target.value))}>
                        {fiscalYears.map((fy) => <option key={fy} value={fy}>{fy}年度</option>)}
                      </select>
                    )}
                  </div>
                </nav>
              </div>
              <div className="kpi-cards">
                {kpiList.map((k) => (
                  <KPICard key={k.key} {...k} active={!!charts[0] && charts[0].selectedMetrics.includes(k.key)} onClick={() => toggleMetricInFirstChart(k.key)} />
                ))}
                {peak && (
                  <KPICard label="日平均電力ピーク(簡易デマンド)" current={peak.demandKW} unit="kW"
                    highlight={`${peak.date} / 契約比 ${fmtNum((peak.demandKW / settings.contractKW) * 100, 0)}%`}
                    active={!!charts[0] && charts[0].selectedMetrics.includes("demandKW")} onClick={() => toggleMetricInFirstChart("demandKW")} />
                )}
                <KPICard label="総合熱源効率(供給熱量/投入熱量)" current={efficiency.ratio} unit="%"
                  active={!!charts[0] && charts[0].selectedMetrics.includes("efficiencyPct")} onClick={() => toggleMetricInFirstChart("efficiencyPct")} />
                <KPICard label="CO2排出量" current={efficiency.co2} unit="t-CO2"
                  active={!!charts[0] && charts[0].selectedMetrics.includes("co2T")} onClick={() => toggleMetricInFirstChart("co2T")} />
                <KPICard label="原油換算値" current={efficiency.crudeOilKL} unit="kL"
                  active={!!charts[0] && charts[0].selectedMetrics.includes("crudeOilKL")} onClick={() => toggleMetricInFirstChart("crudeOilKL")} />
                <KPICard label="概算コスト" current={efficiency.costYen} unit="円"
                  active={!!charts[0] && charts[0].selectedMetrics.includes("costYen")} onClick={() => toggleMetricInFirstChart("costYen")} />
                <KPICard label="比エンタルピー(外気)" current={enthalpyStat.current} previous={enthalpyStat.previous} unit="kJ/kg" pct={enthalpyStat.pct}
                  active={!!charts[0] && charts[0].selectedMetrics.includes("enthalpyKJkg")} onClick={() => toggleMetricInFirstChart("enthalpyKJkg")} />
                <KPICard label="設備稼働率(負荷/定格能力)" current={efficiency.equipUtilPct} unit="%"
                  highlight="⚠ 定格能力は現在仮の数値です（設定画面で編集可能）"
                  active={!!charts[0] && charts[0].selectedMetrics.includes("equipUtilPct")} onClick={() => toggleMetricInFirstChart("equipUtilPct")} />
              </div>
              {charts[0] && <div className="combined-chart-wrap">{renderChartBody(charts[0], true)}</div>}
              <AiCommentBox
                buildPrompt={() => buildAnalysisPrompt(
                  `${kpiLabel}の${view === "day" ? "月次" : "年間"}実績分析`,
                  kpiList.map((k) => `${k.label}: ${fmtNum(k.current, 1)}${k.unit}` + (k.pct != null ? `（前期比${k.pct >= 0 ? "+" : ""}${fmtNum(k.pct, 1)}%）` : ""))
                    .concat([
                      `総合熱源効率: ${fmtNum(efficiency.ratio, 1)}%`,
                      `CO2排出量: ${fmtNum(efficiency.co2, 1)}t-CO2`,
                      `概算コスト: ${fmtNum(efficiency.costYen, 0)}円`,
                    ])
                    .concat(peak ? [`日平均電力ピーク: ${fmtNum(peak.demandKW, 1)}kW（${peak.date}／契約比${fmtNum((peak.demandKW / settings.contractKW) * 100, 0)}%）`] : [])
                    .join(" / "),
                  buildChartSuggestionInstruction()
                )}
                onAddChart={addChartWithMetrics}
              />
            </section>

            {charts.slice(1).map((chart) => (
              <section className="chart-panel chart-main" key={chart.id}>
                {renderChartBody(chart)}
              </section>
            ))}
          </React.Fragment>
        );
      })()}

      <button className="add-chart-btn" onClick={addChart}>＋ グラフを追加</button>

      {openChartSettings != null && (() => {
        const chart = charts.find((c) => c.id === openChartSettings);
        if (!chart) return null;
        return (
          <ChartSettingsModal
            name={chart.name}
            onNameChange={(v) => updateChart(chart.id, { name: v })}
            chartType={chart.chartType}
            onChartTypeChange={(v) => updateChart(chart.id, { chartType: v })}
            selected={chart.selectedMetrics}
            onSelectedChange={(v) => updateChart(chart.id, { selectedMetrics: v })}
            onDelete={charts.length > 1 ? () => removeChart(chart.id) : null}
            onClose={() => setOpenChartSettings(null)}
          />
        );
      })()}
      </React.Fragment>
      )}

      </React.Fragment>
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
          onExportBackup={handleExportBackup}
          onImportBackup={handleImportBackup}
          autoSaveSupported={autoSaveSupported}
          autoSaveFileName={autoSaveFileName}
          autoSaveStatus={autoSaveStatus}
          needsReauth={needsReauth}
          onConnectAutoSave={handleConnectAutoSaveFile}
          onReauthorizeAutoSave={handleReauthorizeAutoSaveFile}
          onDisconnectAutoSave={handleDisconnectAutoSaveFile}
        />
      )}
      {showDataUpdate && <DataUpdateModal onImport={handleImportData} onClose={() => setShowDataUpdate(false)} />}
      {previewMonitorDate && (
        <MonitorPreviewModal
          date={previewMonitorDate}
          files={previewMonitorFiles}
          settings={settings}
          onClose={() => setPreviewMonitorDate(null)}
          onDelete={handleDeleteMonitorFile}
        />
      )}

      <style>{`
        .app-shell { max-width: 1280px; margin: 0 auto; padding: 16px calc(20px + env(safe-area-inset-right)) calc(60px + env(safe-area-inset-bottom)) calc(20px + env(safe-area-inset-left)); }
        .app-sticky-top { position: sticky; top: 0; z-index: 500; background: #f1f5f9; padding-bottom: 6px; }
        .app-shell[data-theme="dark"] .app-sticky-top { background: #0b1220; }
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
        .analysis-note.ai-comment { margin:12px 0 0; padding:10px 12px; background:#f8fafc; border-radius:8px; color:#334155; line-height:1.6; }
        .ai-gemini-box { margin-top:8px; }
        .monitor-ai-box { margin-top:14px; flex-shrink:0; }
        .analysis-note.ai-comment-error { background:#fef2f2; color:#b91c1c; }
        .ai-chart-suggestion { margin-top:6px; padding:8px 12px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; font-size:13px; display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .ai-chart-added-note { margin-top:6px; font-size:13px; color:#16a34a; }
        .analysis-empty { padding:24px; text-align:center; color:#94a3b8; font-size:13px; }
        .granularity-toggle { display:flex; gap:4px; }
        .granularity-toggle .btn.active { background:#2563eb; border-color:#2563eb; color:#fff; }
        .overlay-year-checks { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:14px; }
        .anomaly-table { width:100%; border-collapse:collapse; font-size:12px; }
        .anomaly-table th, .anomaly-table td { padding:6px 10px; border-bottom:1px solid #f1f5f9; text-align:right; }
        .anomaly-table th:first-child, .anomaly-table td:first-child { text-align:left; }
        .anomaly-table th { color:#94a3b8; font-weight:700; background:#f8fafc; }
        .anomaly-table tr.row-focused td { background:#fef2f2; }
        .app-shell[data-theme="dark"] .anomaly-table tr.row-focused td { background:#3f1d1d; }
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
        .entry-cal-monitor-icon { position:absolute; top:1px; left:2px; font-size:9px; line-height:1; background:none; border:none; padding:2px; cursor:pointer; }
        .monitor-list-item { display:flex; align-items:center; justify-content:space-between; gap:10px; cursor:default; }
        .monitor-list-actions { display:flex; gap:6px; flex-shrink:0; }
        .monitor-preview-body { flex:1; min-height:0; display:flex; align-items:center; justify-content:center; overflow:auto; background:#f1f5f9; border-radius:8px; margin-top:14px; }
        .monitor-preview-frame { width:100%; height:min(75vh, 900px); border:none; border-radius:8px; }
        .monitor-preview-image { max-width:100%; max-height:75vh; object-fit:contain; }
        .monitor-preview-list { display:flex; flex-wrap:wrap; gap:12px; margin-top:10px; }
        .monitor-preview-item { width:140px; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; }
        .monitor-preview-item-thumb { width:100%; height:100px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; overflow:hidden; }
        .monitor-preview-item-thumb img { width:100%; height:100%; object-fit:contain; }
        .monitor-preview-item-pdf { width:100%; height:100%; border:none; }
        .monitor-preview-item-loading, .monitor-preview-item-error { font-size:12px; color:#64748b; }
        .monitor-preview-item-error { color:#b91c1c; font-size:20px; }
        .monitor-preview-item-info { padding:6px 8px; font-size:12px; }
        .monitor-preview-item-name { word-break:break-all; margin-bottom:2px; }
        .monitor-selected-status { color:#64748b; font-size:12px; display:block; }
        .monitor-selected-status.error { color:#b91c1c; }
        .monitor-file-card { border:1px solid #e2e8f0; border-radius:10px; padding:14px; margin-top:14px; }
        .monitor-file-card-header { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:4px; }
        .monitor-file-card-actions { display:flex; gap:8px; flex-shrink:0; }
        .monitor-preview-item-clickable { cursor:pointer; transition:box-shadow 0.15s, border-color 0.15s; }
        .monitor-preview-item-clickable:hover { border-color:#2563eb; box-shadow:0 0 0 2px rgba(37,99,235,0.15); }
        .monitor-preview-list-large .monitor-preview-item { width:min(320px, 100%); }
        .monitor-preview-list-large .monitor-preview-item-thumb { height:280px; }
        .monitor-import-panel { background:#fff; border-radius:12px; padding:20px 24px; margin-bottom:16px; box-shadow:0 1px 3px rgba(0,0,0,0.06); }
        .app-shell[data-theme="dark"] .monitor-import-panel { background:#1e293b; }
        .monitor-summary-box { padding:12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; margin-bottom:4px; }
        .app-shell[data-theme="dark"] .monitor-file-card { border-color:#334155; }
        .app-shell[data-theme="dark"] .monitor-summary-box { background:#1e293b; border-color:#334155; }
        .app-shell[data-theme="dark"] .monitor-preview-item { border-color:#334155; }
        .app-shell[data-theme="dark"] .monitor-preview-item-thumb { background:#1e293b; }
        .monitor-import-cal { margin:10px 0; border:1px solid #e2e8f0; border-radius:10px; padding:8px 10px; width:240px; max-width:100%; }
        .monitor-import-cal-header { display:flex; align-items:center; justify-content:space-between; font-size:12px; font-weight:700; margin-bottom:4px; gap:4px; }
        .monitor-import-cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:1px; }
        .monitor-import-cal-dow { font-size:10px; color:#94a3b8; text-align:center; margin-bottom:2px; }
        .monitor-import-cal-cell {
          position:relative; height:26px; border:1px solid transparent; border-radius:5px; background:none;
          font-size:11px; cursor:pointer; color:#334155;
        }
        .monitor-import-cal-cell:hover { background:#f1f5f9; }
        .monitor-import-cal-cell.selected { background:#2563eb; color:#fff; font-weight:700; }
        .monitor-import-cal-cell.empty { cursor:default; }
        .monitor-import-cal-dot { position:absolute; bottom:0; right:1px; font-size:7px; line-height:1; }
        .monitor-import-existing { margin:10px 0; }
        .monitor-import-saved-list { margin:10px 0; }
        .monitor-import-saved-list-title { font-size:13px; font-weight:700; margin-bottom:6px; }
        .monitor-import-saved-list-items { display:flex; flex-wrap:wrap; gap:6px; max-height:120px; overflow-y:auto; }
        .monitor-import-saved-list-item { border:1px solid #cbd5e1; background:#fff; border-radius:8px; padding:4px 10px; font-size:12px; cursor:pointer; color:#334155; }
        .monitor-import-saved-list-item:hover { background:#f1f5f9; }
        .monitor-import-saved-list-item.selected { background:#2563eb; border-color:#2563eb; color:#fff; }
        .monitor-import-preview-step { margin-top:10px; padding-top:10px; border-top:1px solid #e2e8f0; }
        .app-shell[data-theme="dark"] .monitor-import-cal { border-color:#334155; }
        .app-shell[data-theme="dark"] .monitor-import-cal-cell { color:#e2e8f0; }
        .app-shell[data-theme="dark"] .monitor-import-cal-cell:hover { background:#1e293b; }
        .app-shell[data-theme="dark"] .monitor-import-saved-list-item { background:#1e293b; border-color:#334155; color:#e2e8f0; }
        .app-shell[data-theme="dark"] .monitor-import-saved-list-item:hover { background:#0f172a; }
        .app-shell[data-theme="dark"] .monitor-import-preview-step { border-color:#334155; }
        .monitor-dropzone {
          border:2px dashed #cbd5e1; border-radius:10px; padding:24px 16px; text-align:center;
          font-size:13px; color:#64748b; cursor:pointer; margin:10px 0; transition:background 0.15s, border-color 0.15s;
        }
        .monitor-dropzone:hover { background:#f8fafc; border-color:#94a3b8; }
        .monitor-dropzone.drag-over { background:#eff6ff; border-color:#2563eb; color:#2563eb; }
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
        @media (max-width: 900px) {
          .entry-form-header-row, .entry-form-row { grid-template-columns:1fr 56px 56px 112px; gap:4px; }
          .entry-form-input-wrap input { width:78px; }
          .entry-form-unit { width:auto; }
        }
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
        .app-shell[data-theme="dark"] .analysis-note.ai-comment { background:#1e293b; color:#cbd5e1; }
        .app-shell[data-theme="dark"] .analysis-note.ai-comment-error { background:#3f1d1d; color:#fecaca; }
        .app-shell[data-theme="dark"] .ai-chart-suggestion { background:#1e293b; border-color:#334155; color:#e2e8f0; }
        .app-shell[data-theme="dark"] .ai-chart-added-note { color:#4ade80; }
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
        .app-shell[data-theme="dark"] .monitor-dropzone { border-color:#334155; color:#94a3b8; }
        .app-shell[data-theme="dark"] .monitor-dropzone:hover { background:#1e293b; border-color:#475569; }
        .app-shell[data-theme="dark"] .monitor-dropzone.drag-over { background:#0c2a4a; border-color:#2563eb; color:#bfdbfe; }
        .app-shell[data-theme="dark"] .empty-state, .app-shell[data-theme="dark"] .chart-empty,
        .app-shell[data-theme="dark"] .analysis-empty { color:#64748b; }
        .app-shell[data-theme="dark"] .target-bar-bg { background:#0f172a; }
        .app-shell[data-theme="dark"] .gap-banner { background:#3f2d0d; border-color:#92400e; color:#fde68a; }
        .app-shell[data-theme="dark"] .modal-note { color:#94a3b8; }

      `}</style>
    </div>
  );
}

function AuthGate() {
  const [authState, setAuthState] = useState(() => (auth ? "checking" : "none"));
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    if (!auth) return;
    const unsub = auth.onAuthStateChanged((user) => setAuthState(user ? "signedIn" : "signedOut"));
    return unsub;
  }, []);

  if (authState === "none" || authState === "signedIn") return <App />;
  if (authState === "checking") return <div className="auth-gate"><div className="auth-loading">確認中…</div></div>;

  const handleLogin = async (e) => {
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

  return (
    <div className="auth-gate">
      <form className="auth-form" onSubmit={handleLogin}>
        <div className="auth-title">エネルギー管理ダッシュボード</div>
        <p className="modal-note">同期用アカウントでサインインしてください。</p>
        <div className="form-row">
          <label>メールアドレス</label>
          <input type="email" name="email" required autoComplete="username" />
        </div>
        <div className="form-row">
          <label>パスワード</label>
          <input type="password" name="password" required autoComplete="current-password" />
        </div>
        {loginError && <div className="entry-validation entry-validation-error">{loginError}</div>}
        <button type="submit" className="btn btn-primary" disabled={loginLoading} style={{ width: "100%", marginTop: 12 }}>
          {loginLoading ? "サインイン中…" : "サインイン"}
        </button>
      </form>
      <style>{`
        .auth-gate { min-height:100vh; display:flex; align-items:center; justify-content:center; background:#f1f5f9; padding:20px; }
        .auth-form { background:#fff; border-radius:12px; padding:28px 26px; width:340px; max-width:100%; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
        .auth-title { font-size:17px; font-weight:700; margin-bottom:6px; }
        .auth-loading { font-size:14px; color:#64748b; }
      `}</style>
    </div>
  );
}

const rootEl = document.getElementById("root");
if (window.ReactDOM.createRoot) {
  window.ReactDOM.createRoot(rootEl).render(<App />);
} else {
  window.ReactDOM.render(<App />, rootEl);
}
