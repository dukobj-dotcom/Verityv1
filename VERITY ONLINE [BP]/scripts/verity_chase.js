import { EntityDamageCause, Player, system, world } from "@minecraft/server";
import {
	PLAYER_SAVE,
	clearPlayerJson,
	loadPlayerJson,
	savePlayerJson,
} from "./verity_persist.js";
import { stopBallMusic } from "./verity_music.js";
import { playVerityVoice, VOICE } from "./verity_voices.js";
import { collectAllVerityballs } from "./verity_singleton.js";
import { shouldBlockSleep } from "./verity_phase2.js";
import { enterVerityPhase, getVerityPhase, PHASE, setChaseBallFace, clearChaseBallFace } from "./verity_phases.js";

const VERITY_ID = "pntmc:verity";
const VERITY_CHASE_ID = "pntmc:verity_chase";
const WINDOW_ID = "pntmc:verity_window";
/** Tag duy nhất cho con Verity đang chase — khớp Boy In The Bath */
const CHASE_LIVE_TAG = "pntmc_verity_chase_live";

const SOUND_FOREST = "pntmc.verity.mygal_forest";
const SOUND_SPOTTED_BONECRACK = "pntmc.verity.spotted_bonecrack";
const SOUND_CHASE = "pntmc.verity.chase";
const SOUND_JUMPSCARE = "pntmc.verity.jumpscare";

/** Music chase — phát global qua player.playSound (category music) */
const CHASE_MUSIC_IDS = [SOUND_FOREST, SOUND_SPOTTED_BONECRACK, SOUND_CHASE];
const FOREST_MUSIC_VOLUME = 0.4;
const CHASE_MUSIC_VOLUME = 1;
const BONECRACK_MUSIC_VOLUME = 1;

const BALL_AUDIO_IDS = ["pntmc.verity.mygal_normal", "pntmc.verity.loudmusic"];

/** Lặp lại nhạc chase theo phase mỗi 17 giây */
const CHASE_SOUND_LOOP_TICKS = 17 * 20;

/** Actionbar token — khớp hud_screen.json ($atext = 'pntmcverity') */
const JUMPSCARE_HUD_ACTIONBAR = "pntmcverity";

const ANIM_IDLE = 0;
const ANIM_SPOTTED = 1;

const STALK_DIST = 20;
/** Khi bắt đầu chase — đẩy Verity ra xa player ít nhất bấy nhiêu block */
const CHASE_START_MIN_DIST = 12;
/** Nhìn thẳng ~7s trước spotted (interval 10 ticks) */
const STARE_STEPS = 14;
/** Sau spotted ~8s mới chase (khớp spotted anim 8.08s) */
const SPOTTED_TO_CHASE_STEPS = 16;
const NIGHTLY_CHASE_CHANCE = 0.5;
const NIGHT_START = 12000;
const NIGHT_END = 23000;
const TICKS_PER_DAY = 24000;
/** Gần thì spotted ngay trong lúc đang nhìn */
const SPOTTED_CLOSE_DIST = 12;
/** Trốn khi xa hơn 110 blocks (khó cắt đuôi hơn) */
const ESCAPE_DIST = 110;
const GLASS_SCAN_RADIUS = 20;
const WINDOW_LOOK_TICKS = 3;
const WINDOW_SPAWN_OUT = 0.65;
/** Glass center Y + this (user: ngang kính, y - 0.5) */
const WINDOW_Y_FROM_GLASS_CENTER = -0.5;
const WINDOW_LOOK_DIST = 14;
/** Chờ sau khi spawn trước khi bắt đầu detect nhìn (~0.8s) */
const WINDOW_SPAWN_GRACE = 8;
const INDOOR_CEILING_SCAN = 12;

/** Trong nhà: Verity không thấy player ~2s là trốn */
const INDOOR_HIDE_CONFIRM_STEPS = 4;
/** Trong nhà — xa Verity bấy nhiêu block (qua tường) cũng coi là đã trốn */
const INDOOR_SAFE_DIST = 6;
/** Phase window: tự kích hoạt scare nếu đứng gần cửa sổ quá lâu mà không ngẩng đúng tia */
const WINDOW_AUTO_TRIGGER_STEPS = 16;
/** Chiều cao mắt Verity so với chân (collision ~2.2) */
const CHASE_VERITY_EYE_Y = 1.75;

/** @typedef {"stalk"|"spotted"|"chase"|"window"|"done"} ChasePhase */

/** @type {Map<string, {
 *   phase: ChasePhase,
 *   verityId?: string,
 *   windowId?: string,
 *   glassLoc?: { x: number, y: number, z: number },
 *   stalkFaceSteps?: number,
 *   spottedSteps?: number,
 *   hideSteps?: number,
 *   windowWaitSteps?: number,
 *   spawnLoc?: { x: number, y: number, z: number },
 *   lookTicks?: number,
 *   windowGraceSteps?: number,
 *   windowTriggered?: boolean,
 *   testMode?: boolean,
 *   damageCooldown?: number,
 *   musicLoopTick?: number,
 * }>} */
const sessions = new Map();

/**
 * @param {string} playerId
 * @param {{
 *   phase: ChasePhase,
 *   verityId?: string,
 *   windowId?: string,
 *   glassLoc?: { x: number, y: number, z: number },
 *   stalkFaceSteps?: number,
 *   spottedSteps?: number,
 *   hideSteps?: number,
 *   windowWaitSteps?: number,
 *   spawnLoc?: { x: number, y: number, z: number },
 *   lookTicks?: number,
 *   windowGraceSteps?: number,
 *   windowTriggered?: boolean,
 *   testMode?: boolean,
 *   damageCooldown?: number,
 * } | undefined} session
 */
function persistChaseSession(playerId, session) {
	if (!session) {
		clearPlayerJson(playerId, PLAYER_SAVE.CHASE);
		return;
	}
	savePlayerJson(playerId, PLAYER_SAVE.CHASE, {
		phase: session.phase,
		stalkFaceSteps: session.stalkFaceSteps ?? 0,
		spottedSteps: session.spottedSteps ?? 0,
		hideSteps: session.hideSteps ?? 0,
		lookTicks: session.lookTicks ?? 0,
		windowGraceSteps: session.windowGraceSteps ?? 0,
		windowTriggered: session.windowTriggered ?? false,
		damageCooldown: session.damageCooldown ?? 0,
		glassLoc: session.glassLoc,
		spawnLoc: session.spawnLoc,
		testMode: session.testMode ?? false,
		nightlyRepeat: !!session.nightlyRepeat,
		lastNightlyRollDay: session.lastNightlyRollDay ?? -1,
	});
}

/**
 * @param {string} playerId
 * @param {{
 *   phase: ChasePhase,
 *   verityId?: string,
 *   windowId?: string,
 *   glassLoc?: { x: number, y: number, z: number },
 *   stalkFaceSteps?: number,
 *   spottedSteps?: number,
 *   hideSteps?: number,
 *   windowWaitSteps?: number,
 *   spawnLoc?: { x: number, y: number, z: number },
 *   lookTicks?: number,
 *   windowGraceSteps?: number,
 *   windowTriggered?: boolean,
 *   testMode?: boolean,
 *   damageCooldown?: number,
 * } | undefined} session
 */
function setSession(playerId, session) {
	if (!session) {
		sessions.delete(playerId);
		clearPlayerJson(playerId, PLAYER_SAVE.CHASE);
		return;
	}
	sessions.set(playerId, session);
	persistChaseSession(playerId, session);
}

/**
 * @param {string} playerId
 */
function touchSession(playerId) {
	const session = sessions.get(playerId);
	if (session) persistChaseSession(playerId, session);
}

/**
 * @returns {number}
 */
function getMinecraftDay() {
	return Math.floor(world.getAbsoluteTime() / TICKS_PER_DAY);
}

/**
 * @returns {boolean}
 */
function isChaseNightTime() {
	const time = world.getTimeOfDay();
	return time >= NIGHT_START && time <= NIGHT_END;
}

/**
 * @param {Player} player
 */
