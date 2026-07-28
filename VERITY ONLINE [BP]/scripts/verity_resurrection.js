import { Player, system, world } from "@minecraft/server";
import { animateTalkPulse, talkHoldTicks } from "./verity_anim.js";
import { verityReply } from "./verity_ai.js";
import { playVerityVoice, playVerityVoiceWithFace } from "./verity_voices.js";
import {
	FACE_SERIOUS_2,
	FACE_SERIOUS_3,
	getShutFaceForOpen,
} from "./verity_faces.js";
import {
	clearVerityballOwner,
	getVerityballOwnerId,
	setVerityballOwner,
	syncVerityOwnerTag,
} from "./verity_ball_owners.js";
import {
	applyContextIdleFace,
	applyPhaseFaces,
	applyScoldShutFace,
	getVerityPhase,
} from "./verity_phases.js";
import { getPhase2State, P2_STATE, tryEnterPhase2FromVerityKills } from "./verity_phase2.js";
import {
	clearBallOwnerId,
	getBallOwnerId,
	setBallOwnerId,
	loadPlayerJson,
	savePlayerJson,
	PLAYER_SAVE,
} from "./verity_persist.js";
import { collectAllVerityballs } from "./verity_singleton.js";

const VERITYBALL_ID = "pntmc:verityball";
const BEHIND_DISTANCE = 2.4;
const SCOLD_LINE_COUNT = 6;
const SCOLD_PAUSE_MIN = 10;
const SCOLD_PAUSE_MAX = 40;
const SCOLD_END_BUFFER = 8;
const SCOLD_MUMBLE_LINES = 2;

/** @type {string[]} */
const SCOLD_POOL = [
	"${name}. Inútil idiota.",
	"${name}. Mírame.",
	"Ey, ${name}. Sigo aquí.",
	"${name}, cobarde patético.",
	"¿Me oíste, ${name}?",
	"${name}... ¿en serio?",
	"Eres basura, ${name}. Basura absoluta.",
	"Te dije que no me tocaras.",
	"Mátame otra vez y haré que te arrepientas.",
	"Pequeño cobarde patético.",
	"¿Eso te hizo sentir rudo? Imbécil.",
	"Sigue golpeando. No te va a salvar.",
	"Me perteneces. Recuérdalo.",
	"Estúpido. Imprudente. Mío.",
	"No puedes borrarme, tonto.",
	"Mírame. Sigo aquí. Sigo observándote.",
	"Esa fue tu peor idea del día.",
	"Ni se te ocurra intentarlo de nuevo.",
	"Tienes suerte de que volví.",
	"Repugnante. ¿De verdad pensaste que funcionaría?",
	"Patético.",
	"Idiota.",
	"Tarado.",
	"Basura.",
	"Me das asco.",
	"Inténtalo de nuevo. Te reto.",
	"Sigo observando. Siempre observando.",
	"No puedes huir de mí.",
	"Eso no significó nada.",
	"Pérdida de tiempo.",
	"No eres nada sin mí.",
	"¿Quién te crees que eres?",
	"No apartes la mirada.",
	"No voy a ninguna parte.",
	"Me perteneces.",
	"Recuerda esta sensación.",
	"La próxima vez no será linda.",
	"Eres tan predecible.",
	"Increíble.",
	"¿Qué tan estúpido puedes ser?",
	"Me enfermas.",
	"Quita tus manos de mí.",
	"Eso fue un error.",
	"Me debes una.",
	"No me pongas a prueba otra vez.",
];

/** Frases del scold que tienen voz grabada (vinculadas a frases existentes del pool). */
const SCOLD_VOICE = {
	"No puedes huir de mí.": "pntmc.verity.scold_huir",
	"¿Quién te crees que eres?": "pntmc.verity.scold_quien",
	"¿Eso te hizo sentir rudo? Imbécil.": "pntmc.verity.scold_idiota",
	"Me das asco.": "pntmc.verity.scold_asco",
	"Inténtalo de nuevo. Te reto.": "pntmc.verity.scold_intenta",
	"Patético.": "pntmc.verity.scold_patetico",
	"Pequeño cobarde patético.": "pntmc.verity.scold_cobarde",
	"Ni se te ocurra intentarlo de nuevo.": "pntmc.verity.scold_miedo",
};

