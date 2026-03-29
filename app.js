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
const historyClearAll = document.getElementById("history-clear-all");
const historySubtitle = document.getElementById("history-subtitle");
const btnExport = document.getElementById("btn-export");
const btnImport = document.getElementById("btn-import");
const importFile = document.getElementById("import-file");

let state = loadState();

/** @type {string | null} */
let historyActivityId = null;

function persist() {
  saveState(state);
  render();
  if (dialogHistory.open && historyActivityId) {
    refreshHistoryDialog();
  }
}

/** @param {Activity} activity @param {HTMLDivElement} titleRow */
function beginRename(activity, titleRow) {
  titleRow.innerHTML = "";
  const row = document.createElement("div");
  row.className = "card__rename-row";
  const inp = document.createElement("input");
  inp.type = "text";
  inp.className = "input card__name-input";
  inp.value = activity.name;
  inp.maxLength = 120;
  inp.setAttribute("aria-label", "Activity name");
  const btnSave = document.createElement("button");
  btnSave.type = "button";
  btnSave.className = "btn btn--small btn--primary";
  btnSave.textContent = "Save";
  const btnCancel = document.createElement("button");
  btnCancel.type = "button";
  btnCancel.className = "btn btn--small btn--ghost";
  btnCancel.textContent = "Cancel";
  row.appendChild(inp);
  row.appendChild(btnSave);
  row.appendChild(btnCancel);
  titleRow.appendChild(row);
  inp.focus();
  inp.select();
  const done = (save) => {
    if (save) {
      const t = inp.value.trim();
      if (t) activity.name = t;
    }
    persist();
  };
  btnSave.addEventListener("click", () => done(true));
  btnCancel.addEventListener("click", () => done(false));
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      done(true);
    }
    if (e.key === "Escape") {
      e.preventDefault();
      done(false);
    }
  });
}

/** @param {string} activityId @param {string} atIso */
function removeHistoryEntry(activityId, atIso) {
  const act = state.activities.find((x) => x.id === activityId);
  if (!act) return;
  const n = act.events.length;
  act.events = act.events.filter((e) => e.at !== atIso);
  if (act.events.length === n) return;
  persist();
}