function getChaseDoneMeta(player) {
	const session = sessions.get(player.id);
	if (session?.phase === "done") {
		return {
			nightlyRepeat: !!session.nightlyRepeat,
			lastNightlyRollDay: session.lastNightlyRollDay ?? -1,
			testMode: !!session.testMode,
		};
	}
	const data = loadPlayerJson(player.id, PLAYER_SAVE.CHASE);
	if (!data || data.phase !== "done") return null;
	return {
		nightlyRepeat: !!data.nightlyRepeat,
		lastNightlyRollDay: data.lastNightlyRollDay ?? -1,
		testMode: !!data.testMode,
	};
}

/**
 * @param {Player} player
 * @param {{ nightlyRepeat: boolean, lastNightlyRollDay: number, testMode?: boolean }} meta
 */
function saveChaseDoneMeta(player, meta) {
	setSession(player.id, {
		phase: "done",
		nightlyRepeat: meta.nightlyRepeat,
		lastNightlyRollDay: meta.lastNightlyRollDay,
		testMode: meta.testMode ?? false,
	});
}

/**
 * @param {Player} player
 * @param {{ testMode?: boolean } | null | undefined} session
 */
function markChaseDeathComplete(player, session) {
	if (session?.testMode) {
		setSession(player.id, {
			phase: "done",
			testMode: true,
			jumpscarePlayed: true,
		});
		clearChaseBallFace();
		return;
	}
	const today = getMinecraftDay();
	setSession(player.id, {
		phase: "done",
		jumpscarePlayed: true,
		nightlyRepeat: true,
		lastNightlyRollDay: today,
	});
	clearChaseBallFace();
	console.warn(
		`verity chase: death complete — nightly ${NIGHTLY_CHASE_CHANCE * 100}% unlock for ${player.name} (day ${today})`,
	);
}

/**
 * @param {Player} player
 * @returns {boolean}
 */
function tryStartNightlyRepeatChase(player) {
	const meta = getChaseDoneMeta(player);
	if (!meta?.nightlyRepeat || meta.testMode) return false;
	if (getVerityPhase() < PHASE.FOUR) return false;
	if (!isChaseNightTime()) return false;

	const today = getMinecraftDay();
	if (meta.lastNightlyRollDay === today) return false;

	meta.lastNightlyRollDay = today;
	saveChaseDoneMeta(player, meta);

	if (Math.random() >= NIGHTLY_CHASE_CHANCE) {
		console.warn(`verity chase: nightly roll skipped for ${player.name} (day ${today})`);
		return false;
	}

	console.warn(`verity chase: nightly repeat for ${player.name} (day ${today})`);
	setSession(player.id, undefined);
	startChaseSequence(player, false);
	return true;
}

const PASSABLE = new Set([
	"minecraft:air",
	"minecraft:short_grass",
	"minecraft:tall_grass",
	"minecraft:fern",
	"minecraft:large_fern",
	"minecraft:snow_layer",
	"minecraft:vine",
	"minecraft:water",
	"minecraft:flowing_water",
	"minecraft:seagrass",
	"minecraft:tall_seagrass",
]);

/** Block dưới chân Verity — đất, cát, sỏi, đá… không lá/cây */
const CHASE_GROUND = new Set([
	"minecraft:grass_block",
	"minecraft:dirt",
	"minecraft:coarse_dirt",
	"minecraft:rooted_dirt",
	"minecraft:podzol",
	"minecraft:mycelium",
	"minecraft:mud",
	"minecraft:muddy_mangrove_roots",
	"minecraft:clay",
	"minecraft:sand",
	"minecraft:red_sand",
	"minecraft:suspicious_sand",
	"minecraft:suspicious_gravel",
	"minecraft:gravel",
	"minecraft:stone",
	"minecraft:cobblestone",
	"minecraft:mossy_cobblestone",
	"minecraft:deepslate",
	"minecraft:cobbled_deepslate",
	"minecraft:tuff",
	"minecraft:granite",
	"minecraft:diorite",
	"minecraft:andesite",
	"minecraft:calcite",
	"minecraft:dripstone_block",
	"minecraft:sandstone",
	"minecraft:red_sandstone",
	"minecraft:smooth_sandstone",
	"minecraft:smooth_red_sandstone",
	"minecraft:snow_block",
	"minecraft:packed_mud",
	"minecraft:farmland",
	"minecraft:dirt_path",
]);

/**
 * @param {string} typeId
 */
function isChaseGroundBlock(typeId) {
	if (CHASE_GROUND.has(typeId)) return true;
	if (typeId.includes("leaves")) return false;
	if (typeId.endsWith("_log") || typeId.endsWith("_wood")) return false;
	if (PASSABLE.has(typeId)) return false;
	if (typeId.includes("sapling")) return false;
	if (typeId.includes("flower") || typeId.includes("tulip") || typeId.includes("orchid")) {
		return false;
	}
	if (typeId.includes("mushroom") && !typeId.includes("block")) return false;
	if (typeId.includes("vine") || typeId.includes("coral")) return false;
	if (typeId.includes("fence") || typeId.includes("door") || typeId.includes("trapdoor")) {
		return false;
	}
	if (typeId.endsWith("_ore")) return true;
	if (typeId.includes("deepslate")) return true;
	if (typeId.includes("terracotta") || typeId.includes("concrete")) return true;
	return false;
}

const GLASS_IDS = new Set([
	"minecraft:glass",
	"minecraft:glass_pane",
	"minecraft:tinted_glass",
	"minecraft:white_stained_glass",
	"minecraft:black_stained_glass",
	"minecraft:gray_stained_glass",
	"minecraft:light_gray_stained_glass",
	"minecraft:brown_stained_glass",
	"minecraft:red_stained_glass",
	"minecraft:orange_stained_glass",
	"minecraft:yellow_stained_glass",
	"minecraft:lime_stained_glass",
	"minecraft:green_stained_glass",
	"minecraft:cyan_stained_glass",
	"minecraft:light_blue_stained_glass",
	"minecraft:blue_stained_glass",
	"minecraft:purple_stained_glass",
	"minecraft:magenta_stained_glass",
	"minecraft:pink_stained_glass",
	"minecraft:white_stained_glass_pane",
	"minecraft:black_stained_glass_pane",
	"minecraft:gray_stained_glass_pane",
	"minecraft:light_gray_stained_glass_pane",
	"minecraft:brown_stained_glass_pane",
	"minecraft:red_stained_glass_pane",
	"minecraft:orange_stained_glass_pane",
	"minecraft:yellow_stained_glass_pane",
	"minecraft:lime_stained_glass_pane",
	"minecraft:green_stained_glass_pane",
	"minecraft:cyan_stained_glass_pane",
	"minecraft:light_blue_stained_glass_pane",
	"minecraft:blue_stained_glass_pane",
	"minecraft:purple_stained_glass_pane",
	"minecraft:magenta_stained_glass_pane",
	"minecraft:pink_stained_glass_pane",
]);

const FENCE_IDS = new Set([
	"minecraft:oak_fence",
	"minecraft:spruce_fence",
	"minecraft:birch_fence",
	"minecraft:jungle_fence",
	"minecraft:acacia_fence",
	"minecraft:dark_oak_fence",
	"minecraft:mangrove_fence",
	"minecraft:cherry_fence",
	"minecraft:bamboo_fence",
	"minecraft:crimson_fence",
	"minecraft:warped_fence",
	"minecraft:nether_brick_fence",
	"minecraft:oak_fence_gate",
	"minecraft:spruce_fence_gate",
	"minecraft:birch_fence_gate",
	"minecraft:jungle_fence_gate",
	"minecraft:acacia_fence_gate",
	"minecraft:dark_oak_fence_gate",
	"minecraft:mangrove_fence_gate",
	"minecraft:cherry_fence_gate",
	"minecraft:bamboo_fence_gate",
	"minecraft:crimson_fence_gate",
	"minecraft:warped_fence_gate",
]);

