/* This file deals with persistent data, i.e. everything which persists on reload, and also concerns all upgrades. */
import { playAudio } from "./audio.js";
import { Bosses } from "./boss_data.js";
import { currentBoss, difficulty, enemies, frame, score } from "./game.js";
import { activeWindow, ZPresses } from "./menu.js";
import { formatDecimal, formatInteger, numberIsBounded } from "./utility.js";

// Determines the strength of most upgrades as a multiple of the level 1 effect. These upgrades cap at 100 levels.
function upgradeValueCoefficient(lv) {
	if (lv <= 10) {
		// For the first ten levels, each upgrade adds ceil(12.5 * 0.8 ^ lv) / 10 to the coefficient.
		return [0, 1, 1.8, 2.5, 3.1, 3.6, 4, 4.3, 4.6, 4.8, 5][lv];
	} else {
		// Levels 11-40 then each add 0.1 to the coefficient, Levels 41-60 each add 0.05 to the coefficient and Levels 61-100 each add 0.025 to the coefficient.
		return Math.min(lv / 10 + 4, lv / 20 + 6, lv / 40 + 7.5);
	}
}
const upgradeList = {
	autoShoot: {
		name: "Auto Fire",
		description: lv => "Automatically shoots bullets without needing to hold Z.",
		effectValue: lv => lv === 1,
		cost: lv => 5000000,
		maxLevel: 1
	},
	unfocusedStrength: {
		name: "Fluorine Oxidation",
		description: lv => "Green bullets deal " + formatDecimal(upgradeValueCoefficient(lv) * 2, 3) + "% more damage.",
		effectValue: lv => 1 + upgradeValueCoefficient(lv) / 50,
		cost: lv => 10000000 * (lv + 1) * (lv + 1),
		maxLevel: 100
	},
	focusedStrength: {
		name: "Beryllium Toxicity",
		description: lv => "Grey bullets deal " + formatDecimal(upgradeValueCoefficient(lv) * 2, 3) + "% more damage.",
		effectValue: lv => 1 + upgradeValueCoefficient(lv) / 50,
		cost: lv => 10000000 * (lv + 1) * (lv + 1),
		maxLevel: 100
	},
	bombStrength: {
		name: "Fuel Uranium Disulfide",
		description: lv => "The player's bomb deals " + formatDecimal(upgradeValueCoefficient(lv) * 2, 3) + "% more damage.",
		effectValue: lv => 1 + upgradeValueCoefficient(lv) / 50,
		cost: lv => 10000000 * (lv + 1) * (lv + 1),
		maxLevel: 100
	},
	speedUp: {
		name: "Helium Lightness",
		description: lv => "Unfocused movement speed is increased by " + formatDecimal(upgradeValueCoefficient(lv), 3) + "%.",
		effectValue: lv => 1 + upgradeValueCoefficient(lv) / 100,
		cost: lv => 25000000 * (lv + 1) * (lv + 1),
		maxLevel: 100
	},
	speedDown: {
		name: "Osmium Anchoring",
		description: lv => "Focused movement speed is decreased by " + formatDecimal(upgradeValueCoefficient(lv), 3) + "%.",
		effectValue: lv => 1 - upgradeValueCoefficient(lv) / 100,
		cost: lv => 25000000 * (lv + 1) * (lv + 1),
		maxLevel: 100
	},
	startingLives: {
		name: "Extra Starting Lives",
		description: lv => (lv % 3 === 0) ? ("Start the game with " + (2 + lv / 3) + " lives.") : ("Start the game with " + Math.floor(2 + lv / 3) + " lives and " + (lv % 3) + " life piece" + ((lv % 3 === 2) ? "s" : "") + "."),
		effectValue: lv => 6 + lv,
		cost: lv => 100000000 * 2 ** lv,
		maxLevel: 18,
		showLevel0Effect: true
	},
	startingBombs: {
		name: "Extra Starting Bombs",
		description: lv => ((lv % 3 === 0) ? ("Start the game with " + (2 + lv / 3) + " bombs") : ("Start the game with " + Math.floor(2 + lv / 3) + " bombs and " + (lv % 3) + " bomb piece" + ((lv % 3 === 2) ? "s" : ""))) + ".<br>Upon losing a life, your bomb count is replenished to a minimum of this amount.",
		effectValue: lv => 6 + lv,
		cost: lv => 100000000 * 2 ** lv,
		maxLevel: 18,
		showLevel0Effect: true
	},
	startingPower: {
		name: "Extra Starting Power",
		description: lv => "Start the game with " + (1 + lv / 20).toFixed(2) + " power.",
		effectValue: lv => 100 + lv * 5,
		cost: lv => (lv < 4) ? (100000000 * (lv + 1)) : (lv < 20) ? (100000000 * Math.floor((lv + 1) * (lv + 1) / 4)) : (10000000000 * 2 ** (lv - 20)),
		maxLevel: 60,
		showLevel0Effect: true
	},
	lowerAutocollect: {
		name: "Magnetism",
		description: lv => "Items are autocollected starting " + (75 - upgradeValueCoefficient(lv) * 1.5) + "% of the way up the screen.",
		effectValue: lv => 150 + 9 * upgradeValueCoefficient(lv),
		cost: lv => 50000000 * (lv + 1) * (lv + 1),
		maxLevel: 100,
		showLevel0Effect: true
	},
	moreBonuses: {
		name: "Perks of Living",
		description: lv => "Reduce the score requirement for a bonus item by " + formatDecimal(upgradeValueCoefficient(lv), 3) + "%.",
		effectValue: lv => 1 - upgradeValueCoefficient(lv) / 100,
		cost: lv => 50000000 * (lv + 1) * (lv + 1),
		maxLevel: 100
	},
	prestige: {
		name: "Prestige",
		description: lv => "Virtue gain is increased by " + formatDecimal(upgradeValueCoefficient(lv) * 10, 3) + "%.",
		effectValue: lv => 1 + upgradeValueCoefficient(lv) / 10,
		cost: lv => 100000000 * (lv + 1) * (lv + 1),
		maxLevel: 100
	}
}
const upgradeArray = Object.keys(upgradeList);
export const persistentData = {
	virtue: 0,
	records: { // For each difficulty
		highScore: [0, 0, 0, 0],
		maxSpareContinues: [-1, -1, -1, -1], // -1 indicates not cleared.
		maxSpareLives: [0, 0, 0, 0], // This actually stores the number of pieces
		maxSpareBombs: [0, 0, 0, 0],
		spellCardsCaptured: [0, 0, 0, 0]
	},
	upgradelessRecords: { // For each difficulty
		highScore: [0, 0, 0, 0],
		maxSpareContinues: [-1, -1, -1, -1], // -1 indicates not cleared.
		maxSpareLives: [0, 0, 0, 0], // This actually stores the number of pieces
		maxSpareBombs: [0, 0, 0, 0],
		spellCardsCaptured: [0, 0, 0, 0]
	},
	upgrades: Object.fromEntries(Object.keys(upgradeList).map(id => [id, 0])),
}
const initialPersistentData = structuredClone(persistentData);
export const upgradeEffectValues = Object.fromEntries(Object.keys(upgradeList).map(id => [id, 0]));
export function updateUpgradeEffectValues() {
	for (let upgId of upgradeArray) {
		upgradeEffectValues[upgId] = upgradeList[upgId].effectValue(persistentData.upgrades[upgId]);
	}
}
export function buyUpgrade(id) { // This is used for `ZPresses`, so rather than actually buying the upgrade, it returns a new function that buys the upgrade or `undefined`.
	let cost = upgradeList[id].cost(persistentData.upgrades[id]);
	if ((persistentData.virtue >= cost) && (persistentData.upgrades[id] !== upgradeList[id].maxLevel)) {
		return function() {
			persistentData.virtue -= cost;
			persistentData.upgrades[id]++;
			savePersistentData();
			updateUpgradeInterface();
		}
	} else {
		return undefined;
	}
}
export function refundAllUpgrades() {
	for (let upgId of upgradeArray) {
		while (persistentData.upgrades[upgId] !== 0) { // There are much better ways to deal with the cost functions here but I am lazy ._.
			persistentData.upgrades[upgId]--;
			persistentData.virtue += upgradeList[upgId].cost(persistentData.upgrades[upgId]);
		}
	}
	savePersistentData();
	updateUpgradeInterface();
}
export function initialiseUpgradeInterface() {
	for (let upgradeNum = 0; upgradeNum < upgradeArray.length; upgradeNum++) {
		document.getElementById("span_upgrade" + upgradeNum + "Name").innerText = upgradeList[upgradeArray[upgradeNum]].name;
		Object.defineProperty(ZPresses.upgrades, upgradeNum, {
      		get () { return buyUpgrade(upgradeArray[upgradeNum]);} // Use a getter for these so they can be undefined when the "invalid" sound effect needs to get played.
		})
		ZPresses.upgrades[upgradeArray.length] = refundAllUpgrades;
	}
}
export function updateUpgradeInterface() {
	document.getElementById("span_upgrades_availableVirtue").innerText = formatInteger(persistentData.virtue);
	for (let upgradeNum = 0; upgradeNum < upgradeArray.length; upgradeNum++) {
		document.getElementById("span_upgrade" + upgradeNum + "Level").innerText = "Lv. " + persistentData.upgrades[upgradeArray[upgradeNum]];
	}
	let upgradeButtons = Array.from(document.querySelectorAll("[data-menuWindow='" + activeWindow + "']"));
	let selectedUpgradeNum = upgradeButtons.map(x => x.classList.contains("active")).indexOf(true);
	if (selectedUpgradeNum === upgradeArray.length) { // If "Refund All Upgrades" is selected.
		document.getElementById("span_upgrades_selectedUpgradeName").innerText = "";
		document.getElementById("span_upgrades_selectedUpgradeLevel").innerText = "";
		document.getElementById("span_upgrades_selectedUpgradeCurrentEffect").innerText = "";
		document.getElementById("span_upgrades_selectedUpgradeNextEffect").innerText = "";
		document.getElementById("span_upgrades_selectedUpgradeCost").innerText = "";
	} else {
		let selectedUpgrade = upgradeArray[selectedUpgradeNum];
		document.getElementById("span_upgrades_selectedUpgradeName").innerText = upgradeList[selectedUpgrade].name;
		document.getElementById("span_upgrades_selectedUpgradeLevel").innerText = "Level " + persistentData.upgrades[selectedUpgrade] + " / " + upgradeList[selectedUpgrade].maxLevel;
		if ((persistentData.upgrades[selectedUpgrade] !== 0) || (upgradeList[selectedUpgrade].showLevel0Effect)) {
			document.getElementById("span_upgrades_selectedUpgradeCurrentEffect").innerHTML = "<b>Current Effect</b><br>" + upgradeList[selectedUpgrade].description(persistentData.upgrades[selectedUpgrade]);
		} else {
			document.getElementById("span_upgrades_selectedUpgradeCurrentEffect").innerText = "";
		}
		if (persistentData.upgrades[selectedUpgrade] !== upgradeList[selectedUpgrade].maxLevel) {
			document.getElementById("span_upgrades_selectedUpgradeNextEffect").innerHTML = "<b>Next Effect</b><br>" + upgradeList[selectedUpgrade].description(persistentData.upgrades[selectedUpgrade] + 1);
			document.getElementById("span_upgrades_selectedUpgradeCost").innerText = "Cost: " + formatInteger(upgradeList[selectedUpgrade].cost(persistentData.upgrades[selectedUpgrade])) + " virtue";
		} else {
			document.getElementById("span_upgrades_selectedUpgradeNextEffect").innerText = "";
			document.getElementById("span_upgrades_selectedUpgradeCost").innerText = "";
		}
	}
}
function formatPieceRecord(pieces, itemSingular, itemPlural) { // Converts a number of pieces to either "Not Cleared", a number of the item or a number of the item and pieces
	return Math.floor(pieces / 3) + " " + (numberIsBounded(3, pieces, 5) ? itemSingular : itemPlural) + " (" + (pieces % 3) + " / 3)"
}
export function updateRecordInteface() {
	for (let mode of ["records", "upgradelessRecords"]) {
		for (let difficulty = 0; difficulty < 4; difficulty++) {
			document.getElementById("tr_" + mode + "_highScore").children[difficulty + 1].innerText = formatInteger(persistentData[mode].highScore[difficulty]);
			let spareContinues = persistentData[mode].maxSpareContinues[difficulty];
			let spareLives = persistentData[mode].maxSpareLives[difficulty];
			let spareBombs = persistentData[mode].maxSpareBombs[difficulty];
			let difficultyColor = "var(--" + ["easy", "normal", "hard", "lunatic"][difficulty] + ")";
			document.getElementById("tr_" + mode + "_maxSpareItems").children[difficulty + 1].innerHTML = (spareContinues === -1) ? "Not Cleared" : (spareContinues !== 3) ? (spareContinues + " continue" + ((spareContinues === 1) ? "" : "s")) : ("♥".repeat(Math.floor(spareLives / 3)) + ((spareLives % 3 === 0) ? "" : "<span style=\"background:conic-gradient(" + difficultyColor + " 0%, " + difficultyColor + " " + ((spareLives % 3) * 100 / 3) + "%, transparent " + ((spareLives % 3) * 100 / 3) + "%, transparent); background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent;\">♥</span>") + "<span style=\"color: transparent;\">" + "♥".repeat(Math.floor(8 - spareLives / 3)) + "</span><br>" + "★".repeat(Math.floor(spareBombs / 3)) + ((spareBombs % 3 === 0) ? "" : "<span style=\"background:conic-gradient(" + difficultyColor + " 0%, " + difficultyColor + " " + ((spareBombs % 3) * 100 / 3) + "%, transparent " + ((spareBombs % 3) * 100 / 3) + "%, transparent); background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent;\">★</span>") + "<span style=\"color: transparent;\">" + "★".repeat(Math.floor(8 - spareBombs / 3)) + "</span>");
			document.getElementById("tr_" + mode + "_spellCardsCaptured").children[difficulty + 1].innerText = persistentData[mode].spellCardsCaptured[difficulty] + " / 13";
		}
	}
}
export function virtueProgressMultiplier() {
	// This multiplier is based on progress through the stage.
	// Key values:
	// Start of stage    ×1.000
	// Start of Zenryaku ×1.500
	// Start of volcano  ×2.000
	// Start of Lexan    ×3.000
	// Stage clear       ×10.000
	if (Bosses.lexan.isDefeated) { // Edge case
		return 10;
	} else if (currentBoss.bossId === undefined) { // During the stage, we interpolate between pairs of frames and multipliers corresponding to the starts of waves.
		let keyPairs = [
			[0, 1.00],
			[100, 1.00], // The start of the stage
			[850, 1.02], // The first amber shard spawn
			[1200, 1.04], // The second amber shard spawn
			[1700, 1.06], // Starts the wave of two amber shards
			[2280, 1.08], // Starts the wave of three amber shards
			[2800, 1.11], // The first amber orb spawn
			[3390, 1.14], // The second wave of yin yang orbs
			[4000, 1.16], // The second amber orb spawn
			[4550, 1.19], // The first UFO spawn
			[5580, 1.23], // The special amber shard spawn
			[5875, 1.25], // The start of the ocean section
			[6575, 1.28], // The first witch
			[6925, 1.31], // The first wave of eyes
			[7125, 1.33], // The second witch
			[7475, 1.36], // The second wave of eyes
			[7700, 1.39], // The third wave of eyes
			[8100, 1.42], // Red spirits become green spirits
			[8400, 1.45], // The third witch
			[9000, 1.50], // Zenryaku
			[9375, 1.50],
			// After the midboss
			[Bosses.zenryaku.frameDefeated, 2.00],
			[12625, 2.10], // The first magma elemental spawn
			[13220, 2.20], // The third wave of yin yang orbs
			[13775, 2.25], // The second magma elemental spawn
			[14400, 2.35], // The fourth wave of yin yang orbs
			[15000, 2.40], // The yin yang orbs from the fourth wave return
			[15950, 2.50], // The three-spirit wave
			[17025, 2.70], // The super magma elemental			
			[18250, 3.00] // Lexan
			[99999, 3.00]
		];
		for (let pairNum = 0; pairNum < keyPairs.length; pairNum++) {
			if (frame < keyPairs[pairNum][0]) {
				// P1 = pair `pairNum`, P2 = pair `pairNum - 1`.
				// (y - y1) / (x - x1) = (y2 - y1) / (x2 - x1)
				// => y = y1 + (y2 - y1) (x - x1) / (x2 - x1), so...
				let x = frame;
				let x1 = keyPairs[pairNum][0];
				let x2 = keyPairs[pairNum - 1][0];
				let y1 = keyPairs[pairNum][1];
				let y2 = keyPairs[pairNum - 1][1];
				return y1 + (y2 - y1) * (x - x1) / (x2 - x1);
			}
		}
	} else { // During bosses, we interpolate between the start of the current attack and the start of the next by HP.
		let keyPairs = (currentBoss.bossId === "zenryaku") ? [
			["N1", 1.50],
			["S2", 1.60],
			["S3", 1.75],
			["S4", 1.90],
			["END", 2.00],
		] : [
			["N1", 3.00],
			["S1", 3.15],
			["N2", 3.30],
			["S2", 3.45],
			["N3", 3.60],
			["S3", 3.80],
			["N4", 4.00],
			["S4", 4.20],
			["N5", 4.40],
			["S5", 4.70],
			["N6", 5.00],
			["S6", 5.30],
			["N7", 5.60],
			["S7", 6.00],
			["N8", 6.50],
			["S8", 6.80],
			["S9", 7.20],
			["S10", 8.32],
			["END", 10.00]
		];
		for (let pairNum = 0; pairNum < keyPairs.length; pairNum++) {
			let attackId = (currentBoss.isInSpellCard ? "S" : "N") + currentBoss.phase;
			if (attackId === keyPairs[pairNum][0]) {
				let attackData = Bosses[currentBoss.bossId].attacks[attackId];
				// `p` of the way between `y1` and `y2`, where `p` is the higher out of the proportion of HP depleted or the proportion of the attack's duration elapsed:
				let y1 = keyPairs[pairNum][1];
				let y2 = keyPairs[pairNum + 1][1];
				let p = Math.max(currentBoss.currentAttackTime / attackData.maxFrames, attackData.isSurvival ? 0 : (1 - enemies[currentBoss.enemyId].HP / attackData.HP));
				return y1 + p * (y2 - y1);
			}
		}
	}
}
export function processVirtueGain() {
	let virtueGained = score;
	document.getElementById("table_virtueCalculation_score").innerText = formatInteger(score);
	let progressMultiplier = virtueProgressMultiplier();
	virtueGained *= progressMultiplier;
	document.getElementById("table_virtueCalculation_progress").innerText = "× " + progressMultiplier.toFixed(3);
	let difficultyMultiplier = [1, 2, 4, 10][difficulty];
	virtueGained *= difficultyMultiplier;
	document.getElementById("table_virtueCalculation_difficulty").innerText = "× " + difficultyMultiplier;
	virtueGained *= upgradeEffectValues.prestige;
	document.getElementById("table_virtueCalculation_upgrades").innerText = "× " + upgradeEffectValues.prestige.toFixed(3);
	let achievementMultiplier = 1;
	virtueGained *= achievementMultiplier;
	document.getElementById("table_virtueCalculation_achievements").innerText = "× " + achievementMultiplier;
	virtueGained = Math.round(virtueGained);
	document.getElementById("table_virtueCalculation_total").innerText = formatInteger(virtueGained);
	persistentData.virtue += virtueGained;
}
export function updateRecord(label, value, opCode) { // `opCode` is "max" if this is a value to be maximised, and "min" if this is a value to be minimised.
	let isUpgradeless = true;
	upgradeLoop: for (let upgLevel of Object.values(persistentData.upgrades)) {
		if (upgLevel !== 0) {
			isUpgradeless = false;
			break upgradeLoop;
		}
	}
	persistentData.records[label][difficulty] = Math[opCode](persistentData.records[label][difficulty], value);
	if (isUpgradeless) {
		persistentData.upgradelessRecords[label][difficulty] = Math[opCode](persistentData.upgradelessRecords[label][difficulty], value);
	}
}
// To save data, we can just directly stringify the whole `persistentData` object.
export function savePersistentData() {
	localStorage.setItem("OrdinalProject01", JSON.stringify(persistentData));
}
// However, loading data is more complicated due to backwards compatibility, so we will use this function adapted from 'Exotic Matter Dimensions'.
function getSavedGame(saved, game, base=basesave) {
	for (let prop in saved) {
		if (saved.hasOwnProperty(prop)) {
			let savedValue = saved[prop];
			let gameValue = game[prop];
			let baseValue = base[prop]
			if (typeof savedValue === 'object' && !Array.isArray(savedValue)) {
				if (game.hasOwnProperty(prop) && Object.prototype.toString.call(gameValue) === '[object Object]') {
					getSavedGame(savedValue, gameValue, baseValue);
				} else if (!game.hasOwnProperty(prop)) {
					continue;
				} else {
					game[prop] = {};
					getSavedGame(savedValue, game[prop], baseValue);
				}
			} else {
				game[prop] = savedValue;
			}
		}
	}
}
export function loadPersistentData() {
	if (localStorage.getItem("OrdinalProject01") !== null) {
		let savedGame = JSON.parse(localStorage.getItem("OrdinalProject01"));
		getSavedGame(savedGame, persistentData, initialPersistentData);
	} // else, do nothing
}
export function wipeSave() {
	getSavedGame(initialPersistentData, persistentData, initialPersistentData);
	savePersistentData();
}