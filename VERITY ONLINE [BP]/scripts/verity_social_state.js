import { system } from "@minecraft/server";

/** @type {Map<string, number>} */
const lastVerityChatTick = new Map();

/** @type {Map<string, { count: number, lastTick: number }>} */
const rudeStrikes = new Map();

/** @type {Map<string, number>} */
const homeActivityTick = new Map();

/** @type {Map<string, number>} */
const proactiveLastTick = new Map();

export const RUDE_ESCALATE_AT = 3;
export const RUDE_DECAY_TICKS = 12_000;
export const PROACTIVE_IDLE_MIN_TICKS = 3_600;
export const PROACTIVE_IDLE_MAX_TICKS = 5_400;
export const PROACTIVE_COOLDOWN_TICKS = 4_800;
export const HOME_ACTIVITY_WINDOW_TICKS = 2_400;

/**
 * @param {string} playerId
 */
export function notifyVerityPlayerChat(playerId) {
	lastVerityChatTick.set(playerId, system.currentTick);
}

/**
 * @param {string} playerId
 */
export function seedVerityPlayerChat(playerId) {
	if (!lastVerityChatTick.has(playerId)) {
		lastVerityChatTick.set(playerId, system.currentTick);
	}
}

/**
 * @param {string} playerId
 */
export function touchHomeActivity(playerId) {
	homeActivityTick.set(playerId, system.currentTick);
}

/**
 * @param {string} playerId
 */
export function registerRudeStrike(playerId) {
	const now = system.currentTick;
	let entry = rudeStrikes.get(playerId);
	if (!entry || now - entry.lastTick > RUDE_DECAY_TICKS) {
		entry = { count: 0, lastTick: now };
	}
	entry.count += 1;
	entry.lastTick = now;
	rudeStrikes.set(playerId, entry);
	return entry.count;
}

/**
 * @param {string} playerId
 */
export function resetRudeStrikes(playerId) {
	rudeStrikes.delete(playerId);
}

/**
 * @param {string} playerId
 */
export function getRudeStrikeCount(playerId) {
	const entry = rudeStrikes.get(playerId);
	if (!entry) return 0;
	if (system.currentTick - entry.lastTick > RUDE_DECAY_TICKS) return 0;
	return entry.count;
}

/**
 * @param {string} playerId
 */
export function getIdleTicksSinceVerityChat(playerId) {
	const last = lastVerityChatTick.get(playerId);
	if (last === undefined) return 0;
	return system.currentTick - last;
}

/**
 * @param {string} playerId
 */
export function hasRecentHomeActivity(playerId) {
	const last = homeActivityTick.get(playerId);
	if (last === undefined) return false;
	return system.currentTick - last <= HOME_ACTIVITY_WINDOW_TICKS;
}

/**
 * @param {string} playerId
 */
export function canProactiveSpeak(playerId) {
	const last = proactiveLastTick.get(playerId) ?? 0;
	return system.currentTick - last >= PROACTIVE_COOLDOWN_TICKS;
}

/**
 * @param {string} playerId
 */
export function markProactiveSpoke(playerId) {
	proactiveLastTick.set(playerId, system.currentTick);
}

/**
 * @param {string} playerId
 * @returns {number}
 */
export function randomProactiveIdleThreshold(playerId) {
	const span = PROACTIVE_IDLE_MAX_TICKS - PROACTIVE_IDLE_MIN_TICKS;
	const offset = Math.abs(hashPlayerId(playerId)) % (span + 1);
	return PROACTIVE_IDLE_MIN_TICKS + offset;
}

/**
 * @param {string} playerId
 */
function hashPlayerId(playerId) {
	let h = 0;
	for (let i = 0; i < playerId.length; i++) {
		h = (h * 31 + playerId.charCodeAt(i)) | 0;
	}
	return h;
}