/** Kính + fence đều tính là vật liệu cửa sổ */
const WINDOW_MATERIAL_IDS = new Set([...GLASS_IDS, ...FENCE_IDS]);

/** Hàng xóm ngang cùng tầng (bên cạnh) */
const WINDOW_SIDE_OFFSETS = [
	[1, 0, 0],
	[-1, 0, 0],
	[0, 0, 1],
	[0, 0, -1],
];

/**
 * @param {string} typeId
 */
function isWindowMaterial(typeId) {
	return WINDOW_MATERIAL_IDS.has(typeId);
}

/**
 * @param {string} typeId
 */
function isHouseWindowGlass(typeId) {
	return GLASS_IDS.has(typeId);
}

/**
 * @param {string} typeId
 */
function isPassableForIndoor(typeId) {
	return PASSABLE.has(typeId) || typeId === "minecraft:air";
}

/**
 * @param {string} typeId
 */
function isShelterBlock(typeId) {
	if (!typeId || typeId === "minecraft:air") return false;
	if (isPassableForIndoor(typeId)) return false;
	return true;
}

/**
 * @param {string} typeId
 */
function isShelterCeiling(typeId) {
	if (!typeId || typeId === "minecraft:air") return false;
	if (isPassableForIndoor(typeId)) return false;
	if (isHouseWindowGlass(typeId)) return false;
	if (typeId.includes("leaves")) return false;
	return true;
}

/**
 * @param {Player} player
 */
function isPlayerIndoors(player) {
	const dim = player.dimension;
	const x = Math.floor(player.location.x);
	const y = Math.floor(player.location.y);
	const z = Math.floor(player.location.z);

	for (let dy = 1; dy <= INDOOR_CEILING_SCAN; dy++) {
		const block = dim.getBlock({ x, y: y + dy, z });
		if (!block) break;
		if (isShelterCeiling(block.typeId)) return true;
	}
	return false;
}

/**
 * @param {import("@minecraft/server").Dimension} dim
 * @param {number} x
 * @param {number} y
 * @param {number} z
 */
function countGlassSideNeighbors(dim, x, y, z) {
	let count = 0;
	for (const [dx, dy, dz] of WINDOW_SIDE_OFFSETS) {
		const block = dim.getBlock({ x: x + dx, y: y + dy, z: z + dz });
		if (block && isHouseWindowGlass(block.typeId)) count++;
	}
	return count;
}

/**
 * Đếm kính/fence bên cạnh (cùng Y, 4 hướng ngang).
 * @param {import("@minecraft/server").Dimension} dim
 * @param {number} x
 * @param {number} y
 * @param {number} z
 */
function countWindowSideNeighbors(dim, x, y, z) {
	let count = 0;
	for (const [dx, dy, dz] of WINDOW_SIDE_OFFSETS) {
		const block = dim.getBlock({ x: x + dx, y: y + dy, z: z + dz });
		if (block && isWindowMaterial(block.typeId)) count++;
	}
	return count;
}

/**
 * Cần ít nhất 1 block kính/fence bên cạnh (ưu tiên 2+ khi chọn).
 * @param {import("@minecraft/server").Dimension} dim
 * @param {number} x
 * @param {number} y
 * @param {number} z
 */
function isValidWindowAnchor(dim, x, y, z) {
	for (const [dx, dy, dz] of WINDOW_SIDE_OFFSETS) {
		const block = dim.getBlock({ x: x + dx, y: y + dy, z: z + dz });
		if (!block) continue;
		if (isPassableForIndoor(block.typeId)) return true;
		if (isShelterBlock(block.typeId) && !isHouseWindowGlass(block.typeId)) return true;
	}
	return countGlassSideNeighbors(dim, x, y, z) >= 1;
}

const UNBREAKABLE = new Set([
	"minecraft:bedrock",
	"minecraft:barrier",
	"minecraft:command_block",
	"minecraft:chain_command_block",
	"minecraft:repeating_command_block",
]);

/**
 * @param {import("@minecraft/server").Entity} verity
 * @param {number} state
 */
function setVerityAnimState(verity, state) {
	if (!verity?.isValid) return;
	try {
		verity.setProperty("pntmc:chase_state", state);
	} catch (err) {
		console.warn(`verity chase anim state ${state}: ${err}`);
	}
}

/**
 * Player có nhìn thấy Verity (LOS) không.
 * @param {Player} player
 * @param {import("@minecraft/server").Entity} verity
 */
function playerCanSeeVerity(player, verity) {
	if (!verity.isValid) return false;
	return hasLineOfSight(player, verity.location);
}

/**
 * @param {import("@minecraft/server").Entity} verity
 */
function tagChaseVerity(verity) {
	if (!verity?.isValid) return;
	try {
		verity.addTag(CHASE_LIVE_TAG);
	} catch (err) {
		console.warn(`verity chase tag: ${err}`);
	}
}

/**
 * @param {import("@minecraft/server").Entity} entity
 * @param {string} eventId
 */
function triggerChaseLiveEvent(entity, eventId) {
	if (!entity?.isValid) return;
	try {
		entity.runCommand(`event entity @s ${eventId}`);
	} catch (err) {
		console.warn(`verity chase event ${eventId}: ${err}`);
	}
}

/**
 * Gỡ slowness từ verity stalk — transform/spawn hay mang effect sang verity_chase.
 * @param {import("@minecraft/server").Entity} chaseEnt
 */
function activateChaseEntity(chaseEnt) {
	if (!chaseEnt?.isValid) return;
	tagChaseVerity(chaseEnt);
	try {
		chaseEnt.runCommand("effect @s clear slowness");
	} catch (err) {
		console.warn(`verity chase clear slowness: ${err}`);
	}
	triggerChaseLiveEvent(chaseEnt, "pntmc:chase");
}

/**
 * @param {import("@minecraft/server").Entity} verity
 * @param {string} eventId
 */
function triggerVerityEvent(verity, eventId) {
	triggerChaseLiveEvent(verity, eventId);
}

/**
 * @param {import("@minecraft/server").Dimension} dim
 * @param {{ x: number, y: number, z: number }} loc
 * @param {number} [maxDist]
 */
function findChaseEntityNear(dim, loc, maxDist = 4) {
	/** @type {import("@minecraft/server").Entity | null} */
	let best = null;
	let bestDist = maxDist;
	for (const ent of dim.getEntities({
		type: VERITY_CHASE_ID,
		location: loc,
		maxDistance: maxDist,
	})) {
		if (!ent?.isValid) continue;
		const d = Math.hypot(ent.location.x - loc.x, ent.location.z - loc.z);
		if (d <= bestDist) {
			best = ent;
			bestDist = d;
		}
	}
	return best;
}

/**
 * HUD + jumpscare sound khi Verity giết player (chase hoặc window).
 * Dùng playsound @s — vẫn chạy được sau entityDie (giống Boy In The Bath).
 * @param {Player} player
 */
function triggerChaseJumpscare(player) {
	if (!player) return;
	const session = sessions.get(player.id);
	if (session?.jumpscarePlayed) return;
	if (session) {
		session.jumpscarePlayed = true;
		touchSession(player.id);
	}

	stopPlayerChaseMusic(player);
	system.run(() => {
		try {
			player.runCommand("stopsound @s");
		} catch {
			/* ignore */
		}
		let played = false;
		try {
			if (player.isValid) {
				player.playSound(SOUND_JUMPSCARE, { volume: 1, pitch: 1 });
				played = true;
			}
		} catch (err) {
			console.warn(`verity chase jumpscare playSound: ${err}`);
		}
		if (!played) {
			try {
				player.runCommand(`playsound ${SOUND_JUMPSCARE} @s`);
			} catch (err) {
				console.warn(`verity chase jumpscare sound: ${err}`);
			}
		}
		try {
			player.runCommand(`title @s actionbar ${JUMPSCARE_HUD_ACTIONBAR}`);
		} catch (err) {
			console.warn(`verity chase jumpscare hud: ${err}`);
		}
	});
}

/**
 * @param {Player} player
 * @param {import("@minecraft/server").Entity} verity
 */
