import { system } from "@minecraft/server";

import {

	applyBallFace,

	applyScoldFace,

	applyScoldShutFace,

} from "./verity_phases.js";

import {

	FACE_SERIOUS_2,

	FACE_SERIOUS_3,

	FACE_SPEAK,

	getTalkFacePairFor,

} from "./verity_faces.js";

import { holdMouthFace } from "./verity_music.js";



/**

 * @param {string} text

 * @param {boolean} [fast]

 */

function talkHoldTicks(text, fast = false) {
	const trimmed = text.trim();
	if (!trimmed) return 0;
	const units = Math.min(trimmed.length, fast ? 48 : 72);
	const step = fast ? 2 : 4;
	return units * step + 12;
}

export { talkHoldTicks };



/**

 * @typedef {'light' | 'heavy'} ScoldTier

 */



/**

 * @param {import("@minecraft/server").Entity | undefined} ball

 * @param {string} text

 * @param {{ faces?: [number, number], fast?: boolean, scoldTier?: ScoldTier, scoldFace?: number }} [options]

 */

export function animateTalkPulse(ball, text, options = {}) {

	if (!ball?.isValid) return;

	const trimmed = text.trim();

	if (!trimmed) return;



	const holdTicks = talkHoldTicks(trimmed, options.fast);

	if (holdTicks <= 0) return;



	const scoldTier =

		options.scoldTier ??

		(options.scoldFace === FACE_SERIOUS_3

			? "heavy"

			: options.scoldFace === FACE_SERIOUS_2

				? "light"

				: undefined);



	if (scoldTier) {

		const heavy = scoldTier === "heavy";

		const openFace = heavy ? FACE_SERIOUS_3 : FACE_SERIOUS_2;

		applyScoldFace(ball, openFace, true, heavy);

		system.runTimeout(() => {

			if (!ball.isValid) return;

			applyScoldShutFace(ball, heavy);

		}, holdTicks);

		return;

	}



	const [mouthShut, mouthOpen] = options.faces ?? [FACE_SPEAK, FACE_SPEAK];

	holdMouthFace(ball, mouthOpen, holdTicks, undefined, mouthShut);

}



/**

 * @param {number} phase

 * @param {number} p2State

 * @param {object} P2

 * @param {import("@minecraft/server").Entity | undefined} ball

 * @param {string} text

 * @param {boolean} [fast]

 */

export function animateContextTalk(ball, text, phase, p2State, P2, fast = false) {

	if (!ball?.isValid) return;

	const pair = getTalkFacePairFor(phase, p2State, P2);

	animateTalkPulse(ball, text, { faces: pair, fast });

}



/**

 * @param {import("@minecraft/server").Entity | undefined} ball

 * @param {number} faceIndex

 * @param {number} [holdTicks]

 * @param {number} [releaseFace]

 */

export function flashMouthFace(

	ball,

	faceIndex = FACE_SPEAK,

	holdTicks = 20,

	releaseFace = faceIndex,

) {

	if (!ball?.isValid) return;

	holdMouthFace(ball, faceIndex, holdTicks, undefined, releaseFace);

}

