/**
 * Ore scan + answers: how-to (Y tips), nearby (relative), precise (XYZ).
 */

/** Cap getBlock calls per ore scan — weak devices crash on huge cubes */
const MAX_ORE_SAMPLES = 360;
const MAX_ORE_RADIUS = 22;
const MAX_ORE_VERTICAL = 18;

/** @type {Record<string, string[]>} */
export const ORE_BLOCK_IDS = {
	diamond: ["minecraft:diamond_ore", "minecraft:deepslate_diamond_ore"],
	iron: ["minecraft:iron_ore", "minecraft:deepslate_iron_ore"],
	gold: ["minecraft:gold_ore", "minecraft:deepslate_gold_ore", "minecraft:nether_gold_ore"],
	copper: ["minecraft:copper_ore", "minecraft:deepslate_copper_ore"],
	lapis: ["minecraft:lapis_ore", "minecraft:deepslate_lapis_ore"],
	redstone: ["minecraft:redstone_ore", "minecraft:deepslate_redstone_ore"],
	coal: ["minecraft:coal_ore", "minecraft:deepslate_coal_ore"],
	emerald: ["minecraft:emerald_ore", "minecraft:deepslate_emerald_ore"],
	ancient_debris: ["minecraft:ancient_debris"],
	quartz: ["minecraft:quartz_ore"],
};

/** @type {Record<string, string[]>} */
const ORE_HOW_TO = {
	diamond: [
		"Los diamantes aman la pizarra profunda. Mina en ramas cerca de Y menos 59. Lleva picos de hierro y antorchas.",
		"Prueba de Y menos 59 a menos 64 en pizarra profunda. Mina en franjas o ramas. La paciencia le gana a la suerte.",
	],
	iron: [
		"El hierro es común cerca de Y 16 y en montañas. Las cuevas a media altura también funcionan muy bien.",
		"Cava cerca de Y 16, o explora cuevas grandes. Te vas a tropezar con el hierro.",
	],
	gold: [
		"El oro del Overworld prefiere las badlands y profundidades cerca de Y menos 16. El oro del Nether cuelga del techo.",
		"Los biomas de badlands son el paraíso del oro. Si no, baja bastante profundo.",
	],
	copper: [
		"El cobre aparece entre la superficie y Y 0. Desde Y 48 hacia abajo es sólido.",
		"Cava entre la superficie y Y 0 para cobre. Las montañas también ayudan.",
	],
	lapis: [
		"El lapislázuli se agrupa cerca de Y 0. Prueba de menos 32 a más 32.",
		"Ve cerca de Y 0 para lapislázuli. Las mesas de encantamiento aman esa cosa.",
	],
	redstone: [
		"La redstone anda por lo bajo. De Y menos 32 a 16 es donde yo cavaría.",
		"Mina bajo para redstone. Las cuevas grandes de pizarra profunda son geniales.",
	],
	coal: [
		"El carbón aparece de Y 0 a 256. Cuevas y montañas son modo fácil.",
		"Cava en cualquier ladera. El carbón es el mineral con el que te tropiezas primero.",
	],
	emerald: [
		"Las esmeraldas aparecen en biomas de montaña desde Y 256 hacia abajo. Las aldeas son más fáciles: comercia.",
		"Mina en picos pedregosos y montañas, o comercia con aldeanos.",
	],
	ancient_debris: [
		"Los restos antiguos abundan cerca de Y 15 en el Nether. Lleva resistencia al fuego.",
		"Haz túneles en el Nether cerca de Y 15. Minar con camas es riesgoso.",
	],
	quartz: [
		"El cuarzo del Nether está por todas partes en el Nether. Cualquier altura funciona.",
		"Camina por el Nether. El cuarzo es común en paredes y techos.",
	],
};

/**
 * @param {string} oreKey
 */
