/** Random Minecraft facts — used when player asks for facts/trivia */
export const MINECRAFT_FACT_ANSWERS = [
	"Los creepers nacieron de un modelo fallido de cerdo: accidente de programación, leyenda del terror.",
	"Los diamantes abundan cerca de Y -59 desde la 1.18: lleva picos de hierro, no esperanzas.",
	"Un bloque recorrido en el Nether equivale a ocho del Overworld.",
	"Dormir salta la noche solo si no hay monstruos cerca: los phantoms no están de acuerdo.",
	"Fortuna en cultivos da más drops; en minerales da más recursos, no más bloques de mineral.",
	"El agua y la lava hacen roca, obsidiana o piedra según qué toca a qué primero.",
	"Los aldeanos reabastecen sus ofertas dos veces al día si tienen puesto de trabajo y cama.",
	"Los élitros con cohetes le ganan a cualquier caballo en viajes largos.",
	"El Warden es ciego pero lo oye todo: la lana amortigua tus pasos.",
	"Los faros necesitan una estrella del Nether del Wither: objeto de presumir del endgame.",
	"Fundir con bloques de alga es eficiente: los bloques de alga seca arden mucho tiempo.",
	"Botín aumenta lo que sueltan los mobs; no aumenta el mineral de los bloques.",
	"Los escudos bloquean explosiones y proyectiles si los encaras a tiempo.",
	"Las manzanas doradas y las encantadas son diferentes: solo una se puede craftear.",
	"El Wither de Bedrock se comporta distinto al de Java: igual de miserable.",
	"Los chunks de slime existen bajo Y 40: las granjas AFK los aman.",
	"El polvo de hueso en cultivos salta etapas de crecimiento: energía de granjero instantáneo.",
	"Toque de Seda en el hielo conserva el hielo; sin él obtienes agua.",
	"Las etiquetas evitan que desaparezcan los mobs: renombra a tus mascotas y a tus traumas.",
	"Los cofres de ender comparten un solo inventario por jugador entre dimensiones.",
];

/** @type {import("../verity_knowledge_data.js").KnowledgeEntry[]} */
export const TRIVIA_KNOWLEDGE = [
	{
		patterns: [
			/\btell me (?:a |some |few )?facts?\b/,
			/\bgive me (?:a |some |few )?facts?\b/,
			/\bshare (?:a |some |few )?facts?\b/,
			/\brandom facts?\b/,
			/\bminecraft facts?\b/,
			/\bmc facts?\b/,
			/\bfact about minecraft\b/,
			/\btrivia about minecraft\b/,
			/\btell me (?:something|anything) (?:about )?minecraft\b/,
			/\bdo you know (?:any )?facts?\b/,
		],
		keywords: ["fact", "facts", "trivia", "random", "minecraft", "tell", "share"],
		answers: MINECRAFT_FACT_ANSWERS,
	},
];
