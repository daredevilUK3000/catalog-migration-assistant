const els = {
  status: document.getElementById("status"),
  progress: document.getElementById("progress"),
  hotkey: document.getElementById("hotkey"),
  textarea: document.getElementById("json-input"),
  loadBtn: document.getElementById("load-btn"),
  resetBtn: document.getElementById("reset-btn"),
  clearBtn: document.getElementById("clear-btn"),
  loadError: document.getElementById("load-error"),
};

async function loadState() {
  const { queue = [], index = 0, meta = null } = await chrome.storage.local.get([
    "queue",
    "index",
    "meta",
  ]);
  return { queue, index, meta };
}

function renderStatus({ queue, index, meta }) {
  if (!queue.length) {
    els.status.textContent = "No queue loaded yet — paste JSON below and click Load queue.";
    els.progress.textContent = "";
    els.resetBtn.disabled = true;
    return;
  }

  els.resetBtn.disabled = false;
  const metaLine = meta && (meta.album || meta.distributor)
    ? [meta.album, meta.distributor].filter(Boolean).join(" — ")
    : "Loaded queue";

  if (index >= queue.length) {
    els.status.textContent = `${metaLine}: all ${queue.length} field${queue.length === 1 ? "" : "s"} copied.`;
    els.progress.textContent = "";
  } else {
    els.status.textContent = metaLine;
    els.progress.textContent = `Next (${index + 1}/${queue.length}): ${queue[index].label}`;
  }
}

async function refresh() {
  renderStatus(await loadState());
}

async function loadHotkeyLabel() {
  const commands = await chrome.commands.getAll();
  const cmd = commands.find((c) => c.name === "advance-queue");
  els.hotkey.textContent =
    cmd && cmd.shortcut ? cmd.shortcut : "not set — bind one at chrome://extensions/shortcuts";
}

els.loadBtn.addEventListener("click", async () => {
  els.loadError.textContent = "";

  let parsed;
  try {
    parsed = JSON.parse(els.textarea.value);
  } catch {
    els.loadError.textContent = "That's not valid JSON.";
    return;
  }

  if (!parsed || !Array.isArray(parsed.fields)) {
    els.loadError.textContent =
      'Expected an object with a "fields" array — paste the JSON from the app\'s export page.';
    return;
  }

  const fields = parsed.fields
    .filter((f) => f && typeof f.label === "string" && typeof f.value === "string")
    .map((f) => ({ label: f.label, value: f.value }));

  if (fields.length === 0) {
    els.loadError.textContent = "No usable fields found in that JSON.";
    return;
  }

  const meta = {
    album: typeof parsed.album === "string" ? parsed.album : "",
    distributor: typeof parsed.distributor === "string" ? parsed.distributor : "",
  };

  await chrome.storage.local.set({ queue: fields, index: 0, meta });
  els.textarea.value = "";
  refresh();
});

els.resetBtn.addEventListener("click", async () => {
  await chrome.storage.local.set({ index: 0 });
  refresh();
});

els.clearBtn.addEventListener("click", async () => {
  await chrome.storage.local.set({ queue: [], index: 0, meta: null });
  refresh();
});

// Keeps this popup's status live if it's left open while the hotkey is
// pressed (from any tab/window) or the queue changes some other way.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  refresh();
});

loadHotkeyLabel();
refresh();
