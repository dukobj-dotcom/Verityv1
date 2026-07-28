import { system, world } from "@minecraft/server";
import { getMood, MOOD } from "./verity_mood.js";
import { playVerityVoice } from "./verity_voices.js";
import { animateTalkPulse } from "./verity_anim.js";

const lastQuestion = new Map();
const QUESTIONS = [
	{ text: "¿Qué fue lo mejor que te pasó hoy?", voice: "pntmc.verity.vo_pregunta_1" },
	{ text: "¿A quién extrañas cuando estás solo?", voice: "pntmc.verity.vo_pregunta_2" },
	{ text: "¿Por qué me trajiste contigo?", voice: "pntmc.verity.vo_pregunta_3" },
	{ text: "¿Confías en mí de verdad?", voice: "pntmc.verity.vo_pregunta_4" },
];

export function initVerityPersonalQuestions() {
	system.runInterval(() => {
		const now = system.currentTick;
		for (const player of world.getPlayers()) {
			if (!player.isValid || getMood(player.id) !== MOOD.FRIENDLY) continue;
			if (now - (lastQuestion.get(player.id) ?? -99999) < 14400) continue;
			let ball;
			try { ball = player.dimension.getEntities({ type: "pntmc:verityball", location: player.location, maxDistance: 12 })[0]; } catch { /* ignore */ }
			if (!ball?.isValid || Math.random() > 0.24) continue;
			lastQuestion.set(player.id, now);
			const question = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
			try { player.sendMessage(`<§eVerity§r> ${question.text}`); animateTalkPulse(ball, question.text); playVerityVoice(ball, question.voice); } catch { /* optional voice */ }
		}
	}, 1200);
}
