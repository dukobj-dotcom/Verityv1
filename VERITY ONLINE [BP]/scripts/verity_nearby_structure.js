/**
 * Detect structures the player is already inside / standing on (no /locate needed).
 */

/** @type {Record<string, { entities?: string[], blocks?: string[], minEntity?: number, minBlock?: number, radius: number, blockRadius?: number }>} */
const PROXIMITY_RULES = {
	village: {
		entities: [
			"minecraft:villager",
			"minecraft:villager_v2",
			"minecraft:iron_golem",
			"minecraft:wandering_trader",
		],
		blocks: [
			"minecraft:bell",
			"minecraft:lectern",
			"minecraft:composter",
			"minecraft:smithing_table",
			"minecraft:grindstone",
			"minecraft:bed",
			"minecraft:cartography_table",
			"minecraft:fletching_table",
		],
		minEntity: 1,
		minBlock: 1,
		radius: 96,
		blockRadius: 56,
	},
	pillager_outpost: {
		entities: ["minecraft:pillager", "minecraft:vindicator", "minecraft:ravager"],
		blocks: ["minecraft:dark_oak_fence", "minecraft:cobblestone_wall"],
		minEntity: 2,
		minBlock: 4,
		radius: 48,
		blockRadius: 32,
	},
	stronghold: {
		blocks: [
			"minecraft:end_portal_frame",
			"minecraft:infested_stone_bricks",
			"minecraft:infested_mossy_stone_bricks",
			"minecraft:infested_cracked_stone_bricks",
			"minecraft:infested_deepslate",
		],
		minBlock: 1,
		radius: 0,
		blockRadius: 28,
	},
	monument: {
		entities: ["minecraft:guardian", "minecraft:elder_guardian"],
		blocks: [
			"minecraft:prismarine",
			"minecraft:prismarine_bricks",
			"minecraft:dark_prismarine",
			"minecraft:sea_lantern",
		],
		minEntity: 1,
		minBlock: 6,
		radius: 56,
		blockRadius: 36,
	},
	mansion: {
		entities: ["minecraft:evoker", "minecraft:vindicator"],
		blocks: ["minecraft:dark_oak_planks", "minecraft:cobblestone"],
		minEntity: 1,
		minBlock: 12,
		radius: 48,
		blockRadius: 32,
	},
	mineshaft: {
		blocks: ["minecraft:rail", "minecraft:activator_rail", "minecraft:detector_rail"],
		minBlock: 3,
		radius: 0,
		blockRadius: 24,
	},
	shipwreck: {
		blocks: [
			"minecraft:spruce_planks",
			"minecraft:dark_oak_planks",
			"minecraft:trapped_chest",
			"minecraft:stripped_spruce_log",
		],
		minBlock: 4,
		radius: 0,
		blockRadius: 20,
	},
	fortress: {
		entities: ["minecraft:blaze", "minecraft:wither_skeleton", "minecraft:magmacube"],
		blocks: ["minecraft:nether_bricks", "minecraft:nether_brick_fence", "minecraft:nether_wart"],
		minEntity: 1,
		minBlock: 8,
		radius: 48,
		blockRadius: 40,
	},
	desert_pyramid: {
		blocks: [
			"minecraft:chiseled_sandstone",
			"minecraft:cut_sandstone",
			"minecraft:tnt",
			"minecraft:orange_terracotta",
		],
		minBlock: 4,
		radius: 0,
		blockRadius: 28,
	},
	jungle_pyramid: {
		blocks: [
			"minecraft:mossy_cobblestone",
			"minecraft:chiseled_stone_bricks",
			"minecraft:dispenser",
			"minecraft:sticky_piston",
		],
		minBlock: 3,
		radius: 0,
		blockRadius: 28,
	},
	swamp_hut: {
		entities: ["minecraft:witch", "minecraft:cat"],
		blocks: ["minecraft:cauldron", "minecraft:crafting_table"],
		minEntity: 1,
		minBlock: 1,
		radius: 24,
		blockRadius: 16,
	},
	ancient_city: {
		blocks: [
			"minecraft:sculk_shrieker",
			"minecraft:sculk_catalyst",
			"minecraft:reinforced_deepslate",
			"minecraft:candle",
		],
		minBlock: 2,
		radius: 0,
		blockRadius: 40,
	},
	bastion_remnant: {
		entities: ["minecraft:piglin_brute", "minecraft:piglin", "minecraft:hoglin"],
		blocks: [
			"minecraft:polished_blackstone_bricks",
			"minecraft:gilded_blackstone",
			"minecraft:blackstone",
			"minecraft:gold_block",
		],
		minEntity: 2,
		minBlock: 8,
		radius: 40,
		blockRadius: 36,
	},
	end_city: {
		entities: ["minecraft:shulker"],
		blocks: ["minecraft:purpur_block", "minecraft:end_stone_bricks", "minecraft:chorus_plant"],
		minEntity: 1,
		minBlock: 6,
		radius: 48,
		blockRadius: 36,
	},
	ruined_portal: {
		blocks: ["minecraft:crying_obsidian", "minecraft:obsidian", "minecraft:netherrack"],
		minBlock: 4,
		radius: 0,
		blockRadius: 20,
	},
	trial_chambers: {
		blocks: [
			"minecraft:trial_spawner",
			"minecraft:vault",
			"minecraft:waxed_copper_block",
			"minecraft:chiseled_tuff",
		],
		minBlock: 2,
		radius: 0,
		blockRadius: 36,
	},
	trail_ruins: {
		blocks: ["minecraft:suspicious_gravel", "minecraft:suspicious_sand"],
		minBlock: 3,
		radius: 0,
		blockRadius: 24,
	},
	ocean_ruin: {
		blocks: [
			"minecraft:prismarine_bricks",
			"minecraft:mossy_cobblestone",
			"minecraft:gravel",
			"minecraft:sand",
		],
		minBlock: 8,
		radius: 0,
		blockRadius: 28,
	},
	igloo: {
		blocks: ["minecraft:snow_block", "minecraft:white_carpet", "minecraft:red_bed"],
		minBlock: 6,
		radius: 0,
		blockRadius: 16,
	},
};

