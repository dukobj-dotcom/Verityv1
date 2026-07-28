import { Player } from "@minecraft/server";
import { getOreHowToAnswer } from "./verity_ore_scan.js";
import {
	PLAYER_SAVE,
	loadPlayerJson,
	savePlayerJson,
} from "./verity_persist.js";

/** @typedef {{ structure: string, x: number, z: number, dir: string, blocks: number, precise: boolean }} LocateMemory */
/** @typedef {{ lastQuestion?: string, lastAnswer?: string, lastIntent?: string, lastBiome?: string, lastLocate?: LocateMemory, lastSound?: string, lastStructure?: string }} PlayerContext */

/** @type {Map<string, PlayerContext>} */
const playerContext = new Map();

const STOP_WORDS = new Set([
	"a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
	"do", "does", "did", "have", "has", "had", "will", "would", "could",
	"should", "may", "might", "must", "shall", "can", "to", "of", "in",
	"for", "on", "with", "at", "by", "from", "up", "about", "into", "over",
	"after", "i", "me", "my", "you", "your", "we", "our", "they", "them",
	"it", "its", "this", "that", "these", "those", "please", "thanks", "thank",
	"verity", "hey", "uh", "um", "like", "just", "really", "actually",
]);

/** canonical token → extra tokens injected for matching */
const SYNONYM_EXPAND = {
	village: [
		"town", "settlement", "hamlet", "community", "civilization",
		"trader", "trading", "trade", "emerald", "golem",
		"blacksmith", "cleric", "farmer", "librarian", "butcher",
	],
	stronghold: ["end", "portal", "ender", "eye", "dragon", "silverfish"],
	mansion: ["evoker", "vindicator", "woodland", "illager"],
	monument: ["guardian", "prismarine", "elder", "underwater", "ocean temple"],
	shipwreck: ["wreck", "sunken", "boat", "treasure map"],
	mineshaft: ["mine", "rails", "cobweb", "abandoned mine"],
	ancient_city: ["warden", "sculk", "deep dark", "echo"],
	bastion_remnant: ["piglin", "nether gold", "remnant"],
	pillager_outpost: ["raid", "bad omen", "crossbow"],
	ruined_portal: ["obsidian", "crying obsidian", "broken portal"],
	buried_treasure: ["beach", "sand", "map", "chest"],
	end_city: ["shulker", "elytra", "purpur", "chorus"],
	fortress: ["blaze", "nether fortress", "rod"],
	temple: ["desert temple", "jungle temple", "pyramid", "trap"],
	trail_ruins: ["archaeology", "brush", "pottery", "sherd"],
	trial_chambers: ["trial", "breeze", "ominous", "vault"],
	cow: ["moo", "milk"],
	chicken: ["cluck", "egg", "poultry"],
	pig: ["oink", "pork"],
	sheep: ["baa", "wool"],
	cat: ["meow", "kitten"],
	dog: ["woof", "puppy"],
	wolf: ["woof", "pack"],
	creeper: ["ssss", "explode"],
	zombie: ["undead", "rotten"],
	skeleton: ["bones", "arrow", "bow"],
	biome: ["ecosystem", "environment", "terrain", "landscape", "climate"],
	diamond: ["deepest", "best layer"],
	iron: ["underground"],
	lava: ["danger", "burn"],
};

const TYPO_FIX = {
	vilage: "village",
	villiage: "village",
	strongholds: "stronghold",
	monuments: "monument",
	shipwrecks: "shipwreck",
	mineshafts: "mineshaft",
	coords: "coordinates",
	coodinates: "coordinates",
	coordinats: "coordinates",
	biomee: "biome",
	whre: "where",
	wher: "where",
	fnd: "find",
	locat: "locate",
};

export const LOCATE_SEEKING =
	/\b(where|find|locate|nearest|closest|nearby|around here|any|search|look(ing)? for|how (do|can|should) i (get|reach|find)|direction|way to|lead me|point me|track down|get to|go to|headed for|path to|know (of )?any|got any|help me find|trying to find|show me|take me|guide me|which way|what direction)\b/;

export const STRUCTURE_ALIASES = {
	"desert temple": "desert_pyramid",
	"desert pyramid": "desert_pyramid",
	"jungle temple": "jungle_pyramid",
	"jungle pyramid": "jungle_pyramid",
	"witch hut": "swamp_hut",
	"swamp hut": "swamp_hut",
	"ocean ruin": "ocean_ruin",
	"ocean ruins": "ocean_ruin",
	"nether fossil": "nether_fossil",
	village: "village",
	stronghold: "stronghold",
	"strong hold": "stronghold",
	mansion: "mansion",
	"woodland mansion": "mansion",
	monument: "monument",
	"ocean monument": "monument",
	shipwreck: "shipwreck",
	mineshaft: "mineshaft",
	"ancient city": "ancient_city",
	bastion: "bastion_remnant",
	"pillager outpost": "pillager_outpost",
	outpost: "pillager_outpost",
	"ruined portal": "ruined_portal",
	"buried treasure": "buried_treasure",
	"end city": "end_city",
	fortress: "fortress",
	"nether fortress": "fortress",
	temple: "temple",
	igloo: "igloo",
	"trail ruins": "trail_ruins",
	"trial chambers": "trial_chambers",
	"place to trade": "village",
	"trading post": "village",
	"npc town": "village",
	"npc village": "village",
	"where people live": "village",
	"houses with villagers": "village",
	"underwater temple": "monument",
	"guardian temple": "monument",
	"big underwater building": "monument",
	"wood castle": "mansion",
	"evil woodland house": "mansion",
	"portal room": "stronghold",
	"end portal room": "stronghold",
	"eye of ender place": "stronghold",
	"broken nether portal": "ruined_portal",
	"cracked portal": "ruined_portal",
	"witch house": "swamp_hut",
	"sand temple": "desert_pyramid",
	"sand pyramid": "desert_pyramid",
	"jungle temple ruins": "jungle_pyramid",
	"abandoned mine": "mineshaft",
	"abandoned mines": "mineshaft",
	"cave rails": "mineshaft",
	"pirate ship": "shipwreck",
	"sunken ship": "shipwreck",
	"ship wreck": "shipwreck",
	"piglin castle": "bastion_remnant",
	"piglin base": "bastion_remnant",
	"deep dark city": "ancient_city",
	"sculk city": "ancient_city",
	"shulker city": "end_city",
	"floating end city": "end_city",
	"buried chest": "buried_treasure",
	"treasure chest beach": "buried_treasure",
	"snow hut": "igloo",
	"archeology site": "trail_ruins",
	"suspicious gravel site": "trail_ruins",
	"trial dungeon": "trial_chambers",
	"breeze dungeon": "trial_chambers",
	"underwater ruins": "ocean_ruin",
	"sunken ruins": "ocean_ruin",
	"raid tower": "pillager_outpost",
	"crossbow tower": "pillager_outpost",
	"nether castle": "fortress",
	"blaze spawner place": "fortress",
};

