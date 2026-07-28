/** Custom voice lines — seconds measured from WAV/OGG in RP. */
const VOICE_SECONDS = {
	"pntmc.verity.yes_south": 3.11,
	"pntmc.verity.villagers_gone": 2.64,
	"pntmc.verity.gone": 1.78,
	"pntmc.verity.something_passed": 1.54,
	"pntmc.verity.no2": 0.84,
	"pntmc.verity.something_hungry": 1.62,
	"pntmc.verity.im_smiling_now": 1.8,
	"pntmc.verity.always_looked_like_this": 1.8,
	"pntmc.verity.its_already_over": 1.2,
	"pntmc.verity.you_are_mine": 1.18,
		"pntmc.verity.know_everything": 1.12,
		"pntmc.verity.mobbbbb": 4.0,
		"pntmc.verity.somethingiscoming": 1.6,
	"pntmc.verity.somethingiscomingin3days": 1.8,
	"pntmc.verity.loudsound": 2.5,
	"pntmc.verity.loudmusic": 2.5,
	"pntmc.verity.saludo_inicio": 5.8,
	"pntmc.verity.voz_espero": 2.09,
	"pntmc.verity.voz_te_sigo": 1.78,
	"pntmc.verity.voz_coords": 2.93,
	"pntmc.verity.voz_bioma": 2.01,
	"pntmc.verity.voz_hora": 1.49,
	"pntmc.verity.voz_estructura": 3.53,
	"pntmc.verity.voz_no_encontre": 2.74,
	"pntmc.verity.voz_direccion": 2.64,
	"pntmc.verity.voz_mineral": 3.21,
	"pntmc.verity.voz_mineral_escaneo": 3.27,
	"pntmc.verity.voz_como_estas": 2.74,
	"pntmc.verity.voz_estructura_no": 2.93,
	"pntmc.verity.voz_ore_rec": 4.83,
	"pntmc.verity.scold_huir": 2.33,
	"pntmc.verity.scold_quien": 3.30,
	"pntmc.verity.scold_idiota": 2.62,
	"pntmc.verity.scold_asco": 1.60,
	"pntmc.verity.scold_intenta": 2.28,
	"pntmc.verity.scold_patetico": 1.18,
	"pntmc.verity.scold_cobarde": 1.18,
	"pntmc.verity.scold_miedo": 1.49,
	"pntmc.verity.voz_ey_inicio": 5.80,
	"pntmc.verity.voz_estoy_bien_fase": 3.21,
	"pntmc.verity.voz_algo_viene": 1.72,
	"pntmc.verity.voz_se_acabo_aventura": 1.91,
	"pntmc.verity.vo_saludo": 2.5,
	"pntmc.verity.vo_pregunta_1": 2.4,
	"pntmc.verity.vo_pregunta_2": 2.2,
	"pntmc.verity.vo_pregunta_3": 2.3,
	"pntmc.verity.vo_pregunta_4": 2.0,
	"pntmc.verity.vo_gracias": 2.2,
	"pntmc.verity.vo_maltrato": 2.4,
	"pntmc.verity.vo_pasto": 2.5,
	"pntmc.verity.vo_susurro": 1.8,
	"pntmc.verity.vo_final": 1.9,
	"pntmc.verity.vo_risa_demiedo": 1.7,
};

/** Full-length music tracks — seconds from file probe. */
const MUSIC_SECONDS = {
	"pntmc.verity.mygal_normal": 134,
	"pntmc.verity.matrixsong": 108.7,
};

/** Vanilla / short mob SFX defaults. */
const MOB_SECONDS = {
	"mob.villager.haggle": 1.0,
	"mob.villager.idle": 1.2,
	"mob.cow.hurt": 0.9,
	"mob.cow.say": 1.0,
	"mob.pig.say": 0.8,
	"mob.sheep.say": 0.9,
	"mob.chicken.say": 0.7,
	"mob.wolf.bark": 0.8,
	"mob.cat.meow": 0.9,
	"random.door_open": 0.6,
	"random.door_close": 0.6,
};

const DEFAULT_SECONDS = 1.5;
const MIN_TICKS = 12;

/**
 * @param {string} soundId
 * @returns {number}
 */
export function getSoundDurationTicks(soundId) {
	const sec =
		MUSIC_SECONDS[soundId] ??
		VOICE_SECONDS[soundId] ??
		MOB_SECONDS[soundId] ??
		DEFAULT_SECONDS;
	return Math.max(MIN_TICKS, Math.ceil(sec * 20));
}

/**
 * @param {string} soundId
 */
export function getMusicDurationTicks(soundId) {
	return getSoundDurationTicks(soundId);
}
