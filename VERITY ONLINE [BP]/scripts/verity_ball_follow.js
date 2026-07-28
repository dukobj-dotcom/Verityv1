import { system, world } from "@minecraft/server";
import { isVerityballSpeaking } from "./verity_phases.js";
import { isMusicPlaying } from "./verity_music.js";
import { getBallOwnerId } from "./verity_persist.js";
import { collectAllVerityballs } from "./verity_singleton.js";
import { getVerityballOwnerId, syncVerityOwnerTag } from "./verity_ball_owners.js";

export const VERITY_TALK_RADIUS = 50;
export const FOLLOW_ARRIVE_DIST = 2.5;

const FOLLOW_ARRIVE_DIST_SQ = FOLLOW_ARRIVE_DIST * FOLLOW_ARRIVE_DIST;
const FOLLOW_CHECK_INTERVAL = 5;
const MOVE_VELOCITY_SQ = 0.002;
const MOVE_DELTA_SQ = 0.0004;
const FOLLOW_CATCHUP_DIST_SQ = 26 * 26;

/** @type {Set<string>} */
const followingBalls = new Set();

/** Pet follow until player says stop */
/** @type {Set<string>} */
const followModeBalls = new Set();

/** One-shot walk over (come here) */
/** @type {Set<string>} */
const comeHereForced = new Set();

/** @type {Map<string, { x: number, z: number }>} */
const lastBallPositions = new Map();

/**
 * @param {import("@minecraft/server").Entity} ball
 * @param {boolean} moving
 */
function setBallMoving(ball, moving) {
	if (!ball?.isValid) return;
	try {
		ball.setProperty("pntmc:moving", moving);
	} catch {
		/* ignore */
	}
}

/**
 * @param {import("@minecraft/server").Entity} ball
 */
function updateBallMovingState(ball) {
	if (!ball?.isValid) return;

	let moving = false;
	try {
		const vel = ball.getVelocity();
		if (vel) {
			moving = vel.x * vel.x + vel.z * vel.z > MOVE_VELOCITY_SQ;
		}
	} catch {
		/* ignore */
	}

	const loc = ball.location;
	const prev = lastBallPositions.get(ball.id);
	if (!moving && prev) {
		const dx = loc.x - prev.x;
		const dz = loc.z - prev.z;
		moving = dx * dx + dz * dz > MOVE_DELTA_SQ;
	}
	lastBallPositions.set(ball.id, { x: loc.x, z: loc.z });

	setBallMoving(ball, moving);
}

/**
 * @param {import("@minecraft/server").Entity} ball
 */
function isFollowBlocked(ball) {
	if (isVerityballSpeaking(ball)) return true;
	if (isMusicPlaying(ball.id)) return true;
	return false;
}

/**
 * @param {import("@minecraft/server").Vector3} a
 * @param {import("@minecraft/server").Vector3} b
 */
function flatDistSq(a, b) {
	const dx = a.x - b.x;
	const dz = a.z - b.z;
	return dx * dx + dz * dz;
}

function catchupLocation(owner) {
	const origin = owner.location;
	for (const offset of [{ x: 1.5, z: 0 }, { x: -1.5, z: 0 }, { x: 0, z: 1.5 }, { x: 0, z: -1.5 }]) {
		const pos = { x: origin.x + offset.x, y: origin.y, z: origin.z + offset.z };
		try {
			const feet = owner.dimension.getBlock({ x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) });
			const head = owner.dimension.getBlock({ x: Math.floor(pos.x), y: Math.floor(pos.y + 1), z: Math.floor(pos.z) });
			if ((!feet || feet.isAir || feet.isLiquid) && (!head || head.isAir || head.isLiquid)) return pos;
		} catch { return pos; }
	}
	return { x: origin.x, y: origin.y + 0.2, z: origin.z };
}

/**
 * @param {import("@minecraft/server").Entity} ball
 * @param {import("@minecraft/server").Player} player
 */
function startBallFollow(ball, player) {
	if (!ball?.isValid || !player?.isValid) return;
	syncVerityOwnerTag(player);
	if (followingBalls.has(ball.id)) return;
	try {
		ball.triggerEvent("pntmc:start_follow");
	} catch (err) {
		console.warn(`verity follow start: ${err}`);
		return;
	}
	followingBalls.add(ball.id);
}

