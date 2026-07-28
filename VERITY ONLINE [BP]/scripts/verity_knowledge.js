import {
	expandMessage,
	normalizeQuestion,
	tokenize,
	classifyOreIntent,
	findOreKey,
} from "./verity_intent.js";
import { looksLikeMath, tryMathAnswer } from "./verity_math.js";
import { KNOWLEDGE_ENTRIES } from "./verity_knowledge_data.js";
import { tryBasicChat } from "./verity_chat.js";

const QUESTION_LEAD =
	/^(?:what|who|where|when|why|how|which|can|could|would|should|is|are|do|does|did|will|tell me about|explain|define|describe)\b/i;

/** @type {Map<string, import("./verity_knowledge_data.js").KnowledgeEntry[]>} */
const KEYWORD_INDEX = new Map();

for (const entry of KNOWLEDGE_ENTRIES) {
	for (const keyword of entry.keywords) {
		const key = keyword.toLowerCase();
		const bucket = KEYWORD_INDEX.get(key);
		if (bucket) bucket.push(entry);
		else KEYWORD_INDEX.set(key, [entry]);
	}
}

/**
 * @param {string} n
 * @param {Set<string>} tokens
 * @returns {import("./verity_knowledge_data.js").KnowledgeEntry[]}
 */
function knowledgeCandidates(n, tokens) {
	/** @type {Set<import("./verity_knowledge_data.js").KnowledgeEntry>} */
	const seen = new Set();
	for (const token of tokens) {
		const hits = KEYWORD_INDEX.get(token);
		if (!hits) continue;
		for (const entry of hits) seen.add(entry);
	}
	if (seen.size > 0) return [...seen];
	if (!QUESTION_LEAD.test(n) && !n.includes("?")) return [];
	return KNOWLEDGE_ENTRIES;
}

const TOPIC_EXTRACT =
	/\b(?:what is|what are|who is|who are|what s|whats|define|explain|tell me about|how does|how do|why is|why are)\s+(?:an?|the)?\s*(.+)$/i;

/**
 * @param {string} message
 */
function pickAnswer(answers) {
	return answers[Math.floor(Math.random() * answers.length)];
}

/**
 * Fast check for mind ranking — avoids scoring all 100+ entries on every chat line.
 * @param {string} message
 * @param {string} [normalized]
 * @param {Set<string>} [tokens]
 */
export function likelyKnowledgeMatch(message, normalized, tokens) {
	const trimmed = message.trim();
	if (!trimmed || looksLikeMath(trimmed)) return false;
	if (findOreKey(trimmed) && classifyOreIntent(trimmed)) return false;

	const n = normalized ?? expandMessage(normalizeQuestion(trimmed));
	const tok = tokens ?? new Set(tokenize(n));
	const candidates = knowledgeCandidates(n, tok);
	const minScore = QUESTION_LEAD.test(trimmed) ? 5 : 6;

	for (const entry of candidates) {
		if (scoreEntry(trimmed, entry, n, tok) >= minScore) return true;
	}
	return false;
}

/**
 * @param {string} message
 * @param {import("./verity_knowledge_data.js").KnowledgeEntry} entry
 * @param {string} [normalized]
 * @param {Set<string>} [tokens]
 */
function scoreEntry(message, entry, normalized, tokens) {
	const raw = message.toLowerCase();
	const n = normalized ?? expandMessage(normalizeQuestion(message));
	const tok = tokens ?? new Set(tokenize(n));

	for (const pattern of entry.patterns ?? []) {
		if (pattern.test(raw) || pattern.test(n)) return 100;
	}

	let score = 0;
	for (const keyword of entry.keywords) {
		const kw = keyword.toLowerCase();
		if (tok.has(kw)) score += 4;
		else if (n.includes(kw)) score += 2;
	}
	return score;
}

/**
 * @param {string} message
 * @returns {string | null}
 */
export function tryKnowledgeAnswer(message) {
	const trimmed = message.trim();
	if (!trimmed) return null;
	if (looksLikeMath(trimmed)) return null;
	if (findOreKey(trimmed) && classifyOreIntent(trimmed)) return null;

	const n = expandMessage(normalizeQuestion(trimmed));
	const tokens = new Set(tokenize(n));
	const candidates = knowledgeCandidates(n, tokens);
	const minScore = QUESTION_LEAD.test(trimmed) ? 5 : 6;

	let best = null;
	let bestScore = 0;

	for (const entry of candidates) {
		const score = scoreEntry(trimmed, entry, n, tokens);
		if (score > bestScore) {
			bestScore = score;
			best = entry;
		}
	}

	if (best && bestScore >= minScore) {
		return pickAnswer(best.answers);
	}

	return null;
}