/** temple umbrella — desert or jungle pyramid */
const TEMPLE_KEYS = new Set(["desert_pyramid", "jungle_pyramid"]);

/**
 * @param {import("@minecraft/server").Player} player
 * @param {string[]} typeIds
 * @param {number} radius
 */
function countEntities(player, typeIds, radius) {
	if (radius <= 0) return 0;
	let count = 0;
	try {
		for (const ent of player.dimension.getEntities({
			location: player.location,
			maxDistance: radius,
		})) {
			if (!ent.isValid) continue;
			if (typeIds.includes(ent.typeId)) count++;
		}
	} catch (err) {
		console.warn(`verity nearby structure entities: ${err}`);
	}
	return count;
}

/** Hard cap getBlock calls per scan — chống crash trên máy yếu */
const MAX_BLOCK_SAMPLES = 600;
/** Bán kính quét block tối đa (block thật) bất kể rule */
const MAX_BLOCK_SCAN_RADIUS = 28;

/**
 * @param {import("@minecraft/server").Player} player
 * @param {Set<string>} blockIds
 * @param {number} radius
 * @param {{ sampleStep?: number, target?: number }} [options]
 */
function countBlocksInRadius(player, blockIds, radius, options = {}) {
	const r = Math.min(radius, MAX_BLOCK_SCAN_RADIUS);
	const target = options.target ?? Infinity;
	// step đủ lớn để tổng mẫu nằm dưới ngân sách MAX_BLOCK_SAMPLES
	let sampleStep = options.sampleStep ?? 4;
	const ySpan = Math.min(r, 6);
	while (sampleStep < 16) {
		const nx = Math.floor((2 * r) / sampleStep) + 1;
		const ny = Math.floor((2 * ySpan) / sampleStep) + 1;
		if (nx * nx * ny <= MAX_BLOCK_SAMPLES) break;
		sampleStep++;
	}

	let count = 0;
	let samples = 0;
	const dim = player.dimension;
	const cx = Math.floor(player.location.x);
	const cy = Math.floor(player.location.y);
	const cz = Math.floor(player.location.z);

	for (let dx = -r; dx <= r; dx += sampleStep) {
		for (let dz = -r; dz <= r; dz += sampleStep) {
			for (let dy = -ySpan; dy <= ySpan; dy += sampleStep) {
				if (samples++ >= MAX_BLOCK_SAMPLES) return count;
				try {
					const block = dim.getBlock({ x: cx + dx, y: cy + dy, z: cz + dz });
					if (block && blockIds.has(block.typeId)) {
						count++;
						if (count >= target) return count;
					}
				} catch {
					/* chunk edge */
				}
			}
		}
	}
	return count;
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {string} key
 */
function scoreStructureProximity(player, key) {
	const rule = PROXIMITY_RULES[key];
	if (!rule) return 0;

	let score = 0;
	if (rule.entities?.length) {
		const ec = countEntities(player, rule.entities, rule.radius);
		if (ec >= (rule.minEntity ?? 1)) score += ec * 3;
	}
	if (rule.blocks?.length) {
		const minBlock = rule.minBlock ?? 1;
		// Dừng ngay khi đủ minBlock — không quét hết khi đang đứng trong công trình.
		const bc = countBlocksInRadius(player, new Set(rule.blocks), rule.blockRadius ?? rule.radius ?? 24, {
			target: minBlock,
		});
		if (bc >= minBlock) score += bc;
	}
	return score;
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {string} [preferredKey]
 * @returns {string | null}
 */
export function detectNearbyStructure(player, preferredKey) {
	if (preferredKey === "temple") {
		const desert = scoreStructureProximity(player, "desert_pyramid");
		const jungle = scoreStructureProximity(player, "jungle_pyramid");
		if (desert >= jungle && desert > 0) return "desert_pyramid";
		if (jungle > 0) return "jungle_pyramid";
		return null;
	}

	// Có key cụ thể → chỉ chấm điểm đúng key đó, KHÔNG quét toàn bộ công trình (tránh crash).
	if (preferredKey) {
		return scoreStructureProximity(player, preferredKey) > 0 ? preferredKey : null;
	}

	/** @type {{ key: string, score: number }[]} */
	const ranked = [];
	for (const key of Object.keys(PROXIMITY_RULES)) {
		const score = scoreStructureProximity(player, key);
		if (score > 0) {
			ranked.push({ key, score });
			break; // máy yếu: lấy công trình đầu tiên phát hiện được
		}
	}
	ranked.sort((a, b) => b.score - a.score);
	return ranked[0]?.key ?? null;
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {string} structureKey
 */
export function isPlayerAtStructure(player, structureKey) {
	return detectNearbyStructure(player, structureKey) === structureKey;
}

/**
 * Maps locate id to proximity rule key.
 * @param {string} structure
 */
export function resolveProximityKey(structure) {
	if (structure === "temple") return "temple";
	if (PROXIMITY_RULES[structure]) return structure;
	if (TEMPLE_KEYS.has(structure)) return structure;
	return structure;
}
