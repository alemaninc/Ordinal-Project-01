import { pauseBGM, playAudio, playBGM, stopBGM, unpauseBGM } from "./audio.js";
import { advanceDialogue, Bosses, clearCurrentDialogue, currentDialogueId, currentDialogueOpenTime, dialogueList } from "./boss_data.js";
import { hsltohex } from "./color_converter.js";
import { activeKeys, openMainMenu, openMenuWindow } from "./menu.js";
import { persistentData, processVirtueGain, savePersistentData, updateRecord, updateUpgradeEffectValues, upgradeEffectValues } from "./persistent_data.js";
import { clearExtraStageEvents, extraStageEvents, scheduleStageEvent, scheduleUnclearableStageEvent, stageEvents, unclearableExtraStageEvents } from "./stage_events.js";
import { addVectors, angleDifference, bezierCurve, formatDecimal, formatInteger, modulo, multiplyVectors, polarToCartesian, shuffleArray, squaredDistance } from "./utility.js";
import { circularRenderFunction, drawCanvas } from "./visuals.js";

// Difficulty is 0, 1, 2 or 3 for easy, normal, hard or lunatic respectively.
export var difficulty;
// `gameClockId` is the value created by setInterval when the game clock is initiated.
var gameClockId;
// The radius of the player.
export var playerHitboxRadius = 4.5;
// The maximum deflection from the centre of a ray at which the player's bomb ("Alpha Scattering") does damage.
export const maxBombDeflection = 18 * Math.PI / 180; // 18 degrees
// Whether the game is paused, and whether the game over screen is active.
export var gameIsPaused = false;
export var gameOverScreenActive = false;
// The number of continues left.
export var continuesLeft = 3;
// All properties stored in the sidebar. We will assign their values upon starting a game.
export var score, lives, bombs, power, pointValue, graze, fps;
// Begins the game.
export function startGame(difficultySetting) {
	// Initializes the difficulty text at the top of the sidebar.
	let difficultyName = ["Easy", "Normal", "Hard", "Lunatic"][difficultySetting];
	document.getElementById("sidebar_difficulty").innerText = difficultyName;
	document.getElementById("sidebar_difficulty").style.color = "var(--" + difficultyName.toLowerCase() + ")";
	document.getElementById("sidebar_hiscore").innerText = formatInteger(Math.min(persistentData[(Object.values(persistentData.upgrades).reduce((x, y) => x + y) === 0) ? "upgradelessRecords" : "records"].highScore[difficultySetting], 999999999));
	updateUpgradeEffectValues();
	continuesLeft = 3;
	// Initializes sidebar variables.
	score = 0;
	lives = upgradeEffectValues.startingLives; // We store these as a number of pieces rather than a number of the actual item.
	bombs = upgradeEffectValues.startingBombs;
	power = upgradeEffectValues.startingPower;
	pointValue = 10000;
	graze = 0;
	fps = 50;
	totalSpellCardsCaptured = 0;
	// Update the sidebar for the first time.
	drawCanvas();
	openMenuWindow("game");
	difficulty = difficultySetting;
	frame = 0;
	lastMiss = -999;
	lastBomb = -999;
	collectedScoreBonuses = 0;
	stopBGM(); // "An Addendum to the Past" only starts playing 2 seconds in.
	document.getElementById("div_autocollectionLineIndicator").style.top = (15 + upgradeEffectValues.lowerAutocollect) + "px";
	lastTick = Date.now();
	requiredFrames = 0;
	gameClockId = setInterval(gameClock, 10);
}
// Clears the current game data.
export function endGame(overrideScreenChange) {
	processVirtueGain();
	updateRecord("highScore", score, "max");
	if (Bosses.lexan.isDefeated) {
		updateRecord("maxSpareContinues", continuesLeft, "max");
		if (continuesLeft === 3) {
			if (lives > persistentData.records.maxSpareLives) { // The bomb record is tied to the life record.
				persistentData.records.maxSpareBombs = 0;
			}
			if (lives > persistentData.upgradelessRecords.maxSpareLives) { // The bomb record is tied to the life record.
				persistentData.upgradelessRecords.maxSpareBombs = 0;
			}
			updateRecord("maxSpareLives", lives, "max");
			updateRecord("maxSpareBombs", bombs, "max");
		}
	}
	updateRecord("spellCardsCaptured", totalSpellCardsCaptured, "max");
	savePersistentData();
	clearScreen(false);
	for (let itemId of Object.keys(items)) {
		delete items[itemId];
	}
	clearExtraStageEvents(true);
	clearInterval(gameClockId);
	isInCutscene = false;
	currentBoss.bossId = undefined;
	clearCurrentDialogue();
	gameIsPaused = false;
	gameOverScreenActive = false;
	document.getElementById("window_game").style.display = "none"; // In case the game was paused.
	document.getElementById("window_pauseMenu").style.display = "none";
	document.getElementById("window_gameOver").style.display = "none";
	document.getElementById("div_bossSpellCard").style.opacity = 0;
	document.getElementById("div_bossSpellCard").innerText = "";
	if (!overrideScreenChange) {
		stopBGM();
		openMenuWindow("virtueCalculation");
		setTimeout(function() {
			openMainMenu();
		}, 4000); // Game timer no longer exists so do this as a normal timeout rather than stage event.
	}
}
// The id of the current frame.
export var frame = 0;
// The frame of the last death and last bomb.
export var lastMiss = -999;
export var lastBomb = -999;
// The number of score bonuses collected so far.
export var collectedScoreBonuses = 0;
// The score requirement for the next bonus.
// Each bonus consists of 10 power items, 10 point items and a large item whose type depends on how many bonuses have been collected.
export function scoreForNextBonus() {
	return Math.round(50000 * (collectedScoreBonuses + 1) * (collectedScoreBonuses + 10) * upgradeEffectValues.moreBonuses);
}
function processScoreBonus() {
	collectedScoreBonuses++;
	let itemType = (collectedScoreBonuses % 15 === 0) ? "extend" : (collectedScoreBonuses % 5 === 0) ? "spellcard" : (collectedScoreBonuses % 3 === 0) ? "lifepiece" : "bombpiece";
	itemCollectionFunctions[itemType]();
}
// The number of frames that should have been run at the current point in time.
var requiredFrames = 0;
var lastTick = Date.now();
// 0 = no collision, 1 = graze, 2 = direct collision.
export function radialCollisionCheck(radius, canGraze = true) {
	if (radius === 0) { // Special case - hidden bullet.
		return function() {return 0};
	}
	let correctedRadius = radius + playerHitboxRadius;
	let grazeRadius = canGraze ? (correctedRadius * 1.25 + 8) : correctedRadius;
	return function(position1, position2) {
		let squaredDistance = (position1[0] - position2[0]) * (position1[0] - position2[0]) + (position1[1] - position2[1]) * (position1[1] - position2[1]);
		return (squaredDistance > (grazeRadius * grazeRadius)) ? 0 : (squaredDistance > (correctedRadius * correctedRadius)) ? 1 : 2;
	}
}
export function rectangularCollisionCheck(height, width) {
	let correctedHeight = height + playerHitboxRadius * Math.SQRT1_2;
	let correctedWidth = width + playerHitboxRadius * Math.SQRT1_2;
	let grazeHeight = correctedHeight * 1.25 + 8;
	let grazeWidth = correctedWidth * 1.25 + 8;
	return function(position1, position2) {
		let xOffset = Math.abs(position1[0] - position2[0]);
		let yOffset = Math.abs(position1[1] - position2[1]);
		return ((xOffset < correctedWidth / 2) && (yOffset < correctedHeight / 2)) ? 2 : ((xOffset < grazeWidth / 2) && (yOffset < grazeHeight / 2)) ? 1 : 0;
	}
}
// A list of all the bullets currently present.
export const bullets = {};
// The number of bullets that have been spawned during the game.
var bulletCounter = 0;
// Creates a bullet. `positionFunction` must take as an argument the number of frames that has elapsed since the bullet's creation, and return its coordinates.
// `collisionCheckFunction` is to take the position of the bullet and player as an argument and return: 0 if there is no collision, 1 if there is a graze, 2 if there is a direct hit.
// `nextGraze` denotes the next frame upon which a graze with this bullet is possible. Every bullet can only be grazed once every 10 frames (5 grazes per second).
export function createBullet(position, behaviourFunction, renderFunction, collisionCheckFunction, maximumX = Math.max(270, Math.abs(position[0]) + 5), maximumY = Math.max(320, Math.abs(position[1]) + 5), extraProperties = {}) {
	bullets[bulletCounter] = {position, behaviourFunction, renderFunction, collisionCheckFunction, maximumX, maximumY, creationTime: frame, nextGraze: frame, id: bulletCounter};
	Object.assign(bullets[bulletCounter], extraProperties);
	bulletCounter++;
}
// A list of all the enemies currently present.
export const enemies = {};
// The number of enemies that have been spawned during the game.
export var enemyCounter = 0;
// Creates an enemy. `positionFunction` and `collisionCheckFunction` use the same logic as for bullets.
export function createEnemy(position, behaviourFunction, renderFunction, collisionCheckFunction, HP, score = 0, dropList = {}, onDefeat = function(){}, maximumX = Math.max(270, Math.abs(position[0]) + 5), maximumY = Math.max(320, Math.abs(position[1]) + 5), extraProperties = {}) {
	enemies[enemyCounter] = {position, behaviourFunction, renderFunction, collisionCheckFunction, HP, maxHP: HP, score, dropList, onDefeat, maximumX, maximumY, creationTime: frame, id: enemyCounter};
	Object.assign(enemies[enemyCounter], extraProperties);
	enemyCounter++;
}
// A list of all the player bullets currently present.
export const playerBullets = {};
// The number of player bullets that have been spawned during the game.
var playerBulletCounter = 0;
// The current amplitude of oscillation of the player bullet spawners. This value is calculated, but it gradually decays towards the calculated value rather than immediately being set.
var playerBulletOscillation = 30;
// Spawns a player bullet. Note that the vertical component of velocity for this function is negated, i.e. `10` indicates 10 pixels per frame upwards rather than downwards.
function createPlayerBullet(position, behaviourFunction, damage, extraProperties = {}) {
	playerBullets[playerBulletCounter] = {position, behaviourFunction, creationTime: frame, damage, id: playerBulletCounter};
	Object.assign(playerBullets[playerBulletCounter], extraProperties);
	playerBulletCounter++;
}
// These functions run every time an item is collected.
const itemCollectionFunctions = {
	power: function() {
		if (power < 400) {
			power++;
			if (power % 100 === 0) {
				playAudio("se_powerup");
			}
			score += 100;
		} else {
			score += 10000;
		}
	},
	fullpower: function() { // Gives 1.00 power, or if the player is at 3.00 power or above, gives 10 000 score per 0.01 power above this.
		if (power < 400) { // Power will always go up in this case.
			playAudio("se_powerup");
		}
		score += 10000 * Math.max(power - 300, 0);
		power = Math.min(power + 100, 400);
	},
	point: function() {
		score += pointValue;
	},
	lifepiece: function() {
		if (lives % 3 === 2) {
			playAudio("se_extend");
		}
		lives = Math.min(lives + 1, 24);
	},
	extend: function() {
		if (lives < 24) {
			playAudio("se_extend");
		}
		lives = Math.min(lives + 3, 24);
	},
	bombpiece: function() {
		bombs = Math.min(bombs + 1, 24);
	},
	spellcard: function() {
		bombs = Math.min(bombs + 3, 24);
	}
};
// A list of all the items currently present.
export const items = {};
// The number of items that have been spawned during the game.
var itemCounter = 0;
// Creates an item. We pass slightly different parameters to those for creating bullets and enemies as all items have a common motion function.
function createItem(position, type) {
	items[itemCounter] = {position, type, velocity: -3, autocollect: false, id: itemCounter};
	itemCounter++;
}
// Converts a drop list object (e.g. {point: 1, power: 2}) into a shuffled drop list array (e.g. ["power", "point", "power"]).
function inflateDropList(list) {
	let out = [];
	for (let dropType of Object.keys(list)) {
		for (let i = 0; i < list[dropType]; i++) {
			out.push(dropType);
		}
	}
	return shuffleArray(out);
}
// Arranges an enemy's drops nicely.
export function processEnemyDrops(enemyPosition, dropList) {
	let inflatedList = inflateDropList(dropList);
	if (inflatedList.length === 1) { // Special case - if only one item, create it at the exact position.
		createItem(enemyPosition, inflatedList[0]);
		return;
	}
	let largeDrops = inflatedList.filter(x => !["point", "power"].includes(x));
	let smallDrops = inflatedList.filter(x => ["point", "power"].includes(x));
	let largeRingRadius = 20 * largeDrops.length - 30;
	let totalSmallDrops = smallDrops.length;
	let smallRingRadii = [];
	let smallRingSizes = [];
	let cumulativeSmallRingSizes = [0];
	let nextSmallRingSize = (largeDrops.length === 0) ? 18 : (largeRingRadius + 80);
	while (totalSmallDrops > 0) {
		smallRingRadii.push(nextSmallRingSize);
		let dropsInNextRing = Math.min(Math.floor(nextSmallRingSize / 3.6), totalSmallDrops);
		smallRingSizes.push(dropsInNextRing);
		cumulativeSmallRingSizes.push(cumulativeSmallRingSizes[cumulativeSmallRingSizes.length - 1] + dropsInNextRing);
		nextSmallRingSize += 18;
		totalSmallDrops -= dropsInNextRing;
	}
	let largeRingPhase = Math.random();
	for (let largeId = 0; largeId < largeDrops.length; largeId++) {
		createItem(addVectors(enemyPosition, polarToCartesian(largeRingRadius, bearingToAngle(360 * (largeId + largeRingPhase) / largeDrops.length)), [Math.random() * 8 - 4, Math.random() * 8 - 4]), largeDrops[largeId]);
	}
	for (let ringId = 0; ringId < smallRingRadii.length; ringId++) {
		let smallRingPhase = Math.random();
		for (let smallId = 0; smallId < smallRingSizes[ringId]; smallId++) {
			createItem(addVectors(enemyPosition, polarToCartesian(smallRingRadii[ringId], bearingToAngle(360 * (smallId + smallRingPhase) / smallRingSizes[ringId])), [Math.random() * 8 - 4, Math.random() * 8 - 4]), smallDrops[cumulativeSmallRingSizes[ringId] + smallId]);
		}
	}
}
// The game canvas, and its context.
const gameCanvas = document.getElementById("gameCanvas");
export const canvasContext = gameCanvas.getContext("2d");
// Position of the player, relative to the centre of the screen. Item 0 = horizontal distance (x-distance) rightward; item 1 = vertical distance (y-distance) downward.
export var playerPosition = [0, 250];
// Converts a bearing (clockwise from north) to a polar angle under the standard convention (anticlockwise from east), accounting that the y axis goes downwards here.
export function bearingToAngle(degrees) {
	return (degrees - 90) * Math.PI / 180;
}
// Returns the polar angle from an object to another object.
export function angleToObject(observer, target) {
	return Math.atan2(target[1] - observer[1], target[0] - observer[0]);
}
// Returns the polar angle from a position to the player.
export function angleToPlayer(objectPosition) {
	return angleToObject(objectPosition, playerPosition);
}
// Moves a distance along a Bezier curve, and returns the new position and the new `t`.
export function processBezierMotion(criticalPoints, t, speed) {
	let differential = 5000 * Math.sqrt(squaredDistance(bezierCurve(criticalPoints, t - 0.0001), bezierCurve(criticalPoints, t + 0.0001)));
	let dt = speed / differential;
	return [bezierCurve(criticalPoints, t + dt), t + dt];
}
// Changes an enemy's speed in a smooth way.
export function processNaturalSpeed(speed, acceleration, targetSpeed) {
	let targetAcceleration = targetSpeed - speed;
	acceleration = acceleration * 0.9 + targetAcceleration * 0.1;
	speed += acceleration * 0.02;
	return [speed, acceleration];
}
// Initiates the player's bomb.
export function useBomb() {
	if (bombs >= 3) {
		lastBomb = frame;
		document.getElementById("div_playerSpellCard").style.opacity = 1;
		setTimeout(function() {
			document.getElementById("div_playerSpellCard").style.opacity = 0;
		}, 2400);
		bombs -= 3;
		playAudio("se_nep00");
	} else {
		playAudio("se_invalid");
	}
}
// Uses a continue.
export function useContinue() {
	// If no continues are left, the function corresponding to the continue button gets replaced with undefined so the appropriate sound is played.
	// Thus, we do not check if any continues are left here.
	processVirtueGain();
	continuesLeft--;
	score = 3 - continuesLeft;
	lives = 0;
	bombs = 0;
	power = 400;
	gameOverScreenActive = false;
	playerPosition[0] = 0;
	playerPosition[1] = 250;
	openMenuWindow("game");
	unpauseBGM();
}
// Returns the angles at which the player's bomb ("Alpha Scattering") fires rays.
export function playerBombAngles() {
	let principalAngle = frame * 1.2;
	let out = [];
	for (let direction of [-1, 1]) {
		for (let addend of [0, 120, 240]) {
			out.push(bearingToAngle((principalAngle + addend) * direction));
		}
	}
	return out;
}
// Returns the maximum distance reached by the player's bomb ("Alpha Scattering") at this point in time.
export function playerBombRange() {
	let timeSinceBomb = frame - lastBomb;
	return Math.max(Math.min(timeSinceBomb, 300 - timeSinceBomb) * 7.5, 0); // Clamp at 0 to prevent negative from being squared into a positive.
}
// Returns the maximum distance at which the player's bomb does damage regardless of the angle.
export function playerBombGuaranteedRange() {
	let timeSinceBomb = frame - lastBomb;
	return Math.max(timeSinceBomb, 0) * Math.max(300 - timeSinceBomb, 0) / 200;
}
// Returns whether a bomb is active or not.
export function bombIsActive() {
	return frame - lastBomb <= 300;
}
// Determines whether a position is currently covered by the player's bomb, and if it is, how much damage to deal per frame.
export function positionCoveredByBomb(vector, bombAngles = bombIsActive() ? playerBombAngles() : [], bombRange = playerBombRange(), guaranteedRange = playerBombGuaranteedRange()) { 
	let squaredDist = squaredDistance(vector, playerPosition);
	if (squaredDist > (bombRange * bombRange)) { // If too far:
		return 0;
	}
	let out = 0;
	if (squaredDist < (guaranteedRange * guaranteedRange)) { // Within 20px, always cover to prevent bullets from avoiding the bomb by going right through the player. Also does extra damage.
		out += 1;
	}
	for (let bombAngle of bombAngles) {
		if (angleDifference(bombAngle, angleToPlayer(vector) + Math.PI) < maxBombDeflection) { // Add pi to change the angle to the player into an angle from the player.
			out += 3;
		}
	}
	return out;
}
export var isInCutscene = false;
export function beginCutscene() {
	clearScreen(true);
	isInCutscene = true;
	lastBomb = -999; // Clear any bomb which is on the screen.
}
export function endCutscene() {
	isInCutscene = false;
}
export const currentBoss = {
	bossId: undefined,
	enemyId: undefined,
	phase: 0,
	isInSpellCard: false,
	targetPosition: [-250, -300],
	currentAttackTime: 0,
}
// Creates a boss.
export function createBoss(id) {
	// Initialises the boss.
	currentBoss.bossId = id;
	currentBoss.targetPosition = [-500, -300];
	isInCutscene = true;
	startBossPhase("S0"); // The next ID will thus be "N1" as required.
	lastBomb = Math.min(lastBomb, frame - 375); // Do not bomb during the boss cutscene.
}
// Retrieves the id of the next phase of a boss
function nextBossPhaseId(id) {
	let attackData = Bosses[currentBoss.bossId].attacks;
	let phaseNum = Number(id.substring(1));
	let isInSpellCard = id[0] === "S";
	do {
		phaseNum += isInSpellCard ? 1 : 0;
		isInSpellCard = !isInSpellCard;
		id = (isInSpellCard ? "S" : "N") + phaseNum;
		if (phaseNum > Bosses[currentBoss.bossId].phases) {
			return "END";
		}
	} while (attackData[id] === undefined);
	return id;
}
// Starts the next phase of a boss.
export function startBossPhase(currentPhaseId) { // `phaseId` is "Nn" for the nth nonspell and "Sn" for the nth spell card.
	let nextId = nextBossPhaseId(currentPhaseId);
	if (nextId === "END") { // Ends the boss fight.
		clearScreen(Bosses[currentBoss.bossId].autocollectAtEnd);
		currentBoss.bossId = undefined;
		document.getElementById("div_bossSpellCard").style.opacity = 0;
		playAudio("se_enep01");
	} else {
		let bossData = Bosses[currentBoss.bossId];
		let nextAttackData = bossData.attacks[nextId];
		let position = enemies[currentBoss.enemyId]?.position ?? currentBoss.targetPosition;
		clearScreen((currentPhaseId === "S0") && bossData.autocollectAtStart); // Clear before creating the boss or the boss gets deleted. Autocollect only at the start of the boss fight.
		currentBoss.enemyId = enemyCounter;
		// We apply a blank behaviour function and run the boss's actual behaviour function in the main loop.
		createEnemy(position, function() {}, bossData.renderFunction, bossData.collisionCheckFunction, nextAttackData.isSurvival ? Number.MIN_VALUE : nextAttackData.HP);
		enemies[currentBoss.enemyId].invincible = true; // Every boss is invincible for the first 2 seconds of each pattern. We set this to false within the game loop.
		currentBoss.phase = Number(nextId.substring(1));
		currentBoss.isInSpellCard = nextId[0] === "S";
		currentBoss.currentAttackTime = 0;
		document.getElementById("div_bossSpellCard").style.opacity = 0;
		document.getElementById("div_bossSpellCard").innerText = "";
		if (currentBoss.isInSpellCard) {
			scheduleUnclearableStageEvent(25, function() { // Give potential previous spell card time to disappear.
				playAudio("se_cat00");
				document.getElementById("div_bossSpellCard").innerText = Bosses[currentBoss.bossId].attacks[nextId].name;
				document.getElementById("div_bossSpellCard").style.opacity = 1;
				document.getElementById("div_bossSpellCard").style.textDecorationColor = Bosses[currentBoss.bossId].color;
			});
		}
	}
}
// The total number of spell cards captured in this game, out of 13.
var totalSpellCardsCaptured = 0;
// Whether a spell card can be captured.
export function canGetSpellCard() {
	let attackStartTime = frame - currentBoss.currentAttackTime;
	return (lastMiss < attackStartTime) && ((lastBomb + 350) < attackStartTime); // Must not have missed or been under the effect of a bomb during the current card.
}
// Calculates the score bonus for the current spell card.
export function spellCardBonus() {
	let cardData = Bosses[currentBoss.bossId].attacks["S" + currentBoss.phase];
	let maxScore = cardData.captureScore;
	if (cardData.isSurvival) {
		return maxScore;
	} else {
		let maxTime = cardData.maxFrames;
		let timeLeft = maxTime - currentBoss.currentAttackTime;
		let proportion = (1 + 2 * Math.min(timeLeft / (maxTime - 250), 1)) / 3;
		return 10 * Math.round(proportion * maxScore / 10); // Round to the nearest 10 points.
	}
}
// Removes all bullets and enemies, and autocollects all items at the start and end of a boss fight.
export function clearScreen(autocollect) {
	for (let bulletId of Object.keys(bullets)) {
		delete bullets[bulletId];
	}
	for (let playerBulletId of Object.keys(playerBullets)) {
		delete playerBullets[playerBulletId];
	}
	for (let enemyId of Object.keys(enemies)) {
		processEnemyDrops(enemies[enemyId].position, enemies[enemyId].dropList);
		delete enemies[enemyId];
	}
	if (autocollect) {
		for (let itemId of Object.keys(items)) {
			items[itemId].autocollect = true;
		}
	}
	clearExtraStageEvents(); // These are always related to enemies on the screen, so get rid of them as well.
}
var finalSpellSlowdown = false; // When Lexan's last spell is defeated, this activates and reduces the frame rate to 10fps.
// Runs all logic that happens during a frame.
function processFrame() {
	// Run all events that need to happen this frame.
	if (stageEvents[frame] !== undefined) {
		stageEvents[frame]();
	}
	if (extraStageEvents[frame] !== undefined) {
		for (let eventNum = 0; eventNum < extraStageEvents[frame].length; eventNum++) {
			extraStageEvents[frame][eventNum]();
		}
	}
	if (unclearableExtraStageEvents[frame] !== undefined) {
		for (let eventNum = 0; eventNum < unclearableExtraStageEvents[frame].length; eventNum++) {
			unclearableExtraStageEvents[frame][eventNum]();
		}
	}
	frame++;
	if ((currentDialogueId !== undefined) && (frame - currentDialogueOpenTime >= dialogueList[currentDialogueId].maxFrames)) { // We advance dialogues automatically to prevent the stage from advancing too much and desyncing from the music.
		advanceDialogue();
	}
	let bombActive = bombIsActive();
	let bombAngles = bombActive ? playerBombAngles() : [];
	let bombRange = playerBombRange();
	let guaranteedBombRange = playerBombGuaranteedRange();
	// Determine the player speed, and adjust the player's position.
	let speed = (activeKeys.Shift || bombActive) ? (2.4 * upgradeEffectValues.speedDown) : (7.2 * upgradeEffectValues.speedUp);
	if (activeKeys.ArrowLeft) {
		playerPosition[0] -= speed;
	}
	if (activeKeys.ArrowRight) {
		playerPosition[0] += speed;
	}
	playerPosition[0] = Math.max(-244, Math.min(playerPosition[0], 244)); // 5 pixels less than screen size to prevent hitbox being halfway out.
	if (activeKeys.ArrowUp) {
		playerPosition[1] -= speed;
	}
	if (activeKeys.ArrowDown) {
		playerPosition[1] += speed;
	}
	playerPosition[1] = Math.max(-294, Math.min(playerPosition[1], 294));
	if (currentBoss.bossId !== undefined) {
		enemies[currentBoss.enemyId].position = addVectors(multiplyVectors(enemies[currentBoss.enemyId].position, 0.95), multiplyVectors(currentBoss.targetPosition, 0.05));
		let attackTimeLeft = Bosses[currentBoss.bossId].attacks[(currentBoss.isInSpellCard ? "S" : "N") + currentBoss.phase].maxFrames - currentBoss.currentAttackTime;
		if ((attackTimeLeft <= 500) && (attackTimeLeft % 50 === 0)) {
			playAudio("se_timeout");
		}
	}
	if (!isInCutscene) { // In cutscenes, we do not run any enemy or bullet behaviour.
		// Run the behaviour of all enemies.
		let grazesThisFrame = 0;
		let collisionThisFrame = false;
		if (currentBoss.bossId !== undefined) { // Bosses use different enemy behaviour from normal enemies
			let phaseId = (currentBoss.isInSpellCard ? "S" : "N") + currentBoss.phase;
			let enemyData = enemies[currentBoss.enemyId];
			let bossData = Bosses[currentBoss.bossId];
			let attackData = bossData.attacks[phaseId];
			currentBoss.currentAttackTime++;
			if ((currentBoss.currentAttackTime === 100) && (!attackData.isSurvival)) { // Every boss is invincible for the first 2 seconds of each attack.
				enemies[currentBoss.enemyId].invincible = false;
			}
			let potentialCapture = true;
			if (currentBoss.currentAttackTime === attackData.maxFrames) { // If the attack is timed out.
				enemyData.HP = 0;
				if (!attackData.isSurvival) {
					potentialCapture = false;
				}
			}
			if (enemyData.HP <= 0) {
				if (attackData.slowDefeat) { // Prevent the boss from being defeated for 2 seconds while the game slows down on the last spell.
					playAudio("se_enep01");
					attackData.slowDefeat = false;
					finalSpellSlowdown = true;
					enemyData.HP = 1;
					enemyData.invincible = true;
					scheduleStageEvent(16, function() { // 1.6 seconds while slowed down.
						enemyData.HP = 0;
						finalSpellSlowdown = false;
					});
				} else {
					if (currentBoss.isInSpellCard) {
						if (canGetSpellCard() && potentialCapture) { // If the spell card is captured
							score += spellCardBonus();
							totalSpellCardsCaptured++;
							document.getElementById("div_bossSpellCaptureText").innerText = "Get Spell Card!"
							playAudio("se_cardget");
						} else {
							document.getElementById("div_bossSpellCaptureText").innerText = "Bonus Failed..."
							playAudio("se_fault");
						}
						document.getElementById("div_bossSpellCaptureText").style.opacity = 1;
						setTimeout(function() {
							document.getElementById("div_bossSpellCaptureText").style.opacity = 0;
						}, 800); // Not stage event in case game is quit in this time.
					}
					score += attackData.guaranteedScore;
					processEnemyDrops(enemyData.position, attackData.dropList);
					if (attackData.onDefeat !== undefined) {
						attackData.onDefeat(enemyData.position);
					}
					delete enemies[currentBoss.enemyId];
					startBossPhase(phaseId);
				}
			} else {
				Bosses[currentBoss.bossId].attacks[phaseId].behaviourFunction(currentBoss.currentAttackTime);
			}
		}
		let enemyIds = Object.keys(enemies);
		enemyLoop: for (let id of enemyIds) {
			if (!enemies[id].invincible) {
				enemies[id].HP -= positionCoveredByBomb(enemies[id].position, bombAngles, bombRange, guaranteedBombRange) * upgradeEffectValues.bombStrength; // If bomb is inactive, this always returns 0.
			}
			if ((currentBoss.bossId === undefined) || (id != currentBoss.enemyId)) { // Boss behaviour gets run separately, except for collisions.
				if (enemies[id].HP <= 0) {
					playAudio("se_enep00", 0.25);
					score += enemies[id].score;
					processEnemyDrops(enemies[id].position, enemies[id].dropList);
					if (enemies[id].onDefeat !== undefined) {
						enemies[id].onDefeat(enemies[id].position);
					}
					delete enemies[id];
					continue enemyLoop;
				} else if ((Math.abs(enemies[id].position[0]) > enemies[id].maximumX) || (Math.abs(enemies[id].position[1]) > enemies[id].maximumY)) {
					delete enemies[id];
					continue enemyLoop;
				}
				enemies[id].behaviourFunction(frame - enemies[id].creationTime, id);
			}
			let playerCollisionValue = enemies[id].collisionCheckFunction(enemies[id].position, playerPosition);
			if (playerCollisionValue === 2) {
				collisionThisFrame = true;
			}
			// Check for all collisions between enemies and the player's bullets.
			for (let id2 of Object.keys(playerBullets)) {
				let bulletCollisionValue = enemies[id].collisionCheckFunction(enemies[id].position, playerBullets[id2].position);
				if (bulletCollisionValue === 2) {
					if (!enemies[id].invincible) {
						enemies[id].HP -= playerBullets[id2].damage;
					}
					score += 10;
					playAudio("se_damage00", 0.2);
					delete playerBullets[id2];
				}
			}
		}
		let bulletIds = Object.keys(bullets);	
		bulletLoop: for (let id of bulletIds) {
			if (bullets[id] === undefined) { // Bullets may get deleted midway through this loop, e.g. by Lexan's electric poles or black hole.
				continue bulletLoop;
			}
			if (((frame - lastMiss) <= 25) && (!bullets[id].indestructible)) { // If less than 0.5 seconds have passed since a miss, delete all bullets.
				delete bullets[id];
				continue bulletLoop;
			}
			if ((Math.abs(bullets[id].position[0]) > bullets[id].maximumX) || (Math.abs(bullets[id].position[1]) > bullets[id].maximumY)) {
				delete bullets[id];
				continue bulletLoop;
			}
			if ((positionCoveredByBomb(bullets[id].position, bombAngles, bombRange, guaranteedBombRange) !== 0) && (!bullets[id].indestructible)) {
				delete bullets[id];
				continue bulletLoop;
			}
			bullets[id].behaviourFunction(frame - bullets[id].creationTime);
			let collisionValue = bullets[id].collisionCheckFunction(bullets[id].position, playerPosition);
			if (collisionValue === 2) {
				collisionThisFrame = true;
				continue bulletLoop;
			} else if ((collisionValue === 1) && (frame >= bullets[id].nextGraze)) {
				grazesThisFrame++;
				bullets[id].nextGraze = frame + 10;
			}
		}
		let playerBulletIds = Object.keys(playerBullets);
		playerBulletLoop: for (let id of playerBulletIds) {
			// During Lexan's last spell, bullets can move sideways and downwards significantly, so increase the limits.
			// In all other situations, we want to minimise the number of player bullets to avoid large numbers of collisions when there are lots of enemies.
			let maximumX = (currentBoss.phase === 10) ? 1000 : 260;
			let maximumY = (currentBoss.phase === 10) ? 1000 : 310;
			if ((Math.abs(playerBullets[id].position[0]) > maximumX) || (Math.abs(playerBullets[id].position[1]) > maximumY)) {
				delete playerBullets[id];
			} else {
				playerBullets[id].behaviourFunction(frame - playerBullets[id].creationTime);
			}
		}
		graze += grazesThisFrame;
		if (grazesThisFrame !== 0) { // Do not play the graze sound effect more than once per frame.
			playAudio("se_graze");
		}
		pointValue += grazesThisFrame * 50;
		// If there was a collision between a player and a bullet or enemy, add a miss.
		// If no bomb happens in the next 0.1s, remove a life and reset enemy bullets and the player's position, otherwise add graze.
		if (collisionThisFrame && ((frame - lastMiss) > 100) && (frame - lastBomb > 350)) { // Misses must be at least 2s apart, and cannot happen during a bomb or within 1s of after a bomb.
			playAudio("se_pldead00");
			lastMiss = frame;
		}
		if ((frame - lastMiss === 5) && (!bombActive)) {
			if (lives < 3) {
				openMenuWindow("gameOver");
				document.getElementById("button_gameOver_continueGame").innerText = "Continue (" + continuesLeft + " left)";
				document.getElementById("window_game").style.display = "block"; // Makes the game visible in the background.
				pauseBGM();
				gameOverScreenActive = true;
			} else {
				let lostPower = Math.floor(Math.min(power - 100, power * 0.1));
				power -= lostPower;
				for (let i = 0; i < Math.min(lostPower, 7); i++) {
					createItem(addVectors(playerPosition, polarToCartesian(90, bearingToAngle(-30 + i * 10))), "power");
				}
				lives -= 3;
				bombs = Math.max(bombs, upgradeEffectValues.startingBombs); // Replenishes bombs to 2 full bombs (possibly more with upgrades).
				for (let id of Object.keys(bullets)) {
					if (!bullets[id].indestructible) {
						delete bullets[id];
					}
				}
				playerPosition = [0, 250];
			}
		}
	}
	// Process any bonus before dealing with the motion of items.
	if (score >= scoreForNextBonus()) { // Run this in an if rather than a while to prevent audio spam if multiple bonuses are obtained at once (e.g. when Lexan's 9th is captured)
		playAudio("se_bonus");
	}
	while (score >= scoreForNextBonus()) {
		processScoreBonus();
	}
	// Process the motion of items, and collect any items within the collection radius.
	let itemIds = Object.keys(items);
	itemLoop: for (let id of itemIds) {
		if (playerPosition[1] < (upgradeEffectValues.lowerAutocollect - 300)) { // Process autocollection
			items[id].autocollect = true;
		}
		if (items[id].autocollect || isInCutscene) {
			items[id].position = addVectors(items[id].position, polarToCartesian(12, angleToPlayer(items[id].position)));
		} else { // 0.05 px s^-2 acceleration from gravity (downwards) and 0.005v^2 px s^-2 acceleration from drag (opposes motion).
			items[id].velocity += items[id].velocity * Math.abs(items[id].velocity) * -0.015 + 0.1;
			items[id].position[1] += items[id].velocity;
		}
		let dist = squaredDistance(playerPosition, items[id].position);
		if (items[id].position[1] > 320) { // Delete only if too low, not too high.
			delete items[id];
		} else if (dist < 100) {
			itemCollectionFunctions[items[id].type]();
			playAudio("se_item00");
			delete items[id];
		} else if (dist < (["point", "power"].includes(items[id].type) ? 2500 : (items[id].type === "fullpower") ? 4225 : 6400)) { // Collection radius is 50px for point and power items, 65px for full power and 80px for large items.
			items[id].autocollect = true;
		}
	}
	// Spawn the player's bullets. We spawn auxiliary bullets every 3 seconds, and central bullets every 2 frames.
	// We also adjust the oscillation of the player's bullets here. The rate of decay towards the desired value is approximately proportional to the square root of the discrepancy.
	let desiredPlayerBulletOscillation = activeKeys.Shift ? (12 + Math.floor(power / 100) * 3) : (30 + Math.floor(power / 100) * 7.5);
	if ((activeKeys.z || upgradeEffectValues.autoShoot) && (!isInCutscene)) { // Z = is shooting
		if ((frame % 5) === 0) {
			playAudio("se_plst00", 0.25);
		}
		playerBulletOscillation = playerBulletOscillation + Math.sign(desiredPlayerBulletOscillation - playerBulletOscillation) * (Math.sqrt(Math.abs(desiredPlayerBulletOscillation - playerBulletOscillation) + 1) - 1) * 0.2;
		let instantaneousPlayerPosition = structuredClone(playerPosition);
/*		if ((frame % 3) === 0) {
			let currentOscillation = playerBulletOscillation;
			let numberOfPaths = [2, 3, 4, 6][Math.floor(power / 100) - 1];
			for (let i = 0; i < numberOfPaths; i++) {
				let horizontalAngle = Math.cos(Math.PI * 2 * i / numberOfPaths + frame / (5 * numberOfPaths));
				createPlayerBullet(addVectors(instantaneousPlayerPosition, [currentOscillation * horizontalAngle, -20]), function(t) {
					this.position[0] += currentOscillation * horizontalAngle * t ** 0.5 * 0.003;
					this.position[1] -= 1.5 * t ** 0.5;
				}, 1);
			} */
		if ((frame % 3) === 0) {
			let auxiliaryBulletStartPoints = [[16, -24], [24, -10], [32, -20], [40, -8]];
			let auxiliaryBulletHorizontalSpeeds = [0.1, 0.18, 0.28, 0.4];
			let auxiliaryBulletVerticalSpeeds = [1.48, 1.4, 1.44, 1.36];
			let focusHorizontalFactor = activeKeys.Shift ? 0.7 : 1;
			for (let i = 0; i < Math.floor(power / 100); i++) {
				for (let direction of [-1, 1]) {
					createPlayerBullet(addVectors(instantaneousPlayerPosition, [(auxiliaryBulletStartPoints[i][0] * focusHorizontalFactor + 4) * direction, auxiliaryBulletStartPoints[i][1] * focusHorizontalFactor]), function(t) {
						this.position[0] += auxiliaryBulletHorizontalSpeeds[i] * t ** 0.5 * direction * focusHorizontalFactor;
						this.position[1] -= auxiliaryBulletVerticalSpeeds[i] * t ** 0.5 * focusHorizontalFactor;
					}, upgradeEffectValues.unfocusedStrength, {mass: 0.125, velocity: [0, 0]}); // Mass and velocity is for Lexan's last spell, in addition to bullets' natural motion.
				}
			}
		}
		if ((frame % 2) === 0) {
			for (let i of [-1, 1]) {
				createPlayerBullet(addVectors(instantaneousPlayerPosition, [i * 8, -9]), function(t) {
					this.position[1] -= 2 * t ** 0.5;
					this.angle = Math.atan2(this.velocity[1] - 2 * t ** 0.5, this.velocity[0]);
				}, upgradeEffectValues.focusedStrength, {mass: 0.125, angle: -Math.PI / 2, velocity: [0, 0]}); // Mass, angle and velocity are for Lexan's last spell.
			}
		}
	}
/*	if ([12].includes(frame % 211)) {
		let direction = (frame % 2 === 0) ? 1 : -1
		let initialX = Math.random() * 350 - 175;
		createEnemy(function(t, id) {
			return [initialX + Math.max(t - 300, 0) ** 2 * direction / 40, t / 2 - 315];
		}, function(t, id) {
			if (t % 337 === 177) {
				let currentPosition = computePosition(enemies[id]);
				for (let v = 1.8; v <= 3.75; v += 0.00225) for (let a = 0; a < 1; a ++) createBullet(function(t) {
					let distance = t * v;
					let angle = 1e5 * Math.sin((a * 73) * (id + 137) * (v + 23) + a * 101 + id * 149 + v * 222);
					return [currentPosition[0] + distance * Math.cos(angle), currentPosition[1] + distance * Math.sin(angle)]
				}, radialCollisionCheck(9), 280, 375);
			}
		}, radialCollisionCheck(10), 200, 250, 400)
	}
	if (frame % 9 === 2) {
		for (let i = 0; i < 3; i++) {
			for (let j = 0; j < 1; j++) {
				let vm = 2.5 + 0.125 * j + Math.random() * 0;
				let va = frame * 0.5 + i * 0.667 * Math.PI + 0.0001 * frame ** 2;
				let pm = 12 + 3 * j + Math.random() * 0;
				let px = pm * Math.cos(va);
				let py = pm * Math.sin(va) - 100;
				let vx = vm * Math.cos(va);
				let vy = vm * Math.sin(va);
				if (frame % 1 === 0) createBullet([px, py], function(t) {
					this.position[0] += vx;
					this.position[1] += vy;
				}, circularRenderFunction(4, "#ccccff", "#ffffff"), radialCollisionCheck(4), 280, 375);
			}
		}
	}
	if (frame % 700 === 0) {
		let v = 5;
		let r = Math.random() * 1.047;
		for (let i = 0; i < 4; i++) {
			let vx = v * Math.cos(Math.floor(frame / 700) ** 2.3 + i * 1.571 + r);
			let vy = v * Math.sin(Math.floor(frame / 700) ** 2.3 + i * 1.571 + r);
			createBullet([0, 0], function(t) {
				this.position[0] += vx;
				this.position[1] += vy;
				if ((Math.abs(this.position[0]) > 250) && (this.reflectsLeft > 0)) {
					this.position[0] = Math.sign(this.position[0]) * (500 - Math.abs(this.position[0]));
					vx *= -1;
					this.reflectsLeft--;
				}
				if ((Math.abs(this.position[1]) > 300) && (this.reflectsLeft > 0)) {
					this.position[1] = Math.sign(this.position[1]) * (600 - Math.abs(this.position[1]));
					vy *= -1;
					this.reflectsLeft--;
				}
				if (frame % 2 === 0) {
					let lifespan = 125 - (frame % 700) * 0;
					createBullet(structuredClone(this.position), function(t) {
						if (t > lifespan) {
							this.position[0] = 999;
						}
					}, circularRenderFunction(4, hsltohex(Math.floor(frame / 700) * 30, 100, 50)), radialCollisionCheck(4), 280, 375)
				}
			}, circularRenderFunction(6, hsltohex(Math.floor(frame / 700) * 30, 100, 50)), radialCollisionCheck(6), 280, 375, {reflectsLeft: 5});
		}
		processEnemyDrops([0, -200], {lifepiece: 1, power: 80, point: 60});
	}
	if (frame % 10 === 16) {
		let a1 = Math.random() * 2 * Math.PI;
		let rotationTime = 2000 + Math.random() * 2000;
		createBullet([400 * Math.cos(a1), 400 * Math.sin(a1)], function(t) {
			if (t < 3000) {
				let maxDeflection = 0.1 * Math.max(1 - t / rotationTime, 0);
				let targetAngle = angleToPlayer(this.position[0], this.position[1]);
				let difference = modulo(this.angle - targetAngle, Math.PI * 2);
				if (difference > Math.PI) {
					this.angle += Math.min(maxDeflection, Math.PI * 2 - difference);
				} else {
					this.angle -= Math.min(maxDeflection, difference);
				}
			}
			this.position[0] += 1 * Math.cos(this.angle);
			this.position[1] += 1 * Math.sin(this.angle);
		}, circularRenderFunction(4, hsltohex(frame / 10, 100, 50)), radialCollisionCheck(4), 420, 420, {angle: angleToPlayer(400 * Math.cos(a1), 400 * Math.sin(a1))});
	} */
	fps = fps * 0.98;
}
// We use this to recalculate `startTime` on unpause to prevent all the missed frames from immediately occurring on unpause.
var gameTimeElapsed = undefined;
export function togglePause() {
	if (gameIsPaused) {
		openMenuWindow("game");
		unpauseBGM();
		gameIsPaused = false;
	} else {
		openMenuWindow("pauseMenu");
		document.getElementById("window_game").style.display = "block"; // Makes the game visible in the background.
		pauseBGM();
		gameIsPaused = true;
		playAudio("se_pause");
	}
}
function gameClock() {
	requiredFrames += (Date.now() - lastTick) * ((gameIsPaused || gameOverScreenActive) ? 0 : finalSpellSlowdown ? 0.01 : 0.05);
	lastTick = Date.now();
	let changesMade = false;
	while (frame < Math.floor(requiredFrames)) {
		processFrame();
		changesMade = true;
	}
	if (changesMade) {
		fps++;
		drawCanvas();
	}
}
// Debug only. Use only before boss.
export function skipFrames(amount) {
	frame += amount;
	requiredFrames += amount;
	playBGM("bgm_stage", 368, 389.8, frame / 50 - 2);
}
// Skips boss phases.
export function skipPhases(amount) {
	startBossPhase("S" + amount);
}