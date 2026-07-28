import { ItemStack, system, world } from "@minecraft/server";
import { getMood, MOOD } from "./verity_mood.js";

const lastGift = new Map();
const GIFT_COOLDOWN = 24000; // 20 min reales de juego
const GIFTS = [
	{ id: "minecraft:bread", amount: 2, line: "Tomé esto para ti. No preguntes de dónde salió." },
	{ id: "minecraft:torch", amount: 12, line: "La oscuridad te está mirando. Lleva luz." },
	{ id: "minecraft:oak_planks", amount: 16, line: "Por si necesitas construir algo antes de que anochezca." },
	{ id: "minecraft:stone_pickaxe", amount: 1, line: "Te hará falta bajo tierra. No te alejes demasiado." },
	{ id: "minecraft:stone_sword", amount: 1, line: "No es para mí. Espero." },
];

function nearbyBall(player) {
	try { return player.dimension.getEntities({ type: "pntmc:verityball", location: player.location, maxDistance: 10 })[0]; } catch { return undefined; }
}

function giveGift(player, ball) {
	const gift = GIFTS[Math.floor(Math.random() * GIFTS.length)];
	let stack;
	try { stack = new ItemStack(gift.id, gift.amount); } catch { return; }
	// Siempre lo deja visible junto a ella: el jugador decide si recogerlo.
	try { player.dimension.spawnItem(stack, { x: ball.location.x, y: ball.location.y + 0.45, z: ball.location.z }); } catch { return; }
	try { player.dimension.spawnParticle("minecraft:heart_particle", { x: ball.location.x, y: ball.location.y + 0.65, z: ball.location.z }); } catch { /* optional */ }
	try { player.sendMessage(`<§eVerity§r> ${gift.line}`); } catch { /* ignore */ }
}

/** Regalos poco frecuentes para no sustituir la exploración ni el loot normal. */
export function initVerityGifts() {
	system.runInterval(() => {
		const now = system.currentTick;
		for (const player of world.getPlayers()) {
			if (!player.isValid || getMood(player.id) !== MOOD.FRIENDLY) continue;
			if (now - (lastGift.get(player.id) ?? -99999) < GIFT_COOLDOWN) continue;
			const ball = nearbyBall(player);
			if (!ball?.isValid || Math.random() > 0.18) continue;
			lastGift.set(player.id, now);
			giveGift(player, ball);
		}
	}, 1200);
	console.warn("VERITY ONLINE: companion gifts active");
}
