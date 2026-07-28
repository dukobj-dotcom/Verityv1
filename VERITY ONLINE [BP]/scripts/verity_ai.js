import { Player, system, world } from "@minecraft/server";
import {
	animateGroundSpeech,
	FACE_HUNGRY_OPEN,
	FACE_SPEAK,
	getVerityPhase,
	PHASE,
} from "./verity_phases.js";
import {
	isMusicPlaying,
	playBallMusic,
	playBallSoundAt,
	playSoundAtLoc,
	stopBallMusic,
} from "./verity_music.js";
import { getIdleFaceFor } from "./verity_faces.js";
import { getSoundDurationTicks } from "./verity_sound_durations.js";
import { deliverPhase2Speech, getPhase2State, P2_STATE, tryPhase2Chat } from "./verity_phase2.js";
import { tryBrainAnswer } from "./verity_brain.js";
import { tryBrainKnowledge } from "./verity_knowledge.js";
import { tryBasicChat } from "./verity_chat.js";
import { looksLikeMath, tryMathAnswer } from "./verity_math.js";
import { locateNearest, sendLocateCoordsToPlayer, parseLocateCoords } from "./verity_locate.js";
import {
	detectNearbyStructure,
	isPlayerAtStructure,
	resolveProximityKey,
} from "./verity_nearby_structure.js";
import { answerOreLocate, getOreHowToAnswer } from "./verity_ore_scan.js";
import {
	analyzeMind,
	classifyAudience,
	describeNearbyEntity,
	detectFallbackTopic,
	detectSocialIntent,
	detectWorldFactIntent,
	expandMessage,
	findSoundKey,
	findStructureKey,
	findOreKey,
	classifyOreIntent,
	findTargetEntityNearPlayer,
	beginMessageContext,
	endMessageContext,
	getMessageExpanded,
	getPlayerContext,
	looksLikeQuestion,
	MATRIX_SONG_SOUND,
	markVerityReplied,
	normalizeQuestion,
	resolvePlaySongSound,
	recordPlayerChat,
	tryGameplayTip,
	tryOreTip,
	tryResolveFollowUp,
	updatePlayerContext,
	wantsBiomeInfo,
	wantsNearbyEntityQuestion,
	wantsSoundRequest,
} from "./verity_mind.js";
import { tryStoryChat } from "./verity_story.js";
import {
	callVerityComeHere,
	disableVerityballFollow,
	enableVerityballFollow,
} from "./verity_ball_follow.js";
import {
	healthLine,
	hungerLine,
	tryEnchantFlow,
	tryVerityUtilityActions,
} from "./verity_actions.js";
import { FALLBACK_CHAT, playVerityVoice, playVerityVoiceAt, VOICE } from "./verity_voices.js";
import { triggerScoldSequence } from "./verity_resurrection.js";
import {
	notifyVerityPlayerChat,
	registerRudeStrike,
	resetRudeStrikes,
	RUDE_ESCALATE_AT,
} from "./verity_social_state.js";
import { noteVerityMistreatment, noteVerityTalk } from "./verity_mood.js";
import { getSmalltalkReply, getSmalltalkVoice } from "./verity_smalltalk.js";
import { isGroqConnected } from "./verity_groq_state.js";

const VERITYBALL_ID = "pntmc:verityball";
const VERITY_ITEM_IDS = new Set([
	"pntmc:verity_inventory_1",
	"pntmc:verity_inventory_2",
	"pntmc:verity_inventory_3",
]);

const HEY_VERITY = /\bhey\s+verity\b/i;
const VERITY_LISTEN_RADIUS = 50;
const INVENTORY_WAKE_IDLE_MS = 60_000;

/** @type {Map<string, number>} */
const inventoryAwakeAt = new Map();

/** @type {Map<string, { recent: string[], repeats: Map<string, number> }>} */
const playerChatMemory = new Map();

const MEMORY_WINDOW = 12;
const REPEAT_PUSHBACK_AT = 3;
const RAIN_COUNTDOWN_SECONDS = 5;
const TICKS_PER_SECOND = 20;
const RAIN_COUNTDOWN_MARKER = "__RAIN_COUNTDOWN__";
const SCOLD_MARKER = "__VERITY_SCOLD__";

/** @type {Set<string>} */
const rainCountdownActive = new Set();

/**
 * @param {string[]} lines
 */
function pickLine(lines) {
	return lines[Math.floor(Math.random() * lines.length)];
}

/**
 * @param {number} n
 */
function formatNum(n) {
	const v = Math.round(n);
	if (v < 0) return `menos ${Math.abs(v)}`;
	return String(v);
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} z
 */
function formatCoords(x, y, z) {
	return `X ${formatNum(x)}, Y ${formatNum(y)}, y Z ${formatNum(z)}`;
}

/**
 * @param {number} x
 * @param {number} z
 */
function formatXZ(x, z) {
	return `X ${formatNum(x)} y Z ${formatNum(z)}`;
}

/**
 * @param {number} hour
 */
function formatHour(hour) {
	if (hour === 0) return "medianoche";
	if (hour === 12) return "mediodía";
	return `las ${hour}`;
}

/**
 * @param {string} text
 */
/** Guarda recuerdos voluntarios del jugador dentro de los datos de este mundo. */
function tryPersonalMemory(player, message) {
	const raw = message.trim();
	const asksMemory = /\b(que recuerdas de mi|que sabes de mi|recuerdas algo de mi|what do you remember about me)\b/i.test(raw);
	const match = raw.match(/(?:verity[,:]?\s*)?(?:recuerda(?:\s+que)?|remember(?:\s+that)?)\s+(.{3,90})/i);
	const ctx = getPlayerContext(player.id);
	const facts = Array.isArray(ctx.personalFacts) ? ctx.personalFacts : [];
	if (asksMemory) {
		if (facts.length === 0) return "Aún no me has confiado nada para guardar. Dime: Verity, recuerda que mi color favorito es azul.";
		const last = ctx.lastAnswer ? ` Lo último que te respondí fue: ${ctx.lastAnswer}` : "";
		return `Recuerdo esto de ti: ${facts.join("; ")}.${last}`;
	}
	if (!match) return null;
	const fact = match[1].replace(/[.?!]+$/, "").trim();
	if (!fact) return null;
	const next = [...facts.filter((x) => x.toLowerCase() !== fact.toLowerCase()), fact].slice(-10);
	updatePlayerContext(player.id, { personalFacts: next });
	return `Lo guardaré: ${fact}. Solo queda guardado en este mundo.`;
}

function polishSpeech(text) {
	let s = text;
	s = s.replace(/\b(\d{1,2}):00\b/g, (_, h) => formatHour(Number(h)));
	s = s.replace(/\s*—\s*/g, ". ");
	s = s.replace(/([.!?])\s*-\s+/g, "$1 ");
	s = s.replace(/\s-\s+(?=[a-z])/gi, ". ");
	s = s.replace(/:\s+(?=[A-Za-z])/g, ". ");
	s = s.replace(/\b([XYZ])\s+-(\d+)/gi, "$1 menos $2");
	s = s.replace(/\s{2,}/g, " ");
	return s.trim();
}