/**
 * @param {import("@minecraft/server").Entity} ball
 */
function stopBallFollow(ball) {
	if (!ball?.isValid) {
		followingBalls.delete(ball.id);
		return;
	}
	followingBalls.delete(ball.id);
	try {
		ball.triggerEvent("pntmc:stop_follow");
	} catch (err) {
		console.warn(`verity follow stop: ${err}`);
	}
	setBallMoving(ball, false);
}

/**
 * @param {string} ballId
 */
function clearBallFollowState(ballId) {
	followingBalls.delete(ballId);
	followModeBalls.delete(ballId);
	comeHereForced.delete(ballId);
	lastBallPositions.delete(ballId);
}

/**
 * @param {import("@minecraft/server").Entity} ball
 */
function tickBallFollow(ball) {
	if (!ball.isValid) {
		clearBallFollowState(ball.id);
		return;
	}

	const followMode = followModeBalls.has(ball.id);
	const comeHere = comeHereForced.has(ball.id);
	if (!followMode && !comeHere) {
		if (followingBalls.has(ball.id)) stopBallFollow(ball);
		return;
	}

	const ownerId = getVerityballOwnerId(ball.id) ?? getBallOwnerId();
	if (!ownerId) {
		if (followingBalls.has(ball.id)) stopBallFollow(ball);
		return;
	}

	const owner = [...world.getPlayers()].find((p) => p.id === ownerId);
	if (!owner?.isValid) {
		if (followingBalls.has(ball.id)) stopBallFollow(ball);
		return;
	}

	if (isFollowBlocked(ball)) {
		if (followingBalls.has(ball.id)) stopBallFollow(ball);
		return;
	}

	// Cerca navega de forma normal. Si se queda muy lejos o cambias de dimensión,
	// alcanza al dueño en un punto seguro y continúa siguiéndolo.
	if (owner.dimension.id !== ball.dimension.id || flatDistSq(ball.location, owner.location) > FOLLOW_CATCHUP_DIST_SQ) {
		try { ball.teleport(catchupLocation(owner), { dimension: owner.dimension, facingLocation: owner.location }); } catch { /* retry next check */ }
	}

	if (comeHere && !followMode) {
		const distSq = flatDistSq(ball.location, owner.location);
		if (distSq <= FOLLOW_ARRIVE_DIST_SQ) {
			comeHereForced.delete(ball.id);
			stopBallFollow(ball);
			return;
		}
	}

	startBallFollow(ball, owner);
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {import("@minecraft/server").Entity} ball
 */
export function enableVerityballFollow(player, ball) {
	if (!ball?.isValid || !player.isValid) return;
	comeHereForced.delete(ball.id);
	followModeBalls.add(ball.id);
	startBallFollow(ball, player);
	console.warn(`verity follow mode on for ${player.name}`);
}

/**
 * @param {import("@minecraft/server").Entity} ball
 */
export function disableVerityballFollow(ball) {
	if (!ball?.isValid) return;
	followModeBalls.delete(ball.id);
	comeHereForced.delete(ball.id);
	stopBallFollow(ball);
	console.warn("verity follow mode off");
}

/**
 * @param {import("@minecraft/server").Entity} ball
 */
export function isVerityballFollowMode(ball) {
	return followModeBalls.has(ball.id);
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {import("@minecraft/server").Entity} ball
 */
export function callVerityComeHere(player, ball) {
	if (!ball?.isValid || !player.isValid) return;
	comeHereForced.add(ball.id);
	startBallFollow(ball, player);
	console.warn(`verity come here for ${player.name}`);
}

export function initVerityBallFollow() {
	system.runInterval(() => {
		for (const ball of collectAllVerityballs()) {
			if (!ball.isValid) continue;
			tickBallFollow(ball);
			updateBallMovingState(ball);
		}
	}, FOLLOW_CHECK_INTERVAL);

	world.afterEvents.entityRemove.subscribe((ev) => {
		clearBallFollowState(ev.removedEntityId);
	});

	console.warn("verity ball follow: command-only pet follow");
}
