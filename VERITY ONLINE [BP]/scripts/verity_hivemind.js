/*
 * verity_hivemind.js — Remote bridge client for VERITY ONLINE
 *
 * Protocol: Hive Mind API by TrayePlays (MIT).
 * No API keys are stored here. This file only routes chat through
 * a temporary pairing code to the public Verity VPS bridge.
 *
 * Flow:
 *   1. remoteRequest() writes the JSON request into dynamic properties.
 *   2. The VPS reads those properties via StatEvent2 and calls Groq.
 *   3. VPS replies with:
 *        scriptevent hivemind:respond  <id>|-1|accepted   ← "I got it, Groq is working"
 *        scriptevent hivemind:set add  <id> <jsonPayload> ← the actual response data
 *        scriptevent hivemind:respond  <id>|0|ok          ← "all done, read the data"
 *   4. commandResponse() reads the accumulated payload and resolves the promise.
 */
import { system, world } from "@minecraft/server";

const VERSION  = 0.3;
const PREFIX   = "hivemindRequest";          // dynamic property key prefix
const pending  = new Map();                  // id → { resolve, reject, timerId, chunks }
const responses = new Map();                 // id → accumulated JSON string from the VPS

let initialized = false;

// How long to wait for the VPS to acknowledge the request.
const INITIAL_TIMEOUT_TICKS  = 900;         // 45 s
// How long to wait after the VPS sent -1 (accepted) for Groq to finish.
const EXTENDED_TIMEOUT_TICKS = 2400;        // 120 s


// ─── internal helpers ────────────────────────────────────────────────────────

function clearTimer(entry) {
    if (entry.timerId !== undefined) {
        try { system.clearRun(entry.timerId); } catch { /* ignore */ }
        entry.timerId = undefined;
    }
}

// Called by the scriptEventReceive handler every time hivemind:respond fires.
function commandResponse(id, status, errMsg) {
    const entry = pending.get(id);
    if (!entry) return;  // unknown or already resolved request

    if (status === -1) {
        // VPS acknowledged the request — Groq is still generating.
        // Cancel the short initial timer and start a longer one.
        clearTimer(entry);
        entry.timerId = system.runTimeout(() => {
            if (!pending.has(id)) return;
            pending.delete(id);
            entry.reject(new Error("Verity bridge accepted but Groq did not respond in time."));
        }, EXTENDED_TIMEOUT_TICKS);
        return;
    }

    // Final response — either success (0) or error (anything else).
    clearTimer(entry);
    pending.delete(id);

    if (status !== 0) {
        entry.reject(new Error(errMsg || "Verity bridge returned an error."));
        return;
    }

    // Read the JSON payload that hivemind:set add accumulated.
    const raw = responses.get(id) ?? "";
    responses.delete(id);

    // Decode once. A second parse is done only if the first returns a string
    // (some bridge versions double-encode the payload).
    let decoded = raw;
    try {
        decoded = JSON.parse(raw);
        if (typeof decoded === "string") decoded = JSON.parse(decoded);
    } catch { /* leave decoded as raw string */ }

    entry.resolve(decoded);
}

// Remove any leftover hivemindRequest* properties from a previous session.
function cleanupOrphans() {
    try {
        const ids = world.getDynamicPropertyIds?.() ?? [];
        for (const key of ids) {
            if (typeof key === "string" && key.startsWith(PREFIX)) {
                world.setDynamicProperty(key);  // delete by setting undefined
            }
        }
    } catch (e) {
        console.warn(`[VERITY hivemind] orphan cleanup error: ${e}`);
    }
}


// ─── event subscription ──────────────────────────────────────────────────────

