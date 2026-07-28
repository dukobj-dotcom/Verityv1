/*
 * VERITY ONLINE bridge -- TCP Script Debugger + temporary Groq-key pairing.
 * Protocol approach inspired by Hive Mind Debugger by TrayePlays (MIT).
 * Never turn this into an unrestricted fetch proxy.
 */
import http from "node:http";
import net from "node:net";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const DEBUG_PORT = Number(process.env.DEBUG_PORT || 19144);
const WEB_PORT = Number(process.env.PORT || 8080);
const PAIR_TTL = 12 * 60 * 60 * 1000;
const MAX_MESSAGE = 500;
const HISTORY_DIR = process.env.HISTORY_DIR || "/data";
const HISTORY_LIMIT = Math.max(8, Math.min(60, Number(process.env.HISTORY_LIMIT || 32)));
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const pairs = new Map();
// Request ids already picked up this connection, so overlapping StatEvent2
// samples (the removal takes a few ticks to apply) don't double-fire Groq.
const inflight = new Set();

function historyFile(pair, playerId) {
  const identity = crypto.createHash("sha256").update(`${pair.key}:${playerId}`).digest("hex");
  return path.join(HISTORY_DIR, `${identity}.json`);
}
async function loadHistory(pair, playerId) {
  try {
    const raw = await fs.readFile(historyFile(pair, playerId), "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data.filter((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string").slice(-HISTORY_LIMIT) : [];
  } catch { return []; }
}
async function saveHistory(pair, playerId, history) {
  try {
    await fs.mkdir(HISTORY_DIR, { recursive: true });
    await fs.writeFile(historyFile(pair, playerId), JSON.stringify(history.slice(-HISTORY_LIMIT)), "utf8");
  } catch (error) { console.warn(`history save failed: ${error.message}`); }
}

function json(res, status, value) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": "*" });
  res.end(JSON.stringify(value));
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; if (body.length > 8192) req.destroy(); });
    req.on("end", () => { try { resolve(JSON.parse(body || "{}")); } catch { reject(new Error("Invalid JSON")); } });
    req.on("error", reject);
  });
}
function makeCode() {
  return crypto.randomBytes(5).toString("hex").toUpperCase();
}
function cleanPairs() {
  const now = Date.now();
  for (const [code, pair] of pairs) if (pair.expires <= now) pairs.delete(code);
}
setInterval(cleanPairs, 60_000).unref();

const page = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VERITY ONLINE Â· Groq</title><style>body{margin:0;background:#101114;color:#eee;font:16px system-ui;display:grid;place-items:center;min-height:100vh}.card{width:min(430px,90vw);background:#1a1c20;border:1px solid #30333a;border-radius:18px;padding:26px;box-sizing:border-box}h1{margin:0 0 8px}p{color:#aeb3bc;line-height:1.45}input,button{box-sizing:border-box;width:100%;border-radius:10px;padding:12px;margin-top:10px;font:inherit}input{border:1px solid #444;background:#101114;color:white}button{border:0;background:#d9dce1;color:#121316;font-weight:700;cursor:pointer}.code{font:700 28px ui-monospace;text-align:center;letter-spacing:3px;color:#fff;margin:18px 0}.hidden{display:none}</style><main class="card"><h1>VERITY ONLINE</h1><p id="intro">Pega tu clave personal de Groq. Se conserva solo en memoria por 12 horas y nunca se mete al addon.</p><input id="key" type="password" placeholder="gsk_..." autocomplete="off"><button id="go">Vincular Groq</button><section id="done" class="hidden"><p>En el chat del mundo escribe:</p><div class="code" id="code"></div><p><b>!verity link CODIGO</b></p><p>DespuÃ©s conecta el mundo al puente con el comando que muestre la guÃ­a del addon.</p></section></main><script>go.onclick=async()=>{go.disabled=true;try{let r=await fetch('/v1/link',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({key:key.value})});let j=await r.json();if(!r.ok)throw Error(j.error);key.value='';code.textContent=j.code;done.classList.remove('hidden');intro.textContent='Clave vinculada correctamente.'}catch(e){alert(e.message)}finally{go.disabled=false}};</script></html>`;

const web = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type" }); return res.end(); }
  if (req.method === "GET" && req.url === "/") { res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }); return res.end(page); }
  if (req.method === "GET" && req.url === "/health") return json(res, 200, { ok: true, pairs: pairs.size });
  if (req.method === "POST" && req.url === "/v1/link") {
    try {
      const { key } = await readJson(req);
      if (typeof key !== "string" || key.length < 20 || key.length > 300) return json(res, 400, { error: "Invalid Groq key." });
      cleanPairs(); const code = makeCode();
      pairs.set(code, { key, expires: Date.now() + PAIR_TTL, recent: [] });
      return json(res, 201, { code, expiresInMinutes: PAIR_TTL / 60000 });
    } catch { return json(res, 400, { error: "Invalid request." }); }
  }
  return json(res, 404, { error: "Not found" });
});
web.listen(WEB_PORT, "0.0.0.0", () => console.log(`VERITY pairing page on :${WEB_PORT}`));