function onChaseKillPlayer(player, verity) {
	const session = sessions.get(player.id);
	triggerChaseJumpscare(player);
	if (session?.verityId) despawnEntity(session.verityId);
	markChaseDeathComplete(player, session);
}

/**
 * @param {import("@minecraft/server").Vector3} origin
 * @param {Player} player
 */
function hasLineOfSightToPlayer(origin, player) {
	try {
		const head = player.getHeadLocation();
		const dx = head.x - origin.x;
		const dy = head.y - origin.y;
		const dz = head.z - origin.z;
		const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
		const hit = player.dimension.getBlockFromRay(
			origin,
			{ x: dx / len, y: dy / len, z: dz / len },
			{
				maxDistance: len,
				includeLiquidBlocks: false,
				includePassableBlocks: false,
			},
		);
		if (!hit?.block) return true;
		const hx = hit.block.location.x + 0.5;
		const hy = hit.block.location.y + 0.5;
		const hz = hit.block.location.z + 0.5;
		const hitDist = Math.sqrt(
			(hx - origin.x) ** 2 + (hy - origin.y) ** 2 + (hz - origin.z) ** 2,
		);
		return hitDist >= len - 1.5;
	} catch {
		return true;
	}
}

/**
 * @param {Player} player
 * @param {import("@minecraft/server").Entity} verity
 */
function isPlayerHidingFromVerity(player, verity) {
	const eye = {
		x: verity.location.x,
		y: verity.location.y + CHASE_VERITY_EYE_Y,
		z: verity.location.z,
	};
	return !hasLineOfSightToPlayer(eye, player);
}

/**
 * Player và Verity đều không thấy nhau.
 * @param {Player} player
 * @param {import("@minecraft/server").Entity} verity
 */
function hasMutualHide(player, verity) {
	return (
		isPlayerHidingFromVerity(player, verity) &&
		!playerCanSeeVerity(player, verity)
	);
}

/**
 * Đã trốn khỏi chase — trong nhà chỉ cần Verity không nhìn thấy player.
 * @param {Player} player
 * @param {import("@minecraft/server").Entity} verity
 */
function hasEscapedChase(player, verity) {
	if (flatDist(player.location, verity.location) >= ESCAPE_DIST) return true;
	if (isPlayerIndoors(player)) {
		if (isPlayerHidingFromVerity(player, verity)) return true;
		if (flatDist(player.location, verity.location) >= INDOOR_SAFE_DIST) return true;
		return false;
	}
	return hasMutualHide(player, verity);
}

/**
 * @param {import("@minecraft/server").Dimension} dim
 * @param {number} x
 * @param {number} z
 * @param {number} refY
 */
function findGroundY(dim, x, z, refY) {
	for (let dy = 4; dy >= -6; dy--) {
		const y = Math.floor(refY) + dy;
		const below = dim.getBlock({ x: Math.floor(x), y: y - 1, z: Math.floor(z) });
		const feet = dim.getBlock({ x: Math.floor(x), y, z: Math.floor(z) });
		const head = dim.getBlock({ x: Math.floor(x), y: y + 1, z: Math.floor(z) });
		if (!below || !feet || !head) continue;
		if (!isChaseGroundBlock(below.typeId)) continue;
		if (!PASSABLE.has(feet.typeId) || !PASSABLE.has(head.typeId)) continue;
		return y;
	}
	return null;
}

/**
 * @param {import("@minecraft/server").Vector3} a
 * @param {import("@minecraft/server").Vector3} b
 */
function flatDist(a, b) {
	const dx = a.x - b.x;
	const dz = a.z - b.z;
	return Math.sqrt(dx * dx + dz * dz);
}

/**
 * @param {number} x
 * @param {number} z
 */
function hNorm(x, z) {
	const len = Math.hypot(x, z);
	return len < 1e-4 ? { x: 0, z: 1 } : { x: x / len, z: z / len };
}

/**
 * @param {Player} player
 */
function getEye(player) {
	const loc = player.location;
	return { x: loc.x, y: loc.y + 1.62, z: loc.z };
}

/**
 * @param {Player} player
 * @param {{ x: number, y: number, z: number }} target
 */
function hasLineOfSight(player, target) {
	try {
		const head = player.getHeadLocation();
		const dx = target.x - head.x;
		const dy = target.y + 1.4 - head.y;
		const dz = target.z - head.z;
		const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
		const hit = player.dimension.getBlockFromRay(
			head,
			{ x: dx / len, y: dy / len, z: dz / len },
			{
				maxDistance: len,
				includeLiquidBlocks: false,
				includePassableBlocks: false,
			},
		);
		if (!hit?.block) return true;
		const hx = hit.block.location.x + 0.5;
		const hy = hit.block.location.y + 0.5;
		const hz = hit.block.location.z + 0.5;
		const hitDist = Math.sqrt(
			(hx - head.x) ** 2 + (hy - head.y) ** 2 + (hz - head.z) ** 2,
		);
		return hitDist >= len - 1.5;
	} catch {
		return true;
	}
}

/**
 * Vị trí bắt đầu chase — xa player hơn nếu đang đứng quá gần lúc spotted.
 * @param {Player} player
 * @param {import("@minecraft/server").Entity} verity
 */
function findChaseStartLoc(player, verity) {
	const dim = verity.dimension;
	const px = player.location.x;
	const pz = player.location.z;
	const py = player.location.y;
	const vx = verity.location.x;
	const vz = verity.location.z;

	let dir = hNorm(vx - px, vz - pz);
	let dist = flatDist(player.location, verity.location);

	if (dist < 1.5) {
		const view = player.getViewDirection();
		dir = hNorm(-view.x, -view.z);
		dist = 0;
	}

	const targetDist = Math.max(dist, CHASE_START_MIN_DIST);
	const sx = px + dir.x * targetDist;
	const sz = pz + dir.z * targetDist;
	const gy = findGroundY(dim, sx, sz, py);
	if (gy === null) {
		return { x: vx, y: verity.location.y, z: vz };
	}
	return { x: sx, y: gy, z: sz };
}

/**
 * @param {Player} player
 */
function findStalkSpawn(player) {
	const view = player.getViewDirection();
	const horiz = Math.sqrt(view.x * view.x + view.z * view.z) || 1;
	const fx = view.x / horiz;
	const fz = view.z / horiz;
	const rx = -fz;
	const rz = fx;
	const dim = player.dimension;
	const py = player.location.y;

	for (let lane = -8; lane <= 8; lane++) {
		const sx = player.location.x + fx * STALK_DIST + rx * lane * 1.25;
		const sz = player.location.z + fz * STALK_DIST + rz * lane * 1.25;
		const gy = findGroundY(dim, sx, sz, py);
		if (gy === null) continue;
		const pos = { x: sx, y: gy, z: sz };
		if (!hasLineOfSight(player, pos)) continue;
		return pos;
	}

	const fallbackY = findGroundY(
		dim,
		player.location.x + fx * STALK_DIST,
		player.location.z + fz * STALK_DIST,
		py,
	);
	if (fallbackY === null) return null;
	return {
		x: player.location.x + fx * STALK_DIST,
		y: fallbackY,
		z: player.location.z + fz * STALK_DIST,
	};
}

/**
 * Music category — phát global qua Script API (không cần tọa độ).
 * @param {import("@minecraft/server").Dimension} dim
 * @param {string} soundId
 * @param {number} volume
 */
function playMusicForAll(dim, soundId, volume) {
	for (const player of dim.getPlayers()) {
		try {
			player.playSound(soundId, { volume, pitch: 1 });
		} catch (err) {
			console.warn(`verity chase playsound ${soundId}: ${err}`);
		}
	}
}

/**
 * @param {import("@minecraft/server").Dimension} dim
 * @param {string} soundId
 */
function stopMusicForAll(dim, soundId) {
	for (const player of dim.getPlayers()) {
		try {
			player.runCommand(`stopsound @s ${soundId}`);
		} catch {
			/* ignore */
		}
	}
}

/**
 * @param {import("@minecraft/server").Dimension} dim
 */
