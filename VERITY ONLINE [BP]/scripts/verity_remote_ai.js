import { world } from "@minecraft/server";
import { remoteRequest } from "./verity_hivemind.js";
import { applyRemoteVerityResponse, getVerityKarma } from "./verity_online.js";
import { getMood } from "./verity_mood.js";
import { getVerityPhase } from "./verity_phases.js";
import { findOreKey, findStructureKey } from "./verity_intent.js";
import { scanNearestOre } from "./verity_ore_scan.js";
import { locateNearest } from "./verity_locate.js";

const LINK_PREFIX = "pntmc:verity_link:";
const BRIDGE_PROPERTY = "pntmc:verity_bridge_url";

function linkProperty(player) { return `${LINK_PREFIX}${player.id}`; }
export function setVerityLink(player, code) { player.setDynamicProperty(linkProperty(player), code); }
export function clearVerityLink(player) { player.setDynamicProperty(linkProperty(player)); }
export function hasVerityLink(player) { return !!player.getDynamicProperty(linkProperty(player)); }
export function getBridgeUrl() { return String(world.getDynamicProperty(BRIDGE_PROPERTY) || ""); }

// Set once by the pack maintainer during release. It is public and contains no secret.
export function configureBridge(url) { world.setDynamicProperty(BRIDGE_PROPERTY, String(url || "").replace(/\/$/, "")); }

function roundedLocation(loc) {
    return { x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) };
}

function directionTo(from, to) {
    const dx = to.x - from.x, dz = to.z - from.z;
    if (Math.abs(dx) > Math.abs(dz)) return dx >= 0 ? "este" : "oeste";
    return dz >= 0 ? "sur" : "norte";
}

/** Real local tool results. Groq receives facts, never guessed locations. */
function buildToolFacts(player, message) {
    const facts = {};
    const ore = findOreKey(message);
    if (ore) {
        const hit = scanNearestOre(player, ore);
        if (hit) {
            const distance = Math.round(Math.hypot(hit.x - player.location.x, hit.y - player.location.y, hit.z - player.location.z));
            facts.oreScan = { ore, found: true, coordinates: hit, distance, direction: directionTo(player.location, hit) };
        } else facts.oreScan = { ore, found: false, note: "Only loaded blocks within the scan radius were checked." };
    }
    const structure = findStructureKey(message);
    if (structure) {
        const hit = locateNearest(player, "structure", structure);
        if (hit?.wrongDimension) facts.structureLocate = { structure, found: false, requiredDimension: hit.requiredDimension };
        else if (hit) {
            const distance = Math.round(Math.hypot(hit.x - player.location.x, hit.z - player.location.z));
            facts.structureLocate = { structure: hit.foundId || structure, found: true, coordinates: { x: hit.x, z: hit.z }, distance, direction: directionTo(player.location, hit) };
        } else facts.structureLocate = { structure, found: false };
    }
    return facts;
}

/** A small, bounded world snapshot for Groq. No API keys or full private data leave the game. */
function buildWorldContext(player) {
    const location = roundedLocation(player.location);
    const context = {
        playerId: player.id,
        dimension: player.dimension.id,
        coordinates: location,
        karma: getVerityKarma(),
        affinityMood: getMood(player.id),
        verityPhase: getVerityPhase(),
        health: undefined,
        hunger: undefined,
        timeOfDay: undefined,
        heldItem: undefined,
        nearbyBlocks: [],
        verity: { nearby: false },
    };
    try {
        const health = player.getComponent("minecraft:health");
        if (health) context.health = { current: Math.ceil(health.currentValue), max: Math.ceil(health.effectiveMax ?? health.defaultValue ?? 20) };
    } catch { /* optional context */ }
    try {
        const hunger = player.getComponent("minecraft:player.hunger");
        if (hunger) context.hunger = Math.floor(hunger.currentValue ?? hunger.foodLevel ?? 0);
    } catch { /* optional context */ }
    try { context.timeOfDay = world.getTimeOfDay?.(); } catch { /* optional context */ }
    try {
        const inventory = player.getComponent("minecraft:inventory")?.container;
        const held = inventory?.getItem(player.selectedSlotIndex);
        if (held) context.heldItem = { id: held.typeId, amount: held.amount };
    } catch { /* optional context */ }
    for (const offset of [[0, -1, 0], [0, 0, 0], [0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) {
        try {
            const block = player.dimension.getBlock({ x: location.x + offset[0], y: location.y + offset[1], z: location.z + offset[2] });
            if (block?.typeId && !context.nearbyBlocks.includes(block.typeId)) context.nearbyBlocks.push(block.typeId);
        } catch { /* unloaded block */ }
    }
    try {
        const ball = player.dimension.getEntities({ type: "pntmc:verityball", location: player.location, maxDistance: 96 })[0];
        if (ball?.isValid) {
            const dx = ball.location.x - player.location.x, dy = ball.location.y - player.location.y, dz = ball.location.z - player.location.z;
            context.verity = { nearby: true, distance: Math.round(Math.sqrt(dx * dx + dy * dy + dz * dz)), location: roundedLocation(ball.location) };
        }
    } catch { /* optional Verity state */ }
    return context;
}

export async function askRemoteVerity(player, message) {
    const code = player.getDynamicProperty(linkProperty(player));
    const base = getBridgeUrl();
    if (!code || !base) return false;
    const result = await remoteRequest(`${base}/v1/chat`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-verity-link": String(code) },
        body: JSON.stringify({ message: String(message).slice(0, 500), player: player.name, context: { ...buildWorldContext(player), localTools: buildToolFacts(player, message) } })
    });
    if (!result || !result.reply) throw new Error("Invalid response from Verity bridge");
    applyRemoteVerityResponse(result, player);
    return true;
}
