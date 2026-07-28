import { Player, system, world } from "@minecraft/server";
import { VERITY_INVENTORY_IDS, VERITY_ITEM_TO_FACE } from "./verity_items.js";
import { applyBallFace } from "./verity_phases.js";
import { registerVerityballOwner } from "./verity_resurrection.js";
import { touchHomeActivity } from "./verity_social_state.js";

const VERITYBALL_ID = "pntmc:verityball";
const SCAN_INTERVAL = 10;
const ESCAPE_DELAY_TICKS = 50;
const SCAN_RADIUS = 20;

const STORAGE_BLOCKS = new Set([
	"minecraft:chest",
	"minecraft:trapped_chest",
	"minecraft:barrel",
]);

const PASSABLE = new Set([
	"minecraft:air",
	"minecraft:short_grass",
	"minecraft:tall_grass",
	"minecraft:snow_layer",
	"minecraft:water",
	"minecraft:flowing_water",
]);

/** @type {Set<string>} */
const pendingEscapes = new Set();

/**
 * @param {import("@minecraft/server").Vector3} loc
 * @param {string} dimId
 */
function blockKey(loc, dimId) {
	return `${dimId}:${Math.floor(loc.x)},${Math.floor(loc.y)},${Math.floor(loc.z)}`;
}

/**
 * @param {string} typeId
 */
function isPassableBlock(typeId) {
	return PASSABLE.has(typeId);
}

/**
 * @param {import("@minecraft/server").Dimension} dim
 * @param {import("@minecraft/server").Vector3} loc
 */
function tryClearBlock(dim, loc) {
	try {
		const block = dim.getBlock(loc);
		if (!block) return false;
		if (isPassableBlock(block.typeId)) return true;
		block.setType("minecraft:air");
		return true;
	} catch {
		try {
			dim.runCommand(
				`setblock ${Math.floor(loc.x)} ${Math.floor(loc.y)} ${Math.floor(loc.z)} air`,
			);
			return true;
		} catch (err) {
			console.warn(`verity chest escape clear: ${err}`);
			return false;
		}
	}
}

/**
 * @param {import("@minecraft/server").Dimension} dim
 * @param {import("@minecraft/server").Vector3} chestLoc
 */
function findSpawnNearChest(dim, chestLoc) {
	const cx = Math.floor(chestLoc.x);
	const cy = Math.floor(chestLoc.y);
	const cz = Math.floor(chestLoc.z);

	/** @type {{ x: number, y: number, z: number }[]} */
	const offsets = [
		{ x: 0, z: 0 },
		{ x: 1, z: 0 },
		{ x: -1, z: 0 },
		{ x: 0, z: 1 },
		{ x: 0, z: -1 },
		{ x: 1, z: 1 },
		{ x: -1, z: 1 },
		{ x: 1, z: -1 },
		{ x: -1, z: -1 },
	];

	for (const off of offsets) {
		const feet = { x: cx + off.x, y: cy + 1, z: cz + off.z };
		const head = { x: feet.x, y: feet.y + 1, z: feet.z };

		if (!isPassableBlock(dim.getBlock(feet)?.typeId ?? "minecraft:stone")) {
			tryClearBlock(dim, feet);
		}
		if (!isPassableBlock(dim.getBlock(head)?.typeId ?? "minecraft:stone")) {
			tryClearBlock(dim, head);
		}

		const feetBlock = dim.getBlock(feet);
		const headBlock = dim.getBlock(head);
		if (
			feetBlock &&
			headBlock &&
			isPassableBlock(feetBlock.typeId) &&
			isPassableBlock(headBlock.typeId)
		) {
			return { x: feet.x + 0.5, y: feet.y + 0.35, z: feet.z + 0.5 };
		}
	}

	return { x: cx + 0.5, y: cy + 1.35, z: cz + 0.5 };
}

/**
 * @param {import("@minecraft/server").Dimension} dim
 * @param {import("@minecraft/server").Vector3} loc
 */
function playChestCreak(dim, loc) {
	const center = { x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5 };
	try {
		dim.playSound("random.chestopen", center, { volume: 0.85, pitch: 0.82 });
	} catch (err) {
		console.warn(`verity chest escape sound: ${err}`);
	}
}

/**
 * @param {import("@minecraft/server").Block} block
 */
function getStorageInventory(block) {
	try {
		const inv = block.getComponent("minecraft:inventory");
		return inv?.container ?? null;
	} catch {
		return null;
	}
}

/**
 * @param {import("@minecraft/server").Block} block
 * @param {import("@minecraft/server").Player} player
 */
function scheduleChestEscape(block, player) {
	const key = blockKey(block.location, block.dimension.id);
	if (pendingEscapes.has(key)) return;
	pendingEscapes.add(key);

	const loc = { ...block.location };
	const dim = block.dimension;
	const playerId = player.id;

	system.runTimeout(() => {
		pendingEscapes.delete(key);
		try {
			const live = dim.getBlock(loc);
			if (!live || !STORAGE_BLOCKS.has(live.typeId)) return;

			const container = getStorageInventory(live);
			if (!container) return;

			let slot = -1;
			let itemTypeId = "";
			for (let i = 0; i < container.size; i++) {
				const stack = container.getItem(i);
				if (stack && VERITY_INVENTORY_IDS.has(stack.typeId)) {
					slot = i;
					itemTypeId = stack.typeId;
					break;
				}
			}
			if (slot < 0) return;

			container.setItem(slot, undefined);

			const owner = world.getEntity(playerId);
			if (!(owner instanceof Player) || !owner.isValid) return;

			playChestCreak(dim, loc);
			touchHomeActivity(owner.id);

			const spawn = findSpawnNearChest(dim, loc);
			const faceIndex = VERITY_ITEM_TO_FACE[itemTypeId] ?? 1;
			const ball = dim.spawnEntity(VERITYBALL_ID, spawn);
			applyBallFace(ball, faceIndex, false);
			registerVerityballOwner(ball, owner);

			console.warn(
				`verity chest escape: ${owner.name} — ${itemTypeId} @ ${Math.floor(spawn.x)} ${Math.floor(spawn.y)} ${Math.floor(spawn.z)}`,
			);
		} catch (err) {
			console.warn(`verity chest escape: ${err}`);
		}
	}, ESCAPE_DELAY_TICKS);
}

/**
 * @param {import("@minecraft/server").Player} player
 */
function scanNearPlayer(player) {
	const dim = player.dimension;
	const px = Math.floor(player.location.x);
	const py = Math.floor(player.location.y);
	const pz = Math.floor(player.location.z);

	for (let dx = -SCAN_RADIUS; dx <= SCAN_RADIUS; dx += 2) {
		for (let dy = -4; dy <= 4; dy++) {
			for (let dz = -SCAN_RADIUS; dz <= SCAN_RADIUS; dz += 2) {
				let block;
				try {
					block = dim.getBlock({ x: px + dx, y: py + dy, z: pz + dz });
				} catch {
					continue;
				}
				if (!block || !STORAGE_BLOCKS.has(block.typeId)) continue;

				const container = getStorageInventory(block);
				if (!container) continue;

				for (let i = 0; i < container.size; i++) {
					const stack = container.getItem(i);
					if (stack && VERITY_INVENTORY_IDS.has(stack.typeId)) {
						scheduleChestEscape(block, player);
						return;
					}
				}
			}
		}
	}
}

export function initVerityChestEscape() {
	system.runInterval(() => {
		for (const player of world.getPlayers()) {
			scanNearPlayer(player);
		}
	}, SCAN_INTERVAL);

	console.warn("verity chest escape: storage scan enabled");
}