/** @type {Record<string, RegExp[]>} */
export const STRUCTURE_INTENT_HINTS = {
	village: [
		/\btrading\b/,
		/\btrade(s|rs?)?\b/,
		/\bmerchant(s)?\b/,
		/\biron golems?\b/,
		/\bemerald(s)?\b/,
		/\b(blacksmith|cleric|farmer|librarian|butcher|cartographer|fletcher|armorer|weaponsmith)\b/,
		/\b(settlement|town|hamlet|civilization|community)\b/,
		/\bwhere\b.*\b(people|humans?|someone|folk|npcs?)\b/,
		/\b(people|humans?|someone|folk|npcs?)\b.*\b(live|living|near|around|close)\b/,
		/\b(need|want|looking for)\b.*\b(trade|trades|emeralds?|villagers?|food|books)\b/,
		/\b(safe place|somewhere safe|friendly)\b/,
		/\b(beds?|doors?)\b.*\b(find|loot|steal|many)\b/,
		/\b(raid proof|iron farm|trading hall)\b/,
		/\b(houses?|homes?|huts?)\b.*\b(near|around|here)\b/,
		/\b(place|spot)\b.*\b(trade|trading|villagers?)\b/,
		/\bwhere\b.*\b(trade|trading|emeralds?)\b/,
	],
	stronghold: [
		/\bstronghold(s)?\b/,
		/\bend portal\b/,
		/\beyes? of ender\b/,
		/\bender dragon\b/,
		/\b(fight|beat|kill)\b.*\bdragon\b/,
		/\bgo to the end\b/,
		/\benter the end\b/,
	],
	mansion: [
		/\bwoodland mansion\b/,
		/\bmansion(s)?\b/,
		/\b(evoker|vindicator)s?\b/,
		/\billager(s)?\b.*\b(mansion|woods|dark forest)\b/,
		/\btotem of undying\b/,
	],
	monument: [
		/\bocean monument\b/,
		/\b(prismarine|guardians?|elder guardian|sponge)\b/,
		/\b(underwater|sea) temple\b/,
	],
	shipwreck: [/\bshipwreck(s)?\b/, /\b(sunken|wrecked) ship\b/, /\btreasure map\b/],
	mineshaft: [/\bmineshaft(s)?\b/, /\b(abandoned )?mine\b/, /\brail(s)? in a cave\b/],
	ancient_city: [/\bancient cit(y|ies)\b/, /\bward(en)?\b/, /\bsculk (shrieker|sensor|city)\b/],
	bastion_remnant: [/\bbastion(s)?\b/, /\bpiglin (brute|bastion)\b/, /\bnether gold\b/],
	pillager_outpost: [/\bpillager(s)?\b/, /\boutpost(s)?\b/, /\b(bad omen|raid tower|crossbow tower)\b/],
	ruined_portal: [/\bruined portal(s)?\b/, /\bbroken portal\b/, /\bcrying obsidian\b/],
	buried_treasure: [/\bburied treasure\b/, /\bbeach (treasure|chest)\b/],
	end_city: [/\bend cit(y|ies)\b/, /\bshulker(s)?\b/, /\belytra\b/, /\bpurpur\b/],
	fortress: [/\bnether fortress\b/, /\bblaze (rod|spawner|farm)\b/, /\bnether wart\b.*\bfortress\b/],
	temple: [
		/\b(desert|jungle) temple\b/,
		/\bpyramid\b/,
		/\b(temple|shrine)\b.*\b(loot|trap|dispenser)\b/,
	],
	trail_ruins: [/\btrail ruins\b/, /\barcheolog(y|ist|y site)\b/, /\bbrush\b.*\bruins\b/],
	trial_chambers: [/\btrial chambers?\b/, /\bbreeze(s)?\b/, /\b(trial|ominous) (key|spawner)\b/],
	desert_pyramid: [/\bdesert (temple|pyramid)\b/, /\bsand pyramid\b/],
	jungle_pyramid: [/\bjungle (temple|pyramid)\b/, /\bovergrown temple\b/],
	swamp_hut: [/\b(witch|swamp) hut\b/, /\bwitch house\b/],
	igloo: [/\bigloo(s)?\b/, /\bsnow house\b/],
	ocean_ruin: [/\bocean ruins?\b/, /\bunderwater ruins?\b/],
	nether_fossil: [/\bnether fossil(s)?\b/],
};

/** Sound event id map. */
export const SOUND_ALIASES = {
	cow: "mob.cow.hurt",
	chicken: "mob.chicken.say",
	pig: "mob.pig.say",
	sheep: "mob.sheep.say",
	cat: "mob.cat.meow",
	dog: "mob.wolf.bark",
	wolf: "mob.wolf.bark",
	villager: "mob.villager.haggle",
	creeper: "mob.creeper.say",
	zombie: "mob.zombie.say",
	skeleton: "mob.skeleton.say",
	spider: "mob.spider.say",
	enderman: "mob.endermen.stare",
	ghast: "mob.ghast.affectionate_scream",
	warden: "mob.warden.emerge",
	bee: "mob.bee.loop",
	fox: "mob.fox.spit",
	horse: "mob.horse.angry",
	rabbit: "mob.rabbit.hurt",
	panda: "mob.panda.bite",
	dolphin: "mob.dolphin.blowhole",
	turtle: "mob.turtle.hurt",
	parrot: "mob.parrot.imitate",
	llama: "mob.llama.angry",
	goat: "mob.goat.screaming",
	frog: "mob.frog.ambient",
	axolotl: "mob.axolotl.idle",
	door: "random.door_open",
	chest: "random.chestopen",
	anvil: "random.anvil_use",
	bell: "block.bell.hit",
	explosion: "random.explode",
	thunder: "ambient.weather.thunder",
	rain: "ambient.weather.rain",
	portal: "block.portal.travel",
	enchant: "random.levelup",
};

export const MYGAL_NORMAL_SOUND = "pntmc.verity.mygal_normal";
export const MATRIX_SONG_SOUND = "pntmc.verity.matrixsong";

const ONOMATOPOEIA_MOB = {
	moo: "cow",
	meow: "cat",
	bark: "dog",
	oink: "pig",
	baa: "sheep",
};

/**
 * @param {string} message
 */
export function wantsSoundRequest(message) {
	const n = expandMessage(normalizeQuestion(message));
	if (
		/\b(sound|sounds|play|hear|make|imitate|noise|let me hear|what does a|go like a)\b/.test(
			n,
		)
	) {
		return true;
	}
	if (/\b(moo|meow|bark|oink|baa)\b/.test(n)) return true;
	if (
		/\b(cow|villager|pig|sheep|chicken|cat|dog|wolf|zombie|skeleton|creeper|spider|bee|fox|horse|goat|frog|axolotl|warden|ghast|enderman|llama|panda|dolphin|turtle|parrot)\b/.test(
			n,
		) &&
		/\b(sound|sounds|noise|say|moo|meow|bark|oink|baa)\b/.test(n)
	) {
		return true;
	}
	return false;
}

/**
 * @param {string} message
 */
export function wantsAnotherSong(message) {
	const n = expandMessage(normalizeQuestion(message));
	return (
		/\b(another|different|other|new|change|switch|something else|next)\b/.test(n) &&
		/\b(song|music|tune|track|melody)\b/.test(n)
	);
}

/**
 * @param {string} message
 */
export function wantsPlaySong(message) {
	const n = expandMessage(normalizeQuestion(message));
	return (
		/\b(play a song|play music|play something|put on music|sing something)\b/.test(n) ||
		(/\b(song|music|mygal|melody|tune|beat)\b/.test(n) &&
			/\b(play|bored|something|need|want|listen|chill)\b/.test(n)) ||
		/\b(i am bored|im bored|bored play)\b/.test(n) ||
		wantsAnotherSong(message)
	);
}

/**
 * @param {string} message
 * @param {string | undefined} lastSongId
 */
export function resolvePlaySongSound(message, lastSongId) {
	if (wantsAnotherSong(message)) {
		return lastSongId === MATRIX_SONG_SOUND ? MYGAL_NORMAL_SOUND : MATRIX_SONG_SOUND;
	}
	return MYGAL_NORMAL_SOUND;
}

/**
 * @param {string} message
 */
