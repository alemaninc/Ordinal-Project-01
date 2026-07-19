import { Bosses, currentDialogueId, dialogueList, dialoguePortraitVisibilities } from "./boss_data.js";
import { bullets, enemies, fps, canvasContext, graze, lives, playerBullets, playerHitboxRadius, playerPosition, pointValue, power, score, items, frame, bombs, lastBomb, playerBombAngles, playerBombRange, maxBombDeflection, playerBombGuaranteedRange, angleToPlayer, currentBoss, isInCutscene, canGetSpellCard, spellCardBonus, scoreForNextBonus, collectedScoreBonuses } from "./game.js";
import { activeKeys } from "./menu.js";
import { virtueProgressMultiplier } from "./persistent_data.js";
import { addVectors, clampNumber, formatInteger, layeredLinearGradient, multiplyVectors, numberIsBounded, polarToCartesian, predictableRandom, rotateVector } from "./utility.js";

const images = {};
// Lists all the image files which must be loaded by their file name (excluding the file ending if it is "png").
export const requiredImages = ["enemy_amberorb", "enemy_ambershard1", "enemy_ambershard2", "enemy_eye", "enemy_magmaelemental", "enemy_memoryshard1", "enemy_memoryshard2", "enemy_ufo_i1", "enemy_ufo_i2", "enemy_ufo_l1", "enemy_ufo_l2", "enemy_ufo_o1", "enemy_ufo_o2", "enemy_ufo_t1", "enemy_ufo_t2", "enemy_ufo_z1", "enemy_ufo_z2", "enemy_witch", "item_bombpiece", "item_extend", "item_fullpower", "item_lifepiece", "item_point", "item_power", "item_spellcard", "lexan", "lexan2", "luigin_front", "luigin", "stagebg1", "stagebg2.jpg", "stagebg3.jpg", "zenryaku"];
// We store this to be able to calculate how many files have been loaded for the loading screen.
export var imageFilesLoaded = 0;
// Retrieves an image and increments `imageFilesLoaded` once it is available.
async function loadImage(id) {
  images[id] = new Image();
  images[id].src = "assets/img/" + id + (id.includes(".") ? "" : ".png");
  images[id].onload = function() {console.log(id); imageFilesLoaded++;}
}
// Preloads all required images.
export async function loadRequiredImages() {
	for (let id of requiredImages) {
		loadImage(id);
	}
}

