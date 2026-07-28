import { system, world } from "@minecraft/server";

const VERITYBALL_ID = "pntmc:verityball";
const guides = new Map();
const HAZARDS = new Set(["minecraft:lava", "minecraft:flowing_lava", "minecraft:fire", "minecraft:soul_fire"]);

function isDangerous(block) { return !!block && HAZARDS.has(block.typeId); }
function findBall(player) {
    try { return player.dimension.getEntities({ type: VERITYBALL_ID, location: player.location, maxDistance: 128 })[0]; } catch { return undefined; }
}

/** Lightweight waypoint guide: leads in safe-ish short hops, never claims a perfect path. */
export function startVerityGuide(player, target) {
    if (!player?.isValid || !Number.isFinite(target?.x) || !Number.isFinite(target?.z)) return false;
    guides.set(player.id, { x: Math.floor(target.x), y: Number.isFinite(target.y) ? Math.floor(target.y) : Math.floor(player.location.y), z: Math.floor(target.z), started: system.currentTick });
    player.sendMessage(`§e[Verity] §fTe guiaré hacia X ${Math.floor(target.x)}, Z ${Math.floor(target.z)}. No corras demasiado lejos de mí.`);
    return true;
}

export function stopVerityGuide(player) { if (player) guides.delete(player.id); }

export function initVerityGuide() {
    system.runInterval(() => {
		for (const player of world.getPlayers()) {
            const goal = guides.get(player.id);
            if (!goal || !player.isValid) continue;
            const dxPlayer = goal.x - player.location.x, dzPlayer = goal.z - player.location.z;
            if (Math.hypot(dxPlayer, dzPlayer) < 12) {
                guides.delete(player.id);
                player.sendMessage("§e[Verity] §fLlegamos. Mira alrededor; debería estar aquí.");
                continue;
            }
            const ball = findBall(player);
            if (!ball?.isValid) continue;
            const dx = goal.x - ball.location.x, dz = goal.z - ball.location.z;
            const length = Math.hypot(dx, dz) || 1;
            // Keep Verity close enough to be followed; she advances only in short waypoints.
            const playerDistance = Math.hypot(ball.location.x - player.location.x, ball.location.z - player.location.z);
            const step = playerDistance > 26 ? 0.8 : 1.8;
            let nx = ball.location.x + (dx / length) * step;
            let nz = ball.location.z + (dz / length) * step;
            try {
                const ahead = player.dimension.getBlock({ x: Math.floor(nx), y: Math.floor(ball.location.y), z: Math.floor(nz) });
                const below = player.dimension.getBlock({ x: Math.floor(nx), y: Math.floor(ball.location.y - 1), z: Math.floor(nz) });
                if (isDangerous(ahead) || isDangerous(below)) { nx = ball.location.x - (dz / length) * step; nz = ball.location.z + (dx / length) * step; }
                ball.teleport({ x: nx, y: ball.location.y, z: nz }, { facingLocation: { x: goal.x, y: ball.location.y, z: goal.z } });
            } catch { /* chunk or terrain unavailable: wait for the player */ }
        }
    }, 10);
}
