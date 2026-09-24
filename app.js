// Wes Part Time Income — 资料存在浏览器 localStorage
const RATE = 10; // RM 每小时
const KEY = "wes-pt-income-v1";

const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, "0");

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; }
  catch { return []; }
}
function save(list) { localStorage.setItem(KEY, JSON.stringify(list)); }

let entries = load();

function toMin(t) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// 计算工时（分钟）：下班 - 上班 - 休息
function calc(e) {
  const s = toMin(e.clockIn);
  let end = toMin(e.clockOut);
  if (s === null || end === null) return null;
  if (end <= s) end += 1440; // 跨过午夜

  let brk = 0;
  if (e.breakIn && e.breakOut) {
    let bs = toMin(e.breakIn);
    let be = toMin(e.breakOut);
    if (bs < s) bs += 1440;
    if (be < bs) be += 1440;
    brk = be - bs;
  }
  const total = end - s;
  const work = Math.max(0, total - brk);
  return { total, brk, work, pay: Math.round((work / 60) * RATE * 100) / 100 };
}

function fmtDur(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}小时${m}分` : `${h}小时`;
}
const fmtRM = (n) => "RM " + n.toFixed(2);

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function nowTime() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formData() {
  return {
    date: $("date").value,
    clockIn: $("clockIn").value,
    clockOut: $("clockOut").value,
    breakIn: $("breakIn").value,
    breakOut: $("breakOut").value,
    note: $("note").value.trim(),
  };
}

function updatePreview() {
  const e = formData();
  const r = calc(e);
  if (!r) { $("preview").textContent = "填写上班和下班时间后会自动计算"; return; }
  $("preview").innerHTML =
    `在场 ${fmtDur(r.total)} − 休息 ${fmtDur(r.brk)} = 计薪 <b>${fmtDur(r.work)}</b> → <b>${fmtRM(r.pay)}</b>`;
}

function validate(e) {
  if (!e.date) return "请选择日期";
  if (!e.clockIn || !e.clockOut) return "请填写上班和下班时间";
  if (!!e.breakIn !== !!e.breakOut) return "休息时间要同时填开始和结束，或都留空";
  const r = calc(e);
  if (r.brk > r.total) return "休息时间比上班时间还长，请检查";
  return "";
}

function resetForm() {
  $("entryForm").reset();
  $("editId").value = "";
  $("date").value = today();
  $("formTitle").textContent = "新增记录";
  $("saveBtn").textContent = "保存记录";
  $("cancelEdit").classList.add("hidden");
  $("error").textContent = "";
  updatePreview();
}

$("entryForm").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const e = formData();
  const err = validate(e);
  $("error").textContent = err;
  if (err) return;

  const id = $("editId").value;
  if (id) {
    entries = entries.map((x) => (x.id === id ? { ...e, id } : x));
  } else {
    entries.push({ ...e, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6) });
  }
  save(entries);
  $("monthPick").value = e.date.slice(0, 7);
  resetForm();
  render();
});

$("cancelEdit").addEventListener("click", resetForm);

document.querySelectorAll(".now").forEach((b) =>
  b.addEventListener("click", () => {
    $(b.dataset.target).value = nowTime();
    if (!$("date").value) $("date").value = today();
    updatePreview();
  })
);
["date", "clockIn", "clockOut", "breakIn", "breakOut"].forEach((id) =>
  $(id).addEventListener("input", updatePreview)
);

function monthEntries() {
  const m = $("monthPick").value;
  return entries
    .filter((e) => e.date.startsWith(m))
    .sort((a, b) => (a.date + a.clockIn).localeCompare(b.date + b.clockIn));
}

function render() {
  const list = monthEntries();
  let mins = 0, pay = 0;
  const days = new Set();

  const html = list.map((e) => {
    const r = calc(e);
    mins += r.work; pay += r.pay; days.add(e.date);
    const d = new Date(e.date + "T00:00");
    const wk = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
    const brk = e.breakIn ? ` · 休息 ${e.breakIn}–${e.breakOut}` : "";
    return `
      <div class="entry">
        <div>
          <div class="date">${e.date.slice(5)}（${wk}）</div>
          <div class="meta">${e.clockIn}–${e.clockOut}${brk}<br>计薪 ${fmtDur(r.work)}${e.note ? " · " + escapeHtml(e.note) : ""}</div>
        </div>
        <div class="right">
          <div class="pay">${fmtRM(r.pay)}</div>
          <div class="btns">
            <button onclick="editEntry('${e.id}')">编辑</button>
            <button class="del" onclick="delEntry('${e.id}')">删除</button>
          </div>
        </div>
      </div>`;
  }).join("");

  $("list").innerHTML = html || `<div class="empty">这个月还没有记录</div>`;
  $("statDays").textContent = days.size;
  $("statHours").textContent = fmtDur(mins);
  $("statPay").textContent = fmtRM(Math.round(pay * 100) / 100);
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

window.editEntry = (id) => {
  const e = entries.find((x) => x.id === id);
  if (!e) return;
  ["date", "clockIn", "clockOut", "breakIn", "breakOut", "note"].forEach((k) => ($(k).value = e[k] || ""));
  $("editId").value = id;
  $("formTitle").textContent = "编辑记录";
  $("saveBtn").textContent = "更新记录";
  $("cancelEdit").classList.remove("hidden");
  updatePreview();
  window.scrollTo({ top: 0, behavior: "smooth" });
};

window.delEntry = (id) => {
  if (!confirm("确定删除这条记录？")) return;
  entries = entries.filter((x) => x.id !== id);
  save(entries);
  render();
};

$("monthPick").addEventListener("input", render);

// 导出本月 CSV
$("exportCsv").addEventListener("click", () => {
  const list = monthEntries();
  if (!list.length) return alert("这个月没有记录");
  const rows = [["日期", "上班", "下班", "休息开始", "休息结束", "计薪小时", "工资(RM)", "备注"]];
  let total = 0;
  list.forEach((e) => {
    const r = calc(e);
    total += r.pay;
    rows.push([e.date, e.clockIn, e.clockOut, e.breakIn, e.breakOut, (r.work / 60).toFixed(2), r.pay.toFixed(2), e.note]);
  });
  rows.push(["合计", "", "", "", "", "", total.toFixed(2), ""]);
  const csv = "\uFEFF" + rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  download(`wes-income-${$("monthPick").value}.csv`, csv, "text/csv");
});

// 备份 / 还原
$("backupBtn").addEventListener("click", () => {
  download(`wes-income-backup-${today()}.json`, JSON.stringify(entries, null, 2), "application/json");
});
$("restoreInput").addEventListener("change", (ev) => {
  const f = ev.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw 0;
      if (!confirm(`还原 ${data.length} 条记录？会合并到现有记录（相同记录不会重复）。`)) return;
      const ids = new Set(entries.map((e) => e.id));
      data.forEach((e) => { if (e.id && e.date && !ids.has(e.id)) entries.push(e); });
      save(entries);
      render();
      alert("还原完成");
    } catch { alert("备份文件格式不对"); }
    ev.target.value = "";
  };
  reader.readAsText(f);
});

function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// 初始化
$("monthPick").value = today().slice(0, 7);
resetForm();
render();
