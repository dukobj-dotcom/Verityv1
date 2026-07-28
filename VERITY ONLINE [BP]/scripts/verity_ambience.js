import { system, world } from "@minecraft/server";
import { getMood, MOOD } from "./verity_mood.js";

const lastVillageOmen = new Map();

function applyMist(player) {
	try { player.runCommandAsync("fog @s push pntmc:verity_mist vo_day_one_mist"); } catch { /* fog command unavailable */ }
}

function villagersNearby(player) {
	try {
		const first = player.dimension.getEntities({ type: "minecraft:villager", location: player.location, maxDistance: 34 });
		const second = player.dimension.getEntities({ type: "minecraft:villager_v2", location: player.location, maxDistance: 34 });
		return [...first, ...second];
	} catch { return []; }
}

/** Horror de aldea reversible: parece una desaparición, pero jamás mata ni mueve aldeanos. */
function villageOmen(player) {
	const mood = getMood(player.id);
	if (mood === MOOD.FRIENDLY || villagersNearby(player).length < 2) return;
	const now = system.currentTick;
	if (now - (lastVillageOmen.get(player.id) ?? -99999) < 7200) return;
	const chance = mood === MOOD.NEUTRAL ? 0.12 : mood === MOOD.ANNOYED ? 0.32 : 0.55;
	if (Math.random() > chance) return;
	lastVillageOmen.set(player.id, now);
	try {
		const view = player.getViewDirection();
		const pos = { x: player.location.x - view.x * 7, y: player.location.y + 0.5, z: player.location.z - view.z * 7 };
		player.dimension.spawnParticle("minecraft:basic_smoke_particle", pos);
		player.playSound("pntmc.verity.villagers_gone", { location: pos, volume: 0.55, pitch: 0.9 });
		player.onScreenDisplay.setActionBar("§8Por un momento, el pueblo quedó en silencio.");
	} catch { /* optional audiovisual event */ }
}

function ambientWhisper(player) {
	const mood = getMood(player.id);
	if (mood === MOOD.FRIENDLY || Math.random() > (mood === MOOD.HOSTILE ? 0.16 : 0.07)) return;
	try {
		const view = player.getViewDirection();
		const pos = { x: player.location.x - view.x * 9, y: player.location.y + 0.4, z: player.location.z - view.z * 9 };
		const sound = mood === MOOD.HOSTILE ? (Math.random() < 0.3 ? "pntmc.verity.vo_risa_demiedo" : "pntmc.verity.ambient_sinister") : "pntmc.verity.ambient_humming";
		player.playSound(sound, { location: pos, volume: mood === MOOD.HOSTILE ? 0.5 : 0.3, pitch: 1 });
	} catch { /* optional ambient sound */ }
}

export function initVerityAmbience() {
	for (const player of world.getPlayers()) applyMist(player);
	world.afterEvents.playerSpawn.subscribe((event) => {
		if (event.initialSpawn) system.run(() => { applyMist(event.player); event.player.playSound("pntmc.verity.vo_saludo", { location: event.player.location, volume: 0.85, pitch: 1 }); });
	});
	const sleepEvent = world.afterEvents.playerSleep;
	if (sleepEvent) sleepEvent.subscribe((event) => system.runTimeout(() => {
		try { event.player.playSound("pntmc.verity.vo_saludo", { location: event.player.location, volume: 0.8, pitch: 1 }); } catch { /* optional greeting */ }
	}, 80));
	system.runInterval(() => {
		for (const player of world.getPlayers()) {
			if (!player.isValid) continue;
			applyMist(player);
			villageOmen(player);
			ambientWhisper(player);
		}
	}, 1200);
	console.warn("VERITY ONLINE: ambient mist and reversible village omens active");
}
