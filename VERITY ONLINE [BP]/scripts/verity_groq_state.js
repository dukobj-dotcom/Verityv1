import { system } from "@minecraft/server";

let lastHeartbeatTick = -99999;
const HEARTBEAT_TTL_TICKS = 200;

export function markGroqOnline() { lastHeartbeatTick = system.currentTick; }
export function markGroqOffline() { lastHeartbeatTick = -99999; }
export function isGroqConnected() { return system.currentTick - lastHeartbeatTick <= HEARTBEAT_TTL_TICKS; }