/**
 * @param {string} topic
 */
function guessDomain(topic) {
	const t = topic.toLowerCase();
	if (/\b(mob|block|craft|mine|nether|end|enchant|biome|redstone)\b/.test(t)) {
		return "Minecraft";
	}
	if (/\b(planet|star|space|galaxy|moon|sun)\b/.test(t)) return "astronomy";
	if (/\b(war|king|empire|century|ancient)\b/.test(t)) return "history";
	if (/\b(cell|gene|body|brain|disease)\b/.test(t)) return "biology";
	if (/\b(code|computer|software|internet)\b/.test(t)) return "technology";
	return "el mundo real y los juegos";
}

/**
 * Thoughtful fallback when no entry matches — feels more alive than a static line.
 * @param {string} message
 * @returns {string | null}
 */
export function tryInferenceAnswer(message) {
	const trimmed = message.trim();
	if (!QUESTION_LEAD.test(trimmed) && !trimmed.includes("?")) return null;

	if (looksLikeMath(trimmed)) {
		const math = tryMathAnswer(trimmed);
		if (math) return math;
		return pickAnswer([
			"Puedo hacer aritmética. Prueba 5+5 o cuánto es 12*3.",
			"Dame números y operadores. Ejemplo: ¿cuánto es 7 dividido entre 2?",
		]);
	}

	const topicMatch = trimmed.replace(/\?+$/, "").match(TOPIC_EXTRACT);
	if (topicMatch) {
		const topic = topicMatch[1].replace(/\?+$/, "").trim();
		if (topic.length >= 2 && topic.length <= 80) {
			const domain = guessDomain(topic);
			return pickAnswer([
				`${topic.charAt(0).toUpperCase() + topic.slice(1)}: eso es ${domain}. Pregúntame algo más concreto: uso en Minecraft, ciencia real o un cómo-se-hace.`,
				"Buena pregunta. No la tengo archivada palabra por palabra, pero intenta reformularla o dime qué parte te interesa: historia, jugabilidad o cómo funciona.",
				`Sé bastante sobre ${topic} a grandes rasgos. Acota más: ¿definición, pasos, o dónde encontrarlo en el juego?`,
			]);
		}
	}

	if (/\b(help|stuck|lost|don t know|idk|confused)\b/i.test(trimmed)) {
		return pickAnswer([
			"Dime qué intentas hacer: encontrar algo, sobrevivir o entender una cosa. Te guío paso a paso.",
			"Empieza por la meta. Puedo localizar lugares, explicar mecánicas o responder preguntas directas.",
		]);
	}

	if (/\b(talk to me|say something|speak)\b/i.test(trimmed) && trimmed.length < 60) {
		return pickAnswer([
			"Aquí estoy. Haz una pregunta o saluda.",
			"Claro. ¿Qué tienes en mente?",
			"Habla con confianza. Yo escucho.",
		]);
	}

	if (/\b(i love you|love you verity)\b/i.test(trimmed)) {
		return pickAnswer([
			"Qué tierno. Yo también te tengo cariño.",
			"Cuidado. Soy una bola, pero lo aprecio.",
			"Gracias. Ahora ve a minar algo brillante.",
		]);
	}

	if (QUESTION_LEAD.test(trimmed)) {
		return pickAnswer([
			"Te oigo. Dame una pregunta clara: qué es, dónde está, cómo hago... y responderé como se debe.",
			"Pregunta como si hablaras con alguien que de verdad sabe cosas. Yo sé. Sé específico.",
			"Intenta de nuevo con una pregunta directa. Manejo datos, Minecraft, direcciones y cosas raras.",
		]);
	}

	return null;
}

/**
 * @param {string} message
 * @returns {string | null}
 */
export function tryBrainKnowledge(message) {
	return (
		tryMathAnswer(message) ??
		tryKnowledgeAnswer(message) ??
		tryBasicChat(message) ??
		tryInferenceAnswer(message)
	);
}
