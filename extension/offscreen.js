chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "paste-queue:write-clipboard") return undefined;

  navigator.clipboard
    .writeText(message.text ?? "")
    .then(() => sendResponse({ ok: true }))
    .catch((err) => sendResponse({ ok: false, error: String(err) }));

  return true; // keeps the message channel open for the async response above
});