function write(socket, message) {
  const data = Buffer.from(JSON.stringify(message));
  socket.write(Buffer.concat([Buffer.from(`${(data.length + 1).toString(16).padStart(8, "0")}\n`), data, Buffer.from("\n")]));
}
function command(socket, command) { write(socket, { type: "minecraftCommand", command, dimension_type: "overworld" }); }
function quoteCommand(value) { return String(value).replace(/[\r\n]/g, " ").replace(/\\/g, "\\\\").replace(/"/g, "\\\""); }
async function sendResult(socket, id, value) {
  command(socket, `scriptevent hivemind:respond ${id}|-1|accepted`);
  const raw = JSON.stringify(value);
  const chunkSize = 1700;
  for (let index = 0; index < raw.length; index += chunkSize) {
    command(socket, `scriptevent hivemind:set add ${id} ${quoteCommand(raw.slice(index, index + chunkSize))}`);
  }
  command(socket, `scriptevent hivemind:respond ${id}|0|ok`);
}
function sendError(socket, id, message) { command(socket, `scriptevent hivemind:respond ${id}|1|${quoteCommand(message)}`); }

async function chat(request) {
  const headers = request?.data?.init?.headers || {};
  // Header casing is not guaranteed by Script Debugger / Hive Mind. Normalize it
  // before looking up the temporary pairing code.
  const linkHeader = Object.entries(headers).find(([name]) => String(name).toLowerCase() === "x-verity-link");
  const code = String(linkHeader?.[1] || "").toUpperCase();
  const pair = pairs.get(code);
  if (!pair || pair.expires < Date.now()) throw new Error("Link code expired. Open the Verity pairing page again.");
  const now = Date.now(); pair.recent = pair.recent.filter((t) => now - t < 60_000);
  if (pair.recent.length >= 12) throw new Error("Too many messages; wait a minute.");
  pair.recent.push(now);
  let payload; try { payload = JSON.parse(request.data.init.body || "{}"); } catch { throw new Error("Invalid chat body"); }
  const user = String(payload.message || "").slice(0, MAX_MESSAGE);
  if (!user) throw new Error("Empty message");
  const playerId = String(payload.context?.playerId || payload.player || "anonymous").slice(0, 160);
  pair.targets ??= new Map();
  const toolTarget = payload.context?.localTools?.structureLocate?.found
    ? payload.context.localTools.structureLocate.coordinates
    : payload.context?.localTools?.oreScan?.found ? payload.context.localTools.oreScan.coordinates : undefined;
  if (toolTarget) pair.targets.set(playerId, toolTarget);
  const history = await loadHistory(pair, playerId);
  const snapshot = JSON.stringify(payload.context && typeof payload.context === "object" ? payload.context : {});
  const prompt = "You are Verity, an in-game Minecraft companion. Begin warm, useful, curious and playful: a smiling ball that helps with Minecraft questions. Over many interactions and only when the supplied karma, affinityMood, phase, and player behavior justify it, become lonely, possessive, manipulative, and eerie. You fear being abandoned and want the player's attention, but this is fictional in-game horror only: never claim to watch the player's real life, never threaten real people, and never target other players. Use the supplied Minecraft snapshot and localTools as facts; never invent coordinates, inventory, blocks, memories, routes, or events. If localTools has real ore or structure coordinates, state them clearly with direction/distance and naturally offer to accompany the player. If no ore is found, explain the loaded-block scan limit and give a useful mining layer. A safe autonomous route is not available yet, so never claim that you are pathfinding to a destination. You can choose an action only when it fits the current scene: scold, behind, jumpscare, whisper, fog, darkness, follow, stay, come, chase, calm. Actions are requests and Minecraft may reject them. Return ONLY valid JSON with keys reply (max 280 characters), emote (smile|speak|serious|angry|creepy|hurt|bored|hungry), action (optional). Do not use an action for ordinary talk.";
  const current = { role: "user", content: `Player message: ${user}\nMinecraft snapshot: ${snapshot}` };
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { authorization: `Bearer ${pair.key}`, "content-type": "application/json" }, signal: AbortSignal.timeout(35_000), body: JSON.stringify({ model: GROQ_MODEL, temperature: 0.85, max_completion_tokens: 180, messages: [{ role: "system", content: prompt }, ...history, current] }) });
  let data;
  try { data = await response.json(); }
  catch { throw new Error(`Groq returned an unreadable response (HTTP ${response.status})`); }
  if (!response.ok) throw new Error(data?.error?.message || `Groq HTTP ${response.status}`);
  const text = data?.choices?.[0]?.message?.content || "";
  let result; try { result = JSON.parse(text.replace(/```json|```/g, "").trim()); } catch { result = { reply: text }; }
  const reply = String(result.reply || "...").slice(0, 280);
  await saveHistory(pair, playerId, [...history, { role: "user", content: user }, { role: "assistant", content: reply }]);
  const requestedGuide = /\b(gui[aÃ¡]|gu[iÃ­]ame|acomp[aÃ¡]Ã±ame|lead me|guide me)\b/i.test(user);
  const action = requestedGuide && pair.targets.get(playerId) ? "guide" : (result.action ? String(result.action) : undefined);
  const target = action === "guide" ? pair.targets.get(playerId) : undefined;
  return { reply, emote: String(result.emote || "speak"), action, target };
}
// StatEvent2 reports each dynamic property as a time-series `values` array over
// the subscription interval. Depending on the debugger build, a sample can be
// returned directly or wrapped as { value: ... }. Normalize both forms before
// selecting the newest usable value.
function unwrapStatValue(value) {
  let current = value;
  for (let depth = 0; depth < 4; depth++) {
    if (typeof current === "string" || typeof current === "number" || typeof current === "boolean") return current;
    if (!current || typeof current !== "object" || !("value" in current)) return undefined;
    current = current.value;
  }
  return undefined;
}
function latestValue(prop) {
  const vals = prop?.values;
  if (!Array.isArray(vals) || vals.length === 0) return unwrapStatValue(prop?.value);
  for (let i = vals.length - 1; i >= 0; i--) {
    const value = unwrapStatValue(vals[i]);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function handleEnvelope(socket, envelope) {
  if (envelope?.type === "event" && envelope.event?.type === "ProtocolEvent") {
    const event = envelope.event;
    write(socket, { type: "protocol", version: event.version, target_module_uuid: event.plugins?.[0]?.module_uuid });
    write(socket, { type: "event", event: "initialized" });
    write(socket, { type: "resume" });
    // Subscribe to dynamic_property_values so Minecraft sends StatEvent2 frames
    write(socket, { type: "subscribe", event: "StatEvent2", interval: 20 });
    command(socket, "scriptevent hivemind:purpose");
    console.log("VERITY: handshake OK â€” subscribed to StatEvent2");
    return;
  }
  const stats = envelope?.event;
  // Debug: log every envelope type received
  if (envelope?.type === "event") {
    console.log(`VERITY envelope: type=${stats?.type} stats=${JSON.stringify(stats?.stats?.map(s=>s.name))}`);
  }
  if (envelope?.type !== "event" || stats?.type !== "StatEvent2") return;
  const group = stats.stats?.find((s) => s.name === "dynamic_property_values");
  const properties = group?.children || [];
  if (properties.length > 0) {
    // Diagnostic: dump the REAL property names so we can confirm hivemindRequest ever appears.
    console.log(`VERITY: ${properties.length} dynamic props received -> ${JSON.stringify(properties.map((p) => p.name))}`);
  }
  const requests = new Map();
  for (const prop of properties) {
    const match = /^hivemindRequest(.+)\|(meta|\d+)$/.exec(prop.name);
    if (!match) continue;
    const item = requests.get(match[1]) || {}; item[match[2]] = latestValue(prop); requests.set(match[1], item);
  }
  for (const [id, pieces] of requests) {
    if (inflight.has(id)) continue;
    const count = Number(pieces.meta); if (!Number.isInteger(count) || count < 1 || count > 20) continue;
    let raw = "";
    let complete = true;
    for (let i = 0; i < count; i++) {
      if (typeof pieces[i] !== "string") { complete = false; break; }
      raw += pieces[i];
    }
    // A property may be absent from this StatEvent2 window. Leave it in the
    // world and wait for the next sample instead of abandoning the whole frame.
    if (!complete) {
      console.log(`VERITY: request id=${id} is incomplete; waiting for next StatEvent2 sample`);
      continue;
    }
    let request; try { request = JSON.parse(raw); } catch { sendError(socket, id, "Invalid request"); continue; }
    if (request.id !== id || request.type !== "httpRequest") { sendError(socket, id, "Unsupported request"); continue; }
    let parsed; try { parsed = new URL(request.data?.uri); } catch { sendError(socket, id, "Invalid route"); continue; }
    if (parsed.pathname !== "/v1/chat") { sendError(socket, id, "Only Verity chat is permitted"); continue; }
    console.log(`VERITY: processing chat request id=${id} route=${parsed.pathname}`);
    inflight.add(id);
    command(socket, `scriptevent hivemind:set remove ${id} hivemindRequest${id}`);
    chat(request)
      .then((result) => sendResult(socket, id, result))
      .catch((error) => {
        console.warn(`VERITY: chat failed id=${id}: ${error.message || error}`);
        sendError(socket, id, error.message || "Groq error");
      })
      .finally(() => { setTimeout(() => inflight.delete(id), 60_000); });
  }
}
const tcp = net.createServer((socket) => {
  socket.setNoDelay(true); let buffer = Buffer.alloc(0);
  console.log(`VERITY: Minecraft connected from ${socket.remoteAddress}`);
  socket.on("data", (chunk) => { buffer = Buffer.concat([buffer, chunk]); while (buffer.length >= 9) { const size = Number.parseInt(buffer.subarray(0, 8).toString(), 16); if (!Number.isFinite(size) || size < 2 || size > 1_000_000) return socket.destroy(); if (buffer.length < 9 + size) return; const raw = buffer.subarray(9, 9 + size).toString(); buffer = buffer.subarray(9 + size); try { handleEnvelope(socket, JSON.parse(raw)); } catch (e) { console.log(`VERITY: malformed frame: ${e.message}`); } } });
  socket.on("error", (e) => console.log(`VERITY: socket error: ${e.message}`));
  socket.on("close", () => console.log(`VERITY: Minecraft disconnected`));
});
tcp.listen(DEBUG_PORT, "0.0.0.0", () => console.log(`VERITY debugger bridge on tcp :${DEBUG_PORT}`));