// Returns the horizontal and vertical offset corresponding to [250, 300] for any angle.
function canvasOffset(angle) {
	return [250 * Math.cos(angle) + 300 * Math.sin(angle), 300 * Math.cos(angle) - 250 * Math.sin(angle)];
}
// Draws an image on the canvas, at `zoom`x scale, centred at (`centreX`, `centreY`) and rotated `angle` radians clockwise, and possibly `reflect`ed.
export function drawImage(id, centreX, centreY, angle = 0, zoom = 1, reflect = false, opacity = 1) {
	canvasContext.save();
	canvasContext.translate(centreX, centreY);
	if (angle !== 0) {
		canvasContext.rotate(angle);
	}
	if (reflect) {
		canvasContext.scale(-1, 1);
	}
	// Correct for origin being centre instead of top-left, and the dimensions of the image.
	let offset = canvasOffset(angle);
	canvasContext.globalAlpha = opacity;
	if (images[id] === undefined) {
		console.error(id);
	}
	canvasContext.drawImage(images[id], offset[0] * (reflect ? -1 : 1) - images[id].width * zoom / 2, offset[1] - images[id].height * zoom / 2, images[id].width * zoom, images[id].height * zoom);
	canvasContext.globalAlpha = 1;
	canvasContext.restore();
}
// Draws a circle with a smooth outline, which may or may not include internal filling. Mainly used for bullets.
function drawCircle(position, radius, outerColor, innerColor = "#00000000", numberOfStrokes = (radius < 5) ? 1 : (1 + Math.ceil(radius / 10))) {
	canvasContext.beginPath();
	canvasContext.arc(position[0] + 250, position[1] + 300, radius, 0, Math.PI * 2, true);
	canvasContext.fillStyle = innerColor;
	canvasContext.fill();
	for (let strokeNum = 0; strokeNum < numberOfStrokes; strokeNum++) {
		let maxOpacity = (outerColor.length === 7) ? 255 : parseInt(outerColor.substring(7, 9), 16);
		canvasContext.strokeStyle = outerColor.substring(0, 7) + Math.ceil(maxOpacity * 2 / (numberOfStrokes + 1)).toString(16).padStart(2, "0");
		canvasContext.lineWidth = Math.max(radius / 5 + 1, radius / 2.5) * (numberOfStrokes - strokeNum) / numberOfStrokes;
		canvasContext.stroke();
	}
}
// Converts the 4-argument `drawCircle` into a function that only takes one argument (`position`) as is required for the render function loop.
export function circularRenderFunction(radius, outerColor, innerColor = "#00000000", numberOfStrokes = (radius < 5) ? 1 : (1 + Math.ceil(radius / 10))) {
	return function(position) {
		drawCircle(position, radius, outerColor, innerColor, numberOfStrokes);
	}
}
// Draws a rectangle on the canvas, at `zoom`x scale, centred at (`centreX`, `centreY`) and rotated `angle` radians clockwise.
export function drawRectangle(position, height, width, outerColor, innerColor = "#00000000", angle = 0) {
	canvasContext.save();
	canvasContext.translate(position[0], position[1]);
	if (angle !== 0) {
		canvasContext.rotate(angle);
	}
	canvasContext.fillStyle = innerColor;
	canvasContext.strokeStyle = outerColor;
	canvasContext.lineWidth = Math.min(height, width) / 6;
	// Correct for origin being centre instead of top-left, and the dimensions of the image.
	let offset = canvasOffset(angle);
	canvasContext.fillRect(offset[0] - width / 2, offset[1] - height / 2, width, height);
	canvasContext.strokeRect(offset[0] - width / 2, offset[1] - height / 2, width, height);
	canvasContext.restore();
}
// Converts the 6-argument `drawRectangle` into a function that only takes one argument of `position`.
export function rectangularRenderFunction(height, width, outerColor, innerColor = "#00000000", angle = 0) {
	return function(position) {
		drawRectangle(position, height, width, innerColor, outerColor, angle);
	}
}
// Renders an arrow bullet.
export function arrowBulletRenderFunction(color, radius, angle) {
	let lines = [
		[[-0.25, 1.25], [1.25, 0], [-0.25, -1.25]],
		[[-0.75, 0.75], [0.25, 0], [-0.75, -0.75]]
	];
	for (let lineNum = 0; lineNum < lines.length; lineNum++) {
		for (let vectorNum = 0; vectorNum < lines[lineNum].length; vectorNum++) {
			lines[lineNum][vectorNum] = multiplyVectors(lines[lineNum][vectorNum], radius);
		}
	}
	return function(position) {
		canvasContext.strokeStyle = color;
		canvasContext.lineWidth = Math.max(radius / 20 + 1, radius / 10);
		for (let lineNum = 0; lineNum < lines.length; lineNum++) {
			canvasContext.beginPath();
			let line = lines[lineNum];
			canvasContext.moveTo(...addVectors(position, rotateVector(line[0], angle ?? this.angle), [250, 300]));
			for (let pointNum = 1; pointNum < line.length; pointNum++) {
				canvasContext.lineTo(...addVectors(position, rotateVector(line[pointNum], angle ?? this.angle), [250, 300]));
				canvasContext.stroke();
			}
		}
	}
}
// Renders a yin-yang orb.
export function yinYangOrbRenderFunction(innerColor, outerColor) {
	let phase = Math.random();
	return function(position) {
		drawCircle(position, 9, innerColor, innerColor);
		for (let i = 0; i < 4; i++) {
			let angle = Math.PI * 0.5 * (i + (phase + frame / 20) % 1);
			drawCircle(addVectors(position, polarToCartesian(24, angle)), 4, outerColor, outerColor);
		}
	}
}
// Renders an amber shard to show rotation in the vertical axis.
export const amberShardRenderFunction = function(position) {
	let phase = Math.floor((frame - this.creationTime) / 7) % 4;
	let imageNum = [1, 2, 2, 1][phase];
	let isReflected = phase < 2;
	drawImage("enemy_ambershard" + imageNum, position[0], position[1], 0, 1, isReflected);
}
// Renders an amber orb to show rotation in the screen's axis.
export const amberOrbRenderFunction = function(position) {
	drawImage("enemy_amberorb", position[0], position[1], (frame - this.creationTime) / 25, 1);
}
// Renders a UFO to show rotation in the vertical axis, and the correct lights for its shot type.
export const UFORenderFunction = function(position) {
	let phase = Math.floor((frame - this.creationTime) / 8) % 3;
	let imageNum = (phase === 1) ? 1 : 2;
	let isReflected = phase === 2;
	drawImage("enemy_ufo_" + this.type.toLowerCase() + imageNum, position[0], position[1], 0, 1, isReflected);
}
// Renders a spirit. This is just a circle, as spirits spawn the flames of their animation as bullets.
export function spiritRenderFunction(outerColor, innerColor) {
	return function(position) {
		drawCircle(position, 8, outerColor, innerColor);
	}
}
// Renders a witch to face the right way.
export const witchRenderFunction = function(position) {
	drawImage("enemy_witch", position[0], position[1], 0, 1, this.direction === 1);
}
// Renders an eye to look at the player.
export function eyeRenderFunction(rotationAngle = 0) {
	return function(position) {
		let lifetime = frame - this.creationTime;
		let opacity = Math.min(lifetime / 40, 1);
		drawImage("enemy_eye", position[0], position[1], rotationAngle, undefined, undefined, opacity);
		// Draw the pupil in the centre initially, and move to face the player after this.
		let pupilDeflection = Math.max(0, Math.min(lifetime / 12, 5));
		let pupilPosition = addVectors(position, polarToCartesian(pupilDeflection, angleToPlayer(position)));
		let pupilColour = "#ff0000" + Math.round(opacity * 255).toString(16).padStart(2, "0");
		drawCircle(pupilPosition, 3, "#00000000", pupilColour);
	}
}
// Renders a magma elemental to rotate about the screen's axis.
export function magmaElementalRenderFunction(size) {
	return function(position) {
		drawImage("enemy_magmaelemental", position[0], position[1], (frame - this.creationTime) * 0.025, size);
	}
}
// Renders a memory shard to show rotation in the vertical axis, draw the safe zone and indicate the timer.
export function memoryShardRenderFunction(timer) {
	return function(position) {
		let phase = Math.floor((frame - this.creationTime) / 7) % 4;
		let imageNum = [1, 2, 2, 1][phase];
		let isReflected = phase < 2;
		// Shows the safe zone.
		drawCircle(position, 100, "#00000000", "#cc000019");
		// Shows the shard.
		drawImage("enemy_memoryshard" + imageNum, position[0], position[1], 0, 1, isReflected);
		// Shows the timer.
		canvasContext.beginPath();
		canvasContext.strokeStyle = "#cc0000";
		canvasContext.arc(position[0] + 250, position[1] + 300, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(this.creationTime + timer - frame, 0) / timer, false);
		canvasContext.stroke();
	}
}
// Renders a black hole. Identical to the normal render function except radius can vary so the black hole can grow when it needs to.
export function blackHoleRenderFunction() {
	drawCircle(this.position, this.radius, "#0000ff", "#000000e7");
}
// Retrieves the current background image, its size, its opacity and its centre point.
function currentBackground() {
	let url, size, opacity, position;
	if (frame < 5800) { // We do not handle boss spell card backgrounds here as those are drawn directly onto the canvas.
		let progress = Math.max(0, (frame - 800) / 4780) + Math.max(frame - 5580, 0) ** 2 / 10000;
		url = "url(assets/img/stagebg1.png)";
		size = 1.2 + progress * 1.8;
		opacity = clampNumber(0, Math.min(frame / 200, 0.8 - progress * 0.3), 0.5);
		position = "-" + Math.max(progress * 200, progress * 300 - 100) + "px -" + Math.max(progress * 450, progress * 525 - 75) + "px";
	} else if (Bosses.zenryaku.frameDefeated === 99999) {
		url = "url(assets/img/stagebg2.jpg)";
		size = 1.5;
		opacity = clampNumber(0, frame / 500 - 11.6, 0.5);
		// Vary from -520px at frame 5800 to -40px at frame 9000. After frame 9000 (Zenryaku's transition), gradually stop at 0px.
		position = "0px -" + Math.max(1390 - frame * 0.15, 0) + "px";
	} else if (frame < 18100) { // The third and fourth stage background use the same image, but the third background is heavily zoomed in whereas the fourth isn't.
		url = "url(assets/img/stagebg3.jpg)";
		size = 4;
		opacity = Math.min((frame - Bosses.zenryaku.frameDefeated) / 400, 0.33, 45.25 - frame / 400);
		position = "-30px -" + (720 - frame / 25) + "px";
	} else {
		url = "url(assets/img/stagebg3.jpg)";
		size = 2;
		opacity = Math.min(frame / 1000 - 18.1, 0.125);
		position = "-150px -" + (20 + Math.sin(frame / 100) * 20) + "px";
	}
	return {url, size, opacity, position};
}
// Regenerates the canvas, and updates values in the sidebar.
export function drawCanvas() {
	/*
	Order of drawing:
	1. Background
	2. Player
	3. Enemies
	4. Player's bomb ("Alpha Scattering")
	5. Items
	6. Player bullets
	7. Enemy bullets

	Known relations:
	Player < Enemies < Bomb < Items < Bullets
	*/
	// First, clear the canvas.
	canvasContext.clearRect(0, 0, 500, 600);
	// 1. Update the background.
	if ((currentBoss.bossId === "zenryaku") && currentBoss.isInSpellCard && (currentBoss.currentAttackTime > 25)) { // Lexan's background has 3 elements so we draw it directly to the canvas.
		document.getElementById("canvasBackground").style.backgroundImage = "";
		// Eye `id` spawns at frame `id * 100` and despawns at frame `id * 100 + 2400`.
		// Thus, at frame `f`, visible eyes are in the range `f / 100 - 24` to `f / 100`.
		let firstEyeId = Math.ceil(frame / 100) - 24;
		let lastEyeId = Math.ceil(frame / 100);
		for (let eyeId = firstEyeId; eyeId < lastEyeId; eyeId++) {
			let size = 0.75 + 0.5 * predictableRandom(eyeId * 2 + currentBoss.phase);
			let displacement = Math.sqrt(2500 + 157500 * predictableRandom(eyeId * 3 + currentBoss.phase));
			let angle = Math.PI * 2 * predictableRandom(eyeId * 5 * currentBoss.phase) + frame / 125;
			let maxOpacityFrame = eyeId * 100 + 1200;
			let opacity = Math.max(0.5 - (frame - maxOpacityFrame) * (frame - maxOpacityFrame) / 2880000, 0);
			drawImage("enemy_eye", displacement * Math.sin(angle), displacement * -Math.cos(angle), angle, size, false, opacity);
		}
	} else if ((currentBoss.bossId === "lexan") && currentBoss.isInSpellCard && (currentBoss.currentAttackTime > 25)) { // Lexan's background has 3 elements so we draw it directly to the canvas.
		document.getElementById("canvasBackground").style.backgroundImage = "";
		canvasContext.lineWidth = 2;
		for (let colourNum = 0; colourNum < 3; colourNum++) {
			let colour = ["#00ff0055", "#ff00ff55", "#ff000055"][colourNum];
			canvasContext.strokeStyle = colour;
			let phase = frame / 3000 + Math.PI * 2 * colourNum / 3 + currentBoss.phase;
			let startingX = (3000 * Math.cos(phase)) % 75;
			let startingY = (3000 * Math.sin(phase)) % 75;
			for (let x = startingX; x < 500; x += 75) {
				canvasContext.beginPath();
				canvasContext.moveTo(x, -10);
				canvasContext.lineTo(x, 610);
				canvasContext.stroke();
			}
			for (let y = startingY; y < 600; y += 75) {
				canvasContext.beginPath();
				canvasContext.moveTo(-10, y);
				canvasContext.lineTo(510, y);
				canvasContext.stroke();
			}
		}
	} else {
		let backgroundData = currentBackground();
		document.getElementById("canvasBackground").style.backgroundImage = backgroundData.url;
		document.getElementById("canvasBackground").style.backgroundSize = (backgroundData.size * 100) + "%";
		document.getElementById("canvasBackground").style.filter = "opacity(" + (backgroundData.opacity * 100) + "%)";
		document.getElementById("canvasBackground").style.backgroundPosition = backgroundData.position;
		document.getElementById("canvasBackground").style.transform = ((currentBoss.bossId === "zenryaku") && currentBoss.isInSpellCard && (currentBoss.currentAttackTime > 25)) ? ("rotate(" + ((frame / 2) % 360) + "deg)") : "";
	}
	// 2. Draw the player
	drawImage("luigin_front", playerPosition[0], playerPosition[1] + 10, (activeKeys.ArrowRight ? 0.15 : 0) - (activeKeys.ArrowLeft ? 0.15 : 0));
	console.log(playerPosition);
	if (activeKeys.Shift) { // show hitbox if focused
		let playerHitboxRenderFunction = circularRenderFunction(playerHitboxRadius, "#990000");
		playerHitboxRenderFunction(playerPosition);
	}
	// 3. Draw enemies.
	let enemyIds = Object.keys(enemies);
	for (let id of enemyIds) {
		enemies[id].renderFunction(enemies[id].position);
	}
	// 4. Draw the player's bomb. Each ray is 45 degrees wide (22.5 degrees from centre in each direction).
	if ((frame - lastBomb) < 300) {
		let bombRange = playerBombRange();
		canvasContext.fillStyle = "#ffff00";
		for (let angle of playerBombAngles()) {
			canvasContext.beginPath();
			canvasContext.moveTo(playerPosition[0] + 250, playerPosition[1] + 300);
			canvasContext.arc(playerPosition[0] + 250, playerPosition[1] + 300, bombRange, angle - maxBombDeflection, angle + maxBombDeflection); // Draw the outer arc
			canvasContext.closePath();
			canvasContext.fill();
		}
		let guaranteedBombRange = playerBombGuaranteedRange();
		drawCircle(playerPosition, guaranteedBombRange, "#ffff00", "#ffff00");
	}
	// 5. Draw items on the screen.
	let itemIds = Object.keys(items);
	for (let id of itemIds) {
		try {
			drawImage("item_" + items[id].type, items[id].position[0], items[id].position[1]);
		} catch {}
	}
	// 6. Draw player and enemy bullets on the screen.
	let playerBulletIds = Object.keys(playerBullets);
	for (let id of playerBulletIds) {
		let position = playerBullets[id].position;
		if (playerBullets[id].angle !== undefined) {
			arrowBulletRenderFunction("#808080", 4, playerBullets[id].angle)(position);
		} else {
			drawCircle(position, 4, "#008000", "rgba(0, 0, 0, 0)");
		}
	}
	let bulletIds = Object.keys(bullets);
	for (let id of bulletIds) {
		let position = bullets[id].position;
		bullets[id].renderFunction(position);
	}
	// Update the boss's visuals.
	if ((currentBoss.bossId === undefined) || isInCutscene) {
		document.getElementById("div_bossPhasesLeft").style.opacity = 0;
		document.getElementById("div_bossLifeBar").style.opacity = 0;
		document.getElementById("div_bossLifeBarName").style.opacity = 0;
		document.getElementById("div_bossLifeBarBonusLabel").style.opacity = 0;
		document.getElementById("div_bossLifeBarBonusValue").innerText = "";
		document.getElementById("span_bossTimerIntegerPart").innerText = "";
		document.getElementById("span_bossTimerFractionalPart").innerText = "";
		document.getElementById("div_bossPositionIndicator").style.opacity = 0;
		document.getElementById("div_bossPositionIndicator2").style.opacity = 0;
	} else {
		document.getElementById("div_bossHideableData").style.opacity = clampNumber(0.1, 3.5 + playerPosition[1] / 50, 1); // Hide the boss life bar and associated informat
		let attackData = Bosses[currentBoss.bossId].attacks;
		let currentAttack = attackData[(currentBoss.isInSpellCard ? "S" : "N") + currentBoss.phase];
		let color = Bosses[currentBoss.bossId].color;
		document.getElementById("div_bossPhasesLeft").style.opacity = 1;
		document.getElementById("div_bossPhasesLeft").style.color = color;
		document.getElementById("div_bossPhasesLeft").innerText = Bosses[currentBoss.bossId].phases - currentBoss.phase;
		document.getElementById("div_bossLifeBar").style.opacity = 1;
		// There are four cases we consider for the current phase's health bar:
		// 1. there is only a non-spell or only a spell card, and this is not Lexan's final spell;
		// 2. there is a non-spell and spell card and we are currently in the spell card;
		// 3. there is a non-spell and spell card and we are currently in the non-spell.
		// 4. this is Lexan's final spell.
		let maxBarPercent = Math.min(currentBoss.currentAttackTime / 30, 1);
		if (currentBoss.phase === 10) { // Case 4
			let phase = currentAttack.currentPhase;
			let gradientColors = [["#0000ff", 0]];
			for (let phaseNum = 3; phaseNum >= phase; phaseNum--) {
				gradientColors.push(["#" + (340 - phaseNum * 85).toString(16).repeat(2) + "ff", Math.min(currentAttack.phaseTransitions.HP[phaseNum - 1] / currentAttack.HP, maxBarPercent)]);
			}
			gradientColors.push(["rgba(0, 0, 0, 0)", Math.min(enemies[currentBoss.enemyId].HP / currentAttack.HP, maxBarPercent)]);
			document.getElementById("div_bossLifeBar").style.background = layeredLinearGradient(gradientColors);
		} else if ((attackData["N" + currentBoss.phase] === undefined) || (attackData["S" + currentBoss.phase] === undefined)) { // Case 1
			let bossLifePercent = Math.min(enemies[currentBoss.enemyId].HP / currentAttack.HP, maxBarPercent);
			document.getElementById("div_bossLifeBar").style.background = layeredLinearGradient([[currentBoss.isInSpellCard ? color : "#ffffff", 0], ["rgba(0, 0, 0, 0)", bossLifePercent]])
		} else if (currentBoss.isInSpellCard) { // Case 2
			let bossLifePercent = enemies[currentBoss.enemyId].HP / (attackData["N" + currentBoss.phase].HP + attackData["S" + currentBoss.phase].HP); // Do not apply maximum percent here as this is not the first attack in the bar.
			document.getElementById("div_bossLifeBar").style.background = layeredLinearGradient([[color, 0], ["rgba(0, 0, 0, 0)", bossLifePercent]]);
		} else { // Case 3
			let bossLifePercent = Math.min((enemies[currentBoss.enemyId].HP + attackData["S" + currentBoss.phase].HP) / (attackData["N" + currentBoss.phase].HP + attackData["S" + currentBoss.phase].HP), maxBarPercent);
			let percentAtTransition = Math.min(attackData["S" + currentBoss.phase].HP / (attackData["N" + currentBoss.phase].HP + attackData["S" + currentBoss.phase].HP), maxBarPercent);
			document.getElementById("div_bossLifeBar").style.background = layeredLinearGradient([[color, 0], ["#ffffff", percentAtTransition], ["rgba(0, 0, 0, 0)", bossLifePercent]])
		}
		document.getElementById("div_bossLifeBarName").style.opacity = 1;
		document.getElementById("div_bossLifeBarName").style.color = color;
		document.getElementById("div_bossLifeBarName").innerText = Bosses[currentBoss.bossId].name;
		if ((currentBoss.isInSpellCard) && (currentBoss.currentAttackTime >= 94)) { // At 94 frames the spell card name reaches its highest position.
			document.getElementById("div_bossLifeBarBonusLabel").style.opacity = 1;
			document.getElementById("div_bossLifeBarBonusValue").innerText = canGetSpellCard() ? formatInteger(spellCardBonus()) : "Failed";
		} else {
			document.getElementById("div_bossLifeBarBonusLabel").style.opacity = 0;
			document.getElementById("div_bossLifeBarBonusValue").innerText = "";
		}
		document.getElementById("div_bossSpellTimer").style.color = ((currentAttack.maxFrames - currentBoss.currentAttackTime <= 500) ? "#ff3333" : "#ffffff");
		document.getElementById("span_bossTimerIntegerPart").innerText = String(Math.floor((currentAttack.maxFrames - currentBoss.currentAttackTime) / 50)).padStart(2, "0");
		document.getElementById("span_bossTimerFractionalPart").innerText = "." + String(((currentAttack.maxFrames - currentBoss.currentAttackTime) % 50) * 2).padStart(2, "0");
		document.getElementById("div_bossSpellCard").style.top = Math.max(60, Math.min(1000 - currentBoss.currentAttackTime * 10, 400)) + "px";
		document.getElementById("div_bossPositionIndicator").style.opacity = currentAttack.isSurvival ? 0 : 1; // Boss leaves the screen during survivals and this makes the position indicator go off the screen so just hide it.
		document.getElementById("div_bossPositionIndicator").style.color = Bosses[currentBoss.bossId].color;
		document.getElementById("div_bossPositionIndicator").style.left = (enemies[currentBoss.enemyId].position[0] + 245) + "px";
		if (currentBoss.phase === 7) { // Rin's attacks
			document.getElementById("div_bossPositionIndicator2").style.opacity = currentBoss.isInSpellCard ? 1 : clampNumber(0, currentBoss.currentAttackTime / 25 - 1, 1);
			document.getElementById("div_bossPositionIndicator2").style.color = "#cc8000";
			document.getElementById("div_bossPositionIndicator2").style.left = (enemies[Bosses.lexan.attacks[currentBoss.isInSpellCard ? "S7" : "N7"].rinId].position[0] + 245) + "px";
		} else {
			document.getElementById("div_bossPositionIndicator2").style.opacity = 0;
		}
	}
	// Also draws sprites during dialogues.
	if (currentDialogueId !== undefined) {
		dialoguePortraitVisibilities.player = clampNumber(dialoguePortraitVisibilities.player - 0.05, dialoguePortraitVisibilities.playerTarget, dialoguePortraitVisibilities.player + 0.05);
		dialoguePortraitVisibilities.boss = clampNumber(dialoguePortraitVisibilities.boss - 0.05, dialoguePortraitVisibilities.bossTarget, dialoguePortraitVisibilities.boss + 0.05);
		if (dialogueList[currentDialogueId].speaker === "Luigin") {
			if (currentBoss.bossId !== undefined) {
				drawImage(currentBoss.bossId, 250 - dialoguePortraitVisibilities.boss * 225, dialoguePortraitVisibilities.boss * 30 - 90, 0, 0.6, false, dialoguePortraitVisibilities.boss);
			}
			drawImage("luigin", dialoguePortraitVisibilities.player * 225 - 250, dialoguePortraitVisibilities.player * 30 - 90, 0, 0.6, true, dialoguePortraitVisibilities.player);
		} else {
			drawImage("luigin", dialoguePortraitVisibilities.player * 225 - 250, dialoguePortraitVisibilities.player * 30 - 90, 0, 0.6, true, dialoguePortraitVisibilities.player);
			if (currentBoss.bossId !== undefined) {
				drawImage(currentBoss.bossId, 250 - dialoguePortraitVisibilities.boss * 225, dialoguePortraitVisibilities.boss * 30 - 90, 0, 0.6, false, dialoguePortraitVisibilities.boss);
			}
		}
	}
	// Also draws the boss sprite for a spell card background.
	if (currentBoss.isInSpellCard && numberIsBounded(25, currentBoss.currentAttackTime, 75)) {
		let progress = (currentBoss.currentAttackTime < 42) ? (currentBoss.currentAttackTime * 0.06 - 2.5) : (currentBoss.currentAttackTime < 59) ? 0 : (currentBoss.currentAttackTime * 0.06 - 3.5);
		drawImage(currentBoss.bossId, progress * -400, progress * 100, 0, 0.9);
	}
	// Finally, update the sidebar.
	document.getElementById("sidebar_score").innerText = formatInteger(Math.min(score, 999999999));
	document.getElementById("sidebar_bonusScore").innerText = formatInteger(Math.min(scoreForNextBonus(), 999999999));
	document.getElementById("sidebar_bonusType").innerText = (collectedScoreBonuses % 15 === 14) ? "(Extend)" : (collectedScoreBonuses % 5 === 4) ? "(Spell Card)" : (collectedScoreBonuses % 3 === 2) ? "(Life Piece)" : "(Bomb Piece)";
	document.getElementById("sidebar_bonusType").style.color = (collectedScoreBonuses % 15 === 14) ? "#cc66cc" : (collectedScoreBonuses % 5 === 4) ? "#66cc66" : (collectedScoreBonuses % 3 === 2) ? "#e6b3e6" : "#b3e6b3";
	document.getElementById("sidebar_lives").innerHTML = "<span style=\"color: #cc66cc;\">" + "♥".repeat(Math.floor(lives / 3)) + "</span>" + ((lives % 3 === 0) ? "" : "<span style=\"background:conic-gradient(#cc66cc 0%, #cc66cc " + ((lives % 3) * 100 / 3) + "%, #333333 " + ((lives % 3) * 100 / 3) + "%, #333333); background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent;\">♥</span>") + "<span style=\"color: #333333;\">" + "♥".repeat(Math.floor(8 - lives / 3)) + "</span>";
	document.getElementById("sidebar_bombs").innerHTML = "<span style=\"color: #66cc66;\">" + "★".repeat(Math.floor(bombs / 3)) + "</span>" + ((bombs % 3 === 0) ? "" : "<span style=\"background:conic-gradient(#66cc66 0%, #66cc66 " + ((bombs % 3) * 100 / 3) + "%, #333333 " + ((bombs % 3) * 100 / 3) + "%, #333333); background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent;\">★</span>") + "<span style=\"color: #333333;\">" + "★".repeat(Math.floor(8 - bombs / 3)) + "</span>";
	document.getElementById("sidebar_power").innerText = (power / 100).toFixed(2) + " / 4.00";
	document.getElementById("sidebar_value").innerText = formatInteger(pointValue);
	document.getElementById("sidebar_graze").innerText = formatInteger(graze);
	document.getElementById("sidebar_fps").innerText = Math.round(fps) + " fps";
}