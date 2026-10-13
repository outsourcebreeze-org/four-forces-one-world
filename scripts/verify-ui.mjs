import { spawn } from "node:child_process";

const chrome = spawn(
  "google-chrome",
  [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--user-data-dir=/tmp/chrome-ff-profile",
    "--remote-debugging-port=9222",
    "--window-size=1440,900",
    "about:blank",
  ],
  { stdio: "ignore" },
);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let ws;
try {
  let version;
  for (let i = 0; i < 30; i += 1) {
    try {
      version = await fetch("http://127.0.0.1:9222/json/version").then((response) => response.json());
      break;
    } catch {
      await sleep(200);
    }
  }
  if (!version) throw new Error("Chrome debugging port did not open");
  await fetch("http://127.0.0.1:9222/json/new?" + encodeURIComponent("http://127.0.0.1:3847"), {
    method: "PUT",
  }).catch(() => undefined);
  const pages = await fetch("http://127.0.0.1:9222/json/list").then((response) => response.json());
  const page =
    pages.find((item) => item.type === "page" && String(item.url).includes("3847")) ??
    pages.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
  if (!page) throw new Error(`No page target: ${JSON.stringify(pages).slice(0, 400)}`);
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", reject);
  });
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  });
  function send(method, params = {}) {
    const messageId = ++id;
    ws.send(JSON.stringify({ id: messageId, method, params }));
    return new Promise((resolve) => pending.set(messageId, resolve));
  }
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.navigate", { url: "http://127.0.0.1:3847" });
  let text = "";
  for (let i = 0; i < 40; i += 1) {
    await sleep(500);
    const result = await send("Runtime.evaluate", {
      expression: "document.body ? document.body.innerText : 'NO_BODY'",
      returnByValue: true,
    });
    if (i === 0) console.log("EVAL0", JSON.stringify(result).slice(0, 800));
    text = result.result?.result?.value ?? "";
    if (text.includes("situations") && !text.includes("Gathering public hazard feeds")) break;
  }
  const canvas = await send("Runtime.evaluate", {
    expression: "!!document.querySelector('canvas')",
    returnByValue: true,
  });
  console.log("HAS_CANVAS", canvas.result?.result?.value);
  console.log("TEXT_START");
  console.log(text.slice(0, 1800));
  console.log("TEXT_END");
  await send("Runtime.evaluate", {
    expression: `(() => {
      const button = [...document.querySelectorAll('button')].find((item) => item.textContent.includes('Land') || item.textContent.includes('Water') || item.textContent.length > 20);
      const row = [...document.querySelectorAll('button')].find((item) => /M \\d|Flood|Air quality|Wildfire|Cyclone|Earthquake/i.test(item.textContent));
      if (row) row.click();
      return row ? row.innerText.slice(0, 180) : 'no-row';
    })()`,
    returnByValue: true,
  });
  let after = "";
  for (let i = 0; i < 20; i += 1) {
    await sleep(400);
    const result = await send("Runtime.evaluate", {
      expression: "document.body.innerText",
      returnByValue: true,
    });
    after = result.result?.result?.value ?? "";
    if (after.includes("Demo brief") || after.includes("Writing the brief")) break;
  }
  console.log("AFTER_CLICK");
  console.log(after.slice(after.indexOf("situations") > 0 ? Math.max(0, after.length - 1200) : 0));
  const shot = await send("Page.captureScreenshot", { format: "png" });
  const bytes = Buffer.from(shot.result.data, "base64");
  await import("node:fs/promises").then((fs) => fs.writeFile("/tmp/ff-desktop.png", bytes));
  console.log("SHOT", bytes.length);
} finally {
  chrome.kill("SIGKILL");
  ws?.close();
}
