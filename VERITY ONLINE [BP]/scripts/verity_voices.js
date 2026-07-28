import { holdMouthFace, playBallSoundAt, playSoundAtLoc } from "./verity_music.js";
import { getSoundDurationTicks } from "./verity_sound_durations.js";
import { FACE_SPEAK } from "./verity_phases.js";
import { getShutFaceForOpen } from "./verity_faces.js";

export const VOICE = {
	YES_SOUTH: "pntmc.verity.yes_south",
	VILLAGERS_GONE: "pntmc.verity.villagers_gone",
	GONE: "pntmc.verity.gone",
	SOMETHING_PASSED: "pntmc.verity.something_passed",
	NO: "pntmc.verity.no2",
	SOMETHING_HUNGRY: "pntmc.verity.something_hungry",
	IM_SMILING: "pntmc.verity.im_smiling_now",
	ALWAYS_LOOKED: "pntmc.verity.always_looked_like_this",
	ITS_ALREADY_OVER: "pntmc.verity.its_already_over",
	YOU_ARE_MINE: "pntmc.verity.you_are_mine",
	KNOW_EVERYTHING: "pntmc.verity.know_everything",
	EY_INICIO: "pntmc.verity.voz_ey_inicio",
	ESTOY_BIEN_FASE: "pntmc.verity.voz_estoy_bien_fase",
	ALGO_VIENE: "pntmc.verity.voz_algo_viene",
	SE_ACABO_AVENTURA: "pntmc.verity.voz_se_acabo_aventura",
	NO_ESCONDERTE: "pntmc.verity.scold_huir",
	SALUDO: "pntmc.verity.vo_saludo",
	GRACIAS: "pntmc.verity.vo_gracias",
	MALTRATO: "pntmc.verity.vo_maltrato",
	SUSURRO: "pntmc.verity.vo_susurro",
	FINAL: "pntmc.verity.vo_final",
	RISA_MIEDO: "pntmc.verity.vo_risa_demiedo",
	PASTO: "pntmc.verity.vo_pasto",
};

export const FALLBACK_CHAT =
	"Puedes preguntarme lo que sea. Lo sé todo.";

/**
 * @param {import("@minecraft/server").Entity | undefined} ball
 * @param {string} soundId
 */
export function playVerityVoice(ball, soundId) {
	if (!ball?.isValid || !soundId) return;
	const duration = getSoundDurationTicks(soundId);
	const played = playBallSoundAt(
		ball,
		soundId,
		FACE_SPEAK,
		duration,
		getShutFaceForOpen(FACE_SPEAK),
	);
	if (played !== false) {
		console.warn(`verity voice ball: ${soundId}`);
	}
}

/**
 * Reproduce una voz usando una cara concreta al hablar (p. ej. la enojada de la lava).
 * @param {import("@minecraft/server").Entity} ball
 * @param {string} soundId
 * @param {number} openFace  cara "boca abierta" a mostrar mientras habla
 * @param {number} shutFace  cara "boca cerrada" al terminar
 */
export function playVerityVoiceWithFace(ball, soundId, openFace, shutFace) {
	if (!ball?.isValid || !soundId) return;
	const duration = getSoundDurationTicks(soundId);
	const played = playBallSoundAt(ball, soundId, openFace, duration, shutFace);
	if (played !== false) {
		console.warn(`verity voice ball (face): ${soundId}`);
	}
}

/**
 * Voice at the ball when it exists; otherwise at the player.
 * @param {import("@minecraft/server").Player} player
 * @param {string} soundId
 * @param {import("@minecraft/server").Entity | undefined} ball
 * @param {number} [mouthFace]
 */
export function playVerityVoiceAt(player, soundId, ball, mouthFace = FACE_SPEAK) {
	if (!soundId || !player?.isValid) return;

	const duration = getSoundDurationTicks(soundId);
	const releaseFace = getShutFaceForOpen(mouthFace);

	if (ball?.isValid) {
		const played = playBallSoundAt(ball, soundId, mouthFace, duration, releaseFace);
		if (played !== false) {
			console.warn(`verity voice at ball: ${soundId}`);
		}
		return;
	}

	const played = playSoundAtLoc(player, player.location, soundId);
	if (played) {
		console.warn(`verity voice at player: ${soundId}`);
	}
}
