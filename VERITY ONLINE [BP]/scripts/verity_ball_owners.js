import { world } from "@minecraft/server";

/** @type {Map<string, string>} */
export const ballOwners = new Map();

const OWNER_TAG = "pntmc:verity_owner";

/**
 * @param {string} ballId
 */
export function getVerityballOwnerId(ballId) {
	return ballOwners.get(ballId);
}

/**
 * @param {string} ballId
 * @param {string} playerId
 */
export function setVerityballOwner(ballId, playerId) {
	ballOwners.set(ballId, playerId);
}

/**
 * @param {string} ballId
 */
export function clearVerityballOwner(ballId) {
	ballOwners.delete(ballId);
}

/**
 * @param {import("@minecraft/server").Player} player
 */
export function syncVerityOwnerTag(player) {
	if (!player?.isValid) return;
	try {
		for (const other of world.getPlayers()) {
			if (!other.isValid) continue;
			if (other.id === player.id) other.addTag(OWNER_TAG);
			else other.removeTag(OWNER_TAG);
		}
	} catch (err) {
		console.warn(`verity owner tag: ${err}`);
	}
}