function prettyOreName(oreKey) {
	const names = {
		diamond: "diamond",
		iron: "iron",
		gold: "gold",
		copper: "copper",
		lapis: "lapis",
		redstone: "redstone",
		coal: "coal",
		emerald: "emerald",
		ancient_debris: "ancient debris",
		quartz: "quartz",
	};
	return names[oreKey] ?? oreKey.replace(/_/g, " ");
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {string} oreKey
 * @param {number} [radius]
 * @param {number} [vertical]
 */
export function scanNearestOre(player, oreKey, radius = 22, vertical = 18) {
	const blockIds = ORE_BLOCK_IDS[oreKey];
	if (!blockIds) return null;

	const idSet = new Set(blockIds);
	const dim = player.dimension;
	const loc = player.location;
	const cx = Math.floor(loc.x);
	const cy = Math.floor(loc.y);
	const cz = Math.floor(loc.z);
	const r = Math.min(radius, MAX_ORE_RADIUS);
	const v = Math.min(vertical, MAX_ORE_VERTICAL);
	let step = 2;
	while (step < 8) {
		const nx = Math.floor((2 * r) / step) + 1;
		const ny = Math.floor((2 * v) / step) + 1;
		if (nx * nx * ny <= MAX_ORE_SAMPLES) break;
		step++;
	}

	let best = null;
	let bestDist = Infinity;
	let samples = 0;

	for (let dx = -r; dx <= r; dx += step) {
		for (let dy = -v; dy <= v; dy += step) {
			for (let dz = -r; dz <= r; dz += step) {
				if (samples++ >= MAX_ORE_SAMPLES) {
					return best;
				}
				let block;
				try {
					block = dim.getBlock({ x: cx + dx, y: cy + dy, z: cz + dz });
				} catch {
					continue;
				}
				if (!block || !idSet.has(block.typeId)) continue;

				const dist = dx * dx + dy * dy + dz * dz;
				if (dist < bestDist) {
					bestDist = dist;
					best = { x: cx + dx, y: cy + dy, z: cz + dz };
				}
			}
		}
	}

	return best;
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {{ x: number, y: number, z: number }} target
 */
export function formatOreRelative(player, target) {
	const dx = target.x + 0.5 - player.location.x;
	const dy = target.y + 0.5 - player.location.y;
	const dz = target.z + 0.5 - player.location.z;

	const yawRad = (player.getRotation().y * Math.PI) / 180;
	const fwdX = -Math.sin(yawRad);
	const fwdZ = Math.cos(yawRad);
	const rightX = fwdZ;
	const rightZ = -fwdX;

	const fwd = dx * fwdX + dz * fwdZ;
	const right = dx * rightX + dz * rightZ;
	const horiz = Math.sqrt(dx * dx + dz * dz);

	/** @type {string[]} */
	const parts = [];

	if (Math.abs(dy) >= 3) {
		parts.push(dy > 0 ? "encima de ti" : "debajo de ti");
	} else if (Math.abs(dy) >= 1) {
		parts.push(dy > 0 ? "slightly above" : "slightly below");
	}

	if (horiz >= 2) {
		if (Math.abs(fwd) >= Math.abs(right)) {
			if (Math.abs(fwd) >= 2) {
				parts.push(fwd > 0 ? "frente a ti" : "detrás de ti");
			}
		} else if (Math.abs(right) >= 2) {
			parts.push(right > 0 ? "a tu derecha" : "a tu izquierda");
		}
	}

	if (parts.length === 0) {
		return { text: "justo debajo de ti", blocks: Math.round(horiz) };
	}

	const blocks = Math.round(Math.sqrt(dx * dx + dy * dy + dz * dz));
	return { text: parts.join(", "), blocks };
}

/**
 * @param {string} oreKey
 */
export function getOreHowToAnswer(oreKey) {
	const pool = ORE_HOW_TO[oreKey];
	if (!pool) {
		return `Cava donde ese mineral suele aparecer. Pregúntame por un mineral específico: diamante, hierro, oro, etcétera.`;
	}
	return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {string} oreKey
 * @param {boolean} precise
 */
export function answerOreLocate(player, oreKey, precise = false) {
	const pretty = prettyOreName(oreKey);
	const hit = scanNearestOre(player, oreKey);

	if (!hit) {
		return [
			`No percibo mineral de ${pretty} cargado cerca de ti. Prueba los niveles Y habituales, o cava un poco y pregunta de nuevo.`,
			`No hay mineral de ${pretty} en mi radio de escaneo. Muévete a donde lo esperarías y volveré a mirar.`,
			`Nada de ${pretty} lo bastante cerca. ${getOreHowToAnswer(oreKey)}`,
		][Math.floor(Math.random() * 3)];
	}

	const rel = formatOreRelative(player, hit);
	const fx = Math.floor(hit.x);
	const fy = Math.floor(hit.y);
	const fz = Math.floor(hit.z);

	if (precise) {
		return [
			`Mineral de ${pretty} en X ${fx}, Y ${fy}, Z ${fz}. A unos ${rel.blocks} bloques, ${rel.text}.`,
			`Lo fijé: X ${fx}, Y ${fy}, Z ${fz}. ${rel.text}, a unos ${rel.blocks} bloques.`,
		][Math.floor(Math.random() * 2)];
	}

	return [
		`El mineral de ${pretty} está ${rel.text}, a unos ${rel.blocks} bloques de ti.`,
		`Percibo ${pretty} ${rel.text}. A unos ${rel.blocks} bloques.`,
		`El ${pretty} más cercano se ve ${rel.text}. Unos ${rel.blocks} bloques.`,
	][Math.floor(Math.random() * 3)];
}
