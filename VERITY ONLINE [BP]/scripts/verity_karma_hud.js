import { system, world } from "@minecraft/server";
import { getVerityKarma } from "./verity_online.js";

/** Stable replacement for the unreliable invisible-entity boss bar. */
export function initVerityKarmaHud() {
	system.runInterval(() => {
		const karma = Math.round(getVerityKarma());
		const color = karma >= 75 ? "§4" : karma >= 45 ? "§6" : "§e";
		for (const player of world.getPlayers()) {
			try { player.onScreenDisplay.setActionBar(`${color}§lKARMA ONLINE §f${karma}%`); } catch { /* HUD optional */ }
		}
	}, 40);
}