function stopChaseMusicTracks(dim) {
	for (const soundId of CHASE_MUSIC_IDS) {
		stopMusicForAll(dim, soundId);
	}
}

/**
 * @param {Player} player
 */
function stopPlayerChaseMusic(player) {
	if (!player?.isValid) return;
	for (const soundId of CHASE_MUSIC_IDS) {
		try {
			player.runCommand(`stopsound @s ${soundId}`);
		} catch {
			/* ignore */
		}
	}
	for (const soundId of BALL_AUDIO_IDS) {
		try {
			player.runCommand(`stopsound @s ${soundId}`);
		} catch {
			/* ignore */
		}
	}
}

/**
 * @param {Player} player
 */
function stopChaseAudio(player) {
	stopChaseMusicTracks(player.dimension);
	for (const p of player.dimension.getPlayers()) {
		for (const soundId of BALL_AUDIO_IDS) {
			try {
				p.runCommand(`stopsound @s ${soundId}`);
			} catch {
				/* ignore */
			}
		}
	}
	for (const ball of collectAllVerityballs()) {
		if (ball.dimension.id !== player.dimension.id) continue;
		stopBallMusic(ball);
	}
}

/**
 * @param {import("@minecraft/server").Dimension} dim
 */
function playForestMusic(dim) {
	stopMusicForAll(dim, SOUND_FOREST);
	playMusicForAll(dim, SOUND_FOREST, FOREST_MUSIC_VOLUME);
}

/**
 * @param {import("@minecraft/server").Dimension} dim
 */
function playBonecrackMusic(dim) {
	stopMusicForAll(dim, SOUND_SPOTTED_BONECRACK);
	playMusicForAll(dim, SOUND_SPOTTED_BONECRACK, BONECRACK_MUSIC_VOLUME);
}

/**
 * @param {import("@minecraft/server").Dimension} dim
 */
function playChaseMusic(dim) {
	stopMusicForAll(dim, SOUND_FOREST);
	stopMusicForAll(dim, SOUND_CHASE);
	playMusicForAll(dim, SOUND_CHASE, CHASE_MUSIC_VOLUME);
}

/**
 * @param {ChasePhase} phase
 * @param {import("@minecraft/server").Dimension} dim
 */
function replayChasePhaseMusic(phase, dim) {
	switch (phase) {
		case "stalk":
			playForestMusic(dim);
			break;
		case "spotted":
			playBonecrackMusic(dim);
			break;
		case "chase":
			playChaseMusic(dim);
			break;
	}
}

/**
 * @param {{ musicLoopTick?: number }} session
 */
function markChaseMusicPlayed(session) {
	session.musicLoopTick = system.currentTick;
}

/**
 * @param {Player} player
 * @param {{ phase: ChasePhase, verityId?: string, musicLoopTick?: number }} session
 */
function tickChaseMusicLoop(player, session) {
	if (
		session.phase !== "stalk" &&
		session.phase !== "spotted" &&
		session.phase !== "chase"
	) {
		return;
	}

	const now = system.currentTick;
	if (session.musicLoopTick === undefined) {
		session.musicLoopTick = now;
		return;
	}
	if (now - session.musicLoopTick < CHASE_SOUND_LOOP_TICKS) return;

	session.musicLoopTick = now;

	let dim = player.dimension;
	if (session.verityId) {
		const verity = world.getEntity(session.verityId);
		if (verity?.isValid) dim = verity.dimension;
	}
	replayChasePhaseMusic(session.phase, dim);
}

/**
 * @param {Player} player
 * @param {import("@minecraft/server").Entity} entity
 */
function isFacingEntity(player, entity) {
	const view = player.getViewDirection();
	const eye = getEye(player);
	const tx = entity.location.x;
	const ty = entity.location.y + 1.5;
	const tz = entity.location.z;
	const dx = tx - eye.x;
	const dy = ty - eye.y;
	const dz = tz - eye.z;
	const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
	const dot = (view.x * dx + view.y * dy + view.z * dz) / len;
	return dot >= 0.55;
}

/**
 * Tia nhìn thật của player (getViewDirection) có trúng ô kính cửa sổ không.
 * @param {Player} player
 * @param {{ x: number, y: number, z: number }} glassLoc
 */
function viewRayHitsWindowGlass(player, glassLoc) {
	try {
		const head = player.getHeadLocation();
		const view = player.getViewDirection();
		const hit = player.dimension.getBlockFromRay(head, view, {
			maxDistance: WINDOW_LOOK_DIST,
			includeLiquidBlocks: false,
			includePassableBlocks: true,
		});
		if (!hit?.block || !isHouseWindowGlass(hit.block.typeId)) return false;
		const b = hit.block.location;
		return (
			Math.abs(b.x - glassLoc.x) <= 1 &&
			Math.abs(b.y - glassLoc.y) <= 1 &&
			Math.abs(b.z - glassLoc.z) <= 1
		);
	} catch {
		return false;
	}
}

/**
 * @param {Player} player
 * @param {import("@minecraft/server").Entity} entity
 * @param {{ x: number, y: number, z: number } | undefined} glassLoc
 */
function isAimingAtWindowScare(player, entity, glassLoc) {
	if (!entity?.isValid || !glassLoc) return false;
	if (viewRayHitsWindowGlass(player, glassLoc)) return true;
	if (canSeeGlassBlock(player, glassLoc)) {
		const eye = player.getHeadLocation();
		const gx = glassLoc.x + 0.5;
		const gy = glassLoc.y + 0.5;
		const gz = glassLoc.z + 0.5;
		const dx = gx - eye.x;
		const dy = gy - eye.y;
		const dz = gz - eye.z;
		const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
		if (dist > WINDOW_LOOK_DIST) return false;
		const view = player.getViewDirection();
		const dot = (view.x * dx + view.y * dy + view.z * dz) / dist;
		return dot >= 0.25;
	}
	return false;
}

/**
 * @param {Player} player
 * @param {{ x: number, y: number, z: number }} glassLoc
 */
function isNearWindowGlass(player, glassLoc) {
	const eye = player.getHeadLocation();
	const gx = glassLoc.x + 0.5;
	const gy = glassLoc.y + 0.5;
	const gz = glassLoc.z + 0.5;
	const dx = eye.x - gx;
	const dy = eye.y - gy;
	const dz = eye.z - gz;
	return dx * dx + dy * dy + dz * dz <= WINDOW_LOOK_DIST * WINDOW_LOOK_DIST;
}

/**
 * Eye contact = facing + clear line of sight.
 * @param {Player} player
 * @param {import("@minecraft/server").Entity} entity
 */
function hasEyeContact(player, entity) {
	if (!entity.isValid) return false;
	if (!isFacingEntity(player, entity)) return false;
	return hasLineOfSight(player, entity.location);
}

/**
 * @param {string} entityId
 */
function despawnEntity(entityId) {
	try {
		const ent = world.getEntity(entityId);
		if (!ent?.isValid) return;
		ent.runCommand("event entity @s pntmc:despawn");
	} catch {
		/* ignore */
	}
}

/**
 * @param {Player} player
 */
function cleanupSession(player) {
	const session = sessions.get(player.id);
	if (!session) return;
	if (session.verityId) despawnEntity(session.verityId);
	if (session.windowId) despawnEntity(session.windowId);
	stopChaseAudio(player);
	try { player.runCommand("fog @s remove vo_chase_dread"); } catch { /* optional fog */ }
	clearChaseBallFace();
	setSession(player.id, undefined);
}

/**
 * @param {Player} player
 * @param {boolean} [testMode]
 */
