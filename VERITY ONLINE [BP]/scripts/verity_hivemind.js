/*
 * VERITY ONLINE remote bridge client.
 * Protocol derived from Hive Mind API by TrayePlays (MIT licence).
 * This file deliberately contains no provider key: it only transports a
 * temporary pairing code to the public Verity bridge.
 */
import { ScriptEventSource, system, world } from "@minecraft/server";

const VERSION = 0.3;
const PREFIX = "hivemindRequest";
const pending = new Map();
const responses = new Map();
let initialized = false;

// 2400 ticks = 120 s. Used when the bridge acknowledges the request (-1
// accepted) but Groq is still generating the reply.
const EXTENDED_WAIT_TICKS = 2400;

function commandResponse(id, status, message, data) {
    const resolver = pending.get(id);
    if (!resolver) return;
    if (status === -1) {
        // Bridge acknowledged the request. Groq still needs time. Cancel the
        // initial rejection timer and program a longer one so a slow reply
        // doesn't look like a dead bridge.
        if (resolver.timerId !== undefined) {
            try { system.clearRun(resolver.timerId); } catch { /* ignore */ }
        }
        resolver.timerId = system.runTimeout(() => {
            if (!pending.has(id)) return;
            pending.delete(id);
            resolver.reject(new Error("Verity bridge accepted the request but Groq did not respond in time."));
        }, EXTENDED_WAIT_TICKS);
        return;
    }
    pending.delete(id);
    if (resolver.timerId !== undefined) {
        try { system.clearRun(resolver.timerId); } catch { /* ignore */ }
    }
    if (status !== 0) {
        resolver.reject(new Error(message || "Remote bridge error"));
        return;
    }
    let decoded = responses.get(id) ?? data ?? "";
    responses.delete(id);
    try {
        decoded = JSON.parse(decoded);
        if (typeof decoded === "string") decoded = JSON.parse(decoded);
    } catch { /* bridge may return text */ }
    resolver.resolve(decoded);
}

function cleanupOrphanRequests() {
    try {
        const ids = world.getDynamicPropertyIds?.() || [];
        for (const dp of ids) {
            if (typeof dp === "string" && dp.startsWith(PREFIX)) {
                world.setDynamicProperty(dp);
            }
        }
    } catch (err) {
        console.warn(`VERITY hivemind cleanup: ${err}`);
    }
}

function init() {
    if (initialized) return;
    initialized = true;
    const se = system.afterEvents.scriptEventReceive;
    if (!se) { console.warn("VERITY hivemind: scriptEventReceive no disponible"); return; }
    // CRITICAL: pass namespace filter so Bedrock delivers events from ALL source
    // types (Script AND Server). Without this, scriptevents executed via the TCP
    // Script Debugger (sourceType = ScriptEventSource.Server) are silently dropped
    // and hivemind:respond / hivemind:set are never received by this handler.
    // { namespaces: ["hivemind"] } makes Bedrock deliver events from ALL sourceTypes
    // (Script, Server, Entity, Block) for the "hivemind" namespace.
    // Without it, only ScriptEventSource.Script fires — TCP Script Debugger events
    // (ScriptEventSource.Server) are silently dropped, so hivemind:respond and
    // hivemind:set from the VPS bridge are never received by this handler.
    se.subscribe((ev) => {
        const id = ev.id;
        const msg = ev.message || "";
        if (id === "hivemind:purpose") {
            world.setDynamicProperty("hivemindResponse", JSON.stringify({ version: VERSION, name: "VerityOnline", scriptEvent: true }));
            return;
        }
        if (id === "hivemind:resend") {
            // Bridge is asking us to rewrite the dynamic properties for this id
            // (piece loss recovery). Rewrite from the cached chunks.
            const requestId = msg.trim();
            const entry = pending.get(requestId);
            if (!entry?.chunks) return;
            try {
                world.setDynamicProperty(`${PREFIX}${requestId}|meta`, entry.chunks.length);
                for (let i = 0; i < entry.chunks.length; i++) {
                    world.setDynamicProperty(`${PREFIX}${requestId}|${i}`, entry.chunks[i]);
                }
            } catch (err) {
                console.warn(`VERITY hivemind resend ${requestId}: ${err}`);
            }
            return;
        }
        if (id === "hivemind:set") {
            const first = msg.indexOf(" ");
            const second = msg.indexOf(" ", first + 1);
            if (first < 0 || second < 0) return;
            const action = msg.slice(0, first);
            const requestId = msg.slice(first + 1, second);
            let payload = msg.slice(second + 1);
            if (action === "add") responses.set(requestId, (responses.get(requestId) || "") + payload);
            if (action === "reset") responses.delete(requestId);
            if (action === "remove") {
                const count = Number(world.getDynamicProperty(`${PREFIX}${requestId}|meta`) || 0);
                for (let i = 0; i < count; i++) world.setDynamicProperty(`${PREFIX}${requestId}|${i}`);
                world.setDynamicProperty(`${PREFIX}${requestId}|meta`);
            }
            return;
        }
        if (id === "hivemind:respond") {
            const [requestId, rawStatus, message, ...rest] = msg.split("|");
            commandResponse(requestId, Number(rawStatus), message, rest.join("|"));
        }
    }, { namespaces: ["hivemind"] });


    system.run(() => {
        cleanupOrphanRequests();
        world.setDynamicProperty("hivemindResponse", JSON.stringify({ version: VERSION, name: "VerityOnline", scriptEvent: true }));
    });
}

function makeId() { return `${Date.now()}-${Math.floor(Math.random() * 1000000)}-vo`; }

/** Send a request through the script-debugger bridge. */
// Groq may need several seconds to wake up and generate a first response.
// StatEvent2 itself is sampled every 20 ticks, so 15 seconds was too tight and
// made a healthy bridge look disconnected. Once the bridge sends `-1|accepted`
// we swap this timer for a longer one (EXTENDED_WAIT_TICKS).
export function remoteRequest(uri, initData, timeoutTicks = 900) {
    init();
    const id = makeId();
    const request = JSON.stringify({ id, type: "httpRequest", apiName: "VerityOnline", scriptEvent: true, data: { uri, init: initData } });
    const chunks = [];
    for (let i = 0; i < request.length; i += 30000) chunks.push(request.slice(i, i + 30000));
    return new Promise((resolve, reject) => {
        const entry = {
            chunks,
            resolve: (v) => { pending.delete(id); resolve(v); },
            reject: (e) => { pending.delete(id); reject(e); },
        };
        entry.timerId = system.runTimeout(() => {
            if (!pending.has(id)) return;
            pending.delete(id);
            for (let i = 0; i < chunks.length; i++) world.setDynamicProperty(`${PREFIX}${id}|${i}`);
            world.setDynamicProperty(`${PREFIX}${id}|meta`);
            reject(new Error("The Verity bridge did not answer. Connect it with /script debugger connect HOST PORT."));
        }, timeoutTicks);
        pending.set(id, entry);
        world.setDynamicProperty(`${PREFIX}${id}|meta`, chunks.length);
        for (let i = 0; i < chunks.length; i++) world.setDynamicProperty(`${PREFIX}${id}|${i}`, chunks[i]);
    });
}

export function initVerityHivemind() { init(); }