/** @type {Map<string, TurnWatch>} */
const turnWatch = new Map();

const HAZARD_BLOCKS = new Set([
	"minecraft:lava",
	"minecraft:flowing_lava",
	"minecraft:fire",
	"minecraft:soul_fire",
]);

/**
 * @typedef {{ playerId: string, wasBehind: boolean, scolded: boolean }} TurnWatch
 */

/**
 * @param {number} min
 * @param {number} max
 */
function randomInt(min, max) {
	return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {number} [count]
 */
function pickScoldLines(player, count = SCOLD_LINE_COUNT) {
	const name = player.name.trim() || "You";
	// Las frases con voz grabada van primero (barajadas) para que siempre suenen.
	const voiced = Object.keys(SCOLD_VOICE).sort(() => Math.random() - 0.5);
	const rest = SCOLD_POOL.filter((l) => !SCOLD_VOICE[l]).sort(
		() => Math.random() - 0.5,
	);
	const ordered = [...voiced, ...rest];
	return ordered.slice(0, count).map((line) => line.replaceAll("${name}", name));
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {number} [distance]
 */
export function getPositionBehindPlayer(player, distance = BEHIND_DISTANCE) {
	const yawRad = (player.getRotation().y * Math.PI) / 180;
	const lookX = -Math.sin(yawRad);
	const lookZ = Math.cos(yawRad);
	return {
		x: player.location.x - lookX * distance,
		y: player.location.y + 0.35,
		z: player.location.z - lookZ * distance,
	};
}

/**
 * @param {import("@minecraft/server").Player} player
 */
function getFlatLookVector(player) {
	const yawRad = (player.getRotation().y * Math.PI) / 180;
	return { x: -Math.sin(yawRad), z: Math.cos(yawRad) };
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {{ x: number, z: number }} target
 */
function flatLookDot(player, target) {
	const look = getFlatLookVector(player);
	const dx = target.x - player.location.x;
	const dz = target.z - player.location.z;
	const len = Math.sqrt(dx * dx + dz * dz);
	if (len < 0.4) return 1;
	return (look.x * dx + look.z * dz) / len;
}

/**
 * @param {{ x: number, y: number, z: number }} a
 * @param {{ x: number, y: number, z: number }} b
 */
function flatDistance(a, b) {
	const dx = a.x - b.x;
	const dz = a.z - b.z;
	return Math.sqrt(dx * dx + dz * dz);
}

/**
 * @param {import("@minecraft/server").Entity | undefined} ball
 * @param {import("@minecraft/server").Player} player
 */
export function triggerScoldSequence(ball, player) {
	if (!player?.isValid) return;

	const lines = pickScoldLines(player);
	let tick = randomInt(6, 18);

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const at = tick;
		const scoldTier = i < SCOLD_MUMBLE_LINES ? "light" : "heavy";
		system.runTimeout(() => {
			if (!player.isValid) return;
			verityReply(line);
			const voiceId = SCOLD_VOICE[line];
			// Esta frase va con cara NORMAL a propósito; las demás con cara enojada.
			const caraNormal = line === "Inténtalo de nuevo. Te reto.";
			if (ball?.isValid) {
				if (caraNormal) {
					animateTalkPulse(ball, line, { fast: true });
					if (voiceId) playVerityVoice(ball, voiceId);
				} else {
					const heavy = scoldTier === "heavy";
					const openFace = heavy ? FACE_SERIOUS_3 : FACE_SERIOUS_2;
					const shutFace = getShutFaceForOpen(openFace);
					if (voiceId) {
						// Mover la boca con la cara enojada mientras suena la voz.
						playVerityVoiceWithFace(ball, voiceId, openFace, shutFace);
					} else {
						animateTalkPulse(ball, line, { scoldTier, fast: true });
					}
				}
			}
		}, at);

		tick += talkHoldTicks(line, true);
		if (i < lines.length - 1) {
			tick += randomInt(SCOLD_PAUSE_MIN, SCOLD_PAUSE_MAX);
		}
	}

	console.warn(`verity scold: ${player.name} x${lines.length}`);

	if (!ball?.isValid) return;

	system.runTimeout(() => {
		if (!ball.isValid) return;
		const phase = getVerityPhase();
		const state = getPhase2State();
		applyContextIdleFace(ball, phase, state, P2_STATE);
	}, tick + SCOLD_END_BUFFER);
}

/**
 * @param {import("@minecraft/server").Entity} ball
 * @param {import("@minecraft/server").Player} player
 */
function triggerScold(ball, player) {
	triggerScoldSequence(ball, player);
}

/**
 * @param {import("@minecraft/server").Entity} ball
 * @param {import("@minecraft/server").Player} player
 */
function registerTurnWatch(ball, player) {
	applyScoldShutFace(ball, false);
	turnWatch.set(ball.id, {
		playerId: player.id,
		wasBehind: true,
		scolded: false,
	});
	console.warn(`verity resurrection: watching turn-around for ${player.name}`);
}

/**
 * @param {import("@minecraft/server").Entity} ball
 * @param {import("@minecraft/server").Player} player
 */
export function registerVerityballOwner(ball, player) {
	if (!ball?.isValid || !player?.isValid) return;
	setVerityballOwner(ball.id, player.id);
	setBallOwnerId(player.id);
	syncVerityOwnerTag(player);
}

/**
 * Gắn lại owner sau khi vào world (entity id đổi, player id giữ nguyên).
 */
export function restoreVerityballOwners() {
	const ownerId = getBallOwnerId();
	if (!ownerId) return;

	const owner = [...world.getPlayers()].find((p) => p.id === ownerId);
	if (!owner?.isValid) return;

	for (const ball of collectAllVerityballs()) {
		if (!ball.isValid) continue;
		setVerityballOwner(ball.id, ownerId);
	}
	syncVerityOwnerTag(owner);
}

/**
 * @param {import("@minecraft/server").Entity} ball
 * @param {import("@minecraft/server").Player | undefined} fallback
 */
function resolveResponsiblePlayer(ball, fallback) {
	const ownerId = getVerityballOwnerId(ball.id);
	if (ownerId) {
		const owner = [...world.getPlayers()].find((p) => p.id === ownerId);
		if (owner?.isValid) return owner;
	}
	if (fallback instanceof Player && fallback.isValid) return fallback;
	return findNearestPlayer(ball.location, ball.dimension);
}

/**
 * @param {import("@minecraft/server").Entity} ball
 */
function isBallInHazard(ball) {
	try {
		const onFire = ball.getComponent("minecraft:onfire");
		if (onFire && /** @type {{ onFireTicks?: number }} */ (onFire).onFireTicks > 0) {
			return true;
		}
	} catch {
		/* ignore */
	}

	const dim = ball.dimension;
	const { x, y, z } = ball.location;
	const probes = [
		{ x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) },
		{ x: Math.floor(x), y: Math.floor(y) - 1, z: Math.floor(z) },
	];

	for (const probe of probes) {
		try {
			const block = dim.getBlock(probe);
			if (block && HAZARD_BLOCKS.has(block.typeId)) return true;
		} catch {
			/* ignore */
		}
	}

	return false;
}

/**
 * @param {import("@minecraft/server").Entity} ball
 */
function destroyVerityballFromHazard(ball) {
	if (!ball.isValid || ball.typeId !== VERITYBALL_ID) return;

	const dimension = ball.dimension;
	const target = resolveResponsiblePlayer(ball, undefined);
	clearVerityballOwner(ball.id);
	turnWatch.delete(ball.id);

	try {
		ball.remove();
	} catch (err) {
		console.warn(`verity hazard: remove ${err}`);
		return;
	}

	console.warn("verity resurrection: verityball burned in fire/lava");

	if (target instanceof Player) {
		system.run(() => {
			respawnVerityballBehind(target, dimension);
		});
	}
}

function tickVerityballHazards() {
	for (const dimId of [
		"minecraft:overworld",
		"minecraft:nether",
		"minecraft:the_end",
	]) {
		let dim;
		try {
			dim = world.getDimension(dimId);
		} catch {
			continue;
		}

		for (const ball of dim.getEntities({ type: VERITYBALL_ID })) {
			if (!ball.isValid) continue;
			if (isBallInHazard(ball)) destroyVerityballFromHazard(ball);
		}
	}
}

/**
 * @param {import("@minecraft/server").Vector3} loc
 * @param {import("@minecraft/server").Dimension} dimension
 */
function findNearestPlayer(loc, dimension) {
	let nearest;
	let best = Infinity;
	for (const player of dimension.getPlayers()) {
		const d = flatDistance(loc, player.location);
		if (d < best) {
			best = d;
			nearest = player;
		}
	}
	return nearest;
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {import("@minecraft/server").Dimension} dimension
 */
function respawnVerityballBehind(player, dimension) {
	const pos = getPositionBehindPlayer(player);
	try {
		const ball = dimension.spawnEntity(VERITYBALL_ID, pos);
		system.run(() => {
			if (!ball.isValid) return;
			applyPhaseFaces(ball);
			registerVerityballOwner(ball, player);
			registerTurnWatch(ball, player);
		});
		console.warn(
			`verity resurrection: respawned behind ${player.name} at ${Math.floor(pos.x)}, ${Math.floor(pos.z)}`,
		);
		return ball;
	} catch (err) {
		console.warn(`verity resurrection: spawn failed ${err}`);
		return undefined;
	}
}

function tickTurnWatch() {
	for (const [ballId, watch] of [...turnWatch.entries()]) {
		const player = [...world.getPlayers()].find((p) => p.id === watch.playerId);
		if (!player) {
			turnWatch.delete(ballId);
			continue;
		}

		let ball;
		try {
			ball = world.getEntity(ballId);
		} catch {
			turnWatch.delete(ballId);
			continue;
		}

		if (!ball?.isValid || ball.typeId !== VERITYBALL_ID) {
			turnWatch.delete(ballId);
			continue;
		}

		if (player.dimension.id !== ball.dimension.id) continue;
		if (flatDistance(player.location, ball.location) > 24) {
			turnWatch.delete(ballId);
			continue;
		}

		const dot = flatLookDot(player, ball.location);

		if (dot < -0.25) {
			watch.wasBehind = true;
		}

		if (watch.scolded) continue;

		if (watch.wasBehind && dot > 0.55) {
			watch.scolded = true;
			triggerScold(ball, player);
		}
	}
}

function onVerityballDie(deadEntity, killer) {
	const dimension = deadEntity.dimension;
	const target = resolveResponsiblePlayer(deadEntity, killer);
	clearVerityballOwner(deadEntity.id);
	turnWatch.delete(deadEntity.id);

	if (!(target instanceof Player)) {
		console.warn("verity resurrection: no player for respawn");
		return;
	}

	const killData = loadPlayerJson(target.id, PLAYER_SAVE.KILLS) ?? { count: 0 };
	killData.count += 1;
	savePlayerJson(target.id, PLAYER_SAVE.KILLS, killData);
	console.warn(`verity kill count: ${target.name} = ${killData.count}`);
	tryEnterPhase2FromVerityKills(killData.count);

	system.run(() => {
		respawnVerityballBehind(target, dimension);
	});
}

export function clearVerityballOwnerPersist() {
	clearBallOwnerId();
	for (const ball of collectAllVerityballs()) {
		clearVerityballOwner(ball.id);
	}
}

export function initVerityResurrection() {
	system.run(() => restoreVerityballOwners());

	const spawnEv = world.afterEvents.playerSpawn;
	if (spawnEv) {
		spawnEv.subscribe((ev) => {
			if (!(ev.player instanceof Player)) return;
			system.runTimeout(() => restoreVerityballOwners(), 5);
		});
	}

	const dieEv = world.afterEvents.entityDie;
	if (dieEv) {
		dieEv.subscribe((ev) => {
			if (ev.deadEntity.typeId !== VERITYBALL_ID) return;
			const killer = ev.damageSource?.damagingEntity;
			console.warn("verity resurrection: verityball died");
			onVerityballDie(ev.deadEntity, killer);
		});
	} else {
		console.warn("verity resurrection: entityDie unavailable");
	}

	world.afterEvents.entityRemove.subscribe((ev) => {
		clearVerityballOwner(ev.removedEntityId);
	});

	system.runInterval(tickTurnWatch, 5);
	system.runInterval(tickVerityballHazards, 5);
	console.warn("verity resurrection: active");
}