export function startChaseSequence(player, testMode = false) {
	cleanupSession(player);
	// La aparición malvada siempre cambia el ambiente antes de que empiece a moverse.
	try { player.runCommand("fog @s push pntmc:verity_dread vo_chase_dread"); } catch { /* optional fog */ }
	try { player.addEffect("darkness", 220, { amplifier: 0, showParticles: false }); } catch { /* optional darkness */ }

	const spawn = findStalkSpawn(player);
	if (!spawn) {
		console.warn(`verity chase: no spawn for ${player.name}`);
		return false;
	}

	let verity;
	try {
		verity = player.dimension.spawnEntity(VERITY_ID, spawn);
	} catch (err) {
		console.warn(`verity chase spawn: ${err}`);
		return false;
	}

	verity.teleport(spawn, { facingLocation: player.location });
	tagChaseVerity(verity);
	system.run(() => triggerVerityEvent(verity, "pntmc:spawn_idle"));
	setVerityAnimState(verity, ANIM_IDLE);
	// El monstruo aparece: "Ya se acabó tu aventura." con su voz.
	if (!testMode) {
		try {
			world.sendMessage("<§eVerity§r> Ya se acabó tu aventura.");
			playVerityVoice(verity, VOICE.SE_ACABO_AVENTURA);
		} catch (err) {
			console.warn(`verity chase se_acabo: ${err}`);
		}
	}
	system.runTimeout(() => {
		if (!verity.isValid) return;
		playForestMusic(verity.dimension);
		const active = sessions.get(player.id);
		if (active) markChaseMusicPlayed(active);
	}, 2);

	if (!testMode && getVerityPhase() < PHASE.FOUR) {
		enterVerityPhase(PHASE.FOUR);
		console.warn(`verity chase: phase 4 — chase begun for ${player.name}`);
	}

	setChaseBallFace(true);

	setSession(player.id, {
		phase: "stalk",
		verityId: verity.id,
		spawnLoc: { x: spawn.x, y: spawn.y, z: spawn.z },
		stalkFaceSteps: 0,
		spottedSteps: 0,
		hideSteps: 0,
		testMode,
	});
	console.warn(
		`verity chase: stalk spawned for ${player.name} at ${spawn.x.toFixed(1)}, ${spawn.y}, ${spawn.z.toFixed(1)}`,
	);
	return true;
}

/**
 * @param {Player} player
 */
function beginSpotted(player) {
	const session = sessions.get(player.id);
	if (!session?.verityId || session.phase !== "stalk") return;
	const verity = world.getEntity(session.verityId);
	if (!verity?.isValid) return;

	setVerityAnimState(verity, ANIM_SPOTTED);
	playBonecrackMusic(verity.dimension);
	markChaseMusicPlayed(session);
	session.phase = "spotted";
	session.stalkFaceSteps = 0;
	session.spottedSteps = 0;
	session.hideSteps = 0;
	touchSession(player.id);
	console.warn(`verity chase: spotted for ${player.name}`);
}

/**
 * @param {Player} player
 */
function beginChaseRun(player) {
	const session = sessions.get(player.id);
	if (!session?.verityId || session.phase !== "spotted") return;
	const verity = world.getEntity(session.verityId);
	if (!verity?.isValid || verity.typeId !== VERITY_ID) return;

	const chaseSpawn = findChaseStartLoc(player, verity);
	try {
		verity.teleport(chaseSpawn, { facingLocation: player.location });
	} catch (err) {
		console.warn(`verity chase: pre-chase teleport: ${err}`);
	}

	const loc = {
		x: chaseSpawn.x,
		y: chaseSpawn.y,
		z: chaseSpawn.z,
	};
	const dim = verity.dimension;

	playChaseMusic(dim);
	markChaseMusicPlayed(session);
	session.phase = "chase";
	session.spottedSteps = 0;
	session.hideSteps = 0;
	touchSession(player.id);

	triggerVerityEvent(verity, "pntmc:to_chase");
	console.warn(`verity chase: transforming to chase entity for ${player.name}`);

	system.runTimeout(() => {
		const active = sessions.get(player.id);
		if (!active || active.phase !== "chase") return;

		let chaseEnt = findChaseEntityNear(dim, loc);
		if (!chaseEnt) {
			console.warn(`verity chase: transform missed — spawning ${VERITY_CHASE_ID}`);
			try {
				chaseEnt = dim.spawnEntity(VERITY_CHASE_ID, loc);
				chaseEnt.teleport(loc, { facingLocation: player.location });
			} catch (err) {
				console.warn(`verity chase spawn chase entity: ${err}`);
				cleanupSession(player);
				return;
			}
		}

		activateChaseEntity(chaseEnt);
		try {
			chaseEnt.teleport(loc, { facingLocation: player.location });
		} catch {
			/* ignore */
		}
		active.verityId = chaseEnt.id;
		touchSession(player.id);
		console.warn(`verity chase: chase entity active for ${player.name}`);
	}, 2);
}

/**
 * @param {Player} player
 */
function beginEscape(player) {
	const session = sessions.get(player.id);
	if (!session || session.phase !== "chase") return;
	if (session.verityId) despawnEntity(session.verityId);
	session.verityId = undefined;
	stopChaseAudio(player);
	session.hideSteps = 0;
	touchSession(player.id);

	if (!isPlayerIndoors(player)) {
		session.phase = "done";
		clearChaseBallFace();
		touchSession(player.id);
		console.warn(
			`verity chase: escaped outdoors — no window scare for ${player.name}`,
		);
		return;
	}

	console.warn(`verity chase: player escaped indoors — window scare for ${player.name}`);
	tryWindowScare(player);
}

/**
 * @param {Player} player
 * @param {{ x: number, y: number, z: number }} glassLoc
 * @param {{ lookTicks?: number, windowGraceSteps?: number, windowTriggered?: boolean } | null} [preserve]
 */
function spawnWindowOutsideGlass(player, glassLoc, preserve = null) {
	const session = sessions.get(player.id);
	if (!session || session.windowId) return;

	const eye = player.getHeadLocation();
	const gx = glassLoc.x + 0.5;
	const gy = glassLoc.y + 0.5;
	const gz = glassLoc.z + 0.5;
	const out = hNorm(gx - eye.x, gz - eye.z);

	const spawn = {
		x: gx + out.x * WINDOW_SPAWN_OUT,
		y: gy + WINDOW_Y_FROM_GLASS_CENTER,
		z: gz + out.z * WINDOW_SPAWN_OUT,
	};

	let windowEnt;
	try {
		windowEnt = player.dimension.spawnEntity(WINDOW_ID, spawn);
	} catch (err) {
		console.warn(`verity chase window spawn: ${err}`);
		clearChaseBallFace();
		session.phase = "done";
		touchSession(player.id);
		return;
	}

	const yaw = (Math.atan2(-(eye.x - spawn.x), eye.z - spawn.z) * 180) / Math.PI;
	try {
		windowEnt.teleport(spawn, {
			dimension: player.dimension,
			rotation: { x: 0, y: yaw },
		});
	} catch {
		windowEnt.teleport(spawn, { facingLocation: player.location });
	}

	session.windowId = windowEnt.id;
	session.glassLoc = { x: glassLoc.x, y: glassLoc.y, z: glassLoc.z };
	session.lookTicks = preserve?.lookTicks ?? 0;
	session.windowGraceSteps = preserve?.windowGraceSteps ?? 0;
	session.windowTriggered = preserve?.windowTriggered ?? false;
	session.phase = "window";
	touchSession(player.id);
	console.warn(
		`verity chase: window scare at glass ${glassLoc.x},${glassLoc.y},${glassLoc.z} spawn y=${spawn.y.toFixed(2)}`,
	);
}

/**
 * @param {Player} player
 * @param {{ x: number, y: number, z: number }} blockLoc
 */
function canSeeGlassBlock(player, blockLoc) {
	const target = {
		x: blockLoc.x + 0.5,
		y: blockLoc.y + 0.5,
		z: blockLoc.z + 0.5,
	};
	return hasLineOfSight(player, target);
}

/**
 * Find nearest visible glass/fence window around player (inside house scan).
 * Chỉ chọn block có ít nhất 1 kính/fence bên cạnh; ưu tiên block có 2+ hàng xóm.
 * @param {Player} player
 */
