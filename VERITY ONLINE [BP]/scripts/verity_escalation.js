import { system, world } from "@minecraft/server";
import { getMood, MOOD } from "./verity_mood.js";
import { startChaseSequence } from "./verity_chase.js";

const lastEvent = new Map();
const lastChase = new Map();
const DOOR = /(_door|_trapdoor|_fence_gate)$/;

function caveLike(player) {
	const l = player.location;
	try {
		const above = player.dimension.getBlock({ x: Math.floor(l.x), y: Math.floor(l.y + 4), z: Math.floor(l.z) });
		return !!above && !above.isAir && player.dimension.id === "minecraft:overworld";
	} catch { return false; }
}
function behind(player, distance = 3) {
	const v = player.getViewDirection();
	return { x: player.location.x - v.x * distance, y: player.location.y + 0.25, z: player.location.z - v.z * distance };
}
function sound(player, id, volume = 0.7) { try { player.playSound(id, { location: behind(player), volume }); } catch { /* optional */ } }
function toggleDoor(player) {
	const base = player.location;
	for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) for (let dy = -1; dy <= 2; dy++) {
		try {
			const block = player.dimension.getBlock({ x: Math.floor(base.x + dx), y: Math.floor(base.y + dy), z: Math.floor(base.z + dz) });
			if (!block || !DOOR.test(block.typeId)) continue;
			const p = block.permutation; const open = p.getState("open_bit");
			block.setPermutation(p.withState("open_bit", !(open === true || open === 1)));
			sound(player, open ? "random.door_close" : "random.door_open"); return;
		} catch { /* find another */ }
	}
}
function apparition(player) {
	try { player.dimension.spawnParticle("pntmc:verityopen", behind(player, 5)); } catch { /* optional */ }
	sound(player, "pntmc.verity.whosthere", 0.55);
}
function phantomHit(player) {
	try { player.applyDamage(1); } catch { /* no damage API */ }
	sound(player, "pntmc.verity.punchcardboardbox", 0.8);
	try { player.onScreenDisplay.setActionBar("§8Algo rozó tu espalda..."); } catch { /* ignore */ }
}

/** Escala lentamente: señal -> hostigamiento -> aparición -> persecución ya animada. */
export function initVerityEscalation() {
	system.runInterval(() => {
		const now = system.currentTick;
		for (const player of world.getPlayers()) {
			if (!player.isValid || !caveLike(player)) continue;
			const mood = getMood(player.id);
			if (mood === MOOD.FRIENDLY) continue;
			if (now - (lastEvent.get(player.id) ?? -99999) < 1200) continue;
			const chance = mood === MOOD.NEUTRAL ? 0.18 : mood === MOOD.ANNOYED ? 0.38 : 0.62;
			if (Math.random() > chance) continue;
			lastEvent.set(player.id, now);
			if (mood === MOOD.NEUTRAL) { Math.random() < 0.5 ? toggleDoor(player) : sound(player, "random.door_open", 0.45); continue; }
			if (mood === MOOD.ANNOYED) { Math.random() < 0.5 ? apparition(player) : phantomHit(player); continue; }
			// Hostil: avisa primero; la persecución animada solo una vez cada 8 min.
			if (now - (lastChase.get(player.id) ?? -99999) > 9600) { lastChase.set(player.id, now); startChaseSequence(player, false); }
			else { apparition(player); phantomHit(player); }
		}
	}, 200);
}
