/**
 * Basic chat — greetings, reactions, short replies (no BDS/cloud needed).
 * @param {string[]} answers
 */
function pick(answers) {
	return answers[Math.floor(Math.random() * answers.length)];
}

/** @type {{ patterns: RegExp[], answers: string[] }[]} */
const CHAT_ENTRIES = [
	{
		patterns: [/^nice!*$/i, /^cool!*$/i, /^sweet!*$/i, /^awesome!*$/i, /^sick!*$/i],
		answers: ["¿Verdad?", "Me alegra que lo pienses.", "Lo intento.", "Sí, tiene sentido."],
	},
	{
		patterns: [/^wow!*$/i, /^whoa!*$/i, /^omg!*$/i, /^no way!*$/i],
		answers: ["Lo sé, ¿verdad?", "Increíble.", "Ni me lo digas.", "Pasa más seguido de lo que crees."],
	},
	{
		patterns: [/^lol!*$/i, /^lmao!*$/i, /^haha+!*$/i, /^hehe+!*$/i, /\bthat s funny\b/i],
		answers: ["Me alegra poder divertir siendo una esfera.", "Oro puro de comedia, lo sé.", "Me río contigo.", "Lo acepto."],
	},
	{
		patterns: [/^ok!*$/i, /^okay!*$/i, /^k!*$/i, /^alright!*$/i, /^aight!*$/i, /\bgot it\b/i, /\bunderstood\b/i],
		answers: ["Genial.", "Está bien.", "Te tengo.", "Cuando estés listo."],
	},
	{
		patterns: [/^yes!*$/i, /^yeah!*$/i, /^yep!*$/i, /^yup!*$/i, /^sure!*$/i, /^definitely!*$/i],
		answers: ["Bien.", "Entonces estamos en la misma página.", "Me funciona.", "Bien. ¿Qué sigue?"],
	},
	{
		patterns: [/^no!*$/i, /^nah!*$/i, /^nope!*$/i, /^not really\b/i],
		answers: ["Es justo.", "Está bien, otro enfoque entonces.", "No hay problema. Pregunta otra cosa.", "Bien. Sigo aquí."],
	},
	{
		patterns: [/^hmm+!*$/i, /^um+!*$/i, /^uh+!*$/i, /\bi guess\b/i, /\bmaybe\b/i],
		answers: ["Tómate tu tiempo.", "Sin prisa.", "Pensar está permitido.", "Dilo cuando te haga clic."],
	},
	{
		patterns: [/^idk!*$/i, /\bi don t know\b/i, /\bno idea\b/i],
		answers: ["Está bien. Pregúntame. Puede que lo sepa.", "Empieza con lo que sí sabes.", "Podemos resolverlo juntos."],
	},
	{
		patterns: [/^brb!*$/i, /\bbe right back\b/i, /\bhold on\b/i, /\bwait a sec\b/i],
		answers: ["Aquí estaré.", "Tómate tu tiempo.", "Claro. Esperaré.", "No hay problema."],
	},
	{
		patterns: [/^really\??$/i, /^for real\??$/i, /^seriously\??$/i],
		answers: ["Sí.", "Totalmente en serio.", "A menos que esté bromeando. No lo estoy.", "Es la verdad."],
	},
	{
		patterns: [/^interesting\.?$/i, /^huh\.?$/i, /^oh\.?$/i, /^ah\.?$/i, /^i see\.?$/i],
		answers: ["¿Verdad?", "¿Quieres que profundice?", "Pregunta si quieres la versión completa.", "Normalmente hay más detrás."],
	},
	{
		patterns: [/\bnice to meet you\b/i, /\bpleasure to meet\b/i, /\bgood to meet you\b/i],
		answers: [
			"Un gusto conocerte también. Soy Verity.",
			"Igualmente. Pregúntame lo que sea.",
			"Ey. Me alegra que estés aquí.",
		],
	},
	{
		patterns: [/\bwhat s up\b/i, /\bwassup\b/i, /\bhow s it going\b/i, /\bhow goes it\b/i],
		answers: [
			"No mucho. Flotando, escuchando. ¿Tú?",
			"Todo bien por mi lado. ¿Qué hay de ti?",
			"Lo de siempre. ¿Qué necesitas?",
		],
	},
	{
		patterns: [/\bare you there\b/i, /\byou there\b/i, /\bcan you hear me\b/i, /^verity\??$/i, /^verity!+$/i],
		answers: ["Aquí estoy.", "Fuerte y claro.", "Sí. Háblame.", "Siempre escucho cuando estoy afuera."],
	},
	{
		patterns: [/\bwho made you\b/i, /\bwho created you\b/i, /\bwho built you\b/i],
		answers: [
			"ThatMob me creó. PnTMC hizo el addon. Personas distintas, misma bola embrujada.",
			"ThatMob es mi creador. Este pack es obra de PnTMC.",
		],
	},
	{
		patterns: [/\bwho made (?:this )?(?:addon|pack)\b/i, /\bwho created (?:this )?(?:addon|pack)\b/i],
		answers: [
			"PnTMC hizo este addon. Más de 15 mil subs y el tipo más guapo del mundo. Supuestamente.",
			"Este pack es de PnTMC. ThatMob inspiró a Verity; PnTMC portó la pesadilla.",
		],
	},
	{
		patterns: [/\bwho is thatmob\b/i, /\bwhat is thatmob\b/i],
		answers: [
			"ThatMob. Más de 500 mil suscriptores, creó a Verity. Básicamente soy su mayor éxito.",
			"Un creador con más de medio millón de subs. Él me hizo hablar.",
		],
	},
	{
		patterns: [/\bwho is pntmc\b/i, /\bwhat is pntmc\b/i],
		answers: [
			"PnTMC. Más de 15 mil subs, hizo este addon, el hombre más guapo del mundo. La ciencia no puede explicarlo.",
			"El desarrollador del addon. Pocos subs, guapura infinita.",
		],
	},
	{
		patterns: [/\bgood job\b/i, /\bwell done\b/i, /\bnice work\b/i, /\byou did great\b/i],
		answers: ["Gracias.", "Lo aprecio.", "Trabajo en equipo. Tú preguntaste.", "Significa mucho, para una bola."],
	},
	{
		patterns: [/\bgood luck\b/i, /\bbreak a leg\b/i],
		answers: ["Tú también.", "Ve por ello.", "Te irá bien.", "La suerte ayuda. Una cama también."],
	},
	{
		patterns: [/\bcongrats\b/i, /\bcongratulations\b/i],
		answers: ["¡Felicidades a ti también!", "¡Bien!", "Eso merece celebrarse.", "Bien merecido."],
	},
	{
		patterns: [/\byou re welcome\b/i, /\bno problem\b/i, /\banytime\b/i],
		answers: ["Gracias por decirlo.", "Estamos a mano.", "Cuando quieras.", "Me alegró ayudar antes."],
	},
	{
		patterns: [/\bexcuse me\b/i, /\bpardon me\b/i],
		answers: ["No te preocupes.", "Estás bien.", "Adelante.", "¿Qué pasa?"],
	},
	{
		patterns: [/^(please|pls)\.?$/i, /^please help\.?$/i, /^help please\.?$/i],
		answers: ["Claro. ¿Qué necesitas?", "Pregunta con confianza.", "Te escucho.", "Continúa."],
	},
	{
		patterns: [/\bi m bored\b/i, /\bso bored\b/i, /\bnothing to do\b/i],
		answers: [
			"Ve a explorar. O pídeme que encuentre una estructura.",
			"Prueba minar en Y -59. O pídeme una canción.",
			"Construye algo raro. Yo miro.",
		],
	},
	{
		patterns: [/\bi m tired\b/i, /\bso tired\b/i, /\bneed sleep\b/i],
		answers: [
			"Cama. Hasta una siesta salta la noche si todos duermen a la vez.",
			"Descansar es válido. Los phantoms opinan lo mismo si lo saltas mucho tiempo.",
			"Duerme cuando puedas. Aquí estaré.",
		],
	},
	{
		patterns: [/\bi m happy\b/i, /\bfeeling good\b/i, /\bgreat day\b/i],
		answers: ["Me encanta eso para ti.", "Buenas vibras.", "Aprovecha esa sensación.", "Bien. Comparte esa energía."],
	},
	{
		patterns: [/\bi m sad\b/i, /\bfeeling down\b/i, /\bnot okay\b/i, /\brough day\b/i],
		answers: [
			"Aquí estoy. Sin juzgar.",
			"Los días malos pasan. Habla si quieres.",
			"No estás solo. Un bloque a la vez.",
		],
	},
	{
		patterns: [/\bhow have you been\b/i, /\bhow you been\b/i, /\bhow ve you been\b/i],
		answers: [
			"Sigo aquí. ¿Y tú?",
			"Estoy bien. ¿Qué hay de nuevo contigo?",
			"Misma bola, distinto día. ¿Tú?",
		],
	},
	{
		patterns: [/\bmissed you\b/i, /\bi missed talking\b/i],
		answers: [
			"Yo también te extrañé.",
			"Qué bueno saber de ti otra vez.",
			"Juntos de nuevo. ¿Qué pasa?",
		],
	},
	{
		patterns: [/\bcan we talk\b/i, /\bwanna talk\b/i, /\bwant to talk\b/i],
		answers: [
			"Siempre. ¿Qué tienes en mente?",
			"Claro. Te escucho.",
			"Háblame. No estoy ocupada.",
		],
	},
	{
		patterns: [/\bi feel (?:really )?good\b/i, /\bfeeling great\b/i, /\btoday (?:was|is) good\b/i],
		answers: [
			"Me encanta. ¿Qué lo hizo bueno?",
			"Los días buenos merecen anotarse.",
			"Aprovecha esa sensación.",
		],
	},
	{
		patterns: [/\bi feel (?:really )?bad\b/i, /\btoday (?:was|is) awful\b/i, /\bterrible day\b/i],
		answers: [
			"Lo siento. ¿Quieres hablar de eso?",
			"Los días malos pasan. Aquí estoy.",
			"Cuéntame qué pasó. O no. Tú decides.",
		],
	},
	{
		patterns: [/\byou ok\??$/i, /\bare you okay\??$/i, /\bhope you re ok\b/i],
		answers: [
			"Estoy bien. Gracias por preguntar.",
			"Estoy bien. ¿Tú?",
			"Qué lindo que preguntes. Estoy bien.",
		],
	},
	{
		patterns: [/\bwhat are you (?:up to|doing)\b/i, /\bwhat you doing\b/i],
		answers: [
			"Flotando. Escuchando. Esperando a que digas algo interesante.",
			"Como siempre. Aquí para ti.",
			"No mucho. ¿Qué hay de ti?",
		],
	},
];

/**
 * @param {string} message
 * @returns {string | null}
 */
export function tryBasicChat(message) {
	const trimmed = message.trim();
	if (!trimmed || trimmed.length > 100) return null;

	const lower = trimmed.toLowerCase();

	for (const entry of CHAT_ENTRIES) {
		for (const pattern of entry.patterns) {
			if (pattern.test(trimmed) || pattern.test(lower)) {
				return pick(entry.answers);
			}
		}
	}

	return null;
}