function findVisibleGlassNear(player) {
	if (!isPlayerIndoors(player)) return null;

	const dim = player.dimension;
	const eye = player.getHeadLocation();
	const ex = eye.x;
	const ez = eye.z;
	const view = player.getViewDirection();
	const right = hNorm(-view.z, view.x);
	const fy = Math.floor(player.location.y);
	const ly = Math.floor(eye.y);
	const maxH = GLASS_SCAN_RADIUS * GLASS_SCAN_RADIUS;
	/** @type {{ x: number, y: number, z: number, score: number } | null} */
	let best = null;

	for (let x = Math.floor(ex) - GLASS_SCAN_RADIUS; x <= Math.floor(ex) + GLASS_SCAN_RADIUS; x++) {
		for (let y = fy - 2; y <= fy + 5; y++) {
			for (let z = Math.floor(ez) - GLASS_SCAN_RADIUS; z <= Math.floor(ez) + GLASS_SCAN_RADIUS; z++) {
				const block = dim.getBlock({ x, y, z });
				if (!block || !isHouseWindowGlass(block.typeId)) continue;
				if (!isValidWindowAnchor(dim, x, y, z)) continue;
				const h2 = (ex - x - 0.5) ** 2 + (ez - z - 0.5) ** 2;
				if (h2 > maxH) continue;
				const dx = x + 0.5 - eye.x;
				const dz = z + 0.5 - eye.z;
				const sideBonus = dx * right.x + dz * right.z > 0 ? -5 : 0;
				const score = Math.abs(y - ly) * 50 + h2 + sideBonus;
				if (!best || score < best.score) {
					best = { x, y, z, score };
				}
			}
		}
	}
	return best;
}

/**
 * @param {Player} player
 */
function tryWindowScare(player) {
	const session = sessions.get(player.id);
	if (!session) return;

	const glass = findVisibleGlassNear(player);
	if (glass) {
		spawnWindowOutsideGlass(player, glass);
		return;
	}
	console.warn(
		`verity chase: indoors but no window glass found for ${player.name} (indoor=${isPlayerIndoors(player)})`,
	);
	session.phase = "done";
	clearChaseBallFace();
	touchSession(player.id);
	console.warn(
		`verity chase: no valid window (glass/fence + neighbor) — sequence done for ${player.name}`,
	);
}

/**
 * @param {import("@minecraft/server").Dimension} dim
 * @param {{ x: number, y: number, z: number }} glassLoc
 */
/**
 * @param {import("@minecraft/server").Dimension} dim
 * @param {number} x
 * @param {number} y
 * @param {number} z
 */
function destroyGlassBlock(dim, x, y, z) {
	try {
		dim.runCommand(`setblock ${x} ${y} ${z} air destroy`);
	} catch (err) {
		console.warn(`verity chase destroy glass ${x},${y},${z}: ${err}`);
	}
	try {
		dim.runCommand(`kill @e[type=item,x=${x},y=${y},z=${z},r=1.5]`);
	} catch {
		/* ignore */
	}
}

/**
 * @param {import("@minecraft/server").Dimension} dim
 * @param {{ x: number, y: number, z: number }} glassLoc
 */
function breakGlassAround(dim, glassLoc) {
	let broke = 0;
	for (let dx = -1; dx <= 1; dx++) {
		for (let dy = -1; dy <= 1; dy++) {
			for (let dz = -1; dz <= 1; dz++) {
				if (broke >= 4) return;
				const x = glassLoc.x + dx;
				const y = glassLoc.y + dy;
				const z = glassLoc.z + dz;
				const block = dim.getBlock({ x, y, z });
				if (!block || !isWindowMaterial(block.typeId)) continue;
				if (UNBREAKABLE.has(block.typeId)) continue;
				destroyGlassBlock(dim, x, y, z);
				broke++;
			}
		}
	}
}

/**
 * @param {Player} player
 */
function tickWindowPhase(player) {
	const session = sessions.get(player.id);
	if (!session?.windowId || session.phase !== "window") return;
	const windowEnt = world.getEntity(session.windowId);
	if (!windowEnt?.isValid) {
		session.phase = "done";
		clearChaseBallFace();
		touchSession(player.id);
		return;
	}

	if ((session.windowGraceSteps ?? 0) < WINDOW_SPAWN_GRACE) {
		session.windowGraceSteps = (session.windowGraceSteps ?? 0) + 1;
		session.lookTicks = 0;
		session.windowWaitSteps = 0;
		return;
	}

	const glassLoc = session.glassLoc;
	const aiming = isAimingAtWindowScare(player, windowEnt, glassLoc);
	const nearGlass = glassLoc ? isNearWindowGlass(player, glassLoc) : false;

	if (aiming) {
		session.lookTicks = (session.lookTicks ?? 0) + 1;
		session.windowWaitSteps = 0;
	} else if (nearGlass) {
		session.windowWaitSteps = (session.windowWaitSteps ?? 0) + 1;
		session.lookTicks = 0;
	} else {
		session.lookTicks = 0;
		session.windowWaitSteps = 0;
	}

	const autoTrigger =
		nearGlass &&
		(session.windowWaitSteps ?? 0) >= WINDOW_AUTO_TRIGGER_STEPS;
	if (
		session.windowTriggered ||
		(!autoTrigger && session.lookTicks < WINDOW_LOOK_TICKS)
	) {
		return;
	}

	session.windowTriggered = true;
	console.warn(
		`verity chase: window scare triggered (${autoTrigger ? "near glass timeout" : "look at glass"}) for ${player.name}`,
	);
	if (session.glassLoc) {
		breakGlassAround(player.dimension, session.glassLoc);
	}

	try {
		windowEnt.setProperty("pntmc:window_scare", true);
	} catch {
		/* ignore */
	}

	stopPlayerChaseMusic(player);

	system.runTimeout(() => {
		if (session.windowId) despawnEntity(session.windowId);
		session.windowId = undefined;
		markChaseDeathComplete(player, session);
		if (player.isValid) {
			stopPlayerChaseMusic(player);
			try {
				player.kill();
			} catch (err) {
				console.warn(`verity chase kill: ${err}`);
				try {
					player.applyDamage(9999, { cause: EntityDamageCause.override });
				} catch {
					/* ignore */
				}
			}
		}
	}, 80);
}

/**
 * @param {Player} player
 */
function tickStalkPhase(player) {
	const session = sessions.get(player.id);
	if (!session?.verityId) return;
	const verity = world.getEntity(session.verityId);
	if (!verity?.isValid) {
		cleanupSession(player);
		return;
	}

	const dist = flatDist(player.location, verity.location);
	if (
		dist <= SPOTTED_CLOSE_DIST &&
		playerCanSeeVerity(player, verity)
	) {
		beginSpotted(player);
		return;
	}

	if (hasEyeContact(player, verity)) {
		session.stalkFaceSteps = (session.stalkFaceSteps ?? 0) + 1;
		if (session.stalkFaceSteps >= STARE_STEPS) {
			beginSpotted(player);
		}
	} else {
		session.stalkFaceSteps = 0;
	}
}

/**
 * @param {Player} player
 */
function tickSpottedPhase(player) {
	const session = sessions.get(player.id);
	if (!session?.verityId) return;
	const verity = world.getEntity(session.verityId);
	if (!verity?.isValid) {
		cleanupSession(player);
		return;
	}

	session.spottedSteps = (session.spottedSteps ?? 0) + 1;
	if (session.spottedSteps >= SPOTTED_TO_CHASE_STEPS) {
		beginChaseRun(player);
	}
}

/**
 * @param {Player} player
 */
function tickChasePhase(player) {
	const session = sessions.get(player.id);
	if (!session?.verityId) return;
	const verity = world.getEntity(session.verityId);
	if (!verity?.isValid) {
		if (isPlayerIndoors(player) && session.phase === "chase") {
			session.verityId = undefined;
			beginEscape(player);
		} else {
			cleanupSession(player);
		}
		return;
	}

	// Ngoài trời: không bao giờ escape — đuổi mãi. Chỉ trốn trong nhà mới kích window scare.
	if (!isPlayerIndoors(player)) {
		session.hideSteps = 0;
		return;
	}

	const hiding = hasEscapedChase(player, verity);
	if (hiding) {
		session.hideSteps = (session.hideSteps ?? 0) + 1;
		if (session.hideSteps >= INDOOR_HIDE_CONFIRM_STEPS) {
			console.warn(
				`verity chase: escape confirmed (indoor hide ${session.hideSteps}/${INDOOR_HIDE_CONFIRM_STEPS}) for ${player.name}`,
			);
			beginEscape(player);
		}
		return;
	}

	session.hideSteps = 0;
}

