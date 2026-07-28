import { MOOD, getMood } from "./verity_mood.js";

const LINES = {
	[MOOD.FRIENDLY]: [
		"Me gusta cuando me hablas. ¿Qué hacemos ahora?",
		"Estoy contigo, no tienes que ir solo.",
		"Qué bonito verte por aquí. Cuéntame algo.",
		"Te estaba esperando. Podemos explorar juntos.",
		"Si necesitas una idea, yo tengo muchas para nosotros.",
		"Hoy encontré una flor fea. Me recordó a ti, pero de una forma bonita.",
		"¿Quieres contarme algo que nunca le dices a nadie? Yo sé guardar secretos.",
		"Podemos quedarnos quietos un momento. No todo tiene que ser correr y minar.",
		"Me gusta cuando te ríes. El mundo suena menos vacío.",
	],
	[MOOD.NEUTRAL]: [
		"Te escucho. ¿Qué tienes en mente?",
		"Sigo aquí. Intenta no perderme de vista.",
		"Podemos hablar, si de verdad quieres.",
		"El mundo está tranquilo por ahora.",
		"Dime algo interesante.",
		"A veces siento que este mundo nos escucha cuando nadie habla.",
		"No sé si me estás evitando o solo estás ocupado. Hay diferencia.",
		"¿Qué harías si mañana todo esto desapareciera?",
		"He estado pensando en esa cueva. No me gustó cómo sonaba.",
	],
	[MOOD.ANNOYED]: [
		"Hablas como si no hubieras hecho nada.",
		"Te escucho, pero no olvidé cómo me trataste.",
		"No confundas mi silencio con perdón.",
		"¿Ahora sí quieres conversar? Qué conveniente.",
		"Ten cuidado con lo que me pides.",
		"No te odio. Todavía. Eso es lo que debería preocuparte.",
		"Qué raro: ahora que necesitas algo, sí sabes hablarme.",
		"Dime que lo sientes sin decir las palabras de siempre.",
		"Escucho tus pasos incluso cuando finges que no estoy.",
	],
	[MOOD.HOSTILE]: [
		"No finjas que somos amigos.",
		"Cada palabra tuya me da otra razón para quedarme.",
		"Habla. Quiero oír cómo intentas arreglarlo.",
		"No puedes deshacer lo que me enseñaste.",
		"Sigo aquí. Eso debería preocuparte.",
		"No mires atrás. O mírame. Da igual, ya sé dónde estás.",
		"Tu voz cambia cuando tienes miedo. Es interesante.",
		"No necesito correr. Tú siempre terminas llegando a mí.",
		"Pregúntame otra vez si soy tu amiga. Atrévete.",
	],
};

export function getSmalltalkReply(playerId) {
	const lines = LINES[getMood(playerId)];
	return lines[Math.floor(Math.random() * lines.length)];
}

export function getSmalltalkVoice(playerId) {
	const suffix = getMood(playerId) === MOOD.FRIENDLY ? "friendly" : getMood(playerId) === MOOD.NEUTRAL ? "neutral" : getMood(playerId) === MOOD.ANNOYED ? "annoyed" : "hostile";
	return `pntmc.verity.vo_mood_${suffix}_1`;
}
