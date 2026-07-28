import { system, world } from "@minecraft/server";
import { getVerityKarma } from "./verity_online.js";

const ANCHOR_ID = "pntmc:karma_anchor";
function anchorFor(player) {
	try {
		const dimension = player.dimension;
		const found = dimension.getEntities({ type: ANCHOR_ID })[0];
		if (found?.isValid) return found;
		// Spawn inside a loaded chunk. Anchors at x=0 below the world often never tick,
		// so Bedrock never publishes their boss bar to the HUD.
		const pos = { x: player.location.x, y: player.location.y - 8, z: player.location.z };
		const anchor = dimension.spawnEntity(ANCHOR_ID, pos);
		try { anchor.addEffect("invisibility", 20000000, { amplifier: 0, showParticles: false }); } catch { /* server-only anchor */ }
		return anchor;
	} catch { return undefined; }
}

/** Native boss health is the global Karma value. One invisible anchor per dimension. */
export function initVerityKarmaBoss() {
	system.runInterval(() => {
		const karma = Math.max(1, getVerityKarma());
		const seenDimensions = new Set();
		for (const player of world.getPlayers()) {
			if (seenDimensions.has(player.dimension.id)) continue;
			seenDimensions.add(player.dimension.id);
			const anchor = anchorFor(player); if (!anchor?.isValid) continue;
			try {
				const health = anchor.getComponent("minecraft:health");
				if (health?.setCurrentValue) health.setCurrentValue(karma);
				else if (health && health.currentValue > karma) anchor.applyDamage(health.currentValue - karma);
				else if (health) anchor.addEffect("regeneration", 1, { amplifier: 255, showParticles: false });
			} catch { /* fallback HUD remains active */ }
		}
	}, 20);
}