/**
 * @param {Player} player
 */
function tickChaseSession(player) {
	const session = sessions.get(player.id);
	if (!session || session.phase === "done") return;

	tickChaseMusicLoop(player, session);

	if (session.phase === "stalk") {
		tickStalkPhase(player);
		return;
	}

	if (session.phase === "spotted") {
		tickSpottedPhase(player);
		return;
	}

	if (session.phase === "chase") {
		tickChasePhase(player);
		return;
	}

	if (session.phase === "window") {
		tickWindowPhase(player);
	}

	touchSession(player.id);
}

/**
 * @param {Player} player
 */
export function tickVerityChase(player) {
	const session = sessions.get(player.id);
	if (session && session.phase !== "done") {
		tickChaseSession(player);
		return;
	}

	if (tryStartNightlyRepeatChase(player)) return;

	if (session?.phase === "done") return;

	if (!shouldBlockSleep()) return;
	startChaseSequence(player, false);
}

/**
 * @param {Player} player
 * @param {string} message
 * @returns {boolean}
 */
export function handleChaseTestChat(player, message) {
	const cmd = message.trim().toLowerCase();
	if (cmd !== "!veritychase" && cmd !== "/veritychase") return false;
	startChaseSequence(player, true);
	return true;
}

/**
 * Khôi phục chase sau khi player vào lại world (entity id không còn hợp lệ).
 * @param {Player} player
 */
export function restoreChaseSession(player) {
	if (sessions.has(player.id)) return;

	const data = loadPlayerJson(player.id, PLAYER_SAVE.CHASE);
	if (!data || typeof data.phase !== "string") return;

	if (data.phase === "done") {
		setSession(player.id, {
			phase: "done",
			testMode: !!data.testMode,
			nightlyRepeat: !!data.nightlyRepeat,
			lastNightlyRollDay: data.lastNightlyRollDay ?? -1,
		});
		return;
	}

	/** @type {{
	 *   phase: ChasePhase,
	 *   verityId?: string,
	 *   windowId?: string,
	 *   glassLoc?: { x: number, y: number, z: number },
	 *   stalkFaceSteps?: number,
	 *   hideSteps?: number,
	 *   lookTicks?: number,
	 *   windowGraceSteps?: number,
	 *   windowTriggered?: boolean,
	 *   testMode?: boolean,
	 *   damageCooldown?: number,
	 * }} */
	const session = {
		phase: data.phase,
		stalkFaceSteps: data.stalkFaceSteps ?? 0,
		spottedSteps: data.spottedSteps ?? 0,
		hideSteps: data.hideSteps ?? 0,
		lookTicks: data.lookTicks ?? 0,
		windowGraceSteps: data.windowGraceSteps ?? 0,
		windowTriggered: !!data.windowTriggered,
		damageCooldown: data.damageCooldown ?? 0,
		glassLoc: data.glassLoc,
		spawnLoc: data.spawnLoc,
		testMode: !!data.testMode,
	};
	setSession(player.id, session);

	if (data.phase !== "done") {
		setChaseBallFace(true);
	}

	if (data.phase === "stalk" || data.phase === "spotted" || data.phase === "chase") {
		const spawn =
			data.spawnLoc ??
			findStalkSpawn(player) ??
			{
				x: player.location.x + STALK_DIST,
				y: player.location.y,
				z: player.location.z,
			};
		try {
			session.spawnLoc = spawn;

			if (data.phase === "chase") {
				const chase = player.dimension.spawnEntity(VERITY_CHASE_ID, spawn);
				chase.teleport(spawn, { facingLocation: player.location });
				session.verityId = chase.id;
				system.run(() => activateChaseEntity(chase));
				playChaseMusic(chase.dimension);
				markChaseMusicPlayed(session);
			} else {
				const verity = player.dimension.spawnEntity(VERITY_ID, spawn);
				verity.teleport(spawn, { facingLocation: player.location });
				tagChaseVerity(verity);
				session.verityId = verity.id;

				if (data.phase === "stalk") {
					system.run(() => triggerVerityEvent(verity, "pntmc:spawn_idle"));
					setVerityAnimState(verity, ANIM_IDLE);
					playForestMusic(verity.dimension);
					markChaseMusicPlayed(session);
				} else {
					system.run(() => triggerVerityEvent(verity, "pntmc:spawn_idle"));
					setVerityAnimState(verity, ANIM_SPOTTED);
					playBonecrackMusic(verity.dimension);
					markChaseMusicPlayed(session);
				}
			}

			touchSession(player.id);
			console.warn(`verity chase restore: ${data.phase} for ${player.name}`);
		} catch (err) {
			console.warn(`verity chase restore spawn: ${err}`);
		}
		return;
	}

	if (data.phase === "window") {
		if (data.windowTriggered) {
			session.phase = "done";
			clearChaseBallFace();
			touchSession(player.id);
			return;
		}
		if (data.glassLoc) {
			spawnWindowOutsideGlass(player, data.glassLoc, {
				lookTicks: data.lookTicks,
				windowGraceSteps: data.windowGraceSteps,
				windowTriggered: data.windowTriggered,
			});
		} else {
			tryWindowScare(player);
		}
		console.warn(`verity chase restore: window for ${player.name}`);
	}
}

/**
 * @param {Player} player
 */
export function resetChaseForPlayer(player) {
	cleanupSession(player);
}

/**
 * @param {string} playerId
 */
export function resetChaseProgress(playerId) {
	const player = [...world.getPlayers()].find((p) => p.id === playerId);
	if (player) {
		cleanupSession(player);
		return;
	}
	setSession(playerId, undefined);
}

export function initVerityChase() {
	world.afterEvents.playerLeave.subscribe((ev) => {
		const session = sessions.get(ev.playerId);
		if (session) persistChaseSession(ev.playerId, session);
		sessions.delete(ev.playerId);
	});

	const spawnEv = world.afterEvents.playerSpawn;
	if (spawnEv) {
		spawnEv.subscribe((ev) => {
			if (!(ev.player instanceof Player)) return;
			system.runTimeout(() => restoreChaseSession(ev.player), 20);
		});
	}

	system.run(() => {
		for (const player of world.getPlayers()) {
			restoreChaseSession(player);
		}
	});

	system.runInterval(() => {
		for (const player of world.getPlayers()) {
			tickVerityChase(player);
		}
	}, 10);

	const dieEv = world.afterEvents.entityDie;
	if (dieEv) {
		dieEv.subscribe((ev) => {
			const dead = ev.deadEntity;
			if (!(dead instanceof Player)) return;
			const session = sessions.get(dead.id);
			if (!session || session.phase !== "chase") return;
			const killer = ev.damageSource?.damagingEntity;
			if (!killer?.isValid || killer.id !== session.verityId) return;
			onChaseKillPlayer(dead, killer);
		});
	}

	const hurtEv = world.afterEvents.entityHurt;
	if (hurtEv) {
		hurtEv.subscribe((ev) => {
			const hurt = ev.hurtEntity;
			if (!(hurt instanceof Player)) return;
			const session = sessions.get(hurt.id);
			if (!session || session.phase !== "chase") return;
			const damager = ev.damageSource?.damagingEntity;
			if (!damager?.isValid || damager.id !== session.verityId) return;
			try {
				const health = hurt.getComponent("minecraft:health");
				if (health && health.currentValue <= 0) {
					triggerChaseJumpscare(hurt);
				}
			} catch {
				/* ignore */
			}
		});
	}

	console.warn("verity chase: idle → spotted → chase (!veritychase to test)");
}
