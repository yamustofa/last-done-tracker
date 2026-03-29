const STORAGE_KEY = "last-done-tracker-v1";

/** @typedef {{ id: string, name: string, events: { at: string, note?: string }[] }} Activity */

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { activities: [] };
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.activities)) return { activities: [] };
    return data;
  } catch {
    return { activities: [] };
  }
}

/** @param {{ activities: Activity[] }} state */
function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** @param {string} iso */
function parseIso(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** @param {Date} d */
function formatAbsolute(d) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

/** @param {Date} d */
function relativePhrase(d) {
  const now = Date.now();
  const diff = now - d.getTime();
  const sec = Math.floor(diff / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (sec < 60) return rtf.format(-sec, "second");
  const min = Math.floor(sec / 60);
  if (min < 60) return rtf.format(-min, "minute");
  const hr = Math.floor(min / 60);
  if (hr < 48) return rtf.format(-hr, "hour");
  const day = Math.floor(hr / 24);
  if (day < 14) return rtf.format(-day, "day");
  const week = Math.floor(day / 7);
  if (week < 8) return rtf.format(-week, "week");
  const month = Math.floor(day / 30);
  if (month < 12) return rtf.format(-month, "month");
  const year = Math.floor(day / 365);
  return rtf.format(-year, "year");
}

/** @param {Activity} a */
function lastEvent(a) {
  if (!a.events.length) return null;
  return a.events.reduce((best, e) => {
    const tb = parseIso(best.at)?.getTime() ?? -Infinity;
    const te = parseIso(e.at)?.getTime() ?? -Infinity;
    return te >= tb ? e : best;
  });
}

/** @param {Activity} a */
function lastDate(a) {
  const e = lastEvent(a);
  if (!e) return null;
  return parseIso(e.at);
}

const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");
const sortEl = document.getElementById("sort");
const formAdd = document.getElementById("form-add");
const newNameInput = document.getElementById("new-name");
const dialogHistory = document.getElementById("dialog-history");
const historyTitle = document.getElementById("history-title");
const historyList = document.getElementById("history-list");
const historyClose = document.getElementById("history-close");
const btnExport = document.getElementById("btn-export");
const btnImport = document.getElementById("btn-import");
const importFile = document.getElementById("import-file");

let state = loadState();

function persist() {
  saveState(state);
  render();
}

/** @param {Activity[]} items */
function sortActivities(items) {
  const mode = sortEl.value;
  const copy = [...items];

  if (mode === "name") {
    copy.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
    return copy;
  }

  if (mode === "recent") {
    copy.sort((a, b) => {
      const da = lastDate(a)?.getTime() ?? -Infinity;
      const db = lastDate(b)?.getTime() ?? -Infinity;
      return db - da;
    });
    return copy;
  }

  // overdue: longest since last event first (never-done at end or top—put never first as "most overdue")
  copy.sort((a, b) => {
    const la = lastDate(a);
    const lb = lastDate(b);
    if (!la && !lb) return a.name.localeCompare(b.name);
    if (!la) return -1;
    if (!lb) return 1;
    return la.getTime() - lb.getTime();
  });
  return copy;
}

/** @param {string} activityId */
function openHistory(activityId) {
  const a = state.activities.find((x) => x.id === activityId);
  if (!a) return;
  historyTitle.textContent = `History: ${a.name}`;
  const events = [...a.events].sort(
    (x, y) =>
      (parseIso(y.at)?.getTime() ?? 0) - (parseIso(x.at)?.getTime() ?? 0)
  );
  historyList.innerHTML = "";
  if (!events.length) {
    const li = document.createElement("li");
    li.textContent = "No entries yet.";
    historyList.appendChild(li);
  } else {
    for (const ev of events) {
      const li = document.createElement("li");
      const d = parseIso(ev.at);
      li.appendChild(document.createTextNode(d ? formatAbsolute(d) : ev.at));
      if (ev.note) {
        const span = document.createElement("span");
        span.className = "note";
        span.textContent = ev.note;
        li.appendChild(span);
      }
      historyList.appendChild(li);
    }
  }
  dialogHistory.showModal();
}

function render() {
  const sorted = sortActivities(state.activities);
  listEl.innerHTML = "";

  if (!sorted.length) {
    emptyEl.classList.remove("hidden");
    return;
  }
  emptyEl.classList.add("hidden");

  for (const a of sorted) {
    const last = lastDate(a);
    const card = document.createElement("li");
    card.className = "card" + (last ? "" : " card--never");

    const title = document.createElement("h3");
    title.className = "card__name";
    title.textContent = a.name;
    card.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "card__meta";
    if (last) {
      meta.innerHTML = `Last: <strong>${formatAbsolute(last)}</strong> · ${relativePhrase(last)}`;
    } else {
      meta.innerHTML = "Last: <strong>never logged</strong>";
    }
    card.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "card__actions";

    const btnDid = document.createElement("button");
    btnDid.type = "button";
    btnDid.className = "btn btn--primary btn--small";
    btnDid.textContent = "I did it now";
    btnDid.addEventListener("click", () => {
      a.events.push({ at: new Date().toISOString() });
      persist();
    });
    actions.appendChild(btnDid);

    const wrapDate = document.createElement("span");
    wrapDate.className = "inline-date";
    const lbl = document.createElement("label");
    lbl.style.fontSize = "0.8rem";
    lbl.style.color = "var(--muted)";
    lbl.textContent = "Or pick time:";
    lbl.htmlFor = `dt-${a.id}`;
    const dt = document.createElement("input");
    dt.type = "datetime-local";
    dt.id = `dt-${a.id}`;
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    dt.value = now.toISOString().slice(0, 16);
    const btnLog = document.createElement("button");
    btnLog.type = "button";
    btnLog.className = "btn btn--small";
    btnLog.textContent = "Log";
    btnLog.addEventListener("click", () => {
      const v = dt.value;
      if (!v) return;
      const iso = new Date(v).toISOString();
      a.events.push({ at: iso });
      persist();
    });
    wrapDate.appendChild(lbl);
    wrapDate.appendChild(dt);
    wrapDate.appendChild(btnLog);
    actions.appendChild(wrapDate);

    const btnHist = document.createElement("button");
    btnHist.type = "button";
    btnHist.className = "btn btn--small btn--ghost";
    btnHist.textContent = "History";
    btnHist.addEventListener("click", () => openHistory(a.id));
    actions.appendChild(btnHist);

    const btnDel = document.createElement("button");
    btnDel.type = "button";
    btnDel.className = "btn btn--small btn--danger";
    btnDel.textContent = "Remove";
    btnDel.addEventListener("click", () => {
      if (confirm(`Remove “${a.name}” and all its logs?`)) {
        state.activities = state.activities.filter((x) => x.id !== a.id);
        persist();
      }
    });
    actions.appendChild(btnDel);

    card.appendChild(actions);
    listEl.appendChild(card);
  }
}

formAdd.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = newNameInput.value.trim();
  if (!name) return;
  state.activities.push({ id: uid(), name, events: [] });
  newNameInput.value = "";
  persist();
  newNameInput.focus();
});

sortEl.addEventListener("change", render);

historyClose.addEventListener("click", () => dialogHistory.close());

dialogHistory.addEventListener("click", (e) => {
  if (e.target === dialogHistory) dialogHistory.close();
});

btnExport.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `last-done-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

btnImport.addEventListener("click", () => importFile.click());

importFile.addEventListener("change", async () => {
  const file = importFile.files?.[0];
  importFile.value = "";
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data || !Array.isArray(data.activities)) {
      alert("Invalid backup file.");
      return;
    }
    const cleaned = data.activities.filter(
      (x) =>
        x &&
        typeof x.id === "string" &&
        typeof x.name === "string" &&
        Array.isArray(x.events)
    );
    if (
      !confirm(
        "Replace all current data with this backup? This cannot be undone."
      )
    ) {
      return;
    }
    state = { activities: cleaned };
    persist();
  } catch {
    alert("Could not read the file.");
  }
});

render();
newNameInput.focus();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js", { scope: "./" })
      .catch(() => {});
  });
}