function init() {
    if (initialized) return;
    initialized = true;

    const se = system.afterEvents.scriptEventReceive;
    if (!se) {
        console.warn("[VERITY hivemind] scriptEventReceive is not available — bridge disabled.");
        return;
    }

    // IMPORTANT: subscribe WITHOUT a namespace filter.
    // The stable reference addon (Verity 1.1.0 api.js line 62) also subscribes
    // without any filter. Adding { namespaces: ["hivemind"] } causes Bedrock 1.26+
    // to silently drop events sent via the TCP Script Debugger (sourceType = Server),
    // which is exactly how the VPS sends its replies.
    se.subscribe((ev) => {
        const id  = ev.id;
        const msg = ev.message ?? "";

        // ── hivemind:purpose ──────────────────────────────────────────────────
        if (id === "hivemind:purpose") {
            world.setDynamicProperty("hivemindResponse", JSON.stringify({
                version: VERSION, name: "VerityOnline", scriptEvent: true
            }));
            return;
        }

        // ── hivemind:resend ───────────────────────────────────────────────────
        // The VPS asks us to re-write the request properties when it detects gaps.
        if (id === "hivemind:resend") {
            const reqId = msg.trim();
            const entry = pending.get(reqId);
            if (!entry?.chunks) return;
            try {
                world.setDynamicProperty(`${PREFIX}${reqId}|meta`, entry.chunks.length);
                for (let i = 0; i < entry.chunks.length; i++) {
                    world.setDynamicProperty(`${PREFIX}${reqId}|${i}`, entry.chunks[i]);
                }
            } catch (e) {
                console.warn(`[VERITY hivemind] resend error id=${reqId}: ${e}`);
            }
            return;
        }

        // ── hivemind:set ──────────────────────────────────────────────────────
        // VPS accumulates the response payload across one or more add commands.
        if (id === "hivemind:set") {
            // Message format: "<action> <requestId> <payload>"
            const sp1    = msg.indexOf(" ");
            const sp2    = msg.indexOf(" ", sp1 + 1);
            if (sp1 < 0 || sp2 < 0) return;

            const action    = msg.slice(0, sp1);
            const requestId = msg.slice(sp1 + 1, sp2);
            const payload   = msg.slice(sp2 + 1);

            if (action === "add") {
                responses.set(requestId, (responses.get(requestId) ?? "") + payload);
            } else if (action === "reset") {
                responses.delete(requestId);
            } else if (action === "remove") {
                const count = Number(world.getDynamicProperty(`${PREFIX}${requestId}|meta`) || 0);
                for (let i = 0; i < count; i++) world.setDynamicProperty(`${PREFIX}${requestId}|${i}`);
                world.setDynamicProperty(`${PREFIX}${requestId}|meta`);
            }
            return;
        }

        // ── hivemind:respond ──────────────────────────────────────────────────
        // VPS signals that it is done. Message format: "<id>|<status>|<message>"
        if (id === "hivemind:respond") {
            const pipe1  = msg.indexOf("|");
            const pipe2  = msg.indexOf("|", pipe1 + 1);
            if (pipe1 < 0) return;

            const reqId  = msg.slice(0, pipe1);
            const status = Number(msg.slice(pipe1 + 1, pipe2 < 0 ? undefined : pipe2));
            const errMsg = pipe2 >= 0 ? msg.slice(pipe2 + 1) : "";
            commandResponse(reqId, status, errMsg);
        }
    });


    // On the next tick: clean orphan properties and announce our presence.
    system.run(() => {
        cleanupOrphans();
        world.setDynamicProperty("hivemindResponse", JSON.stringify({
            version: VERSION, name: "VerityOnline", scriptEvent: true
        }));
    });
}


// ─── public API ──────────────────────────────────────────────────────────────

function makeId() {
    return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}-vo`;
}

/**
 * Send a request through the Script Debugger bridge and return a Promise
 * that resolves with the parsed JSON response from the VPS.
 *
 * @param {string} uri       - Full URL of the bridge endpoint (e.g. http://host:8080/v1/chat)
 * @param {object} initData  - Fetch-like init object (method, headers, body)
 * @param {number} [timeoutTicks=900] - Ticks before declaring the bridge unreachable
 */
export function remoteRequest(uri, initData, timeoutTicks = INITIAL_TIMEOUT_TICKS) {
    init();

    const id      = makeId();
    const request = JSON.stringify({
        id,
        type:      "httpRequest",
        apiName:   "VerityOnline",
        scriptEvent: true,
        data:      { uri, init: initData }
    });

    // Split into 30 000-char chunks to stay within dynamic property limits.
    const chunks = [];
    for (let i = 0; i < request.length; i += 30_000) {
        chunks.push(request.slice(i, i + 30_000));
    }

    return new Promise((resolve, reject) => {
        const entry = {
            chunks,
            resolve: (v) => resolve(v),
            reject:  (e) => reject(e),
            timerId: undefined,
        };

        // Start the initial timeout. It will be replaced with a longer one
        // if the VPS sends -1|accepted before it fires.
        entry.timerId = system.runTimeout(() => {
            if (!pending.has(id)) return;
            pending.delete(id);
            // Clean up the properties so the VPS won't process a stale request.
            for (let i = 0; i < chunks.length; i++) {
                world.setDynamicProperty(`${PREFIX}${id}|${i}`);
            }
            world.setDynamicProperty(`${PREFIX}${id}|meta`);
            reject(new Error(
                "Verity bridge did not respond. Run: /script debugger connect 207.126.164.18 19144"
            ));
        }, timeoutTicks);

        pending.set(id, entry);

        // Write the request into dynamic properties for the VPS to read.
        world.setDynamicProperty(`${PREFIX}${id}|meta`, chunks.length);
        for (let i = 0; i < chunks.length; i++) {
            world.setDynamicProperty(`${PREFIX}${id}|${i}`, chunks[i]);
        }
    });
}

/** Call once to warm up the subscription (init() is also called lazily by remoteRequest). */
export function initVerityHivemind() { init(); }
