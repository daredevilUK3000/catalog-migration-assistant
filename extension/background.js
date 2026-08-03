const OFFSCREEN_URL = "offscreen.html";
const DONE_BADGE_COLOR = "#059669";
const ACTIVE_BADGE_COLOR = "#171717";

async function ensureOffscreenDocument() {
  const hasDocument = await chrome.offscreen.hasDocument();
  if (hasDocument) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ["CLIPBOARD"],
    justification: "Write the next catalog field value to the system clipboard.",
  });
}

async function writeClipboard(text) {
  await ensureOffscreenDocument();
  const response = await chrome.runtime.sendMessage({ type: "paste-queue:write-clipboard", text });
  if (!response || !response.ok) {
    throw new Error((response && response.error) || "Clipboard write failed.");
  }
}

async function updateBadge(queue, index) {
  if (!queue || queue.length === 0) {
    await chrome.action.setBadgeText({ text: "" });
    return;
  }
  const done = index >= queue.length;
  await chrome.action.setBadgeText({ text: done ? "✓" : `${index + 1}/${queue.length}` });
  await chrome.action.setBadgeBackgroundColor({ color: done ? DONE_BADGE_COLOR : ACTIVE_BADGE_COLOR });
}

async function advanceQueue() {
  const { queue = [], index = 0 } = await chrome.storage.local.get(["queue", "index"]);
  if (!queue.length || index >= queue.length) {
    await updateBadge(queue, index);
    return;
  }

  const field = queue[index];
  await writeClipboard(field.value);

  const nextIndex = index + 1;
  await chrome.storage.local.set({ index: nextIndex });
  await updateBadge(queue, nextIndex);
}

chrome.commands.onCommand.addListener((command) => {
  if (command !== "advance-queue") return;
  advanceQueue().catch((err) => console.error("Paste Queue: failed to advance", err));
});

// Keeps the badge correct if storage changes while this service worker
// happens to already be awake (e.g. the popup loading a new queue or
// resetting the index).
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (!("queue" in changes) && !("index" in changes)) return;
  chrome.storage.local.get(["queue", "index"]).then(({ queue = [], index = 0 }) => {
    updateBadge(queue, index);
  });
});
