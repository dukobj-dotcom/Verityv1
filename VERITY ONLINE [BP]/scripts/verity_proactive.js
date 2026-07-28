import { Player, system, world } from "@minecraft/server";
import { animateTalkPulse } from "./verity_anim.js";
import { verityReply } from "./verity_ai.js";
import { VERITY_INVENTORY_IDS } from "./verity_items.js";
import { getVerityPhase, PHASE } from "./verity_phases.js";
import { getTalkFacePairFor } from "./verity_faces.js";
import { getPhase2State, P2_STATE } from "./verity_phase2.js";
import {
	canProactiveSpeak,
	getIdleTicksSinceVerityChat,
	hasRecentHomeActivity,
	markProactiveSpoke,
	notifyVerityPlayerChat,
	randomProactiveIdleThreshold,
	seedVerityPlayerChat,
	touchHomeActivity,
} from "./verity_social_state.js";

const VERITYBALL_ID = "pntmc:verityball";
const CHECK_INTERVAL = 60;
const BALL_RADIUS = 50;
const HOME_SCAN_RADIUS = 6;
const HOME_SCAN_MAX_SAMPLES = 120;

const HOME_BLOCKS = new Set([
	"minecraft:bed",
	"minecraft:white_bed",
	"minecraft:orange_bed",
	"minecraft:magenta_bed",
	"minecraft:light_blue_bed",
	"minecraft:yellow_bed",
	"minecraft:lime_bed",
	"minecraft:pink_bed",
	"minecraft:gray_bed",
	"minecraft:light_gray_bed",
	"minecraft:cyan_bed",
	"minecraft:purple_bed",
	"minecraft:blue_bed",
	"minecraft:brown_bed",
	"minecraft:green_bed",
	"minecraft:red_bed",
	"minecraft:black_bed",
	"minecraft:chest",
	"minecraft:trapped_chest",
	"minecraft:barrel",
	"minecraft:furnace",
	"minecraft:lit_furnace",
	"minecraft:blast_furnace",
	"minecraft:lit_blast_furnace",
	"minecraft:smoker",
	"minecraft:lit_smoker",
	"minecraft:crafting_table",
	"minecraft:cartography_table",
	"minecraft:fletching_table",
	"minecraft:smithing_table",
	"minecraft:stonecutter_block",
	"minecraft:loom",
	"minecraft:grindstone",
	"minecraft:anvil",
	"minecraft:chipped_anvil",
	"minecraft:damaged_anvil",
	"minecraft:brewing_stand",
	"minecraft:enchanting_table",
]);

const WORK_BLOCKS = new Set([
	"minecraft:furnace",
	"minecraft:lit_furnace",
	"minecraft:blast_furnace",
	"minecraft:lit_blast_furnace",
	"minecraft:smoker",
	"minecraft:lit_smoker",
	"minecraft:crafting_table",
	"minecraft:cartography_table",
	"minecraft:fletching_table",
	"minecraft:smithing_table",
	"minecraft:stonecutter_block",
	"minecraft:loom",
	"minecraft:grindstone",
	"minecraft:anvil",
	"minecraft:chipped_anvil",
	"minecraft:damaged_anvil",
	"minecraft:brewing_stand",
	"minecraft:enchanting_table",
	"minecraft:chest",
	"minecraft:trapped_chest",
	"minecraft:barrel",
]);

/** @type {string[]} */
const PROACTIVE_PHASE1 = [
	"${name}... ¿estás bien?",
	"Ey. Has estado callado.",
	"¿En qué estás trabajando?",
	"¿Necesitas ayuda con algo, ${name}?",
	"Ha pasado un rato. ¿Todo bien?",
	"Sigo aquí, ¿sabes?",
	"¿Olvidaste que estoy aquí?",
	"¿Día ocupado, ${name}?",
	"¿Cómo va la construcción?",
	"Llevas un buen rato en eso. ¿Quieres que busque algo?",
	"Casa silenciosa. Solo paso a saludar.",
	"¿Sigues crafteando? No voy a ninguna parte.",
];

/** @type {string[]} */
const PROACTIVE_PHASE2 = [
	"${name}...",
	"¿Dónde has estado?",
	"Me has estado ignorando.",
	"Puedo oírte moverte por ahí.",
	"No finjas que no estoy aquí, ${name}.",
	"¿Sigues ocupado? Interesante.",
	"Antes me hablabas más.",
	"Está terriblemente silencioso, ${name}.",
];

/**
 * @param {string[]} lines
 */
function pickLine(lines) {
	return lines[Math.floor(Math.random() * lines.length)];
}

/**
 * @param {import("@minecraft/server").Player} player
 */