function refreshHistoryDialog() {
  const id = historyActivityId;
  if (!id) return;
  const a = state.activities.find((x) => x.id === id);
  historyList.innerHTML = "";

  if (!a) {
    historyTitle.textContent = "History";
    historySubtitle.textContent = "This activity is no longer in your list.";
    historyClearAll.disabled = true;
    const li = document.createElement("li");
    li.className = "history-empty";
    li.textContent = "Nothing to show.";
    historyList.appendChild(li);
    return;
  }

  historyTitle.textContent = a.name;

  const events = [...a.events].sort(
    (x, y) =>
      (parseIso(y.at)?.getTime() ?? 0) - (parseIso(x.at)?.getTime() ?? 0)
  );
  historyClearAll.disabled = events.length === 0;

  if (!events.length) {
    historySubtitle.textContent =
      "No logs yet — use “Just now” or “Add that time” on the card.";
    const li = document.createElement("li");
    li.className = "history-empty";
    li.textContent = "No entries yet.";
    historyList.appendChild(li);
    return;
  }

  const n = events.length;
  const newest = events[0];
  const nd = parseIso(newest.at);
  let sub = `${n} ${n === 1 ? "entry" : "entries"}`;
  if (nd) sub += ` · Most recent ${relativePhrase(nd)}`;
  historySubtitle.textContent = sub;

  for (const ev of events) {
    const li = document.createElement("li");
    li.className = "history-item";
    const body = document.createElement("div");
    body.className = "history-item__body";
    const d = parseIso(ev.at);
    const whenStr = d ? formatAbsolute(d) : ev.at;
    const timeEl = document.createElement("time");
    timeEl.className = "history-item__when";
    if (d) timeEl.dateTime = ev.at;
    timeEl.textContent = whenStr;
    body.appendChild(timeEl);
    if (d) {
      const rel = document.createElement("span");
      rel.className = "history-item__relative";
      rel.textContent = relativePhrase(d);
      body.appendChild(rel);
    }
    if (ev.note) {
      const span = document.createElement("span");
      span.className = "history-item__note";
      span.textContent = ev.note;
      body.appendChild(span);
    }
    const btnRm = document.createElement("button");
    btnRm.type = "button";
    btnRm.className = "history-item__remove";
    btnRm.innerHTML = "&times;";
    btnRm.title = "Remove this log";
    btnRm.setAttribute("aria-label", "Remove this log entry");
    btnRm.addEventListener("click", () => removeHistoryEntry(id, ev.at));
    li.appendChild(body);
    li.appendChild(btnRm);
    historyList.appendChild(li);
  }
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
  historyActivityId = activityId;
  refreshHistoryDialog();
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

    const titleRow = document.createElement("div");
    titleRow.className = "card__title-row";
    const title = document.createElement("h3");
    title.className = "card__name";
    title.textContent = a.name;
    const btnRename = document.createElement("button");
    btnRename.type = "button";
    btnRename.className = "btn btn--small btn--ghost card__rename";
    btnRename.textContent = "Rename";
    btnRename.setAttribute("aria-label", "Rename this activity");
    btnRename.addEventListener("click", () => beginRename(a, titleRow));
    titleRow.appendChild(title);
    titleRow.appendChild(btnRename);
    card.appendChild(titleRow);

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

    const logBlock = document.createElement("div");
    logBlock.className = "card__log";

    const btnDid = document.createElement("button");
    btnDid.type = "button";
    btnDid.className = "btn btn--primary btn--small";
    btnDid.textContent = "Just now";
    btnDid.title = "Record that you did this at the current time";
    btnDid.addEventListener("click", () => {
      a.events.push({ at: new Date().toISOString() });
      persist();
    });
    logBlock.appendChild(btnDid);

    const rowAlt = document.createElement("div");
    rowAlt.className = "card__log-row--alt";
    rowAlt.title = "Use when the thing happened earlier, or to correct a wrong entry";
    const lbl = document.createElement("label");
    lbl.className = "card__log-label";
    lbl.htmlFor = `dt-${a.id}`;
    lbl.textContent = "Different time";
    const dt = document.createElement("input");
    dt.type = "datetime-local";
    dt.id = `dt-${a.id}`;
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    dt.value = now.toISOString().slice(0, 16);
    const btnAddTime = document.createElement("button");
    btnAddTime.type = "button";
    btnAddTime.className = "btn btn--small";
    btnAddTime.textContent = "Add that time";
    btnAddTime.title = "Save the date and time above as one log entry";
    btnAddTime.addEventListener("click", () => {
      const v = dt.value;
      if (!v) return;
      const iso = new Date(v).toISOString();
      a.events.push({ at: iso });
      persist();
    });
    rowAlt.appendChild(lbl);
    rowAlt.appendChild(dt);
    rowAlt.appendChild(btnAddTime);
    logBlock.appendChild(rowAlt);

    const secondary = document.createElement("div");
    secondary.className = "card__secondary";

    const btnHist = document.createElement("button");
    btnHist.type = "button";
    btnHist.className = "btn btn--small btn--ghost";
    btnHist.textContent = "History";
    btnHist.addEventListener("click", () => openHistory(a.id));
    secondary.appendChild(btnHist);

    const btnDel = document.createElement("button");
    btnDel.type = "button";
    btnDel.className = "btn btn--small btn--danger";
    btnDel.textContent = "Remove";
    btnDel.addEventListener("click", () => {
      if (confirm(`Remove “${a.name}” and all its logs?`)) {
        state.activities = state.activities.filter((x) => x.id !== a.id);
        if (historyActivityId === a.id) {
          historyActivityId = null;
          dialogHistory.close();
        }
        persist();
      }
    });
    secondary.appendChild(btnDel);

    actions.appendChild(logBlock);
    actions.appendChild(secondary);

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

dialogHistory.addEventListener("close", () => {
  historyActivityId = null;
});

historyClearAll.addEventListener("click", () => {
  const id = historyActivityId;
  if (!id) return;
  const a = state.activities.find((x) => x.id === id);
  if (!a || !a.events.length) return;
  const n = a.events.length;
  if (
    !confirm(
      `Remove all ${n} logged time${n === 1 ? "" : "s"} for “${a.name}”? This cannot be undone.`
    )
  ) {
    return;
  }
  a.events = [];
  persist();
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