export function findSoundKey(message) {
	const n = expandMessage(normalizeQuestion(message));
	const wantsSound = wantsSoundRequest(message);

	if (wantsSound && /\bvillagers?\b/.test(n)) {
		return SOUND_ALIASES.villager;
	}

	for (const [onom, mob] of Object.entries(ONOMATOPOEIA_MOB)) {
		if (n.includes(onom) && wantsSound) {
			const id = SOUND_ALIASES[mob];
			if (id) return id;
		}
	}

	const sorted = Object.keys(SOUND_ALIASES).sort((a, b) => b.length - a.length);
	for (const key of sorted) {
		if (!n.includes(key)) continue;
		if (wantsSound) return SOUND_ALIASES[key];
		if (["moo", "meow", "bark", "oink", "baa"].some((o) => n.includes(o))) {
			return SOUND_ALIASES[key];
		}
	}

	return null;
}

const ORE_TIPS = [
	{
		pattern: /\b(diamond|diamonds)\b/,
		replies: [
			"A los diamantes les encanta la piedra profunda. Prueba cerca de Y menos 59. Mina en ramas a ese nivel.",
			"Para diamantes, baja profundo. Aproximadamente Y menos 59. Lleva picos de hierro y antorchas.",
		],
	},
	{
		pattern: /\b(ancient debris|netherite)\b/,
		replies: [
			"Los restos antiguos aparecen mejor cerca de Y 15 en el Nether. Lleva resistencia al fuego.",
			"El fragmento de netherita vive cerca de Y 15 en el Nether. Minar con camas es riesgoso, así que excava con cuidado.",
		],
	},
	{
		pattern: /\b(iron|iron ore)\b/,
		replies: [
			"El hierro es común cerca de Y 16 y en montañas. Una buena cueva a media altura también funciona.",
			"Prueba Y 16 para hierro, o explora cuevas grandes. Te lo vas a tropezar.",
		],
	},
	{
		pattern: /\b(gold|gold ore)\b/,
		replies: [
			"El oro del Overworld prefiere las badlands y profundidades cerca de Y menos 16. En el Nether está por todas partes en el techo.",
			"Los biomas de badlands son el paraíso del oro. Si no, baja bastante profundo.",
		],
	},
	{
		pattern: /\b(copper|copper ore)\b/,
		replies: [
			"El cobre aparece en alturas normales del Overworld. De Y 48 hasta 0 es un rango sólido.",
			"Cava entre la superficie y Y 0 para cobre. Las montañas también ayudan.",
		],
	},
	{
		pattern: /\b(lapis|lapis lazuli)\b/,
		replies: [
			"El lapislázuli se agrupa cerca de Y 0. Entre menos 32 y 32 es el punto ideal.",
			"Ve cerca de Y 0 para lapislázuli. Las mesas de encantamiento aman esa cosa.",
		],
	},
	{
		pattern: /\b(redstone)\b/,
		replies: [
			"La redstone anda por lo bajo. De Y menos 32 a 16 es donde yo cavaría.",
			"Mina bajo para redstone. Las cuevas grandes a nivel de pizarra profunda son geniales.",
		],
	},
	{
		pattern: /\b(emerald|emeralds)\b/,
		replies: [
			"Las esmeraldas vienen de aldeanos y biomas de montaña. Las aldeas suelen ser más fáciles.",
			"Comercia con aldeanos, o mina en montañas y picos pedregosos si te gusta sufrir.",
		],
	},
	{
		pattern: /\b(coal|charcoal)\b/,
		replies: [
			"El carbón aparece por todas partes de Y 0 a 256. Cuevas y montañas son modo fácil.",
			"Cava en cualquier ladera. El carbón es el mineral con el que te tropiezas primero.",
		],
	},
	{
		pattern: /\b(deepslate|tuff)\b/,
		replies: [
			"La pizarra profunda empieza bajo Y 0. Los minerales ahí son más duros, pero los diamantes aman esa capa.",
			"Bajo Y 0 la piedra se vuelve pizarra profunda. Lleva buenos picos.",
		],
	},
];

/**
 * @param {string} message
 */