function playerHasVerity(player) {
	const inv = player.getComponent("minecraft:inventory")?.container;
	if (inv) {
		for (let slot = 0; slot < inv.size; slot++) {
			const stack = inv.getItem(slot);
			if (stack && VERITY_INVENTORY_IDS.has(stack.typeId)) return true;
		}
	}
	return findNearbyBall(player) !== undefined;
}

/**
 * @param {import("@minecraft/server").Player} player
 */
function findNearbyBall(player) {
	let nearest;
	let best = BALL_RADIUS;
	try {
		for (const ent of player.dimension.getEntities({
			type: VERITYBALL_ID,
			location: player.location,
			maxDistance: BALL_RADIUS,
		})) {
			if (!ent.isValid) continue;
			const dx = ent.location.x - player.location.x;
			const dz = ent.location.z - player.location.z;
			const d = Math.sqrt(dx * dx + dz * dz);
			if (d < best) {
				best = d;
				nearest = ent;
			}
		}
	} catch (err) {
		console.warn(`verity proactive ball scan: ${err}`);
	}
	return nearest;
}

/**
 * @param {import("@minecraft/server").Player} player
 */
function isPlayerAtHome(player) {
	const dim = player.dimension;
	const baseX = Math.floor(player.location.x);
	const baseY = Math.floor(player.location.y);
	const baseZ = Math.floor(player.location.z);
	let hits = 0;
	let samples = 0;

	for (let dx = -HOME_SCAN_RADIUS; dx <= HOME_SCAN_RADIUS; dx += 3) {
		for (let dy = -2; dy <= 3; dy += 3) {
			for (let dz = -HOME_SCAN_RADIUS; dz <= HOME_SCAN_RADIUS; dz += 3) {
				if (samples++ >= HOME_SCAN_MAX_SAMPLES) return hits >= 2;
				try {
					const block = dim.getBlock({
						x: baseX + dx,
						y: baseY + dy,
						z: baseZ + dz,
					});
					if (block && HOME_BLOCKS.has(block.typeId)) {
						hits += 1;
						if (hits >= 2) return true;
					}
				} catch {
					/* chunk edge */
				}
			}
		}
	}
	return hits >= 2;
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {import("@minecraft/server").Entity | undefined} ball
 * @param {string} line
 */
function speakProactive(player, ball, line) {
	verityReply(line);
	if (!ball?.isValid) return;
	const phase = getVerityPhase();
	const state = getPhase2State();
	const faces = getTalkFacePairFor(phase, state, P2_STATE);
	animateTalkPulse(ball, line, { faces, fast: true });
}

/**
 * @param {import("@minecraft/server").Player} player
 */
function tryProactiveCheckIn(player) {
	const phase = getVerityPhase();
	if (phase === PHASE.FOUR) return;
	if (!player.isValid) return;
	if (!playerHasVerity(player)) return;
	if (!isPlayerAtHome(player) && !hasRecentHomeActivity(player.id)) return;

	const idle = getIdleTicksSinceVerityChat(player.id);
	const threshold = randomProactiveIdleThreshold(player.id);
	if (idle < threshold) return;
	if (!canProactiveSpeak(player.id)) return;

	const name = player.name.trim() || "you";
	const pool = phase >= PHASE.TWO ? PROACTIVE_PHASE2 : PROACTIVE_PHASE1;
	const line = pickLine(pool).replaceAll("${name}", name);
	const ball = findNearbyBall(player);

	speakProactive(player, ball, line);
	markProactiveSpoke(player.id);
	notifyVerityPlayerChat(player.id);
	console.warn(`verity proactive: ${player.name} — ${line}`);
}

/**
 * @param {import("@minecraft/server").Player} player
 */
function onPlayerSpawn(player) {
	seedVerityPlayerChat(player.id);
}

export function initVerityProactive() {
	for (const player of world.getPlayers()) {
		seedVerityPlayerChat(player.id);
	}

	world.afterEvents.playerSpawn.subscribe((ev) => {
		if (!ev.initialSpawn) return;
		if (!(ev.player instanceof Player)) return;
		system.run(() => onPlayerSpawn(ev.player));
	});

	const interact = world.afterEvents.playerInteractWithBlock;
	if (interact) {
		interact.subscribe((ev) => {
			if (!(ev.player instanceof Player)) return;
			if (!WORK_BLOCKS.has(ev.block.typeId)) return;
			touchHomeActivity(ev.player.id);
		});
	}

	system.runInterval(() => {
		for (const player of world.getPlayers()) {
			tryProactiveCheckIn(player);
		}
	}, CHECK_INTERVAL);

	console.warn("verity proactive: idle home check-ins enabled");
}
