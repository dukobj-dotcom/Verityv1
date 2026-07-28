import {
	CommandPermissionLevel,
	CustomCommandParamType,
	CustomCommandStatus,
	Player,
	system,
	world,
} from "@minecraft/server";

/** true = story gates phase progression; false = phases by play time (story chat still works) */
export const STORYMODE_PROP = "pntmc:storymode";
/** World time anchor when sandbox mode is active */
export const SANDBOX_ANCHOR_PROP = "pntmc:sandbox_anchor_tick";

/** 2.5 Minecraft days */
export const SANDBOX_PHASE2_TICKS = 60000;
/** 1 Minecraft day after phase 2 */
export const SANDBOX_PHASE3_AFTER_P2_TICKS = 24000;

/**
 * @returns {boolean}
 */
export function isStoryModeEnabled() {
	const v = world.getDynamicProperty(STORYMODE_PROP);
	if (v === false || v === 0) return false;
	return true;
}

/**
 * @param {boolean} enabled
 */
export function setStoryModeEnabled(enabled) {
	world.setDynamicProperty(STORYMODE_PROP, enabled);
	if (!enabled) {
		ensureSandboxAnchor();
	}
}

/**
 * Anchor sandbox progression to current world time if missing.
 */
export function ensureSandboxAnchor() {
	if (typeof world.getDynamicProperty(SANDBOX_ANCHOR_PROP) !== "number") {
		world.setDynamicProperty(SANDBOX_ANCHOR_PROP, world.getAbsoluteTime());
		console.warn("verity storymode: sandbox anchor set");
	}
}

export function clearSandboxAnchor() {
	world.setDynamicProperty(SANDBOX_ANCHOR_PROP, undefined);
}

/**
 * @param {boolean} enabled
 * @param {string} [byName]
 * @returns {string}
 */
export function applyStoryMode(enabled, byName) {
	setStoryModeEnabled(enabled);
	const who = byName ? ` by ${byName}` : "";
	console.warn(`verity storymode: ${enabled ? "on" : "off"}${who}`);
	if (enabled) {
		return "Modo historia activado. Las fases siguen la historia.";
	}
	return "Modo historia desactivado. Tiempo libre: 2.5 días → fase 2, 1 día → fase 3, luego cuenta regresiva → persecución.";
}

/**
 * @param {unknown} args
 * @returns {boolean | undefined}
 */
function readEnabledArg(args) {
	if (typeof args === "boolean") return args;
	if (typeof args === "string") {
		const s = args.trim().toLowerCase();
		if (s === "true" || s === "on") return true;
		if (s === "false" || s === "off") return false;
	}
	if (args && typeof args === "object" && !Array.isArray(args)) {
		const rec = /** @type {Record<string, unknown>} */ (args);
		for (const key of Object.keys(rec)) {
			const v = rec[key];
			if (typeof v === "boolean") return v;
			if (typeof v === "string") {
				const s = v.trim().toLowerCase();
				if (s === "true" || s === "on") return true;
				if (s === "false" || s === "off") return false;
			}
		}
	}
	if (Array.isArray(args)) {
		for (const v of args) {
			const parsed = readEnabledArg(v);
			if (parsed !== undefined) return parsed;
		}
	}
	return undefined;
}

/**
 * @param {() => void} [onChanged]
 */
export function registerStoryModeCommand(onChanged) {
	system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
		customCommandRegistry.registerEnum("pntmc:storymode_flag", ["true", "false"]);

		customCommandRegistry.registerCommand(
			{
				name: "pntmc:storymode",
				description: "Toggle Verity story mode (true = story, false = sandbox time).",
				permissionLevel: CommandPermissionLevel.Any,
				cheatsRequired: false,
				mandatoryParameters: [
					{ type: CustomCommandParamType.Enum, name: "pntmc:storymode_flag" },
				],
			},
			(origin, mode) => {
				const player = origin.initiator ?? origin.sourceEntity;
				if (!(player instanceof Player)) {
					return { status: CustomCommandStatus.Failure, message: "Solo jugadores." };
				}

				const enabled = readEnabledArg(mode);
				if (enabled === undefined) {
					return {
						status: CustomCommandStatus.Failure,
						message: "Use: /pntmc:storymode true|false",
					};
				}

				system.run(() => {
					const message = applyStoryMode(enabled, player.name);
					onChanged?.();
					try {
						player.sendMessage(`§7[Verity] ${message}`);
					} catch {
						/* ignore */
					}
				});

				return { status: CustomCommandStatus.Success };
			},
		);
	});
}