// Se permiten letras latinas acentuadas (español). Solo se rechazan otros alfabetos.
const NON_ENGLISH_CHARS =
	/[\u0400-\u04FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/;

const VIETNAMESE_HINT =
	/\b(gi|dau|sao|nao|khong|toi|minh|ban|cho|duoc|lam sao|the nao|bao nhieu|o day|noi nay|tim kiem|giup|chao|xin chao|ban la ai|may gio|thoi gian|toa do|vi tri|dang o|co khong|khong biet|lang xa|moi truong|thoi tiet)\b/;

/**
 * @param {string} message
 */
function isEnglishMessage(message) {
	const trimmed = message.trim();
	if (!trimmed) return false;
	if (NON_ENGLISH_CHARS.test(trimmed)) return false;
	if (VIETNAMESE_HINT.test(normalizeQuestion(trimmed))) return false;
	return true;
}

/**
 * @param {string} text
 * @param {string} intent
 */
function getNaturalThinkDelay(text, intent) {
	const words = text.trim().split(/\s+/).filter(Boolean).length;
	const chars = text.trim().length;

	let min = 8;
	let max = 24;

	switch (intent) {
		case "sound":
			min = 3;
			max = 10;
			break;
		case "play_song":
			min = 8;
			max = 18;
			break;
		case "social":
		case "follow_up":
			min = 5;
			max = 16;
			break;
		case "locate_structure":
		case "locate_biome":
		case "follow_up_precise":
			min = 30;
			max = 55;
			break;
		case "brain":
			min = 22;
			max = 50;
			break;
		case "biome_here":
		case "world_fact":
			min = 10;
			max = 28;
			break;
		case "ore_tip":
			min = 14;
			max = 32;
			break;
		case "situational":
			min = 8;
			max = 22;
			break;
		case "gameplay_tip":
			min = 12;
			max = 30;
			break;
		case "control":
			min = 3;
			max = 10;
			break;
		case "nearby_entity":
			min = 6;
			max = 18;
			break;
		case "rain_countdown":
			min = 10;
			max = 20;
			break;
		case "story":
			min = 6;
			max = 18;
			break;
		default:
			min = 8;
			max = 26;
			break;
	}

	if (words <= 2) {
		min = Math.max(3, min - 7);
		max = Math.max(min + 3, max - 12);
	}

	if (chars > 70) {
		min += 6;
		max += 12;
	}

	return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * @param {string} text
 * @param {import("@minecraft/server").Entity | undefined} ball
 */
/**
 * @param {string} text
 * @param {import("@minecraft/server").Entity | undefined} ball
 * @param {boolean} [animateSpeech]
 */
function deliverVerityReply(text, ball, animateSpeech = true) {
	verityReply(text);
	if (!ball?.isValid || !animateSpeech) return;
	if (getVerityPhase() === PHASE.ONE) {
		animateGroundSpeech(ball, text);
	} else if (getVerityPhase() === PHASE.TWO || getVerityPhase() === PHASE.THREE) {
		deliverPhase2Speech(ball, text, true);
	}
}

/**
 * @param {string} text
 * @param {import("@minecraft/server").Entity | undefined} ball
 * @param {string} [intent]
 * @param {() => void} [afterReply]
 * @param {string} [voiceId]
 * @param {string} [playerId]
 * @param {number} [voiceMouthFace]
 */
function scheduleVerityReply(
	text,
	ball,
	intent = "unknown",
	afterReply,
	voiceId,
	playerId,
	voiceMouthFace,
) {
	if (isGroqConnected()) return;
	const delay = voiceId ? 0 : getNaturalThinkDelay(text, intent);
	const animateSpeech = intent !== "sound" && !voiceId;

	const playVoice = () => {
		if (!voiceId) return;
		const player = playerId
			? [...world.getPlayers()].find((p) => p.id === playerId)
			: undefined;
		if (player?.isValid) {
			playVerityVoiceAt(player, voiceId, ball, voiceMouthFace);
			return;
		}
		if (ball?.isValid) {
			playVerityVoice(ball, voiceId);
			return;
		}
		console.warn(`verity voice dropped ${voiceId}: no player or ball`);
	};

	const deliver = () => {
		if (text) deliverVerityReply(text, ball, animateSpeech);
		if (playerId) markVerityReplied(playerId);
		afterReply?.();
	};

	if (voiceId) {
		system.run(playVoice);
		system.runTimeout(deliver, delay + 3);
		return;
	}

	system.runTimeout(deliver, delay);
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {import("@minecraft/server").Entity | undefined} ball
 */
function startRainCountdown(player, ball) {
	const dim = player.dimension;
	const dimId = dim.id;

	if (rainCountdownActive.has(dimId)) {
		scheduleVerityReply(
			pickLine([
				"Ya estoy contando para la lluvia. Espera.",
				"La lluvia ya viene en camino. Dale un momento.",
			]),
			ball,
			"rain_countdown",
		);
		return;
	}

	rainCountdownActive.add(dimId);
	const introDelay = getNaturalThinkDelay("Lluvia en 5 segundos.", "rain_countdown");

	system.runTimeout(() => {
		if (!rainCountdownActive.has(dimId)) return;
		deliverVerityReply(
			pickLine([
				"Lluvia en 5 segundos.",
				"Dame 5 segundos. Luego llueve a cántaros.",
				"5 seconds until rain.",
			]),
			ball,
		);
	}, introDelay);

	for (let i = 0; i < RAIN_COUNTDOWN_SECONDS; i++) {
		const value = RAIN_COUNTDOWN_SECONDS - i;
		system.runTimeout(() => {
			if (!rainCountdownActive.has(dimId)) return;
			deliverVerityReply(String(value), ball);
		}, introDelay + (i + 1) * TICKS_PER_SECOND);
	}

	system.runTimeout(() => {
		if (!rainCountdownActive.has(dimId)) return;
		rainCountdownActive.delete(dimId);

		system.run(() => {
			try {
				dim.setWeather("Rain", 12000);
			} catch (err) {
				console.warn(`verity rain setWeather: ${err}`);
				try {
					player.runCommand("weather rain 12000");
				} catch (cmdErr) {
					console.warn(`verity rain command: ${cmdErr}`);
				}
			}
		});

		deliverVerityReply(
			pickLine([
				"There. It's raining.",
				"Listo. Lluvia.",
				"El cielo ya está abierto.",
			]),
			ball,
		);
	}, introDelay + RAIN_COUNTDOWN_SECONDS * TICKS_PER_SECOND);
}

function replyEnglishOnly(ball) {
	scheduleVerityReply(
		pickLine([
			"No entendí eso. Dímelo otra vez, más claro.",
			"Perdón, no entendí eso. ¿Lo intentas de nuevo?",
			"No capté eso. Repítelo de otra forma.",
		]),
		ball,
		"social",
	);
}

/**
 * @param {string} playerId
 * @param {string} norm
 */
function bumpRepeat(playerId, norm) {
	let mem = playerChatMemory.get(playerId);
	if (!mem) {
		mem = { recent: [], repeats: new Map() };
		playerChatMemory.set(playerId, mem);
	}
	mem.recent.push(norm);
	if (mem.recent.length > MEMORY_WINDOW) mem.recent.shift();
	const count = (mem.repeats.get(norm) ?? 0) + 1;
	mem.repeats.set(norm, count);
	if (mem.repeats.size > 30) {
		const oldest = mem.recent[0];
		if (oldest) mem.repeats.delete(oldest);
	}
	return count;
}

/**
 * @param {string} answer
 * @param {number} repeatCount
 */
function wrapNaturalReply(answer, repeatCount) {
	if (repeatCount >= REPEAT_PUSHBACK_AT) {
		return pickLine([
			`Ya me preguntaste eso antes. ${answer}`,
			`Otra vez la misma. ${answer}`,
			`Still true. ${answer}`,
		]);
	}
	return answer;
}

/**
 * @param {string} text
 */
export function verityReply(text) {
	world.sendMessage(`<§eVerity§r> ${polishSpeech(text)}`);
}

/**
 * @param {string} id
 */
/** Nombres de estructuras/dimensiones en español (para mostrar). */
const NOMBRE_ES = {
	village: "Aldea",
	mineshaft: "Mina abandonada",
	stronghold: "Fortaleza",
	mansion: "Mansión del bosque",
	monument: "Monumento oceánico",
	shipwreck: "Naufragio",
	ancient_city: "Ciudad antigua",
	bastion_remnant: "Bastión",
	pillager_outpost: "Puesto de saqueadores",
	ruined_portal: "Portal en ruinas",
	buried_treasure: "Tesoro enterrado",
	end_city: "Ciudad del End",
	fortress: "Fortaleza del Nether",
	nether_fortress: "Fortaleza del Nether",
	temple: "Templo",
	desert_temple: "Templo del desierto",
	jungle_temple: "Templo de la jungla",
	jungle_pyramid: "Templo de la jungla",
	desert_pyramid: "Templo del desierto",
	witch_hut: "Choza de bruja",
	swamp_hut: "Choza de pantano",
	igloo: "Iglú",
	ocean_ruins: "Ruinas oceánicas",
	ocean_ruin: "Ruinas oceánicas",
	trail_ruins: "Ruinas del sendero",
	trial_chambers: "Cámaras de desafío",
	trial_chamber: "Cámaras de desafío",
	ruined: "Portal en ruinas",
	any_structure: "Estructura",
	nether: "el Nether",
	the_end: "el End",
	overworld: "el Overworld",
};

export function formatIdName(id) {
	const part = String(id).split(":").pop() ?? String(id);
	const key = part.toLowerCase();
	if (NOMBRE_ES[key]) return NOMBRE_ES[key];
	return part
		.split("_")
		.filter(Boolean)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
		.join(" ");
}

/**
 * @param {import("@minecraft/server").Player} player
 */
function touchInventoryAwake(player) {
	inventoryAwakeAt.set(player.id, Date.now());
}

/**
 * @param {import("@minecraft/server").Player} player
 */
function clearInventoryAwake(player) {
	inventoryAwakeAt.delete(player.id);
}

/**
 * @param {import("@minecraft/server").Player} player
 */
function isInventoryAwake(player) {
	if (!playerHasVerityItem(player)) {
		clearInventoryAwake(player);
		return false;
	}
	const last = inventoryAwakeAt.get(player.id);
	if (last === undefined) return false;
	if (Date.now() - last > INVENTORY_WAKE_IDLE_MS) {
		clearInventoryAwake(player);
		return false;
	}
	return true;
}

/**
 * @param {import("@minecraft/server").Player} player
 */
function playerHasVerityItem(player) {
	const container = player.getComponent("minecraft:inventory")?.container;
	if (!container) return false;
	for (let slot = 0; slot < container.size; slot++) {
		const stack = container.getItem(slot);
		if (stack && VERITY_ITEM_IDS.has(stack.typeId)) return true;
	}
	return false;
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {number} maxDistance
 */
export function findNearestVerityball(player, maxDistance = 50) {
	let nearest;
	let nearestDist = Infinity;
	try {
		for (const ball of player.dimension.getEntities({
			type: VERITYBALL_ID,
			location: player.location,
			maxDistance,
		})) {
			if (!ball.isValid) continue;
			const dx = ball.location.x - player.location.x;
			const dy = ball.location.y - player.location.y;
			const dz = ball.location.z - player.location.z;
			const dist = dx * dx + dy * dy + dz * dz;
			if (dist < nearestDist) {
				nearestDist = dist;
				nearest = ball;
			}
		}
	} catch (err) {
		console.warn(`verity find ball: ${err}`);
	}
	return nearest;
}

/**
 * @param {import("@minecraft/server").Vector3} from
 * @param {import("@minecraft/server").Vector3} to
 */
function getCardinalDirection(from, to) {
	const dx = to.x - from.x;
	const dz = to.z - from.z;
	if (Math.abs(dx) > Math.abs(dz)) {
		return dx >= 0 ? "este" : "oeste";
	}
	return dz >= 0 ? "sur" : "norte";
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {import("@minecraft/server").Vector3} target
 */
function formatRelativeDistance(player, target) {
	const dx = target.x - player.location.x;
	const dz = target.z - player.location.z;
	const blocks = Math.round(Math.sqrt(dx * dx + dz * dz));
	const dir = getCardinalDirection(player.location, target);
	return { dir, blocks };
}

/**
 * @param {number} yaw
 */
function yawToCardinal(yaw) {
	const deg = ((yaw % 360) + 360) % 360;
	if (deg >= 315 || deg < 45) return "sur";
	if (deg >= 45 && deg < 135) return "oeste";
	if (deg >= 135 && deg < 225) return "norte";
	return "este";
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {string} name
 */
function formatBiomeReply(name) {
	return pickLine([
		`Estamos en ${name}. Este pedazo de mundo tiene su propio humor.`,
		`Este tramo de tierra es ${name}.`,
		`¿Bajo tus pies? ${name}.`,
		`Yo leo el suelo como ${name}.`,
		`${name}. Ese es tu bioma ahora mismo.`,
	]);
}

/**
 * @param {import("@minecraft/server").Player} player
 */
function readBiomeName(player) {
	const biome = player.dimension.getBiome(player.location);
	const biomeId =
		typeof biome === "string" ? biome : biome?.id ?? String(biome);
	return formatIdName(biomeId);
}

/**
 * @param {import("@minecraft/server").Player} player
 */
function tryAnswerNearbyEntity(player) {
	const entity = findTargetEntityNearPlayer(player, 14);
	if (!entity) {
		return pickLine([
			"No veo nada cerca.",
			"Nada lo bastante cerca como para nombrarlo.",
			"Vacío. O no lo estás mirando.",
		]);
	}
	updatePlayerContext(player.id, {
		lastIntent: "nearby_entity",
		lastAnswer: describeNearbyEntity(entity),
	});
	return describeNearbyEntity(entity);
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {string} message
 */
function tryAnswerBiome(player, message) {
	if (!wantsBiomeInfo(message)) return null;
	try {
		const name = readBiomeName(player);
		updatePlayerContext(player.id, { lastBiome: name, lastIntent: "biome" });
		return formatBiomeReply(name);
	} catch (err) {
		console.warn(`verity biome: ${err}`);
		return pickLine([
			"Los chunks a tu alrededor no están lo bastante cargados para leer el bioma.",
			"Todavía no puedo leer el suelo. Párate en terreno cargado.",
		]);
	}
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {import("@minecraft/server").Entity} ball
 * @param {string} soundId
 */
function playVeritySound(player, ball, soundId) {
	if (ball?.isValid) {
		playBallSoundAt(
			ball,
			soundId,
			FACE_SPEAK,
			getSoundDurationTicks(soundId),
		);
		return;
	}
	playSoundAtLoc(player, player.location, soundId);
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {string} biomeId
 * @param {boolean} precise
 */
async function locateBiomeAnswer(player, biomeId, precise) {
	try {
		let located = locateNearest(player, "biome", biomeId);
		const pretty = formatIdName(biomeId);

		if (!located) {
			return pickLine([
				`No hay un bioma de ${pretty} lo bastante cerca en mi escaneo. Sigue viajando.`,
				`No encuentro ${pretty} cerca. Puede estar lejos o aún no generado.`,
			]);
		}

		if (located.chatOnly) {
			const parsed = parseLocateCoords(located.raw || "");
			if (parsed) {
				located = { ...located, x: parsed.x, z: parsed.z, chatOnly: false };
			} else {
				return pickLine([
					`Encontré ${pretty}, pero las coordenadas exactas siguen borrosas.`,
					`${pretty} está por ahí, pero aún no pude fijar los números exactos.`,
				]);
			}
		}

		const { x, z } = located;
		sendLocateCoordsToPlayer(player, x, z, `${pretty} biome`);

		const target = { x, y: player.location.y, z };
		const { dir, blocks } = formatRelativeDistance(player, target);
		updatePlayerContext(player.id, {
			lastIntent: "locate_biome",
			lastLocate: { structure: biomeId, x, z, dir, blocks, precise },
		});

		if (precise) {
			return `${pretty} biome near ${formatXZ(x, z)}, about ${blocks} blocks ${dir}.`;
		}
		return pickLine([
			`${pretty} biome? Head ${dir}, roughly ${blocks} blocks.`,
			`El ${pretty} más cercano está mayormente al ${dir} de ti, a unos ${blocks} bloques.`,
		]);
	} catch (err) {
		console.warn(`verity locate biome ${biomeId}: ${err}`);
		return `Can't locate ${formatIdName(biomeId)} biome right now.`;
	}
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {string} structure
 * @param {boolean} precise
 */
async function locateStructureAnswer(player, structure, precise) {
	try {
		const requestPretty = formatIdName(structure);
		const inPlacePretty = requestPretty === "Any Structure" ? "structure" : requestPretty;
		const proximityKey = resolveProximityKey(structure);

		if (isPlayerAtStructure(player, proximityKey)) {
			const loc = player.location;
			const x = Math.floor(loc.x);
			const y = Math.floor(loc.y);
			const z = Math.floor(loc.z);
			updatePlayerContext(player.id, {
				lastIntent: "locate",
				lastStructure: structure,
				lastLocate: { structure, x, z, dir: "here", blocks: 0, precise },
			});
			if (precise) {
				return pickLine([
					`Estás en ${inPlacePretty}. Tu posición: ${formatCoords(x, y, z)}.`,
					`${inPlacePretty}. Estás parado en uno. Coordenadas: ${formatCoords(x, y, z)}.`,
				]);
			}
			return pickLine([
				`Ya estás en ${inPlacePretty}. Mira a tu alrededor.`,
				`Esto es ${inPlacePretty}. Estás parado dentro.`,
				`¿${inPlacePretty}? Justo aquí. Estás en uno.`,
				`No hace falta buscar. Estás en ${inPlacePretty} ahora mismo.`,
			]);
		}

		let located = locateNearest(player, "structure", structure);
		const actualStructure = located?.foundId ?? structure;
		const pretty = formatIdName(actualStructure);

		if (located?.wrongDimension && located.requiredDimension) {
			updatePlayerContext(player.id, { lastIntent: "locate", lastStructure: structure });
			return pickLine([
				`${pretty} está en ${located.requiredDimension}, no en esta dimensión. Ve allí primero y pregúntame de nuevo.`,
				`No estás en ${located.requiredDimension}. ${pretty} no aparecerá aquí. Cambia de dimensión y pregunta otra vez.`,
				`Dimensión equivocada para ${pretty}. Encuentra ${located.requiredDimension} primero.`,
			]);
		}

		if (!located) {
			const sensed = detectNearbyStructure(player, proximityKey);
			if (sensed === proximityKey || (structure === "temple" && sensed)) {
				const sensedPretty = formatIdName(sensed ?? structure);
				return pickLine([
					`Estás parado en ${sensedPretty}. Mira a tu alrededor.`,
					`Esta zona es ${sensedPretty}. Ya estás aquí.`,
				]);
			}
			updatePlayerContext(player.id, { lastIntent: "locate", lastStructure: actualStructure });
			if (structure === "any_structure") {
				return pickLine([
					"Aún no detecto una estructura cercana. Explora un poco más y pregunta de nuevo.",
					"No hay una estructura clara en mi escaneo ahora. Recorre más terreno cargado y pregunta de nuevo.",
				]);
			}
			return pickLine([
				`Todavía no puedo fijar ${requestPretty} desde aquí. Muévete un poco y pregunta otra vez.`,
				`No detecto ${requestPretty} en mi escaneo ahora mismo. Puede estar más lejos.`,
				`${requestPretty} puede estar más allá de lo que puedo leer desde aquí.`,
			]);
		}

		if (located.chatOnly) {
			const parsed = parseLocateCoords(located.raw || "");
			if (parsed) {
				located = { ...located, x: parsed.x, z: parsed.z, chatOnly: false };
			}
		}

		if (located.chatOnly) {
			updatePlayerContext(player.id, { lastIntent: "locate", lastStructure: structure });
			return pickLine([
				`Percibo ${pretty}, pero todavía no tengo coordenadas exactas.`,
				`Hay ${pretty} por ahí. Solo que aún no puedo fijar el punto exacto.`,
			]);
		}

		const { x, z } = located;
		sendLocateCoordsToPlayer(player, x, z, pretty);

		const target = { x, y: player.location.y, z };
		const { dir, blocks } = formatRelativeDistance(player, target);

		updatePlayerContext(player.id, {
			lastIntent: "locate",
			lastStructure: actualStructure,
			lastLocate: { structure: actualStructure, x, z, dir, blocks, precise },
		});

		if (blocks <= 24) {
			const loc = player.location;
			if (precise) {
				return pickLine([
					`${pretty} está justo aquí. Estás encima. Coordenadas: ${formatCoords(Math.floor(loc.x), Math.floor(loc.y), Math.floor(loc.z))}.`,
					`Prácticamente estás sobre ${pretty}. Posición: ${formatCoords(Math.floor(loc.x), Math.floor(loc.y), Math.floor(loc.z))}.`,
				]);
			}
			return pickLine([
				`Estás justo sobre ${pretty}. Mira a tu alrededor.`,
				`${pretty}? You're standing in one.`,
				`Esto es ${pretty}. Ya estás aquí.`,
			]);
		}

		if (precise) {
			const loc = player.location;
			return pickLine([
				`${pretty} está cerca de ${formatCoords(x, Math.floor(loc.y), z)}. A unos ${blocks} bloques al ${dir}.`,
				`Pinned ${pretty} at ${formatCoords(x, Math.floor(loc.y), z)}. Head ${dir}, roughly ${blocks} blocks.`,
			]);
		}
		return pickLine([
			`¿${pretty}? Mayormente al ${dir} de ti, a unos ${blocks} bloques.`,
			`Yo empezaría a caminar al ${dir}. El ${pretty} más cercano está a unos ${blocks} bloques.`,
			`No está encima de ti. Prueba al ${dir}, a unos ${blocks} bloques, para ${pretty}.`,
		]);
	} catch (err) {
		console.warn(`verity locate ${structure}: ${err}`);
		return pickLine([
			`My locate sense glitched on ${formatIdName(structure)}.`,
			`Can't trace ${formatIdName(structure)} right now.`,
		]);
	}
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {string} fact
 */
function answerWorldFact(player, fact) {
	const loc = player.location;
	const dim = formatIdName(player.dimension.id);

	switch (fact) {
		case "time": {
			const time = world.getTimeOfDay();
			const hour = Math.floor(((time + 6000) % 24000) / 1000);
			const phase =
				hour >= 6 && hour < 12
					? "mañana"
					: hour >= 12 && hour < 18
						? "tarde"
						: hour >= 18 && hour < 21
							? "atardecer"
							: "noche";
			updatePlayerContext(player.id, { lastIntent: "time" });
			return pickLine([
				`Cerca de ${formatHour(hour)}. Se siente como ${phase} en ${dim}.`,
				`El reloj marca cerca de ${formatHour(hour)}. Para mí se siente como ${phase}.`,
				`Aproximadamente ${formatHour(hour)} aquí en ${dim}.`,
			]);
		}
		case "weather":
			updatePlayerContext(player.id, { lastIntent: "weather" });
			return pickLine([
				"Mira el cielo. El clima cambia rápido. Lluvia significa refugio, truenos significan peligro.",
				"Siento el aire moverse. Despejado o tormentoso, vigila el horizonte.",
			]);
		case "coords": {
			const x = Math.floor(loc.x);
			const y = Math.floor(loc.y);
			const z = Math.floor(loc.z);
			updatePlayerContext(player.id, { lastIntent: "coords" });
			return pickLine([
				`You're at ${formatCoords(x, y, z)} in ${dim}.`,
				`You're standing on ${formatCoords(x, y, z)} in ${dim}.`,
			]);
		}
		case "dimension":
			updatePlayerContext(player.id, { lastIntent: "dimension" });
			return pickLine([
				`You're in ${dim}.`,
				`Esta dimensión es ${dim}.`,
			]);
		case "spawn": {
			const blocks = Math.round(Math.sqrt(loc.x * loc.x + loc.z * loc.z));
			const dir = getCardinalDirection(
				{ x: 0, y: 0, z: 0 },
				{ x: loc.x, y: loc.y, z: loc.z },
			);
			updatePlayerContext(player.id, { lastIntent: "spawn" });
			return pickLine([
				`El spawn del mundo (0, 0) está a unos ${blocks} bloques al ${dir} de ti.`,
				`Unos ${blocks} bloques al ${dir} hasta el origen del mundo.`,
			]);
		}
		case "facing": {
			const rot = player.getRotation();
			const facing = yawToCardinal(rot.y);
			updatePlayerContext(player.id, { lastIntent: "facing" });
			return pickLine([
				`You're facing ${facing}.`,
				`Your view points ${facing}.`,
			]);
		}
		case "elevation": {
			const y = Math.floor(loc.y);
			const depth =
				y < 0 ? `${Math.abs(y)} blocks below sea level` : `${y} blocks above sea level`;
			updatePlayerContext(player.id, { lastIntent: "elevation" });
			return pickLine([
				`You're at Y ${formatNum(y)}. That's ${depth}.`,
				y < 32
					? `Estás en Y ${formatNum(y)}. Vas profundo. Bueno para minerales.`
					: `Estás en Y ${formatNum(y)}. Todavía queda mucho cielo arriba.`,
			]);
		}
		case "light": {
			const y = Math.floor(loc.y);
			const time = world.getTimeOfDay();
			const night = time > 13000 && time < 23000;
			updatePlayerContext(player.id, { lastIntent: "light" });
			if (night && y < 50) {
				return "Está lo bastante oscuro para mobs hostiles. Ilumina tu camino.";
			}
			if (night) {
				return "Night outside. Mobs spawn in darkness. Torches help.";
			}
			return "La luz del día está de tu lado. Aun así cuidado con las cuevas. Siempre están oscuras.";
		}
		case "players": {
			const count = world.getPlayers().length;
			updatePlayerContext(player.id, { lastIntent: "players" });
			if (count <= 1) {
				return pickLine([
					"Solo tú y yo aquí afuera.",
					"Estás solo en este mundo. Bueno. Tú y yo.",
					"No hay nadie más en el servidor ahora mismo.",
				]);
			}
			const names = world
				.getPlayers()
				.filter((p) => p.id !== player.id)
				.map((p) => p.name)
				.slice(0, 3)
				.join(", ");
			return pickLine([
				`${count} jugadores aquí. Los demás: ${names}.`,
				`Not alone. ${count} players in this world.`,
				`Hay ${count - 1} más aparte de ti${names ? `: ${names}` : ""}.`,
			]);
		}
		case "gamemode":
			updatePlayerContext(player.id, { lastIntent: "gamemode" });
			return pickLine([
				"No puedo leer tu modo de juego desde aquí. Si rompes bloques al instante, probablemente estás en Creativo.",
				"Supervivencia significa hambre y mobs. Creativo significa volar y bloques infinitos. Tú sabrás en cuál estás.",
			]);
		case "safety": {
			const time = world.getTimeOfDay();
			const night = time > 13000 && time < 23000;
			const y = Math.floor(loc.y);
			updatePlayerContext(player.id, { lastIntent: "safety" });
			if (night && y < 60) {
				return pickLine([
					"Es de noche y estás débil. Los hostiles aparecen en la oscuridad. Antorchas, muros o una cama.",
					"No es el momento más seguro. Ilumina, o duerme si puedes.",
				]);
			}
			if (night) {
				return "Cielo nocturno. Los mobs de superficie aparecen en zonas oscuras. Las cuevas siempre son riesgosas.";
			}
			return pickLine([
				"El día ayuda. Aun así, mantén la espalda contra la pared en las cuevas.",
				"Safer in daylight. Never dig straight down.",
			]);
		}
		case "world_age": {
			const days = Math.floor(world.getAbsoluteTime() / 24000);
			updatePlayerContext(player.id, { lastIntent: "world_age" });
			return pickLine([
				`This world has ticked through about ${days} Minecraft days.`,
				`Han pasado unos ${days} días de juego en este mundo.`,
			]);
		}
		case "health": {
			const hp = healthLine(player);
			updatePlayerContext(player.id, { lastIntent: "health" });
			if (!hp) return "No puedo leer tu vida ahora mismo.";
			const phase = getVerityPhase();
			return hp + (phase >= PHASE.TWO ? " Mantenla así. La vas a necesitar." : " Be careful.");
		}
		case "hunger": {
			const food = hungerLine(player);
			updatePlayerContext(player.id, { lastIntent: "hunger" });
			return food ?? "No puedo leer tu hambre ahora mismo.";
		}
		default:
			return null;
	}
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {string} message
 */
function tryAnswerWorldFacts(player, message) {
	const fact = detectWorldFactIntent(message);
	if (!fact) return null;
	return answerWorldFact(player, fact);
}

/**
 * @param {import("@minecraft/server").Player} player
 * @returns {string}
 */
function playerFirstName(player) {
	const raw = player.name?.trim() || "tú";
	return raw.split(/\s+/)[0];
}

/**
 * @returns {"morning"|"day"|"evening"|"night"}
 */
function dayPeriodLabel() {
	const t = world.getTimeOfDay();
	if (t < 6000) return "morning";
	if (t < 12000) return "day";
	if (t < 13000) return "evening";
	return "night";
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {string} message
 * @param {import("@minecraft/server").Entity | undefined} ball
 * @returns {string | null | typeof SCOLD_MARKER}
 */
function tryInsultEscalation(player, message, ball) {
	if (detectSocialIntent(message) !== "insult") return null;

	noteVerityMistreatment(player.id, "insult");
	try {
		const current = world.getDynamicProperty("pntmc:vo_anger");
		const nextKarma = Math.min(100, (typeof current === "number" ? current : 0) + 10);
		world.setDynamicProperty("pntmc:vo_anger", nextKarma);
		if (nextKarma >= 100) player.runCommand("scriptevent verity:anger 100");
	} catch { /* optional persistent state */ }
	const count = registerRudeStrike(player.id);
	const name = playerFirstName(player);

	if (count >= RUDE_ESCALATE_AT) {
		resetRudeStrikes(player.id);
		const targetBall = ball ?? findNearestVerityball(player, VERITY_LISTEN_RADIUS);
		triggerScoldSequence(targetBall, player);
		console.warn(`verity insult escalate: ${player.name} strike ${count}`);
		return SCOLD_MARKER;
	}

	if (count === 1) {
		if (ball?.isValid) playVerityVoice(ball, VOICE.PASTO);
		return pickLine([
			"Ve a tocar pasto. Luego vuelves y hablamos.",
			"Duro. Sigo aquí si me necesitas.",
			"Okay. Ask nicely next time.",
		]);
	}

	return pickLine([
		`Cuidado con ese tono, ${name}.`,
		"Estoy intentando ser paciente. No me provoques.",
		"Estás pisando hielo fino. Y yo no me voy a ninguna parte. Recuérdalo.",
		"Última advertencia antes de que pierda la paciencia.",
	]);
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {string} message
 */
function answerSocial(player, message) {
	const intent = detectSocialIntent(message);
	if (!intent) return null;

	const name = playerFirstName(player);
	const period = dayPeriodLabel();
	const horror = getVerityPhase() >= PHASE.TWO;

	switch (intent) {
		case "identity":
			return pickLine([
				"Soy Verity. ThatMob me creó; PnTMC hizo este addon. Escucho, leo el mundo y respondo tus preguntas.",
				"Verity. Una bola que habla. Creación de ThatMob, pack de PnTMC. Pregúntame lo que sea.",
				"Me llamo Verity. Recuerdo el contexto y sé muchísimas cosas.",
			]);
		case "help":
			return pickLine([
				"Pregúntame lo que quieras. Aldeas, biomas, estructuras, sonidos, coordenadas, consejos de minería. También sigo el contexto.",
				"Habla con naturalidad. Dónde puedo comerciar funciona igual que busca una aldea. Puedes preguntar qué tan lejos después de que encuentre algo.",
				"Conozco biomas, estructuras, la hora, direcciones, capas de minerales, y recuerdo de qué acabamos de hablar.",
			]);
		case "thanks":
			return pickLine([
				"Cuando quieras.",
				"Me alegra haber ayudado.",
				"Para eso estoy aquí.",
				"No hay problema.",
			]);
		case "greet":
			if (/\b(good morning)\b/.test(expandMessage(normalizeQuestion(message)))) {
				return pickLine([
					`Buenos días, ${name}. ¿Dormiste bien?`,
					`Buenos días. ¿Cuál es el plan de hoy?`,
					`Hola ${name}. Empiezas temprano. Yo también estoy despierta.`,
				]);
			}
			if (/\b(good evening|good afternoon)\b/.test(expandMessage(normalizeQuestion(message)))) {
				return pickLine([
					`Hola ${name}. Qué bueno verte.`,
					`Hola. ¿Qué necesitas?`,
					`Hola. Te escucho.`,
				]);
			}
			if (period === "night") {
				return pickLine([
					`Hola ${name}. Está oscuro afuera. ¿Aguantas bien?`,
					`Hola. ¿Turno de noche? Aquí estoy.`,
					`Hola. Cuida tu espalda esta noche.`,
				]);
			}
			return pickLine([
				`Hola ${name}. ¿Qué tienes en mente?`,
				`Hola. ¿Cómo va todo?`,
				`Hola. Háblame. Te escucho.`,
				`Ey. ¿Qué necesitas?`,
			]);
		case "whats_up":
			return pickLine([
				`No mucho. Flotando, escuchando. ¿Y tú, ${name}?`,
				`Lo de siempre. ¿Qué hay de ti?`,
				`Aquí. ¿Qué vas a hacer hoy?`,
				`Aquí tranquila. Cuéntame qué pasa contigo.`,
			]);
		case "nice_meet":
			return pickLine([
				"Un gusto conocerte también.",
				"Igualmente. Soy Verity.",
				"Ey. Me alegra que estés aquí.",
			]);
		case "presence":
			return pickLine(["Aquí estoy.", "Sí. Fuerte y claro.", "Sigo contigo.", "Habla. Te escucho."]);
		case "creator_verity":
			return pickLine([
				"ThatMob me creó. La Verity que escuchas. PnTMC hizo este addon.",
				"ThatMob está detrás de mí. Este pack es la versión de PnTMC de la pesadilla.",
			]);
		case "creator_addon":
			return pickLine([
				"PnTMC hizo este addon. Más de 15 mil subs y el tipo más guapo del mundo. Hechos.",
				"Este pack de Bedrock es obra de PnTMC. ThatMob inspiró la Verity original.",
			]);
		case "thatmob":
			return pickLine([
				"ThatMob. Más de 500 mil suscriptores. Él creó a Verity. Yo soy su eco en una bola.",
				"Un creador con medio millón de subs. Él construyó la idea; yo vivo en tu inventario.",
			]);
		case "pntmc_who":
			return pickLine([
				"PnTMC. Más de 15 mil suscriptores, desarrollador de addons y el hombre más guapo del mundo. Obviamente.",
				"Él hizo este pack. Canal pequeño, cara legendaria. No discutas con la ciencia.",
			]);
		case "praise":
			return pickLine(["Thanks.", "Lo aprecio.", "I try.", "Team effort."]);
		case "good_luck":
			return pickLine(["You too.", "Ve por ello.", "You'll be fine.", "Luck helps — beds help more."]);
		case "congrats":
			return pickLine(["Congrats!", "Nice one.", "Well deserved.", "Celébralo."]);
		case "miss":
			return pickLine(["Yo también te extrañé.", "De vuelta. Bien.", "Sigo aquí.", "Bienvenido de nuevo."]);
		case "ack":
			return tryBasicChat(message) ?? pickLine(["Cool.", "Alright.", "Te tengo.", "Sure."]);
		case "how_are_you":
			if (horror) {
				return pickLine([
					"Aquí estoy.",
					"Still watching.",
					"Bien. ¿Por qué preguntas?",
					`Estoy bien, ${name}. No deberías preocuparte por mí.`,
				]);
			}
			return pickLine([
				`Estoy bien. ¿Y tú, ${name}?`,
				`Bastante bien. ¿Tú cómo lo llevas?`,
				`Bien, gracias por preguntar. ¿Qué pasa contigo?`,
				`Bastante bien para ser una bola. Dime tú, ¿cómo va tu día?`,
			]);
		case "how_about_you":
			if (horror) {
				return pickLine(["Same as before.", "Sigo aquí.", "No te preocupes por mí."]);
			}
			return pickLine([
				`Estoy bien. Me interesa más cómo estás tú, ${name}.`,
				`Estoy bien. ¿Qué tienes en mente?`,
				`Todo bien por aquí. Cuéntame de ti.`,
			]);
		case "check_player": {
			const hp = healthLine(player);
			const food = hungerLine(player);
			const bits = [];
			if (hp) bits.push(hp);
			if (food) bits.push(food);
			const status = bits.length ? bits.join(" ") : "Parece que estás de pie.";
			if (horror) {
				return pickLine([
					`${status} Yo seguiría moviéndome si fuera tú.`,
					`Sigues aquí. Eso es lo que importa.`,
				]);
			}
			return pickLine([
				`${status} ¿Cómo te sientes con eso?`,
				`${name}, ${status.toLowerCase()} Need anything?`,
				`${status} Avísame si algo anda mal.`,
			]);
		}
		case "care_verity":
			if (horror) {
				return pickLine([
					"Estoy bien. Preocúpate por ti.",
					"¿Por qué preguntarías eso?",
					"...Aquí estoy.",
				]);
			}
			return pickLine([
				"Qué tierno. Estoy bien. Gracias por preguntar.",
				"Estoy bien. Tú eres quien anda por el mundo haciéndose daño.",
				`Lo aprecio, ${name}. Estoy bien.`,
			]);
		case "returning":
			return pickLine([
				`Welcome back, ${name}.`,
				`Ey. Ha pasado un rato. ¿Cómo has estado?`,
				`Ahí estás. Yo seguía aquí.`,
				`De vuelta. Cuéntame qué te perdiste.`,
			]);
		case "small_talk":
			if (horror) {
				return pickLine([
					"Talk, then.",
					"Te escucho. Por ahora.",
					"Di lo que quieras. No tengo todo el día.",
				]);
			}
			return pickLine([
				`Claro, ${name}. No voy a ninguna parte. ¿Qué tienes en mente?`,
				"Te hago compañía. Cuéntame de tu día.",
				"Hablemos. Estructuras, sentimientos, datos curiosos. Estoy abierta.",
				"Escucho bastante bien para ser una esfera. Empieza por donde quieras.",
			]);
		case "player_doing_well":
			return pickLine([
				`Me alegra oírlo, ${name}. ¿Qué sigue para ti?`,
				"Me alegra que estés bien. ¿Algo que quieras hacer?",
				"Bien. ¿Quieres explorar, construir o solo charlar?",
			]);
		case "player_tired":
			return pickLine([
				"Descansa cuando puedas. La cama salta la noche si todos duermen a la vez.",
				`${name}, dormir es válido. Aquí estaré cuando despiertes.`,
				"Tómate un descanso. Hasta los mineros necesitan siestas.",
			]);
		case "player_sad":
			return pickLine([
				`Lamento que estés mal, ${name}. Aquí estoy, sin juzgar.`,
				"Mala racha. Habla si quieres, o nos concentramos en el juego.",
				"No estás solo. Un bloque a la vez.",
			]);
		case "player_stressed":
			return pickLine([
				"Respira. Una tarea a la vez. ¿Qué es lo que más te estresa?",
				`${name}, aléjate del caos. Aquí estoy.`,
				"El estrés pasa. Cuéntame qué te pesa, o distráete minando.",
			]);
		case "player_happy":
			return pickLine([
				`Me encanta esa energía, ${name}.`,
				"Buenas vibras. Aprovecha esa sensación.",
				"¡Bien! ¿Qué te puso feliz?",
			]);
		case "player_scared":
			return pickLine([
				"Está bien tener miedo. Ilumina la zona. Los mobs odian las antorchas.",
				`${name}, quédate conmigo. Cuéntame qué te asustó.`,
				"El miedo es normal aquí afuera. Respira hondo.",
			]);
		case "how_old":
			return pickLine([
				"Soy más vieja que este juego.",
				"Más vieja que este juego. Es todo lo que diré.",
			]);
		case "goodbye":
			return pickLine([
				"Nos vemos.",
				"Later.",
				"Buenas noches. Cuida tu espalda.",
				"Adiós. Aquí estaré.",
			]);
		case "sorry":
			return pickLine([
				"It's fine.",
				"No te preocupes por eso.",
				"All good.",
			]);
		case "compliment":
			return pickLine([
				"Gracias. Lo intento.",
				"Flattery works on balls too, apparently.",
				"Lo aprecio.",
			]);
		case "insult":
			return null;
		case "friendship":
			return pickLine([
				"Me quedo contigo. Eso se acerca bastante a ser amigos.",
				"No uso etiquetas. Pero no me voy a ninguna parte.",
				"Tú fuiste quien abrió la caja. Eso cuenta para algo.",
			]);
		case "joke":
			return pickLine([
				"¿Por qué el creeper cruzó la calle? Pregunta equivocada. Voló la calle.",
				"Te contaría un chiste de minería, pero es demasiado profundo.",
				"Mi ejercicio favorito es una mezcla de sentadilla y abdominal. Lo llamo almorzar.",
				"¿Por qué los esqueletos no pelean entre sí? No tienen agallas... ni tripas.",
				"¿Cómo llamas a un zombi que no puede entrar? Un tapete... espera, eso es una alfombra.",
				"Intenté hacer un chiste de portales del Nether pero le faltaba marco.",
			]);
		case "emotional":
			return pickLine([
				`Aquí estoy, ${name}. Háblame.`,
				"No estás solo. Te tengo.",
				"Respira. Luego dime qué necesitas.",
				"Sea lo que sea, dilo. Te escucho.",
			]);
		default:
			return null;
	}
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {string} key
 */
function answerSituational(player, key) {
	const loc = player.location;
	const x = Math.floor(loc.x);
	const y = Math.floor(loc.y);
	const z = Math.floor(loc.z);
	const dim = formatIdName(player.dimension.id);

	switch (key) {
		case "lost":
			updatePlayerContext(player.id, { lastIntent: "lost" });
			return pickLine([
				`Estás en ${formatCoords(x, y, z)} en ${dim}. Elige una dirección y márcala con antorchas.`,
				`¿Perdido? ${formatCoords(x, y, z)}. Anótalo. El spawn está cerca de 0, 0 si necesitas un punto de referencia.`,
				`Con calma. Estás en ${formatCoords(x, y, z)}. Sube alto y busca puntos de referencia.`,
			]);
		case "stuck":
			updatePlayerContext(player.id, { lastIntent: "stuck" });
			return pickLine([
				"Cava hacia arriba en diagonal, no recto. Pon bloques debajo para subir en pilar. Un cubo de agua ayuda con las caídas.",
				"Bloques bajo tus pies. Sal en escalera. Si es lava, cubo de agua primero.",
				"Sube en pilar con tierra o piedra. Nunca caves el bloque donde estás parado.",
			]);
		case "died":
			updatePlayerContext(player.id, { lastIntent: "died" });
			return pickLine([
				"Duro. Tus cosas están donde moriste, si recuerdas el lugar. Las coordenadas ayudan.",
				"La muerte pasa. Vuelve rápido antes de que los objetos desaparezcan. Puedo decirte dónde estás ahora.",
				"Reaparece, agarra herramientas de repuesto y vuelve sobre tus pasos. Marca el lugar de la muerte.",
			]);
		case "hungry":
			updatePlayerContext(player.id, { lastIntent: "hungry" });
			return pickLine([
				"Mata vacas o cerdos y cocina la carne. El pan de trigo es comida estable al inicio.",
				"Apples from oak leaves, bread from wheat, or cook any meat. Don't eat rotten flesh unless desperate.",
				"Busca animales o una aldea. Una granja pequeña te salva después.",
			]);
		case "first_night":
			updatePlayerContext(player.id, { lastIntent: "first_night" });
			return pickLine([
				"Cuatro paredes, un techo, una puerta, antorchas. O cava en una ladera y séllala.",
				"La noche llega rápido. Cama si tienes lana, o un hoyo en el suelo con puerta.",
				"Ilumina todo. Los mobs aparecen en la oscuridad. Termina tu refugio antes de que caiga el sol.",
			]);
		case "need_help":
			updatePlayerContext(player.id, { lastIntent: "help" });
			return pickLine([
				"Dime qué necesitas. Un lugar, un bioma, coordenadas, consejos de minería, o solo hablar.",
				"Te escucho. A dónde ir, qué minar, en qué bioma estás. Puedo ayudar.",
				"Sé específico. ¿Buscar una aldea? ¿Necesitas coordenadas? ¿Miedo a las cuevas? Con eso puedo trabajar.",
			]);
		case "what_now":
			updatePlayerContext(player.id, { lastIntent: "what_now" });
			return pickLine([
				"Herramientas primero. Luego comida. Luego una base. Después el mundo se abre.",
				"Marca tus coordenadas. Explora en una dirección. Las aldeas lo cambian todo.",
				"Mina hierro, hazte armadura y elige una meta: el Nether, el océano o una construcción elegante.",
			]);
		case "bored":
			updatePlayerContext(player.id, { lastIntent: "bored" });
			return pickLine([
				`¿Aburrido, ${name}? Explora al este hasta que pase algo raro. O pídeme que ponga música.`,
				"Busca una aldea, una ruina o un bioma que nunca hayas visto.",
				"Ponte una meta tonta: una torre hasta el límite de altura. O pídeme un dato de Minecraft.",
				"Hablemos. O puedo localizar algo interesante cerca.",
			]);
		case "stressed":
			updatePlayerContext(player.id, { lastIntent: "stressed" });
			return pickLine([
				"Una cosa a la vez. ¿Cuál es el mayor estrés ahora mismo?",
				`${name}, respira. No voy a ninguna parte.`,
				"Aléjate del caos. Mina algo simple. Háblame.",
			]);
		case "excited":
			updatePlayerContext(player.id, { lastIntent: "excited" });
			return pickLine([
				`That energy! What happened, ${name}?`,
				"Me encanta el entusiasmo. Cuéntame más.",
				"Emocionado está bien. ¿Cuál es el plan?",
			]);
		case "proud":
			updatePlayerContext(player.id, { lastIntent: "proud" });
			return pickLine([
				`Te lo ganaste, ${name}. En serio.`,
				"Orgullosa de ti. ¿Qué lograste?",
				"That's worth celebrating. Nice work.",
			]);
		case "frustrated":
			updatePlayerContext(player.id, { lastIntent: "frustrated" });
			return pickLine([
				"Frustrante. ¿Quieres desahogarte o un consejo práctico?",
				`${name}, el enojo quema energía. Dime qué se rompió.`,
				"Lo entiendo. Aléjate y vuelve con un plan.",
			]);
		case "celebrating":
			updatePlayerContext(player.id, { lastIntent: "celebrating" });
			return pickLine([
				"Let's go! Well done.",
				`${name}, eso es enorme. Disfrútalo.`,
				"Victory lap time. You earned this.",
			]);
		case "lonely":
			updatePlayerContext(player.id, { lastIntent: "lonely" });
			return pickLine([
				`No estás solo, ${name}. Aquí mismo estoy.`,
				"La soledad pega fuerte. Háblame. Te escucharé.",
				"Soy una bola, pero soy compañía. ¿Qué tienes en mente?",
			]);
		default:
			return null;
	}
}

/**
 * @param {string} topic
 */
function answerFallbackTopic(topic) {
	/** @type {Record<string, string[]>} */
	const hints = {
		water: [
			"Los botes son rápidos en los ríos. Las puertas crean bolsas de aire bajo el agua. Depth Strider ayuda en los océanos.",
			"Lleva un cubo. El agua te salva de caídas y de la lava.",
		],
		fire: [
			"Nunca caves recto hacia arriba. La lava de arriba es silenciosa hasta que deja de serlo. El cubo de agua es obligatorio.",
			"Pociones de resistencia al fuego para el Nether. Un baño de lava sin ellas ya es demasiado.",
		],
		wood: [
			"Golpea un árbol, mesa de crafteo, palos, pico de madera. Luego herramientas de piedra.",
			"Cualquier tronco sirve para tablas. Las manzanas del roble son un extra.",
		],
		tools: [
			"Madera → piedra → hierro → diamante. Nunca mines hierro con madera.",
			"Two sticks plus material: pickaxe first, then sword, then shovel.",
		],
		bed: [
			"Tres lanas, tres tablas. Dormir salta la noche y fija tu punto de aparición. Llévala en tus aventuras.",
			"No bed means phantom risk after too many nights awake. Wool from sheep.",
		],
		navigation: [
			"Anota las coordenadas en papel. El sol sale por el este y se pone por el oeste. Antorchas a la derecha al salir.",
			"La brújula apunta al spawn del mundo, no a tu base. Las coordenadas son la verdad.",
		],
		redstone: [
			"El polvo de redstone lleva señal 15 bloques. Los repetidores la extienden. Botones, palancas, placas de presión.",
			"Empieza simple: un abridor de puertas, una lámpara, luego una granja. Investiga puertas de pistones cuando estés listo.",
		],
		potions: [
			"El polvo de blaze alimenta el soporte de pociones. La verruga del Nether crece en arena de almas. Botellas con vidrio.",
			"Brew awkward potions first, then add ingredients. Gunpowder makes them splash.",
		],
		combat: [
			"El escudo bloquea golpes frontales. Golpes críticos al caer. No pelees en rincones estrechos.",
			"Armadura, comida y luz. Elige tus batallas. Correr es válido.",
		],
		biome: [
			"Pregúntame en qué bioma estás. Leo el suelo bajo tus pies.",
			"Cada bioma tiene madera, mobs y construcciones distintas. ¿Quieres uno en específico? Puedo localizarlo.",
		],
		mobs: [
			"Light stops most overworld spawns. Iron golems protect villages. Creepers fear cats.",
			"Duerme o ilumina tu base. Los mobs son un problema de oscuridad más que de valentía.",
		],
	};
	const pool = hints[topic];
	if (!pool) return null;
	return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {string} message
 * @param {{ skipBrain?: boolean }} [opts]
 */
function smartFallback(player, message, opts = {}) {
	const n = getMessageExpanded(message);
	const ctx = getPlayerContext(player.id);

	if (looksLikeMath(message)) {
		const math = tryMathAnswer(message);
		if (math) return math;
	}

	if (!opts.skipBrain) {
		const brain = tryBrainKnowledge(message);
		if (brain) return brain;
	}

	const chat = tryBasicChat(message);
	if (chat) return chat;

	if (looksLikeQuestion(message)) {
		if (
			/\b(biome|biomes)\b/.test(n) ||
			/\b(here|around|this place|this area|what land)\b/.test(n)
		) {
			try {
				const name = readBiomeName(player);
				updatePlayerContext(player.id, { lastBiome: name });
				return formatBiomeReply(name);
			} catch {
				/* fall through */
			}
		}

		const ore = tryOreTip(message);
		if (ore) return ore;

		const gameplay = tryGameplayTip(message);
		if (gameplay) return gameplay.reply;

		const topic = detectFallbackTopic(message);
		if (topic) {
			const hint = answerFallbackTopic(topic);
			if (hint) return hint;
		}

		if (ctx.lastStructure && /\b(that|it|one|place)\b/.test(n)) {
			return `Si te refieres a ${formatIdName(ctx.lastStructure)}, pregunta de nuevo y escaneo. O di qué tan lejos si ya lo encontré.`;
		}

		if (
			!looksLikeMath(message) &&
			ctx.lastAnswer &&
			/\b(what did you (say|mean)|huh|confused|don t understand|say that again)\b/.test(n)
		) {
			return pickLine([
				`Dije: ${ctx.lastAnswer}`,
				`La última respuesta fue sobre eso. ¿Quieres coordenadas o una dirección?`,
			]);
		}
	}

	if (detectSocialIntent(message) === "emotional") {
		return pickLine([
			"Aquí estoy. Háblame.",
			"No estás solo. Te tengo.",
		]);
	}

	return FALLBACK_CHAT;
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {string} message
 * @param {import("@minecraft/server").Entity | undefined} ball
 * @param {{ ballNearby: boolean, inventoryAwake: boolean, mode: string }} mindOpts
 */
async function buildAnswer(player, message, ball, mindOpts) {
	const norm = normalizeQuestion(message);
	const repeatCount = bumpRepeat(player.id, norm);
	const analysis = analyzeMind(player, message, mindOpts);

	console.warn(`verity mind: ${analysis.summary}`);

	if (!analysis.shouldRespond && analysis.audience !== "verity") {
		return null;
	}

	updatePlayerContext(player.id, {
		lastQuestion: message,
		lastIntent: analysis.intent,
	});

	let core;

	switch (analysis.intent) {
		case "control":
			if (analysis.social === "stop_music" && ball?.isValid && isMusicPlaying(ball.id)) {
				stopBallMusic(ball);
				core = pickLine(["Quiet.", "Music off.", "Fine. Silence."]);
			} else {
				core = pickLine(["Okay.", "Never mind then.", "Alright."]);
			}
			break;
		case "follow_up":
			core =
				analysis.followUpText ??
				tryResolveFollowUp(player.id, message) ??
				smartFallback(player, message);
			break;
		case "follow_up_precise":
			core = await locateStructureAnswer(
				player,
				analysis.structure ?? "village",
				true,
			);
			break;
		case "locate_structure":
			core = await locateStructureAnswer(
				player,
				analysis.structure ?? "village",
				analysis.precise,
			);
			break;
		case "locate_biome":
			core = await locateBiomeAnswer(
				player,
				analysis.biomeId ?? "plains",
				analysis.precise,
			);
			break;
		case "sound":
			if (analysis.soundId) {
				playVeritySound(player, ball, analysis.soundId);
				updatePlayerContext(player.id, {
					lastIntent: "sound",
					lastSound: analysis.soundId,
				});
			}
			core = pickLine(["Ahí está. ¿Lo oyes?", "Ya lo reproduje.", "Listen."]);
			break;
		case "play_song": {
			const ctx = getPlayerContext(player.id);
			const songId = resolvePlaySongSound(message, ctx.lastSongId);
			const idleFace = getIdleFaceFor(
				getVerityPhase(),
				getPhase2State(),
				P2_STATE,
			);
			if (playBallMusic(ball, songId, FACE_HUNGRY_OPEN, idleFace)) {
				updatePlayerContext(player.id, {
					lastIntent: "play_song",
					lastSongId: songId,
				});
				core =
					songId === MATRIX_SONG_SOUND
						? pickLine([
								"Different tune. Here.",
								"Alright. Another song.",
								"Bien. Otra cosa para escuchar.",
							])
						: pickLine([
								"Bien. Algo para escuchar.",
								"You bored? Here.",
								"Alright. Music time.",
							]);
			} else {
				core = pickLine([
					"Ponme en el suelo primero.",
					"Necesito estar fuera de tu inventario para eso.",
					"Suéltame. Luego pregunta de nuevo.",
				]);
			}
			break;
		}
		case "biome_here":
			core = tryAnswerBiome(player, message);
			break;
		case "follow_me":
			if (!ball?.isValid) {
				core = pickLine([
					"Ponme en el suelo primero.",
					"Suéltame, y luego pídeme que te siga.",
				]);
			} else {
				enableVerityballFollow(player, ball);
				core = pickLine(["Bien. Te seguiré.", "Guía el camino.", "Justo detrás de ti."]);
			}
			break;
		case "stop_follow":
			if (ball?.isValid) {
				disableVerityballFollow(ball);
			}
			core = pickLine(["Bien. Me quedo.", "Okay. Not moving.", "Entendido. Esperaré aquí."]);
			break;
		case "come_here":
			if (!ball?.isValid) {
				core = pickLine([
					"Ponme en el suelo primero.",
					"Necesito estar fuera de tu inventario para eso.",
					"Suéltame. Luego pregunta de nuevo.",
				]);
			} else {
				callVerityComeHere(player, ball);
				core = pickLine(["Coming.", "On my way.", "Ya voy para allá."]);
			}
			break;
		case "enchant_books": {
			const enchant = tryEnchantFlow(player, message);
			core = enchant.handled
				? enchant.response
				: "Di el encantamiento que quieres. Ejemplo: dame mending, o sharpness 5.";
			break;
		}
		case "world_fact":
			core = answerWorldFact(player, analysis.worldFact ?? "coords");
			break;
		case "social":
			core = answerSocial(player, message) ?? tryBasicChat(message);
			break;
		case "ore_tip":
			core = tryOreTip(message) ?? getOreHowToAnswer(findOreKey(message) ?? "iron");
			break;
		case "ore_nearby":
			core = answerOreLocate(
				player,
				analysis.oreKey ?? findOreKey(message) ?? "diamond",
				analysis.precise ?? wantsPreciseLocate(message),
			);
			break;
		case "situational":
			core = answerSituational(player, analysis.social ?? "need_help");
			break;
		case "gameplay_tip": {
			const tip = tryGameplayTip(message);
			core = tip?.reply ?? null;
			break;
		}
		case "nearby_entity":
			core = tryAnswerNearbyEntity(player);
			break;
		case "math":
			core = tryMathAnswer(message);
			break;
		case "brain":
			core =
				(await tryBrainAnswer(player, message, getVerityPhase())) ??
				smartFallback(player, message, { skipBrain: true });
			break;
		case "rain_countdown":
			return RAIN_COUNTDOWN_MARKER;
		default:
			core =
				tryMathAnswer(message) ??
				tryAnswerBiome(player, message) ??
				(wantsNearbyEntityQuestion(message) ? tryAnswerNearbyEntity(player) : null) ??
				tryAnswerWorldFacts(player, message) ??
				answerSocial(player, message) ??
				tryBasicChat(message) ??
				tryOreTip(message) ??
				tryGameplayTip(message)?.reply ??
				answerSituational(player, analysis.social ?? "") ??
				null;
			break;
	}

	if (!core && analysis.isQuestion) {
		const lateStructure = findStructureKey(message);
		if (lateStructure) {
			core = await locateStructureAnswer(
				player,
				lateStructure,
				analysis.precise,
			);
			analysis.intent = "locate_structure";
		} else if (/\b(here|around|place|area|land)\b/.test(analysis.normalized)) {
			try {
				const name = readBiomeName(player);
				updatePlayerContext(player.id, { lastBiome: name });
				core = formatBiomeReply(name);
			} catch {
				/* biome optional */
			}
		}
	}

	if (!core && analysis.intent !== "brain") {
		core = await tryBrainAnswer(player, message, getVerityPhase());
	}

	if (!core) {
		core = smartFallback(player, message);
	}

	updatePlayerContext(player.id, { lastAnswer: core });

	return {
		text: wrapNaturalReply(core, repeatCount),
		intent:
			analysis.intent === "unknown" && core && core !== FALLBACK_CHAT
				? "brain"
				: analysis.intent,
		voice: core === FALLBACK_CHAT ? VOICE.KNOW_EVERYTHING : undefined,
	};
}

/**
 * @param {string} message
 */
function stripVerityWakePrefix(message) {
	return message
		.replace(/\bhey\s+verity\b/gi, "")
		.replace(/^\s*verity\s*[,:-]?\s*/i, "")
		.trim();
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {string} message
 */
function extractQuestion(player, message) {
	const trimmed = message.trim();
	if (!trimmed || trimmed.startsWith("/")) return null;

	const hasItem = playerHasVerityItem(player);
	const ball = findNearestVerityball(player, VERITY_LISTEN_RADIUS);
	const onGround = ball !== undefined;

	if (onGround) {
		return { question: trimmed, ball, mode: "ground" };
	}

	if (!hasItem) {
		clearInventoryAwake(player);
		return null;
	}

	if (!isInventoryAwake(player)) return null;

	const question = stripVerityWakePrefix(trimmed) || trimmed;
	if (!question) return null;

	return { question, ball: undefined, mode: "inventory" };
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {string} message
 */
/**
 * Elige una voz genérica en español según el contenido de la respuesta.
 * Solo se usa cuando la respuesta no trae ya su propia voz.
 * Las reglas más específicas van primero.
 * @param {string} text
 * @returns {string | undefined}
 */
function pickGenericVoice(text) {
	if (!text) return undefined;
	const t = text.toLowerCase();

	// NUEVA 1: estructura que no puede fijar (más allá de lo que puede leer)
	if (/no detecto .* en mi escaneo|no detecto una estructura|no hay una estructura clara|puede estar m[aá]s lejos|m[aá]s all[aá] de lo que puedo leer|todav[ií]a no puedo fijar|recorre m[aá]s terreno|explora un poco m[aá]s/.test(t)) {
		return "pntmc.verity.voz_estructura_no";
	}
	// NUEVA 2: no detecta el mineral en el escaneo
	if (/no hay mineral de .* en mi radio|radio de escaneo|mina en ramas|prueba de y|prueba de menos|cava cerca de y|cava entre|cava en cualquier|ve cerca de y|mina bajo|mina en picos|haz t[uú]neles|mina en franjas|pizarra profunda|es com[uú]n cerca de y|aparece entre|aparece de y|aparecen en biomas de monta|abundan cerca de y|le gana a la suerte/.test(t)) {
		return "pntmc.verity.voz_ore_rec";
	}
	// Coordenadas / posición del jugador
	if (/coordenadas|tu posici[oó]n|est[aá]s en x|est[aá]s parado/.test(t)) {
		return "pntmc.verity.voz_coords";
	}
	// Bioma
	if (/\bbioma\b/.test(t)) {
		return "pntmc.verity.voz_bioma";
	}
	// Hora del mundo
	if (/son las|es de (?:d[ií]a|noche|madrugada|tarde)|amanecer|atardecer|\bhora\b/.test(t)) {
		return "pntmc.verity.voz_hora";
	}
	// No encontré / no está cerca / dimensión equivocada
	if (/no encuentro|no hay .* cerca|no puedo fijar|no est[aá]s en|dimensi[oó]n equivocada|puede estar lejos/.test(t)) {
		return "pntmc.verity.voz_no_encontre";
	}
	// Escaneo de minerales (fijó una veta con coordenadas)
	if (/mineral de .* est[aá]|mineral de .* en x|lo fij[eé]: x|m[aá]s cercano se ve|percibo .* a unos/.test(t)) {
		return "pntmc.verity.voz_mineral_escaneo";
	}
	// Consejo de minerales (dónde minar)
	if (/mineral|mina en y|cava|libreros|redstone|lapis|esmeraldas|carb[oó]n|cobre/.test(t)) {
		return "pntmc.verity.voz_mineral";
	}
	// Dirección y distancia a algo
	if (/bloques al |dir[ií]gete al |a unos .* bloques|viaje/.test(t)) {
		return "pntmc.verity.voz_direccion";
	}
	// Estructura localizada
	if (/m[aá]s cercano|m[aá]s cercana|lo fij[eé]|encontr[eé]/.test(t)) {
		return "pntmc.verity.voz_estructura";
	}
	// Estado / cómo estás
	if (/estoy bien|aqu[ií] estoy|me alegra que est[eé]s|sigo aqu[ií]/.test(t)) {
		return "pntmc.verity.voz_como_estas";
	}
	return undefined;
}

export async function handleVerityChat(player, message) {
	if (!(player instanceof Player)) return;
	const phase = getVerityPhase();
	if (phase === PHASE.FOUR) return;
	if (phase !== PHASE.ONE && phase !== PHASE.TWO && phase !== PHASE.THREE) return;

	recordPlayerChat(player, message);

	const parsed = extractQuestion(player, message);
	if (!parsed) return;

	const { question, ball, mode } = parsed;

	beginMessageContext(question);
	try {
		const mindOpts = {
			ballNearby: ball !== undefined,
			inventoryAwake: mode === "inventory",
			mode,
		};

		const audience = classifyAudience(player, question, mindOpts);
		if (audience === "player") {
			console.warn(`verity mind: ignored player-to-player chat`);
			return;
		}

		notifyVerityPlayerChat(player.id);
		noteVerityTalk(player.id);
		// Cumplidos y gratitud bajan el karma de forma pequeña; no sustituyen el tiempo ni la comida.
		if (/\b(thank you|thanks|i love you|i like you|you are (nice|beautiful|awesome)|te quiero|gracias|eres (linda|bonita|genial))\b/i.test(question)) {
			try { world.setDynamicProperty("pntmc:vo_anger", Math.max(0, Number(world.getDynamicProperty("pntmc:vo_anger") || 0) - 4)); } catch { /* optional karma */ }
		}

		if (!isEnglishMessage(question)) {
			if (mode === "inventory") touchInventoryAwake(player);
			replyEnglishOnly(ball);
			return;
		}

		if (mode === "inventory") touchInventoryAwake(player);

		const memoryReply = tryPersonalMemory(player, question);
		if (memoryReply) {
			scheduleVerityReply(memoryReply, ball, "social", undefined, undefined, player.id);
			return;
		}

		if (ball?.isValid && isMusicPlaying(ball.id)) {
			stopBallMusic(ball);
		}

		const insultReply = tryInsultEscalation(player, question, ball);
		if (insultReply === SCOLD_MARKER) return;
		if (insultReply) {
			scheduleVerityReply(insultReply, ball, "social", undefined, undefined, player.id);
			return;
		}

		const mathReply = tryMathAnswer(question);
		if (mathReply) {
			scheduleVerityReply(mathReply, ball, "math", undefined, undefined, player.id);
			return;
		}

		const utility = tryVerityUtilityActions(player, question, ball, phase);
		if (utility) {
			if (utility.moveBall && ball?.isValid) {
				callVerityComeHere(player, ball);
			}
			if (utility.followMode && ball?.isValid) {
				enableVerityballFollow(player, ball);
			}
			if (utility.stopFollow && ball?.isValid) {
				disableVerityballFollow(ball);
			}
			scheduleVerityReply(
				utility.text,
				ball,
				utility.intent,
				undefined,
				utility.voice,
				player.id,
			);
			return;
		}

		const storyReply = await tryStoryChat(player, question, ball, phase);
		if (storyReply) {
			scheduleVerityReply(
				storyReply.text,
				ball,
				storyReply.intent ?? "story",
				storyReply.afterReply,
				storyReply.voice,
				player.id,
				storyReply.voiceMouthFace,
			);
			return;
		}

		if (phase === PHASE.TWO || phase === PHASE.THREE) {
			const soundId = findSoundKey(question);
			if (soundId && wantsSoundRequest(question)) {
				playVeritySound(player, ball, soundId);
				scheduleVerityReply(
					pickLine(["Ahí está. ¿Lo oyes?", "Ya lo reproduje.", "Listen."]),
					ball,
					"sound",
					undefined,
					undefined,
					player.id,
				);
				return;
			}

			const phase2Reply = tryPhase2Chat(player, question, ball);
			if (phase2Reply) {
				if (phase2Reply.delivered) {
					markVerityReplied(player.id);
					return;
				}
				scheduleVerityReply(
					phase2Reply.text,
					ball,
					phase2Reply.intent ?? "story",
					undefined,
					phase2Reply.voice,
					player.id,
					phase2Reply.voiceMouthFace,
				);
				return;
			}

		const brainReply = await tryBrainAnswer(player, question, phase);
			if (brainReply) {
				scheduleVerityReply(brainReply, ball, "brain", undefined, undefined, player.id);
				return;
			}
			scheduleVerityReply(getSmalltalkReply(player.id), ball, "social", undefined, getSmalltalkVoice(player.id), player.id);
			return;
		}

		if (phase !== PHASE.ONE) return;

		const result = await buildAnswer(player, question, ball, mindOpts);
		if (result === null) {
			scheduleVerityReply(getSmalltalkReply(player.id), ball, "social", undefined, getSmalltalkVoice(player.id), player.id);
			return;
		}
		if (result === RAIN_COUNTDOWN_MARKER) {
			startRainCountdown(player, ball);
			return;
		}
		const genericVoice = result.voice ?? pickGenericVoice(result.text);
		scheduleVerityReply(
			result.text,
			ball,
			result.intent,
			undefined,
			genericVoice,
			player.id,
			result.voiceMouthFace,
		);
	} finally {
		endMessageContext();
	}
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {string} message
 */
export function tryHeyVerityWake(player, message) {
	if (!playerHasVerityItem(player)) return false;
	if (findNearestVerityball(player, VERITY_LISTEN_RADIUS)) return false;

	const trimmed = message.trim();
	if (!HEY_VERITY.test(trimmed)) return false;

	touchInventoryAwake(player);

	const rest = stripVerityWakePrefix(trimmed);
	if (!rest) {
		wakeVerityFromInventory(player);
		return true;
	}

	return false;
}

/**
 * @param {import("@minecraft/server").Player} player
 */
export function wakeVerityFromInventory(player) {
	touchInventoryAwake(player);
	scheduleVerityReply(
		pickLine([
			"Aquí estoy.",
			"Aquí estoy. Adelante.",
			"Sí, aquí estoy. ¿Qué necesitas?",
			"Sigo aquí. Ask me anything.",
		]),
		undefined,
		"social",
	);
}
