/*
 * VERITY ONLINE remote bridge client.
 * Protocol derived from Hive Mind API by TrayePlays (MIT licence).
 * This file deliberately contains no provider key: it only transports a
 * temporary pairing code to the public Verity bridge.
 */
import { system, world } from "@minecraft/server";

const VERSION = 0.3;
const PREFIX = "hivemindRequest";
const pending = new Map();
const responses = new Map();
let initialized = false;

function commandResponse(id, status, message, data) {
    const resolver = pending.get(id);
    if (!resolver) return;
    if (status === -1) return; // accepted; wait for final data
    pending.delete(id);
    if (status !== 0) {
        resolver.reject(new Error(message || "Remote bridge error"));
        return;
    }
    let decoded = responses.get(id) ?? data ?? "";
    responses.delete(id);
    try { decoded = JSON.parse(decoded); } catch { /* bridge may return text */ }
    resolver.resolve(decoded);
}

function init() {
    if (initialized) return;
    initialized = true;
    system.afterEvents.scriptEventReceived.subscribe((ev) => {
        const id = ev.id;
        const msg = ev.message || "";
        if (id === "hivemind:purpose") {
            world.setDynamicProperty("hivemindResponse", JSON.stringify({ version: VERSION, name: "VerityOnline", scriptEvent: true }));
            return;
        }
        if (id === "hivemind:set") {
            const first = msg.indexOf(" ");
            const second = msg.indexOf(" ", first + 1);
            if (first < 0 || second < 0) return;
            const action = msg.slice(0, first);
            const requestId = msg.slice(first + 1, second);
            const payload = msg.slice(second + 1);
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
        world.setDynamicProperty("hivemindResponse", JSON.stringify({ version: VERSION, name: "VerityOnline", scriptEvent: true }));
    });
}

function makeId() { return `${Date.now()}-${Math.floor(Math.random() * 1000000)}-vo`; }

/** Send a request through the script-debugger bridge. */
export function remoteRequest(uri, initData, timeoutTicks = 300) {
    init();
    const id = makeId();
    const request = JSON.stringify({ id, type: "httpRequest", apiName: "VerityOnline", scriptEvent: true, data: { uri, init: initData } });
    const chunks = [];
    for (let i = 0; i < request.length; i += 30000) chunks.push(request.slice(i, i + 30000));
    return new Promise((resolve, reject) => {
        const timeout = system.runTimeout(() => {
            if (!pending.has(id)) return;
            pending.delete(id);
            for (let i = 0; i < chunks.length; i++) world.setDynamicProperty(`${PREFIX}${id}|${i}`);
            world.setDynamicProperty(`${PREFIX}${id}|meta`);
            reject(new Error("The Verity bridge did not answer. Connect it with /script debugger connect HOST PORT."));
        }, timeoutTicks);
        pending.set(id, { resolve: (v) => { system.clearRun(timeout); resolve(v); }, reject: (e) => { system.clearRun(timeout); reject(e); } });
        world.setDynamicProperty(`${PREFIX}${id}|meta`, chunks.length);
        for (let i = 0; i < chunks.length; i++) world.setDynamicProperty(`${PREFIX}${id}|${i}`, chunks[i]);
    });
}

export function initVerityHivemind() { init(); }