export function normalizeQuestion(message) {
	let s = message.toLowerCase();
	s = s
		// Spanish is normalized into the same intent vocabulary as English.
		.replace(/\b(d[oó]nde|ad[oó]nde)\b/g, " where ")
		.replace(/\b(coordenadas?|coord(?:enadas)?|posici[oó]n)\b/g, " coords ")
		.replace(/\b(exactas?|precisas?|exactamente)\b/g, " exact ")
		.replace(/\b(mineral(?:es)?|mena)\b/g, " ore ")
		.replace(/\b(diamantes?)\b/g, " diamond ")
		.replace(/\b(hierro)\b/g, " iron ")
		.replace(/\b(oro)\b/g, " gold ")
		.replace(/\b(carb[oó]n)\b/g, " coal ")
		.replace(/\b(cobre)\b/g, " copper ")
		.replace(/\b(esmeraldas?)\b/g, " emerald ")
		.replace(/\b(redstone)\b/g, " redstone ")
		.replace(/\b(lapis|lapisl[aá]zuli)\b/g, " lapis ")
		.replace(/\b(reproduce|reproducir|pon|toca|escucha|imita)\b/g, " play ")
		.replace(/\b(sonidos?|ruidos?)\b/g, " sound ")
		.replace(/\b(m[uú]sica|canci[oó]n|canciones)\b/g, " music song ")
		.replace(/\b(aburrido|aburrida|me aburro)\b/g, " bored ")
		.replace(/\b(vaca)\b/g, " cow ")
		.replace(/\b(cerdo)\b/g, " pig ")
		.replace(/\b(oveja)\b/g, " sheep ")
		.replace(/\b(gato)\b/g, " cat ")
		.replace(/\b(perro)\b/g, " dog ")
		.replace(/\b(gallina|pollo)\b/g, " chicken ")
		.replace(/\b(lobo)\b/g, " wolf ")
		.replace(/\b(aldea)\b/g, " village ")
		.replace(/c[oô]ng\s*tr[iì]nh/g, " structure ")
		.replace(/\bl[àa]ng\b/g, " village ")
		.replace(/t[iì]m(\s*kiếm|\s*kiem)?/g, " find ")
		.replace(/(ở\s*)?đâu/g, " where ")
		.replace(/\bgần(\s*đây)?\b/g, " nearby ")
		.replace(/\bcho\s*tôi\b/g, " find ");
	return s
		.replace(/[^a-z0-9\s]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * @param {string} n
 */
function fixTypos(n) {
	let out = ` ${n} `;
	for (const [typo, fix] of Object.entries(TYPO_FIX)) {
		out = out.replaceAll(` ${typo} `, ` ${fix} `);
	}
	return out.trim();
}

/**
 * @param {string} n
 */
export function expandMessage(n) {
	let expanded = fixTypos(n);

	for (const [canonical, syns] of Object.entries(SYNONYM_EXPAND)) {
		for (const syn of syns) {
			if (expanded.includes(syn)) {
				expanded += ` ${canonical}`;
			}
		}
	}

	return expanded.replace(/\s+/g, " ").trim();
}

/**
 * @param {string} n
 */
export function tokenize(n) {
	return expandMessage(n)
		.split(" ")
		.filter((w) => w && !STOP_WORDS.has(w));
}

/** @type {{ raw: string, norm: string, expanded: string, tokens: string[] } | null} */
let messageContext = null;

/**
 * Cache normalize/expand/tokenize once per chat message (hot path).
 * @param {string} message
 */
export function beginMessageContext(message) {
	const raw = String(message ?? "").trim();
	const norm = normalizeQuestion(raw);
	const expanded = expandMessage(norm);
	messageContext = { raw, norm, expanded, tokens: tokenize(expanded) };
}

export function endMessageContext() {
	messageContext = null;
}

/**
 * @param {string} message
 */
export function getMessageExpanded(message) {
	const raw = String(message ?? "").trim();
	if (messageContext && messageContext.raw === raw) return messageContext.expanded;
	return expandMessage(normalizeQuestion(raw));
}

/**
 * @param {string} message
 * @returns {string[]}
 */
export function getMessageTokens(message) {
	const raw = String(message ?? "").trim();
	if (messageContext && messageContext.raw === raw) return messageContext.tokens;
	return tokenize(expandMessage(normalizeQuestion(raw)));
}

/**
 * @param {string} playerId
 */
export function getPlayerContext(playerId) {
	let ctx = playerContext.get(playerId);
	if (!ctx) {
		const saved = loadPlayerJson(playerId, PLAYER_SAVE.CONTEXT);
		ctx = saved && typeof saved === "object" ? saved : {};
		playerContext.set(playerId, ctx);
	}
	return ctx;
}

/**
 * @param {string} playerId
 * @param {Partial<PlayerContext>} patch
 */
export function updatePlayerContext(playerId, patch) {
	const ctx = getPlayerContext(playerId);
	Object.assign(ctx, patch);
	playerContext.set(playerId, ctx);
	savePlayerJson(playerId, PLAYER_SAVE.CONTEXT, ctx);
}

/**
 * @param {string} playerId
 */
export function clearPlayerContext(playerId) {
	playerContext.delete(playerId);
}

/**
 * @param {string} message
 */
export function wantsPreciseLocate(message) {
	return /\b(exact|precise|coordinate|coords|xyz|numbers|position|pinpoint)\b/i.test(
		message,
	);
}

/**
 * @param {string} message
 */
export function looksLikeQuestion(message) {
	const n = normalizeQuestion(message);
	if (/[?？]/.test(message)) return true;
	if (
		/^(what|where|when|who|why|how|which|can|could|should|is|are|am|do|does|did|will|would|tell|show|help|find|locate|play|give|let)\b/.test(
			n,
		)
	) {
		return true;
	}
	if (
		/\b(need|want|looking for|searching for|trying to find|help me find|know any|got any|wondering|curious|thinking about|planning to)\b/.test(
			n,
		)
	) {
		return true;
	}
	return n.split(" ").filter(Boolean).length >= 4;
}

/**
 * @param {string} n
 */
function scoreStructureIntents(n) {
	/** @type {Map<string, number>} */
	const scores = new Map();

	for (const [structure, patterns] of Object.entries(STRUCTURE_INTENT_HINTS)) {
		for (const pattern of patterns) {
			if (pattern.test(n)) {
				scores.set(structure, (scores.get(structure) ?? 0) + 1);
			}
		}
	}

	for (const [alias, structure] of Object.entries(STRUCTURE_ALIASES)) {
		if (n.includes(normalizeQuestion(alias))) {
			scores.set(structure, (scores.get(structure) ?? 0) + 3);
		}
	}

	return scores;
}

/**
 * @param {Map<string, number>} scores
 */
function pickBest(scores) {
	let best = "";
	let bestScore = 0;
	for (const [key, score] of scores) {
		if (score > bestScore) {
			bestScore = score;
			best = key;
		}
	}
	return bestScore > 0 ? { key: best, score: bestScore } : null;
}

/**
 * @param {string} n
 */
function isProximityQuestion(n) {
	return (
		/\b(here|this area|around me|around here|near me|right here|right now|where i am|at my location|close by|standing in|in this)\b/.test(
			n,
		) ||
		/\b(is this|am i in|are we in|is that a|this a|are we at)\b/.test(n) ||
		/\b(is there|are there|any|got)\b.*\b(near|here|around|close)\b/.test(n)
	);
}

/**
 * @param {string} n
 * @param {number} score
 */
function shouldLocateStructure(n, score) {
	if (wantsSoundRequest(n)) return false;
	if (/\b(don t|dont|not|without|never|no)\b.*\b(village|stronghold|mansion|structure)\b/.test(n)) {
		return false;
	}
	if (isProximityQuestion(n) && score >= 1) return true;
	if (score >= 2) return true;
	if (LOCATE_SEEKING.test(n) && score >= 1) return true;
	if (score >= 1 && looksLikeQuestion(n)) return true;
	return false;
}

/**
 * @param {string} n
 */
function isVillagerSoundNotVillage(n) {
	return (
		/\bvillagers?\b/.test(n) &&
		!/\b(village|town|settlement|hamlet|trading hall|locate|find|where|nearest)\b/.test(n)
	);
}

/**
 * @param {string} message
 */
export function findStructureKey(message) {
	const n = getMessageExpanded(message);

	if (wantsSoundRequest(message) && isVillagerSoundNotVillage(n)) {
		return null;
	}

	let bestAlias = null;
	let bestLen = 0;
	for (const [alias, structure] of Object.entries(STRUCTURE_ALIASES)) {
		const norm = normalizeQuestion(alias);
		if (n.includes(norm) && norm.length > bestLen && shouldLocateStructure(n, 3)) {
			bestAlias = structure;
			bestLen = norm.length;
		}
	}
	if (bestAlias) return bestAlias;

	const best = pickBest(scoreStructureIntents(n));
	if (best && shouldLocateStructure(n, best.score)) {
		if (best.key === "village" && isVillagerSoundNotVillage(n)) return null;
		return best.key;
	}

	if (
		LOCATE_SEEKING.test(n) &&
		/\b(people|humans?|someone|houses?|homes?|huts?|settlement|trade|trades|civilization|npcs?|friendly)\b/.test(
			n,
		) &&
		!/\bvillagers?\b/.test(n)
	) {
		return "village";
	}

	if (
		LOCATE_SEEKING.test(n) &&
		/\bvillagers?\b/.test(n) &&
		/\b(village|town|settlement|trading|trade)\b/.test(n)
	) {
		return "village";
	}

	if (LOCATE_SEEKING.test(n) && /\bstructure(s)?\b/.test(n)) {
		return "any_structure";
	}

	if (
		isProximityQuestion(n) &&
		/\b(village|town|temple|monument|mansion|stronghold|fortress|mineshaft|shipwreck|outpost|hut|ruins?|city)\b/.test(
			n,
		)
	) {
		const hint = pickBest(scoreStructureIntents(n));
		if (hint && hint.score >= 1) return hint.key;
	}

	return null;
}

/** @type {Record<string, RegExp>} */
const ORE_KEY_PATTERNS = {
	diamond: /\b(diamond|diamonds)\b/,
	iron: /\b(iron|iron ore)\b/,
	gold: /\b(gold|gold ore)\b/,
	copper: /\b(copper|copper ore)\b/,
	lapis: /\b(lapis|lapis lazuli)\b/,
	redstone: /\b(redstone)\b/,
	coal: /\b(coal|charcoal)\b/,
	emerald: /\b(emerald|emeralds)\b/,
	ancient_debris: /\b(ancient debris|netherite scrap|netherite)\b/,
	quartz: /\b(quartz|nether quartz)\b/,
};

/**
 * @param {string} message
 * @returns {string | null}
 */
export function findOreKey(message) {
	const n = expandMessage(normalizeQuestion(message));
	for (const [key, pattern] of Object.entries(ORE_KEY_PATTERNS)) {
		if (pattern.test(n)) return key;
	}
	return null;
}

/**
 * @param {string} message
 * @returns {"how_to"|"nearby"|"precise"|null}
 */
export function classifyOreIntent(message) {
	const n = expandMessage(normalizeQuestion(message));
	if (!findOreKey(message)) return null;

	if (
		wantsPreciseLocate(message) ||
		/\b(exact|coordinates|coords|xyz|what block|pinpoint|give me the numbers)\b/.test(n)
	) {
		return "precise";
	}

	if (
		/\b(how (do|can|should|would)|best way|what y|what level|which level|which y|where (should|do) i (mine|dig|look|find)|tips? for|how to (find|get|mine))\b/.test(
			n,
		)
	) {
		return "how_to";
	}

	if (
		/\b(where|find|near|nearby|around|close|scan|sense|there any|any .+ near|locate|spot)\b/.test(
			n,
		) &&
		/\b(ore|vein|deposit)\b/.test(n)
	) {
		return "nearby";
	}

	if (/\b(where|find|near|nearby|around)\b/.test(n)) {
		return "nearby";
	}

	return "how_to";
}

/**
 * @param {string} message
 */
export function wantsBiomeInfo(message) {
	const n = expandMessage(normalizeQuestion(message));
	return (
		/\b(biome|ecosystem|environment|terrain|climate|weather zone|landscape|biome name)\b/.test(
			n,
		) ||
		/\b(what|which|kind of)\b.*\b(place|area|land|ground|region|zone|forest|desert|jungle|swamp|taiga|savanna)\b/.test(
			n,
		) ||
		/\b(what is this|what s this|this place|this area|what land)\b/.test(n) ||
		/\b(standing|walking|standing on)\b.*\b(what|where|kind)\b/.test(n) ||
		/\b(here|around here|around me|under my feet|beneath me)\b/.test(n) ||
		(/\b(growing|plants|trees|grass|foliage|blocks around)\b/.test(n) &&
			looksLikeQuestion(message)) ||
		(/\b(cold|hot|wet|dry|snowy|sandy|spooky|scary)\b/.test(n) &&
			looksLikeQuestion(message))
	);
}

/**
 * @param {string} playerId
 * @param {string} message
 * @returns {string | null}
 */
export function tryResolveFollowUp(playerId, message) {
	const ctx = getPlayerContext(playerId);
	const n = expandMessage(normalizeQuestion(message));

	if (ctx.lastLocate) {
		const { structure, blocks, dir, x, z, precise } = ctx.lastLocate;
		const pretty = structure.replace(/_/g, " ");

		if (/\b(how far|how many blocks|distance|far away|far is it)\b/.test(n)) {
			return `A unos ${blocks} bloques al ${dir}. Ese es el ${pretty} más cercano.`;
		}
		if (
			/\b(which way|what direction|where do i go|head|turn|walk|run)\b/.test(n) &&
			!findStructureKey(message)
		) {
			return `Dirígete al ${dir}. Unos ${blocks} bloques hasta el ${pretty} más cercano.`;
		}
		if (/\b(exact|precise|coordinates|coords|xyz|numbers)\b/.test(n)) {
			return `__LOCATE_PRECISE__:${structure}`;
		}
		if (/\b(that|it|there|same|again)\b/.test(n) && n.split(" ").length <= 6) {
			if (precise) {
				const xStr = Math.round(x) < 0 ? `minus ${Math.abs(Math.round(x))}` : String(Math.round(x));
				const zStr = Math.round(z) < 0 ? `minus ${Math.abs(Math.round(z))}` : String(Math.round(z));
				return `${pretty} está cerca de X ${xStr} y Z ${zStr}, a unos ${blocks} bloques al ${dir}.`;
			}
			return `Sigue al ${dir} de ti, a unos ${blocks} bloques del ${pretty}.`;
		}
	}

	if (ctx.lastBiome && /\b(that biome|same biome|it again|what was it)\b/.test(n)) {
		return `Sigue siendo ${ctx.lastBiome}.`;
	}

	if (ctx.lastSound && /\b(again|one more|repeat|same sound|do it again)\b/.test(n)) {
		return `__REPLAY_SOUND__:${ctx.lastSound}`;
	}

	if (ctx.lastLocate && /\b(closer|nearer|another|different|other one|somewhere else)\b/.test(n)) {
		return `__LOCATE_AGAIN__:${ctx.lastLocate.structure}`;
	}

	if (ctx.lastIntent === "locate" && /\b(is it far|is it close|far away|pretty close)\b/.test(n)) {
		const { blocks, pretty } = ctx.lastLocate
			? {
					blocks: ctx.lastLocate.blocks,
					pretty: ctx.lastLocate.structure.replace(/_/g, " "),
				}
			: { blocks: 0, pretty: "it" };
		if (blocks > 800) return `Sí. El ${pretty} está lejos. A unos ${blocks} bloques. Empaca provisiones.`;
		if (blocks > 300) return `Viaje medio. Unos ${blocks} bloques. No está a la vuelta de la esquina.`;
		if (blocks > 0) return `Bastante cerca. Unos ${blocks} bloques. Podrías ir caminando.`;
	}

	if (/\b(say that again|repeat that|what did you say|pardon|come again)\b/.test(n)) {
		if (ctx.lastAnswer) return ctx.lastAnswer;
		if (ctx.lastQuestion) return `__REPEAT_LAST__:${ctx.lastQuestion}`;
	}

	if (/\b(what can you do|what do you know|capabilities|features)\b/.test(n)) {
		return null;
	}

	return null;
}

/**
 * @param {string} message
 * @returns {string | null}
 */
export function tryOreTip(message) {
	const intent = classifyOreIntent(message);
	if (intent !== "how_to") return null;

	const oreKey = findOreKey(message);
	if (oreKey) {
		return getOreHowToAnswer(oreKey);
	}

	const n = expandMessage(normalizeQuestion(message));
	if (!/\b(where|find|mine|mining|dig|best|layer|level|y level|depth|farm|how)\b/.test(n)) {
		return null;
	}

	for (const tip of ORE_TIPS) {
		if (tip.pattern.test(n)) {
			return tip.replies[Math.floor(Math.random() * tip.replies.length)];
		}
	}
	return null;
}

/**
 * @param {string} message
 */
export function wantsRainCountdown(message) {
	const n = expandMessage(normalizeQuestion(message));
	return (
		/\b(will it rain|is it going to rain|going to rain|when will it rain|when is it going to rain|when does it rain|when is rain|rain soon|start raining|make it rain|let it rain|can it rain|bring rain|need rain)\b/.test(
			n,
		) ||
		(/\b(when|soon|start|make|let)\b/.test(n) && /\b(rain|raining|rainy|storm)\b/.test(n)) ||
		(/\b(rain|raining|rainy|storm)\b/.test(n) && /\b(when|soon|now|start|come|begin)\b/.test(n))
	);
}

/**
 * @param {string} message
 */
export function detectWorldFactIntent(message) {
	const n = expandMessage(normalizeQuestion(message));
	const lower = message.toLowerCase();

	if (/\b(health|hearts|hp|how much health|am i hurt)\b/.test(n)) {
		return "health";
	}
	if (/\b(hunger|food|starving|hungry|how hungry|đói)\b/.test(n)) {
		return "hunger";
	}
	if (/\b(time|clock|hour|day|night|morning|evening|sunrise|sunset|sleep|bed)\b/.test(n)) {
		return "time";
	}
	if (wantsRainCountdown(message)) {
		return null;
	}
	if (/\b(weather|rain|storm|thunder|snowing|clear sky)\b/.test(n)) {
		return "weather";
	}
	if (
		/\b(coordinate|coords|position|my location|where am i|lost|gps|xyz)\b/.test(n) ||
		(/\bwhere\b/.test(n) && /\b(i|me|myself)\b/.test(n))
	) {
		return "coords";
	}
	if (/\b(dimension|overworld|nether|end|which world)\b/.test(n)) {
		return "dimension";
	}
	if (/\b(spawn|world origin|0 0|center of the map)\b/.test(n)) {
		return "spawn";
	}
	if (
		/\b(facing|looking|direction am i|which way am i|compass)\b/.test(n) ||
		(/\b(am i)\b/.test(n) && /\b(facing|looking)\b/.test(lower))
	) {
		return "facing";
	}
	if (/\b(depth|y level|height|how high|how deep|elevation)\b/.test(n)) {
		return "elevation";
	}
	if (/\b(light|dark|bright|can mobs spawn)\b/.test(n)) {
		return "light";
	}
	if (/\b(how many players|anyone else|other players|who else|am i alone|solo|multiplayer)\b/.test(n)) {
		return "players";
	}
	if (/\b(gamemode|creative|survival|hardcore|cheats)\b/.test(n)) {
		return "gamemode";
	}
	if (/\b(safe|danger|dangerous|hostile|mobs nearby|something near)\b/.test(n) && looksLikeQuestion(message)) {
		return "safety";
	}
	if (/\b(how long|days|played|world age)\b/.test(n) && /\b(world|game|server)\b/.test(n)) {
		return "world_age";
	}
	return null;
}

/**
 * @param {string} message
 */
const BIOME_LOCATE_ALIASES = {
	desert: "desert",
	jungle: "jungle",
	"dark forest": "roofed_forest",
	"roofed forest": "roofed_forest",
	swamp: "swamp",
	mangrove: "mangrove_swamp",
	taiga: "taiga",
	"snowy taiga": "cold_taiga",
	savanna: "savanna",
	"badlands": "mesa",
	mesa: "mesa",
	cherry: "cherry_grove",
	"cherry grove": "cherry_grove",
	plains: "plains",
	forest: "forest",
	"flower forest": "flower_forest",
	birch: "birch_forest",
	"old growth": "old_growth_birch_forest",
	ice: "ice_plains",
	"snowy plains": "ice_plains",
	"deep dark": "deep_dark",
	mushroom: "mushroom_island",
	"mooshroom": "mushroom_island",
	ocean: "ocean",
	"warm ocean": "warm_ocean",
	"deep ocean": "deep_ocean",
};

/**
 * @param {string} message
 */
export function findBiomeLocateKey(message) {
	const n = expandMessage(normalizeQuestion(message));
	if (!LOCATE_SEEKING.test(n) && !/\b(find|need|want|looking)\b.*\b(biome|desert|jungle|swamp|taiga)\b/.test(n)) {
		return null;
	}

	let best = "";
	let bestLen = 0;
	for (const [alias, biomeId] of Object.entries(BIOME_LOCATE_ALIASES)) {
		if (n.includes(alias) && alias.length > bestLen) {
			best = biomeId;
			bestLen = alias.length;
		}
	}
	return best || null;
}

export function detectSocialIntent(message) {
	const n = expandMessage(normalizeQuestion(message));
	const short = message.trim().length <= 24;
	if (/\b(who are you|what are you|your name)\b/.test(n)) return "identity";
	if (/\b(help|how do i use you|what can you do|commands)\b/.test(n)) return "help";
	if (/\b(thanks|thank you|ty|appreciate|cheers)\b/.test(n)) return "thanks";
	if (/\b(goodbye|bye|see you|see ya|cya|good night|gn)\b/.test(n)) return "goodbye";
	if (/\b(sorry|my bad|apologize|didn t mean|xin lỗi|xin loi)\b/.test(n)) return "sorry";
	if (/\b(you re (cool|awesome|great|amazing|helpful|the best)|love you|best friend)\b/.test(n)) {
		return "compliment";
	}
	if (/\b(you re (weird|creepy|stupid|useless|annoying|bad)|hate you|shut up)\b/.test(n)) {
		return "insult";
	}
	if (/\b(are we friends|do you like me|like me|friend)\b/.test(n) && /\b(you|verity|us)\b/.test(n)) {
		return "friendship";
	}
	if (/\b(joke|funny|make me laugh|tell me something funny)\b/.test(n)) return "joke";
	if (/\b(lonely|alone|scared|afraid|worried|nervous|anxious)\b/.test(n) && message.trim().length < 80) {
		return "emotional";
	}
	if (/\b(i m|im) (fine|good|great|okay|ok|alright|doing well|doing good|not bad)\b/.test(n) && message.trim().length < 72) {
		return "player_doing_well";
	}
	if (/\b(i m|im) (tired|exhausted|sleepy|wiped|drained)\b/.test(n)) {
		return "player_tired";
	}
	if (/\b(i m|im) (sad|down|depressed|upset|heartbroken|miserable)\b/.test(n)) {
		return "player_sad";
	}
	if (/\b(i m|im) (stressed|overwhelmed|burnt out|burned out)\b/.test(n)) {
		return "player_stressed";
	}
	if (/\b(i m|im) (happy|excited|pumped|thrilled|glad|cheerful)\b/.test(n)) {
		return "player_happy";
	}
	if (/\b(i m|im) (scared|terrified|freaked out|freaked)\b/.test(n)) {
		return "player_scared";
	}
	if (
		/\b(how am i|how do i look|am i (ok|okay|alright|doing fine|doing ok)|do i look (ok|okay|fine))\b/.test(n) ||
		/\b(what do you think of me|do you care about me)\b/.test(n)
	) {
		return "check_player";
	}
	if (/\b(are you (ok|okay|alright)|you (ok|okay|alright)\??|hope you re (ok|well)|hope you re doing)\b/.test(n)) {
		return "care_verity";
	}
	if (/\b(long time no see|haven t talked|been a while|i m back|im back|back again)\b/.test(n)) {
		return "returning";
	}
	if (
		/\b(keep me company|talk (to|with) me|let s (talk|chat)|chat with me|just talk|stay with me)\b/.test(n) ||
		/\b(what s new|anything new with you|tell me about yourself)\b/.test(n)
	) {
		return "small_talk";
	}
	if (/\b(how about you|what about you|and you\??)\b/.test(n) && message.trim().length < 36) {
		return "how_about_you";
	}
	if (/\b(khoe khong|khỏe không|ban khoe|bạn khỏe)\b/.test(n)) {
		return "how_are_you";
	}
	if (/\b(xin chao|chao ban|chào bạn|chao verity)\b/.test(n)) {
		return "greet";
	}
	if (/\b(cam on|cảm ơn)\b/.test(n) && message.trim().length < 40) {
		return "thanks";
	}
	if (/\b(how old are you|your age|when were you born)\b/.test(n)) {
		return "how_old";
	}
	if (/\b(how are you|how re you|how have you been|you good)\b/.test(n)) {
		return "how_are_you";
	}
	if (/\b(who is thatmob|who s thatmob|what is thatmob)\b/.test(n)) return "thatmob";
	if (/\b(who is pntmc|who s pntmc|what is pntmc)\b/.test(n)) return "pntmc_who";
	if (/\b(who made (?:this )?(?:addon|pack|mod)|who created (?:this )?(?:addon|pack|mod)|who made the addon|who made the pack)\b/.test(n)) {
		return "creator_addon";
	}
	if (/\b(who made you|who created you|who built you)\b/.test(n)) return "creator_verity";
	if (/\b(nice to meet|good to meet|pleasure to meet)\b/.test(n)) return "nice_meet";
	if (/\b(what s up|wassup|how s it going|how goes it)\b/.test(n)) return "whats_up";
	if (/\b(are you there|you there|can you hear me)\b/.test(n) || /^verity[?!.]*$/i.test(message.trim())) {
		return "presence";
	}
	if (/\b(good job|well done|nice work|you did great)\b/.test(n)) return "praise";
	if (/\b(good luck|break a leg)\b/.test(n)) return "good_luck";
	if (/\b(congrats|congratulations)\b/.test(n)) return "congrats";
	if (/\b(miss you|missed you)\b/.test(n)) return "miss";
	if (short && /^(ok|okay|k|sure|yep|yeah|yea|nah|nope|cool|nice|wow|lol|haha|omg|bruh)$/i.test(n.trim())) {
		return "ack";
	}
	if (
		/\b(hi|hello|hey|good morning|good afternoon|good evening|sup|yo)\b/.test(n) &&
		message.trim().length < 48 &&
		!/\d\s*(plus|minus|times|divided)\b/.test(n) &&
		!/\d\s*[+\-*/^]/.test(message) &&
		!/^(?:what(?:'s| is)|whats|how much is|calculate|compute|solve)\s+\d/i.test(message.trim())
	) {
		return "greet";
	}
	return null;
}

/**
 * @param {string} message
 */
export function detectControlIntent(message) {
	const n = expandMessage(normalizeQuestion(message));
	if (/\b(stop (the )?music|stop playing|turn off (the )?music|quiet|shut up|be quiet|silence)\b/.test(n)) {
		return "stop_music";
	}
	if (/\b(never mind|nevermind|forget it|nvm|cancel that|ignore that)\b/.test(n)) {
		return "cancel";
	}
	if (/\b(stop|enough|that s enough)\b/.test(n) && n.split(" ").length <= 4) {
		return "cancel";
	}
	return null;
}

/**
 * @param {string} message
 */
export function detectSituationalIntent(message) {
	const n = expandMessage(normalizeQuestion(message));
	if (/\b(i m lost|im lost|lost|no idea where|don t know where|can t find my way|where am i going)\b/.test(n)) {
		return "lost";
	}
	if (/\b(stuck|trapped|can t get out|fallen in|in a hole|help me out)\b/.test(n)) {
		return "stuck";
	}
	if (/\b(i died|just died|lost my stuff|died again|death|all my items|grave)\b/.test(n)) {
		return "died";
	}
	if (/\b(hungry|no food|starving|need food|what do i eat|what should i eat)\b/.test(n)) {
		return "hungry";
	}
	if (/\b(first night|getting dark|sun is setting|sunset|night is coming|before dark)\b/.test(n)) {
		return "first_night";
	}
	if (
		/\b(help me|i need help|please help|can you help)\b/.test(n) &&
		!LOCATE_SEEKING.test(n) &&
		!findStructureKey(message)
	) {
		return "need_help";
	}
	if (/\b(what should i do|what now|what do i do next|any ideas|suggest something)\b/.test(n)) {
		return "what_now";
	}
	if (/\b(bored|nothing to do|so bored)\b/.test(n) && !wantsPlaySong(message)) {
		return "bored";
	}
	if (/\b(i m|im) (stressed|overwhelmed|anxious|worried sick)\b/.test(n)) {
		return "stressed";
	}
	if (/\b(i m|im) (excited|pumped|hyped|thrilled)\b/.test(n)) {
		return "excited";
	}
	if (/\b(i m|im) (proud|accomplished|did it|finally did)\b/.test(n) || /\b(i finally|just beat|just finished)\b/.test(n)) {
		return "proud";
	}
	if (/\b(i m|im) (frustrated|annoyed|mad|angry|pissed)\b/.test(n)) {
		return "frustrated";
	}
	if (/\b(i won|i did it|let s go|yes!|we did it|finally)\b/.test(n) && message.trim().length < 48) {
		return "celebrating";
	}
	if (/\b(feeling lonely|feel alone|no one to talk)\b/.test(n)) {
		return "lonely";
	}
	return null;
}

/** @type {{ id: string, pattern: RegExp, replies: string[] }[]} */
export const GAMEPLAY_TIPS = [
	{
		id: "nether",
		pattern: /\b(nether|nether portal|go to nether|enter nether|obsidian portal)\b/,
		replies: [
			"Mínimo diez de obsidiana para un portal. Mechero para encenderlo. Lleva resistencia al fuego, armadura de oro para los piglins y comida.",
			"Construye un portal con obsidiana, enciéndelo y prepárate: comida, bloques, resistencia al fuego y una forma de volver.",
		],
	},
	{
		id: "end",
		pattern: /\b(the end|end dimension|ender dragon|beat the dragon|kill dragon|enter the end)\b/,
		replies: [
			"Encuentra una fortaleza del End, llena el portal con ojos de ender, lleva camas o flechas, la caída lenta ayuda, y cuidado con los cristales.",
			"Fortaleza del End primero. Ojos de ender. Luego armadura, comida, bloques y un plan para los cristales del dragón.",
		],
	},
	{
		id: "warden",
		pattern: /\b(warden|deep dark|ancient city|sculk shrieker)\b/,
		replies: [
			"Agáchate. No actives los chilladores de sculk dos veces. La lana o las alfombras amortiguan los pasos. Si aparece, corre y no pelees.",
			"Las ciudades antiguas son zonas de silencio. Agáchate, evita vibraciones y nunca busques pelea con un Warden.",
		],
	},
	{
		id: "enchant",
		pattern: /\b(enchant|enchanting|enchantment|enchant table|xp level|experience)\b/,
		replies: [
			"Los libreros alrededor de la mesa desbloquean mejores encantamientos. Farmea XP en una granja de mobs o mina carbón.",
			"15 libreros, lapislázuli y XP. Renombra objetos en un yunque antes de que se rompan.",
		],
	},
	{
		id: "villager_trade",
		pattern: /\b(villager trade|trading hall|breed villagers|cure zombie villager|discount)\b/,
		replies: [
			"Fija el trabajo de un aldeano con su puesto de trabajo. Cura aldeanos zombi para descuentos. Protégelos de noche.",
			"Puestos de trabajo, camas y seguridad. Curar zombis da grandes descuentos si lo logras.",
		],
	},
	{
		id: "tame",
		pattern: /\b(tame|taming|wolf|cat|horse|parrot|axolotl)\b/,
		replies: [
			"A los lobos les gustan los huesos, a los gatos el pescado crudo, los caballos necesitan que los montes varias veces, los loros semillas. Ten paciencia.",
			"La mayoría de mascotas necesitan comida o paciencia. Los creepers temen a los gatos. Los lobos pelean por ti.",
		],
	},
	{
		id: "farm",
		pattern: /\b(farm|farming|crop|wheat|carrot|potato|bread|food farm)\b/,
		replies: [
			"Empieza con trigo y pan. El polvo de hueso acelera los cultivos. Ilumina la granja para que nada la pisotee.",
			"Agua a menos de cuatro bloques, ilumínala, cosecha y replanta. Los aldeanos pueden automatizarla después.",
		],
	},
	{
		id: "armor",
		pattern: /\b(armor|armour|protection|what armor|best gear|diamond armor|netherite armor)\b/,
		replies: [
			"Hierro al inicio, diamante a medio juego, netherita al final. Protección y Caída de Pluma salvan vidas.",
			"Hierro completo antes del Nether. Diamante antes del End. Encanta todo lo que puedas.",
		],
	},
	{
		id: "portal_return",
		pattern: /\b(get back|way back|return home|find home|my base)\b/,
		replies: [
			"Las coordenadas salvan vidas. Anota la X y Z de tu base. La brújula apunta al spawn, no a tu casa.",
			"Marca las coordenadas de tu base. Las antorchas en el camino ayudan. En el Nether, un bloque son ocho del Overworld.",
		],
	},
	{
		id: "cave",
		pattern: /\b(cave|caving|explore cave|underground|branch mine|strip mine)\b/,
		replies: [
			"Antorchas en la pared derecha al entrar, a la izquierda al salir. Escucha los mobs y la lava.",
			"Nunca caves recto hacia abajo o arriba. Mina en ramas a buenos niveles de Y. El cubo de agua te salva de la lava.",
		],
	},
	{
		id: "build",
		pattern: /\b(build a house|make a base|base location|where to build|starter base)\b/,
		replies: [
			"Terreno plano cerca de agua y árboles. Ilumina un perímetro amplio. Cama adentro antes de la noche.",
			"Llanura o bosque cerca de una aldea es acogedor. Las bases en cuevas funcionan si iluminas cada rincón.",
		],
	},
	{
		id: "shield",
		pattern: /\b(shield|block attacks|creeper|skeleton arrow)\b/,
		replies: [
			"Los escudos bloquean daño frontal. Esquiva a los creepers de lado. Los esqueletos odian las esquinas desde donde puedes asomarte.",
			"Craftea un escudo pronto. Bloquea antes de que llegue el golpe. Salva más vidas que corazones extra.",
		],
	},
];

/**
 * @param {string} message
 * @returns {{ id: string, reply: string } | null}
 */
export function tryGameplayTip(message) {
	const n = expandMessage(normalizeQuestion(message));
	if (!looksLikeQuestion(message) && !/\b(how|tip|advice|help|should|need|want)\b/.test(n)) {
		return null;
	}
	for (const tip of GAMEPLAY_TIPS) {
		if (tip.pattern.test(n)) {
			return {
				id: tip.id,
				reply: tip.replies[Math.floor(Math.random() * tip.replies.length)],
			};
		}
	}
	return null;
}

/**
 * @param {string} message
 */
export function detectGameplayIntent(message) {
	const hit = tryGameplayTip(message);
	return hit?.id ?? null;
}

/**
 * @param {string} message
 */
export function wantsNearbyEntityQuestion(message) {
	const n = expandMessage(normalizeQuestion(message));

	if (
		/\b(biome|biomes|ecosystem|terrain|climate|landscape|weather|dimension|structure|village|seed|coordinate|coords)\b/.test(
			n,
		) ||
		/\b(sound|sounds|song|music|noise)\b/.test(n) ||
		/\b(block|blocks|item|items|tool|weapon|armor|ore|mob sound)\b/.test(n)
	) {
		return false;
	}

	if (wantsBiomeInfo(message) && /\bbiome/.test(n)) {
		return false;
	}

	return (
		/\b(what is that|what s that|whats that|what is this|what s this|whats this)\b/.test(
			n,
		) ||
		/\bwhat (mob|animal|creature|monster|thing|entity|is that|is this)\b/.test(n) ||
		/\b(that|this|it)\b.*\bwhat (is|was)\b/.test(n) ||
		/\bwhat (is|was)\b.*\b(that|this|it)\b/.test(n) ||
		/\b(do you see|see that|see this|what am i looking at|what s in front)\b/.test(n) ||
		/\bwho s that|who is that\b/.test(n)
	);
}

const SKIP_ENTITY_TYPES = new Set([
	"minecraft:item",
	"minecraft:xp_orb",
	"minecraft:arrow",
	"minecraft:snowball",
	"minecraft:egg",
	"minecraft:ender_pearl",
	"minecraft:experience_orb",
	"minecraft:lightning_bolt",
	"minecraft:area_effect_cloud",
]);

/**
 * @param {import("@minecraft/server").Player} player
 * @param {number} [maxDistance]
 */
export function findTargetEntityNearPlayer(player, maxDistance = 12) {
	try {
		const viewHits = player.getEntitiesFromViewDirection({ maxDistance });
		for (const hit of viewHits) {
			const ent = hit.entity;
			if (!ent?.isValid) continue;
			if (ent.id === player.id) continue;
			if (ent.typeId === "pntmc:verityball") continue;
			if (ent instanceof Player) continue;
			if (SKIP_ENTITY_TYPES.has(ent.typeId)) continue;
			return ent;
		}
	} catch (err) {
		console.warn(`verity nearby entity view: ${err}`);
	}

	let nearest;
	let best = maxDistance;
	const loc = player.location;

	for (const ent of player.dimension.getEntities({
		location: loc,
		maxDistance,
	})) {
		if (!ent.isValid) continue;
		if (ent.id === player.id) continue;
		if (ent.typeId === "pntmc:verityball") continue;
		if (ent instanceof Player) continue;
		if (SKIP_ENTITY_TYPES.has(ent.typeId)) continue;

		const dx = ent.location.x - loc.x;
		const dz = ent.location.z - loc.z;
		const d = Math.sqrt(dx * dx + dz * dz);
		if (d < best) {
			best = d;
			nearest = ent;
		}
	}

	return nearest;
}

/**
 * @param {string} typeId
 */
export function formatEntityName(typeId) {
	const part = String(typeId).split(":").pop() ?? String(typeId);
	return part
		.split("_")
		.filter(Boolean)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
		.join(" ");
}

/** @type {Record<string, string[]>} */
export const ENTITY_FLAVOR = {
	"minecraft:creeper": [
		"Creeper. Retrocede. Ahora.",
		"Eso es un creeper. Ya sabes lo que significa.",
	],
	"minecraft:zombie": ["Zombi. No-muerto estándar. Cuidado con el ruido.", "Zombi. Mátalo o corre."],
	"minecraft:skeleton": ["Esqueleto. Arco. El escudo ayuda.", "Esqueleto arquero. No te muevas de lado en campo abierto."],
	"minecraft:spider": ["Araña. Trepa paredes. No dejes que se te ponga encima.", "Araña. Grande y rápida de noche."],
	"minecraft:enderman": [
		"Enderman. No lo mires a los ojos.",
		"Enderman. Mira tus pies a menos que quieras pelea.",
	],
	"minecraft:warden": ["Warden. Corre. No pelees.", "Warden. No deberías estar tan cerca."],
	"minecraft:villager": ["Aldeano. Comercia si no lo asustas.", "Aldeano. Esmeraldas si eres educado."],
	"minecraft:cow": ["Vaca. Carne y cuero si tienes hambre.", "Vaca. Pasiva. Comida fácil."],
	"minecraft:pig": ["Cerdo. Chuletas esperando a suceder.", "Cerdo. Comida clásica del inicio."],
	"minecraft:sheep": ["Oveja. Lana para una cama.", "Oveja. Consigue lana antes de la noche."],
	"minecraft:chicken": ["Gallina. Huevos y carne.", "Gallina. Pequeña pero útil."],
	"minecraft:wolf": ["Lobo. Con huesos quizá lo domestiques.", "Lobo. Podría volverse tu mejor amigo."],
	"minecraft:iron_golem": ["Gólem de hierro. Guardia de la aldea. No busques pelea.", "Gólem de hierro. Protege a los aldeanos."],
	"minecraft:pillager": ["Saqueador. Problemas de invasión. Mátalo rápido.", "Saqueador. Ballesta. Malas noticias."],
	"minecraft:bee": ["Abeja. No la golpees a menos que te guste el dolor.", "Abeja. Poliniza. Déjala en paz."],
};

/**
 * @param {import("@minecraft/server").Entity} entity
 */
export function describeNearbyEntity(entity) {
	const name = formatEntityName(entity.typeId);
	const flavor = ENTITY_FLAVOR[entity.typeId];
	if (flavor) {
		return flavor[Math.floor(Math.random() * flavor.length)];
	}
	return `Eso es un ${name}.`;
}

/**
 * Keyword router for unknown questions — returns a hint category or null.
 * @param {string} message
 */
export function detectFallbackTopic(message) {
	const n = expandMessage(normalizeQuestion(message));
	if (/\b(water|swim|drown|boat|ocean|river|fishing)\b/.test(n)) return "water";
	if (/\b(fire|lava|burn|flame|magma)\b/.test(n)) return "fire";
	if (/\b(wood|tree|chop|log|planks|crafting table)\b/.test(n)) return "wood";
	if (/\b(stone|pickaxe|cobble|tool|tools)\b/.test(n)) return "tools";
	if (/\b(bed|sleep|spawn point|respawn anchor)\b/.test(n)) return "bed";
	if (/\b(map|compass|locator|barrier|coordinates)\b/.test(n)) return "navigation";
	if (/\b(redstone|piston|automation|machine)\b/.test(n)) return "redstone";
	if (/\b(potion|brew|brewing|splash|lingering)\b/.test(n)) return "potions";
	if (/\b(boss|wither|elder guardian|raid)\b/.test(n)) return "combat";
	if (/\b(biome|climate|temperature|snow|desert)\b/.test(n)) return "biome";
	if (/\b(mob|monster|hostile|passive|animal)\b/.test(n)) return "mobs";
	return null;
}
