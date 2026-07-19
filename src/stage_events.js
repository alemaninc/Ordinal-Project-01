import { playAudio, playBGM, playSingleAudio } from "./audio.js";
import { Bosses, showBossTitleCard, startDialogue } from "./boss_data.js";
import { hsltohex } from "./color_converter.js";
import { angleToObject, angleToPlayer, bearingToAngle, beginCutscene, bullets, clearScreen, createBoss, createBullet, createEnemy, currentBoss, difficulty, enemies, frame, lastBomb, playerPosition, processBezierMotion, processEnemyDrops, processNaturalSpeed, radialCollisionCheck, rectangularCollisionCheck, skipFrames, skipPhases, togglePause } from "./game.js";
import { addVectors, clampNumber, clampVector, multiplyVectors, numberIsBounded, plusMinus1, polarToCartesian, randomCartesianVector, randomPolarVector, randomReal, ranint, rotateVector, shuffleArray, squaredDistance } from "./utility.js";
import { amberOrbRenderFunction, amberShardRenderFunction, arrowBulletRenderFunction, circularRenderFunction, eyeRenderFunction, magmaElementalRenderFunction, rectangularRenderFunction, spiritRenderFunction, UFORenderFunction, witchRenderFunction, yinYangOrbRenderFunction } from "./visuals.js";

/* This section contains initialisation functions for the different enemies in the stage. */

// The general function for spawning yin-yang orbs. In this instalment, they shoot large streaming bullets and small random bullets.
// We count the number spawned to determine if the next should drop a power or point item.
var yinYangOrbSpawnCounter = 0;
function createYinYangOrb(targetPosition, streamingBulletMinTime, streamingBulletMaxTime, streamingBulletInterval, streamingBulletSpeed, streamingBulletDeflectionChance, streamingBulletMaxDeflection, randomBulletInterval, randomBulletMinSpeed, randomBulletMaxSpeed, speedUpFrame = 999999) {
	targetPosition = addVectors(targetPosition, randomCartesianVector(10, 5));
	let timeToReachTargetPosition = (targetPosition[1] + 320) / 2.5 + 25;
	let directionOfExit = -Math.sign(targetPosition[0]);
	let streamingBulletTime = ranint(streamingBulletMinTime, streamingBulletMaxTime);
	createEnemy([targetPosition[0], -320], function(t) {
		[this.speed, this.acceleration] = processNaturalSpeed(this.speed, this.acceleration, ((t < 120) ? 0.2 : 1.5) + Math.max((frame - speedUpFrame) / 60, 0)); // `speedUpFrame` exists to clear yin-yang orbs quickly before the next wave of enemies.
		[this.position, this.bezierT] = processBezierMotion([[targetPosition[0], -320], targetPosition, targetPosition, targetPosition, [Math.sign(targetPosition[0]) * -350, targetPosition[1] + 50]], this.bezierT, this.speed);
		// Creates streaming bullets.
		if ((t - streamingBulletTime) % streamingBulletInterval === 1) {
			playSingleAudio("se_tan00", "yinyangstream" + frame, 0.3);
			let angle = angleToPlayer(this.position);
			if (Math.random() < streamingBulletDeflectionChance) {
				angle += streamingBulletMaxDeflection * (Math.random() * 2 - 1);
			}
			let vx = streamingBulletSpeed * Math.cos(angle);
			let vy = streamingBulletSpeed * Math.sin(angle);
			createBullet(this.position, function(t) {
				this.position[0] += vx;
				this.position[1] += vy;
			}, circularRenderFunction(6, "#ccccff", "#ffffff"), radialCollisionCheck(6));
		}		
		// Creates random bullets.
		if ((t > 25) && (t % randomBulletInterval === 0)) {
			playSingleAudio("se_tan00", "yinyangrandom" + frame, 0.05);
			let v = randomPolarVector(randomBulletMinSpeed, randomBulletMaxSpeed);
			createBullet(addVectors(this.position, randomCartesianVector(15)), function() {
				this.position = addVectors(this.position, v);
			}, circularRenderFunction(4, "#ccccff", "#ffffff"), radialCollisionCheck(4));
		}
	}, yinYangOrbRenderFunction("#ccccff", "#0000ff"), radialCollisionCheck(9), 10, 500, (yinYangOrbSpawnCounter % 4 > 1) ? {power: 1} : {point: 1}, undefined, 270, 500, {bezierT: 0, speed: 2, acceleration: 0});
	yinYangOrbSpawnCounter++;
}

// The yin yang orbs at the start of the stage.
// On Easy, a small fraction of these periodically shoot streaming bullets, with the rest completely passive.
// On Normal, they periodically shoot streaming bullets.
// On Hard, they shoot streaming bullets faster and also shoot random bullets.
// On Lunatic, all bullets are faster and shot at a faster rate, and streaming bullets may be deflected.
// We clear all of them out starting at frame 540 to make room for the title.
function createStartingYinYangOrb(targetPosition) {
	createYinYangOrb(targetPosition, [50, 25, 0, 0][difficulty], [200 + 10000 * ranint(0, 2), 125, 60, 30][difficulty], [300, 150, 60, 30][difficulty], [0, 4, 5, 6][difficulty], [0, 0, 0, 0.3][difficulty], 0.5, [9999, 9999, 9, 3][difficulty], [0, 0, 2, 4][difficulty], [0, 0, 3, 6][difficulty], 540);
}
// The amber shards that shoot rings of diamonds with a constant phase difference, and upon defeat or timeout shoot a stream of bullets at the player.
function createAmberShard(targetPosition, factor78 = Math.random()) {
	let initialTarget = structuredClone(targetPosition);
	targetPosition = addVectors(targetPosition, randomCartesianVector(5, 5));
	let diamondSpeed = [3, 4, 5.5, 7][difficulty];
	let diamondsPerWave = (difficulty === 3) ? Math.floor(14.5 + factor78 * 2) : Math.floor(7.5 + factor78); // 7 or 8 on E/N/H; 14-16 on L.
	let diamondInterval = [24, 16, 10, 18][difficulty];
	let angularFrequency = randomReal(0.25, 0.75) / diamondInterval;
	createEnemy([targetPosition[0], -330], function(t) {
		// Amber shard uses nudge motion. It moves towards a target position rapidly, and this target position is changed every few seconds (a "nudge").
		let angleToTarget = angleToObject(this.position, targetPosition);
		let speed = (squaredDistance(this.position, targetPosition) + 1) ** 0.25 * 0.3 - 0.3;
		this.position[0] += speed * Math.cos(angleToTarget);
		this.position[1] += speed * Math.sin(angleToTarget);
		if (t % 180 === 150) {
			targetPosition = addVectors(targetPosition, randomPolarVector(20, 30));
			targetPosition = clampVector(targetPosition, initialTarget[0] - 60, initialTarget[0] + 60, initialTarget[1] - 40, initialTarget[1] + 40);
		}
		if ((t > 50) && (t < 375) && (t % diamondInterval === Math.min(diamondInterval - 1, 19))) {
			playSingleAudio("se_tan00", "ambersharddiamonds" + frame, 0.3);
			let phase = angularFrequency * frame;
			for (let diamondNum = 0; diamondNum < diamondsPerWave; diamondNum++) {
				let angle = (diamondNum + phase) * Math.PI * 2 / diamondsPerWave;
				let v = polarToCartesian(diamondSpeed, angle);
				createBullet(this.position, function(t) {
					this.position = addVectors(this.position, v);
				}, rectangularRenderFunction(24, 24, "#fd5909", "#ff9933", angle + Math.PI / 4), radialCollisionCheck(17));
			}
		}
		if (t === 420) { // If not destroyed fast enough, self-destructs and drops only 3 items instead of 6. The death explosion will spawn more bullets.
			this.dropList = {power: 3, point: 3};
			this.score = 0;
			this.HP = 0;
			this.isAutokilled = true;
		}
	}, amberShardRenderFunction, radialCollisionCheck(20), 120, 3000, {power: 6, point: 6}, function(position) {
		let totalAngles = [3, 5, 9, 13][difficulty]; // Death bullets are not shot on Easy unless the shard was despawned
		let bulletsPerAngle = [10, 16, 24, 32][difficulty];
		if (this.isAutokilled) { // If this amber shard was despawned rather than defeated.
			totalAngles += 4;
			bulletsPerAngle += 4;
		}
		let averageSpeed = [3, 4.5, 6, 7.2][difficulty];
		for (let bulletNum = 0; bulletNum <= bulletsPerAngle; bulletNum++) { // We process bullets outside angles to prevent scheduling more than 1 event per frame.
			scheduleStageEvent((bulletNum === 0) ? 1 : (bulletNum * 3 + 14), function() {
				if (bulletNum % 3 === 0) {
					playSingleAudio("se_tan00", "ambershardfire" + frame, 0.3);
				}
				for (let angleNum = 0; angleNum < totalAngles; angleNum++) {
					let primaryAngle = angleToPlayer(position); // Tracks the player during the burst.
					let angle = primaryAngle + Math.PI * 2 * angleNum / totalAngles;
					let v = polarToCartesian(averageSpeed * randomReal(0.8, 1.2), angle);
					createBullet(addVectors(position, randomPolarVector(0, 30)), function() {
						this.position = addVectors(this.position, v);
					}, circularRenderFunction(7, "#fd5909", "#ff9933"), radialCollisionCheck(7));
				}
			})
		}
	}, undefined, undefined, {isAutokilled: false})
}
// The yin yang orbs spawned together with amber shards. They have a lower rate of fire, and shoot random bullets on all difficulties.
// We clear these out as soon as they spawn because otherwise they're way too slow ._.
function createYinYangOrbVariantB(targetPosition) {
	createYinYangOrb(targetPosition, [25, 25, 0, 0][difficulty], [325, 125, 60, 30][difficulty], [300, 200, 100, 60][difficulty], [2.5, 4, 5, 6][difficulty], [0, 0, 0, 0.3][difficulty], 0.5, [75, 30, 15, 6][difficulty], [1.5, 1.8, 2, 4][difficulty], [2.25, 2.7, 3, 6][difficulty], frame);
}
// The amber orbs that shoot rings of 7 or 8 small bullets at varying phase differences.
// The rings periodically alternate between 7 and 8 small bullets, and upon a changeover rings of 7 or 8 diamonds are shot.
// On Lunatic, waves have twice as many bullets and diamonds (same case as amber shards).
// Upon defeat, a larger amount of diamond waves is shot.
var amberOrbsDefeated = 0;
function createAmberOrb(targetPosition) {
	targetPosition = addVectors(targetPosition, randomCartesianVector(10, 10));
	let waveInterval = [12, 6, 3, 6][difficulty];
	let waveSize = (difficulty === 3) ? Math.floor(randomReal(14.5, 16.5)) : ranint(7, 8);
	let waveSpeed = [4, 4.8, 6, 7.5][difficulty];
	let averageAngularFrequency = [0.04, 0.05, 0.07, 0.1][difficulty];
	let period = [450, 360, 300, 240][difficulty];
	createEnemy([targetPosition[0], -350], function(t) {
		this.position[1] = this.position[1] * 0.95 + targetPosition[1] * 0.05;
		if ((t >= 60) && (t <= 475) && (t % waveInterval === 0)) {
			playAudio("se_tan00", 0.15);
			// Maximum frequency at 1/4 T, 5/4 T, 9/4 T, etc. Minimum frequency at 3/4 T, 7/4 T, 11/4 T, etc.
			// Wave size changes occur at average frequency - i.e. 1/2 T, T, 3/2 T, etc.
			let principalAngle = averageAngularFrequency * (frame - period * Math.cos(2 * Math.PI * frame / period) / (2 * Math.PI));
			for (let bulletNum = 0; bulletNum < waveSize; bulletNum++) {
				let angle = principalAngle + 2 * Math.PI * bulletNum / waveSize;
				let vx = waveSpeed * Math.cos(angle);
				let vy = waveSpeed * Math.sin(angle);
				createBullet(addVectors(this.position, polarToCartesian(30, angle)), function(t) {
					this.position[0] += vx;
					this.position[1] += vy;
				}, circularRenderFunction(4, "#fd5909", "#ff9933"), radialCollisionCheck(4));
			}
		}
		if ((t !== 0) && (t <= 475) && (t % (period / 2) === 0)) {
			createAmberOrbDiamondWaves(this.position, [1, 2, 4, 4][difficulty], waveSize);
			waveSize = (difficulty === 3) ? Math.floor(randomReal(14.5, 16.5)) : (15 - waveSize);
		}
		// If not destroyed fast enough, self-destructs and drops only 6 items instead of 13. The death explosion will spawn more bullets.
		if (t === 500) {
			this.dropList = {power: 3, point: 3};
			this.score = 0;
			this.HP = 0;
			this.isAutokilled = true;
		}
		// The first amber orb defeated drops a bomb piece, the second a life piece.
	}, amberOrbRenderFunction, radialCollisionCheck(30), 250, 10000, {point: 12, power: 12, bombpiece: 1 - amberOrbsDefeated, lifepiece: amberOrbsDefeated}, function() {
		let amount = [0, 4, 7, 8][difficulty];
		if (this.isAutokilled) {
			amount = amount + 5;
		} else {
			amberOrbsDefeated++;
		}
		createAmberOrbDiamondWaves(this.position, amount);
	}, undefined, undefined, {isAutokilled: false})
}
// Creates the waves of diamonds that amber orbs create on wave size change and on death.
function createAmberOrbDiamondWaves(centre, amount, firstSize = (difficulty === 3) ? Math.floor(randomReal(14.5, 16.5)) : ranint(7, 8)) {
	let initialSpeed = [2.5, 3.2, 4, 5][difficulty];
	for (let waveNum = 0; waveNum < amount; waveNum++) {
		let waveSize = firstSize;
		let waveSpeed = initialSpeed + 0.05 * waveNum;
		let principalAngle = randomReal(0, Math.PI * 2);
		scheduleStageEvent((waveNum === 0) ? 1 : (waveNum * ((difficulty === 3) ? 7 : 3) + 12), function() {
			playAudio("se_tan00", 0.25);
			for (let bulletNum = 0; bulletNum < waveSize; bulletNum++) {
				let angle = principalAngle + Math.PI * 2 * bulletNum / waveSize;
				let v = polarToCartesian(waveSpeed, angle);
				createBullet(addVectors(centre, polarToCartesian(7 + waveNum + 2, angle)), function() { // Bullets will initially move into the centre before flying out.
					this.position = addVectors(this.position, v);
				}, rectangularRenderFunction(24, 24, "#fd5909", "#ff9933", angle + Math.PI / 4), radialCollisionCheck(17));
			}
		})
		firstSize = (difficulty === 3) ? Math.floor(randomReal(14.5, 16.5)) : (15 - firstSize);
	}
}
// The yin yang orbs spawned after the first amber orb. They act exactly like Variant B, but shoot bullets ~50% faster and linger on the screen for longer.
// We take `exitFrame` as a parameter and clear whole waves out at once.
function createYinYangOrbVariantC(targetPosition, exitFrame) {
	createYinYangOrb(targetPosition, [25, 25, 0, 0][difficulty], [325, 125, 60, 30][difficulty], [200, 135, 70, 40][difficulty], [2.5, 4, 5, 6][difficulty], [0, 0, 0, 0.3][difficulty], 0.5, [50, 20, 10, 4][difficulty], [1.5, 1.8, 2, 4][difficulty], [2.25, 2.7, 3, 6][difficulty], exitFrame);
}
// Spawns a whole wave of variant C orbs.
function createYinYangOrbVariantCWave(size, exitFrame) {
	for (let orbNum = 0; orbNum < size; orbNum++) {
		let targetX = -250 + 500 * (orbNum + randomReal(1/3, 2/3)) / size;
		createYinYangOrbVariantC([targetX, -225], exitFrame);
	}
}
// Creates a UFO that shoots tetrominoes. As there are 5 different types with completely different patterns, we pass the shot functions in as arguments instead of creating 5 different creator functions.
// The UFOs drop different items depending on how many have already been defeated, so we give them blank drop objects, and process the drops using onDefeat.
function createUFO(targetPosition, type) {
	targetPosition = addVectors(targetPosition, randomCartesianVector(20, 20));
	let initialPosition = [targetPosition[0] + Math.sign(targetPosition[0]) * randomReal(40, 60), -330]; // These enter the screen at an angle, moving towards the centre of the screen.
	let exitAngle = bearingToAngle(Math.sign(initialPosition[0]) * randomReal(-81, -78));
	let shotTypeRandomSeed = Math.random(); // Since the shot types are not generated by functions themselves, add randomness to them here.
	createEnemy(initialPosition, function(t) {
		if (t < 120) {
			let reduction = 0.1 + t / 500;
			this.position = addVectors(multiplyVectors(this.position, 1 - reduction), multiplyVectors(targetPosition, reduction));
		} else {
			this.position = addVectors(this.position, polarToCartesian((t - 120) * 0.25, exitAngle));
		}
		if ((20 <= t) && (t <= 120)) {
			UFOShots[type](this.position, t, shotTypeRandomSeed);
		}
	}, UFORenderFunction, rectangularCollisionCheck(30, 70), 80, 5000, {}, function() {processUFODrops(this.position, this.creationTime)}, undefined, undefined, {type: type});
}
// Creates UFO drops.
var UFOsDefeated = 0;
const UFODrops = {
	0: {point: 4, power: 4},
	1: {point: 8, power: 8},
	2: {bombpiece: 1, point: 6, power: 6},
	3: {spellcard: 1, point: 6, power: 6},
	4: {lifepiece: 1, point: 8, power: 8},
	5: {fullpower: 1, point: 20}
};
function processUFODrops(position, creationTime) {
	// We only advance the drop list if the UFO was defeated without bombing. 300 is added as this is the duration of a bomb.
	// If a bomb was used, we instead add 2 point items and 2 power items.
	let defeatedWithoutBombing = (lastBomb + 300) < creationTime;
	if (defeatedWithoutBombing) {
		UFOsDefeated++;
	}
	let dropList = structuredClone(UFODrops[UFOsDefeated]);
	if (!defeatedWithoutBombing) {
		dropList.point += 2;
		dropList.power += 2;
	}
	processEnemyDrops(position, UFODrops[UFOsDefeated]);
}
// The five possible UFO shot types. We keep them in this object for the benefit of the rainbow UFO.
const UFOShots = {
	I: function(currentPosition, t, randomSeed) {
		// Shoots lasers. On higher difficulties, there are more lasers, they are faster and linger on the screen for longer.
		let shotInterval = [4, 4, 4, 4][difficulty];
		if (t % shotInterval === 0) {
			if (t % (shotInterval * 2) === 0) {
				playAudio("se_tan00", 0.15);
			}
			let numberOfAngles = [3, 4, 5, 6][difficulty];
			let bulletsPerAngle = [7, 8, 9, 11][difficulty];
			let minBulletSpeed = [3.3, 4, 4.8, 5.4][difficulty];
			let maxBulletSpeed = [4.4, 5.6, 7.2, 9][difficulty];
			let principalAngle = Math.PI * 2 * t * (0.603 + randomSeed * 0.03) / (numberOfAngles * shotInterval);
			for (let angleNum = 0; angleNum < numberOfAngles; angleNum++) {
				let angle = principalAngle + 2 * Math.PI * angleNum / numberOfAngles;
				for (let bulletNum = 0; bulletNum < bulletsPerAngle; bulletNum++) {
					let speed = minBulletSpeed + (maxBulletSpeed - minBulletSpeed) * bulletNum / (bulletsPerAngle - 1); // Bullet speed increases linearly within each shot.
					let v = polarToCartesian(speed, angle);
					createBullet(addVectors(currentPosition, polarToCartesian(20, angle)), function() {
						this.position = addVectors(this.position, v);
					}, circularRenderFunction(3, "#009999", "#00cccc"), radialCollisionCheck(3))
				}
			}
		}
	},
	O: function(currentPosition, t) {
		// Shoots large ring bullets following curved paths. On higher difficulties, bullets move faster, are fired more frequently and have a higher angular velocity.
		if (frame % 3 === 0) {
			if (t % 6 === 0) {
				playAudio("se_tan00", 0.15);
			}
			let bulletsPerFrame = [3, 4, 5, 7][difficulty];
			let radialSpeed = [105, 115, 130, 150][difficulty];
			let angularSpeed = [0.045, 0.045, 0.045, 0.045][difficulty];
			let principalAngle = Math.PI * 2 * Math.random();
			let initialPosition = structuredClone(currentPosition);
			for (let bulletNum = 0; bulletNum < bulletsPerFrame; bulletNum++) {
				let angle = principalAngle + Math.PI * 2 * bulletNum / bulletsPerFrame;
				createBullet(addVectors(initialPosition, polarToCartesian(25, angle)), function(t) {
					let radius = radialSpeed * (Math.sqrt(t + 100) - 10) + 25;
					this.angle -= angularSpeed * radialSpeed / (radius + 150);
					this.position = addVectors(initialPosition, polarToCartesian(radius, this.angle));
				}, circularRenderFunction(15, "#ffff00"), radialCollisionCheck(15), 700, 700, {angle: principalAngle + Math.PI * 2 * bulletNum / bulletsPerFrame});
			}
		}
	},
	L: function(currentPosition, t) {
		// Creates rotating rings of L's which interlock with each other.
		let waveInterval = [28, 24, 20, 18][difficulty];
		if (frame % waveInterval === 0) {
			playAudio("se_tan00", 0.3);
			let waveSpeed = 144 / waveInterval;
			let waveOrientation = (frame % (waveInterval * 2) < waveInterval) ? 1 : -1;
			let angularSpeed = [0.005, 0.006, 0.007, 0.008][difficulty] * waveOrientation;
			let waveSize = [10, 12, 16, 18][difficulty];
			let principalAngle = Math.PI * 2 * Math.random();
			let offsets = UFOLOffsets.map(x => [x[0], x[1] * waveOrientation]); // Make adjacent rings have L's facing in opposite directions and rotating in opposite directions.
			let initialPosition = structuredClone(currentPosition);
			for (let LNum = 0; LNum < waveSize; LNum++) {
				let initialAngle = principalAngle + Math.PI * 2 * LNum / waveSize;
				for (let bulletNum = 0; bulletNum < offsets.length; bulletNum++) {
					// If this bullet of the L has not gone through the centre of the UFO yet, do not display it.
					createBullet([-400, 0], function(t) {
						if (20 + waveSpeed * t + offsets[bulletNum][0] > 0) {
							let angle = initialAngle + angularSpeed * t;
							this.position = addVectors(initialPosition, polarToCartesian(20 + waveSpeed * t, angle), rotateVector(offsets[bulletNum], angle));
						}
					}, circularRenderFunction(4, "#000099", "#0000ff"), radialCollisionCheck(4), 500, 500);
				}
			}
		}
	},
	Z: function(currentPosition, t, randomSeed) {
		// Creates Z-shapes which move linearly and rotate about their own centres.
		let waveInterval = [18, 15, 12, 10][difficulty];
		if (frame % waveInterval === 0) {
			playAudio("se_tan00", 0.3);
			let waveSize = [4, 5, 6, 8][difficulty];
			let waveSpeed = [3.2, 4, 5, 6][difficulty];
			let angularSpeed = [0.02, 0.035, 0.05, 0.07][difficulty] * plusMinus1();
			let initialPosition = structuredClone(currentPosition);
			let principalAngle = Math.PI * 2 * t * (0.603 + randomSeed * 0.03) / (waveSize * waveInterval)
			for (let ZNum = 0; ZNum < waveSize; ZNum++) {
				let initialAngle = principalAngle + Math.PI * 2 * ZNum / waveSize;
				for (let bulletNum = 0; bulletNum < UFOZOffsets.length; bulletNum++) {
					let appearanceTime = Math.abs(bulletNum - 7.5) + 0.5;
					// Every bullet in the Z starts off the screen, so just spawn at an arbitrary coordinate.
					createBullet([-400, 0], function(t) {
						if (t >= appearanceTime) {
							let angle = initialAngle + angularSpeed * t;
							this.position = addVectors(initialPosition, polarToCartesian(waveSpeed * t, initialAngle), rotateVector(UFOZOffsets[bulletNum], angle));
						}
					}, circularRenderFunction(4, "#990000", "#ff0000"), radialCollisionCheck(4), 500);
				}
			}
		}
	},
	T: function(currentPosition, t, randomSeed) {
		// Creates static waves of T-shapes moving linearly.
		let waveInterval = [25, 21, 18, 16][difficulty];
		if (frame % waveInterval === 0) {
			playAudio("se_tan00", 0.3);
			let waveSize = [15, 16, 17, 18][difficulty];
			let waveSpeed = [4.8, 6, 7.2, 8.4][difficulty];
			let phase = (frame / (waveInterval * 2)) % 2;
			let initialPosition = structuredClone(currentPosition);
			for (let TNum = 0; TNum < waveSize; TNum++) {
				let angle = Math.PI * 2 * (randomSeed + phase + TNum) / waveSize;
				for (let bulletNum = 0; bulletNum < UFOTOffsets.length; bulletNum++) {
					let appearanceTime = 10 * (1 + (bulletNum - 1) % 5) / waveSpeed; // -1 % 5 = -1 so the 1st bullet has appearance time 0 this way.
					createBullet([-400, 0], function(t) {
						if (t > appearanceTime) {
							this.position = addVectors(initialPosition, polarToCartesian(waveSpeed * t, angle), rotateVector(UFOTOffsets[bulletNum], angle));
						}
					}, circularRenderFunction(4, "#6600cc", "#9900ff"), radialCollisionCheck(4), 500);
				}
			}
		}
	}
}
const UFOLOffsets = [[-136, 0], [-128, 0], [-120, 0], [-112, 0], [-104, 0], [-96, 0], [-88, 0], [-80, 0], [-72, 0], [-64, 0], [-56, 0], [-48, 0], [-40, 0], [-32, 0], [-24, 0], [-16, 0], [-8, 0], [0, 0], [0, 8], [0, 16], [0, 24], [0, 32], [0, 40], [0, 48], [0, 56], [0, 64]];
const UFOZOffsets = [[-50, -25], [-40, -25], [-30, -25], [-20, -25], [-10, -25], [0, -25], [0, -15], [0, -5], [0, 5], [0, 15], [0, 25], [10, 25], [20, 25], [30, 25], [40, 25], [50, 25]]
const UFOTOffsets = [[0, 0], [-10, 0], [-20, 0], [-30, 0], [-40, 0], [-50, 0], [0, 10], [0, 20], [0, 30], [0, 40], [0, 50], [0, -10], [0, -20], [0, -30], [0, -40], [0, -50]];
// The amber shard during the transition from the Capitol to the ocean.
// This one does not shoot diamonds, and instead creates a prolonged fire wave similar to the normal shards' death explosions, and then self-destructs for full drops.
function createSuperAmberShard(targetPosition, factor78 = Math.random()) {
	let initialTarget = structuredClone(targetPosition);
	targetPosition = addVectors(targetPosition, randomCartesianVector(5, 5));
	createEnemy([targetPosition[0], -330], function(t) {
		let angleToTarget = angleToObject(this.position, targetPosition);
		let speed = (squaredDistance(this.position, targetPosition) + 1) ** 0.25 * 0.5 - 0.5;
		this.position[1] += speed;
		if ((50 <= t) && (t <= 275) && (t % 2 === 0)) {
			if (t % 8 === 0) {
				playAudio("se_tan00", 0.3);
			}
			let totalAngles = [7, 9, 11, 13][difficulty];
			let averageSpeed = [5.5, 6.5, 7.5, 9][difficulty];
			for (let angleNum = 0; angleNum < totalAngles; angleNum++) {
				let primaryAngle = angleToPlayer(this.position); // Tracks the player during the burst.
				let angle = primaryAngle + Math.PI * 2 * angleNum / totalAngles;
				let v = polarToCartesian(averageSpeed * randomReal(0.8, 1.2), angle);
				createBullet(addVectors(this.position, randomPolarVector(0, 30)), function() {
					this.position = addVectors(this.position, v);
				}, circularRenderFunction(7, "#fd5909", "#ff9933"), radialCollisionCheck(7));
			}
		}
		if (t === 320) {
			this.score = 0;
			this.HP = 0;
		}
	}, amberShardRenderFunction, radialCollisionCheck(20), 1000, 10000, {power: 12, point: 12, extend: 1});
}
// Creates the spirits that spawn during the beginning of the ocean section.
// These passively fly to the bottom of the screen, and shoot circular waves on defeat.
// If they reach the bottom of the screen, they self-destruct and shoot denser waves.
// Their motion is a sinusoidal wave in a random downward-facing direction.
function createBlueSpirit(targetPosition) {
	if (squaredDistance(playerPosition, targetPosition) < 5625) { // Prevent spawning right on top of player:
		targetPosition[1] += 150 * ((playerPosition[1] < 0) ? 1 : -1);
	}
	let motionDirection = bearingToAngle(randomReal(150, 210) - targetPosition[0] / 20);
	let maxTransverseDisplacement = randomReal(-50, 50);
	let startOfMotion = randomReal(0, 60);
	createEnemy(structuredClone(targetPosition), function(t) {
		[this.longitudinalSpeed, this.longitudinalAcceleration] = processNaturalSpeed(this.longitudinalSpeed, this.longitudinalAcceleration, (t < startOfMotion) ? 0.25 : Math.min((t - startOfMotion) / 75, (t - startOfMotion) / 200 + 1));
		this.longitudinalDisplacement += this.longitudinalSpeed;
		let transverseAmplitude = maxTransverseDisplacement * Math.max(0.25, Math.min(0.25 + (t - startOfMotion) / 250, 1));
		let transverseDisplacement = polarToCartesian(transverseAmplitude * Math.sin(t / 20), motionDirection + Math.PI / 2);
		this.position = addVectors(targetPosition, polarToCartesian(this.longitudinalDisplacement, motionDirection), polarToCartesian(transverseAmplitude * Math.sin(t / 20), motionDirection + Math.PI / 2));
		let spiritId = this.id;
		// We animate the spirit's flame using bullets.
		spiritFlameAnimation(this.position, "#00ffff");
		// If the spirit reaches any side of the screen, self-destruct.
		if ((Math.abs(this.position[0]) > 250) || (Math.abs(this.position[1]) > 300)) {
			this.score = 0;
			this.dropList = {};
			this.HP = 0;
			this.isAutokilled = true;
		}
	}, spiritRenderFunction("#00ffff", "#99ffff"), radialCollisionCheck(8), 10, 1000, {point: 1, power: 1}, function(position) {
		playAudio("se_kira00", 0.3);
		let waveSize;
		if (this.isAutokilled) {
			waveSize = [8, 16, 28, 60][difficulty];
		} else {
			waveSize = [6, 10, 16, 30][difficulty];
		}
		let waveSpeed = [2.5, 3.2, 4, 5][difficulty];
		let principalAngle = Math.PI * 2 * Math.random();
		for (let bulletNum = 0; bulletNum < waveSize; bulletNum++) {
			let angle = principalAngle + Math.PI * 2 * bulletNum / waveSize;
			createBullet(structuredClone(position), function() {
				this.speed = this.speed * 0.975 + waveSpeed * 0.025;
				this.position = addVectors(this.position, polarToCartesian(this.speed, angle));
			}, circularRenderFunction(5, "#009999", "#00ffff"), radialCollisionCheck(5), undefined, undefined, {speed: 0});
		}
	}, 999, 999, {longitudinalAcceleration: 0, longitudinalSpeed: 0.1, longitudinalDisplacement: 0, isAutokilled: false});
};
function spiritFlameAnimation(position, color) {
	for (let i = 0; i < 2; i++) {
		let fireStartDeflection = randomReal(-6, 6);
		// Fire moves vertically upwards and despawns after a short time
		createBullet([position[0] + fireStartDeflection, position[1]], function(t) {
			if (t > (20 - Math.abs(fireStartDeflection) * 2.5)) {
				this.position[0] = 999;
			} else {
				this.position[1] -= 1.5;
			}
		}, circularRenderFunction(2, color, color), radialCollisionCheck(2, false)); // These bullets cannot be grazed.
	}
}
// Creates the witch silhouettes that create glyphs which disperse into random bullets.
// Type 1 is the basic type that creates random glyphs. Type 2 is the type that creates a large glyph immediately before the midboss.
function createWitch(type) {
	let direction = (Math.random() < 0.5) ? 1 : -1;
	let targetPosition = [randomReal(-50, 50), randomReal(-225, -125)];
	let verticalPhase = Math.PI * 2 * Math.random();
	let shot = (type === 1) ? witchShot1 : witchShot2;
	let score = (type === 1) ? 4000 : 10000;
	let dropList = (type === 1) ? {power: 6, point: 6} : {bombpiece: 1, power: 6, point: 6};
	createEnemy([400, 0], function(t) { // [400, 0] is arbitrary off-screen position.
		let horizontalDisplacement = (t < 75) ? (-0.08 * (75 - t) ** 2) : (t < 110) ? 0 : (0.08 * (t - 110) ** 2);
		let verticalDisplacement = 15 * Math.sin(verticalPhase + 0.05 * t);
		if (t < 250) {
			this.position = addVectors(targetPosition, [horizontalDisplacement * direction, verticalDisplacement]);
		} else {
			this.position[1] = 1000;
		}
		if ((t === 90) && this.canShoot) {
			shot(this.position);
			this.canShoot = false;
		}
	}, witchRenderFunction, function(position1, position2) {
		// The centre of the witch .png is at (72, 48). We have two rectangular hitboxes:
		// - one from (46, 18) to (91, 81) - i.e. centre (68.5, 49.5), height 63, width 45;
		// - one from (34, 70) to (124, 72) - i.e. centre (89, 71), height 3, width 91.
		return Math.max(
			rectangularCollisionCheck(63, 45)(addVectors(position1, [20.5, 1.5]), position2),
			rectangularCollisionCheck(3, 91)(addVectors(position1, [17, 23]), position2),
		);
	}, 100, score, dropList, function() {
		if (this.canShoot) {
			shot(this.position);
			this.canShoot = false;
		}
	}, 10000, 300, {direction, canShoot: true});
}
// These two attacks are the same regardless of whether they are used on defeat or not so use them as a separate function.
// Both involve linearly moving "spawner bullets" moving and constantly creating stationary "glyph bullets" which then disperse in pseudorandom directions.
function witchShot1(position) {
	// This single shot periodically changes direction and stays near its spawn point. It spawns large numbers of fast-moving glyph bullets.
	let initialPosition = structuredClone(position);
	let lifespan = [39, 49, 69, 89][difficulty];
	let spawnerSpeed = [11, 12.5, 14, 16][difficulty];
	let glyphSpeed = [4.8, 5.6, 6.8, 8.4][difficulty];
	let glyphAccelerationFactor = [0.008, 0.01, 0.012, 0.015][difficulty];
	let spawnsPerFrame = [3, 4, 6, 8][difficulty];
	let glyphPhase = Math.PI * 2 * Math.random();
	createBullet(addVectors(position, randomCartesianVector(5)), function(t) {
		if (t % 5 === 0) {
			playAudio("se_kira00", 0.3);
		}
		if (t % 10 === 0) {
			// Focus of each glyph is (0, -150), regardless of its spawn point.
			let targetAngle = angleToObject(this.position, [0, -150]);
			let maxDeflection = Math.PI * (1 - Math.sqrt(squaredDistance(this.position, initialPosition)) / 300);
			this.angle = randomReal(targetAngle - maxDeflection, targetAngle + maxDeflection);
		}
		this.position = addVectors(this.position, polarToCartesian(spawnerSpeed, this.angle));
		for (let bulletNum = 0; bulletNum < spawnsPerFrame; bulletNum++) {
			let angle = glyphPhase + Math.PI * 2 * 0.6180339887 * (t + bulletNum / spawnsPerFrame);
			createBullet(addVectors(this.position, polarToCartesian(-spawnerSpeed * bulletNum / spawnsPerFrame, this.angle)), function(t) {
				let speed = (t < 40) ? 0 : (glyphSpeed * (1 - Math.exp((t - 40) * -glyphAccelerationFactor)));
				this.position = addVectors(this.position, polarToCartesian(speed, angle));
			}, circularRenderFunction(4, "#6600cc", "#9900ff"), radialCollisionCheck(4));
		}
		if (t === lifespan) {
			this.position[0] = 10000;
		}
	}, circularRenderFunction(5, "#6600cc", "#9900ff"), radialCollisionCheck(5), 1000, 1000, {angle: Math.PI * 2 * Math.random()})
}
function witchShot2(position) {
	let principalAngle = Math.PI * 2 * Math.random();
	let totalShots = [7, 8, 10, 12][difficulty];
	for (let shotNum = 0; shotNum < totalShots; shotNum++) {
		let angle = principalAngle + Math.PI * 2 * shotNum / totalShots;
		witchShot2Bullet(structuredClone(position), angle);
	}
}
function witchShot2Bullet(position, angle, lifespan = 207) {
	// These shots move away from their spawn point and periodically change direction and split into secondary spawner bullets. It spawns smaller numbers of slow-moving glyph bullets.
	let initialPosition = structuredClone(position);
	let spawnerSpeed = [4, 4, 4, 4][difficulty];
	let glyphSpeed = [0.3, 0.35, 0.4, 0.45][difficulty];
	let glyphAccelerationFactor = [0.008, 0.01, 0.012, 0.015][difficulty];
	let spawnInterval = [2, 2, 2, 2][difficulty];
	let glyphPhase = Math.PI * 2 * Math.random();
	createBullet(addVectors(position, randomCartesianVector(5)), function(t) {
		if (this.lifespanLeft % 60 === 31) {
			let branchAngle = randomReal(0.006, 0.007) * this.lifespanLeft;
			witchShot2Bullet(structuredClone(this.position), this.angle + branchAngle, this.lifespanLeft - 1);
			this.angle -= branchAngle;
		} else if (this.lifespanLeft % 60 === 1) {
			this.angle += randomReal(0.3, 0.4) * plusMinus1();
		}
		this.position = addVectors(this.position, polarToCartesian(spawnerSpeed, this.angle));
		if (frame % 5 === 0) { // Run this outside the spawn interval check as they will not always match.
			playSingleAudio("se_kira00", "witchshot2_" + frame, 0.3);
		}
		if (t % spawnInterval === 0) {
			let angle = glyphPhase + Math.PI * 2 * 0.6180339887 * t / spawnInterval;
			createBullet(structuredClone(this.position), function(t) {
				let speed = (t < 40) ? 0 : (glyphSpeed * (1 - Math.exp((t - 40) * -glyphAccelerationFactor)));
				this.position = addVectors(this.position, polarToCartesian(speed, angle));
			}, circularRenderFunction(4, "#6600cc", "#9900ff"), radialCollisionCheck(4));
		}
		this.lifespanLeft--;
		if (this.lifespanLeft === 0) { // Do not force despawn in case any spawners are still left on the screen, but allow them to despawn naturally.
			this.maximumX = Math.max(Math.abs(this.position[0]) + 5, 260);
			this.maximumY = Math.max(Math.abs(this.position[1]) + 5, 310);
		}
	}, circularRenderFunction(5, "#6600cc", "#9900ff"), radialCollisionCheck(5), 1000, 1000, {angle: angle, lifespanLeft: lifespan})
}
// Creates the eyes that shoot lasers at the player and then disappear. We count the number spawned to determine what item the next should drop.
// On higher difficulties,, we shoot lasers to the sides as well.
var eyeSpawnCounter = 0;
function createEye(position, deflectionMult) {
	let dropIfAutokilled = [0, 3, 5, 6].includes(eyeSpawnCounter % 8) ? {point: 1} : {power: 1};
	createEnemy(position, function(t) {
		if (t === 50) {
			playAudio("se_tan00", 0.2);
			let principalAngle = angleToPlayer(position);
			let laserMinSpeed = [4.5, 5, 5.8, 8][difficulty];
			let laserMaxSpeed = [6, 7, 8, 10][difficulty];
			let bulletsPerLaser = [13, 11, 9, 7][difficulty];
			let sideAngles = [0, 0, 1, 2][difficulty];
			let sideAngleDeflection = [0, 0, 0.6, 0.25][difficulty] * deflectionMult;
			for (let angleNum = -sideAngles; angleNum <= sideAngles; angleNum++) {
				let angle = principalAngle + sideAngleDeflection * angleNum;
				for (let bulletNum = 0; bulletNum < bulletsPerLaser; bulletNum++) {
					let v = polarToCartesian(laserMinSpeed + (laserMaxSpeed - laserMinSpeed) * bulletNum / (bulletsPerLaser - 1), angle);
					createBullet(addVectors(position, polarToCartesian(5, principalAngle)), function() {
						this.position = addVectors(this.position, v);
					}, arrowBulletRenderFunction("#ff0000", 4, angle), radialCollisionCheck(4));
				}
			}
		}
		if (t === 80) {
			this.dropList = dropIfAutokilled;
			this.score = 0;
			this.HP = 0;
		}
	}, eyeRenderFunction(0), radialCollisionCheck(16), 20, 1500, {point: 1, power: 1});
	eyeSpawnCounter++;
}
// Creates the red spirits that sweep the outside of the circle out during the wave with the circle of eyes.
function createRedSpirit(initialAngle, angularDirection, verticalOffset) {
	createEnemy([500, 0], function(t) {
		let distanceFromOrigin = (t <= 600) ? Math.max(400 + Math.max(120 - t, 0) ** 2 / 120 - t, 280) : (t / 2 - 20);
		let angleFromOrigin = initialAngle + 0.015 * t * angularDirection;
		this.position = polarToCartesian(distanceFromOrigin, angleFromOrigin);
		this.position[1] += verticalOffset;
		// We animate the spirit's flame using bullets.
		spiritFlameAnimation(this.position, this.innerColor);
		// Shoot bullets outwards from the origin.
		let bulletVelocity = polarToCartesian(5, angleFromOrigin - Math.PI * angularDirection / 2);
		if ((t >= 75) && (t % 7 === 0)) {
			createBullet(addVectors(this.position, bulletVelocity), function() {
				this.position = addVectors(this.position, bulletVelocity);
			}, circularRenderFunction(7, this.outerColor, this.innerColor), radialCollisionCheck(7));
		}
		if (t === 450) {
			playSingleAudio("se_boon01", "redSpiritTransition" + frame, 0.75);
		}
		if (t >= 450) { // This is when the red spirits become damageable and start shooting secondary bullets.
			let colorTransitionProgress = Math.min(t / 50 - 9, 1);
			// Change from #cc0000 = hsl(0, 60, 40) to #009900 = hsl(180, 60, 30).
			this.outerColor = hsltohex(colorTransitionProgress * 120, 60, 40 - colorTransitionProgress * 10);
			// Change from #ff0000 = hsl(0, 60, 50) to #00ff00 = hsl(180, 60, 50).
			this.innerColor = hsltohex(colorTransitionProgress * 120, 60, 50);
			this.invincible = false;
			let shotInterval = [30, 24, 20, 17][difficulty];
			let totalBullets = [3, 4, 5, 6][difficulty];
			if (verticalOffset !== 0) { // Weaken the red spirits that spawn during the volcano section as they're too spammy.
				shotInterval = Math.floor(shotInterval * 1.5);
				totalBullets--;
			}
			if ((t >= 480) && (t <= 600) && (t % shotInterval === 0)) {
				playSingleAudio("se_kira00", "redSpiritShot" + frame, 0.3);
				let principalAngle = Math.PI * 2 * Math.random();
				let initialSpeed = [0.6, 0.8, 1, 1.2][difficulty];
				for (let bulletNum = 0; bulletNum < totalBullets; bulletNum++) {
					let angle = principalAngle + Math.PI * 2 * bulletNum / totalBullets;
					createBullet(addVectors(this.position, polarToCartesian(20, angle)), function(t) {
						this.position = addVectors(this.position, polarToCartesian(initialSpeed * (1 + t / 200), angle));
					}, circularRenderFunction(5, "#009900", "#00ff00"), radialCollisionCheck(5));
				}
			}
		}
	}, function(position) {
		spiritRenderFunction(this.outerColor, this.innerColor)(position);
	}, radialCollisionCheck(8), 8, 0, {point: 2, power: 1}, undefined, 600, 600, {outerColor: "#cc0000", innerColor: "#ff0000", invincible: true}); // These are not meant to be killed.
};
// Creates the eyes that shoot streaming bullets in a circular orientation
function createSpecialEye(distanceFromOrigin, angleFromOrigin) {
	let shotInterval = [100, 90, 80, 70][difficulty];
	let shotDelay = shotInterval * (angleFromOrigin / (Math.PI * 2) - 1) + 50;
	let position = polarToCartesian(distanceFromOrigin, Math.PI / 2 + angleFromOrigin);
	let dropIfAutokilled = [{}, {point: 1}, {power: 1}][eyeSpawnCounter % 3]
	createEnemy(position, function(t) {
		if ((t - shotDelay) % shotInterval >= shotInterval - 1) {
			if (t > 250) {
				this.dropList = dropIfAutokilled;
				this.score = 0;
				this.HP = 0;
			}
			playAudio("se_tan00", 0.2);
			let principalAngle = angleToPlayer(position);
			let laserMinSpeed = [4, 5, 6.5, 7.5][difficulty];
			let laserMaxSpeed = [4.5, 5.5, 7, 8][difficulty];
			let bulletsPerLaser = [3, 3, 3, 3][difficulty];
			let sideAngles = [0, 0, 1, 1][difficulty];
			let sideAngleDeflection = [0, 0, 0.75, 0.5][difficulty];
			for (let angleNum = -sideAngles; angleNum <= sideAngles; angleNum++) {
				let angle = principalAngle + sideAngleDeflection * angleNum;
				for (let bulletNum = 0; bulletNum < bulletsPerLaser; bulletNum++) {
					let v = polarToCartesian(laserMinSpeed + (laserMaxSpeed - laserMinSpeed) * bulletNum / Math.max(bulletsPerLaser - 1, 1), angle);
					createBullet(addVectors(position, polarToCartesian(5, principalAngle)), function() {
						this.position = addVectors(this.position, v);
					}, arrowBulletRenderFunction("#ff0000", 4, angle), radialCollisionCheck(4));
				}
			}
		}
	}, eyeRenderFunction(angleFromOrigin), radialCollisionCheck(16), 200, 5000, {point: 1, power: 1});
	eyeSpawnCounter++;
}
// Creates the spirits that spawn during the beginning of the volcano section.
// These stay stationary for most of their lifetime, and on death create overlapping circular waves rotating in opposite directions.
// If not defeated fast enough, they rapidly fly into the sides of the screen and create denser waves.
var yellowSpiritSpawnCounter = 0;
function createYellowSpirit(targetPosition) {
	if (squaredDistance(playerPosition, targetPosition) < 5625) { // Prevent spawning right on top of player:
		targetPosition[1] += 150 * ((playerPosition[1] < 0) ? 1 : -1);
	}
	let motionDirection = bearingToAngle(randomReal(60, 120) + ranint(0, 1) * 180);
	let maxTransverseDisplacement = randomReal(-50, 50);
	let startOfMotion = randomReal(150, 225);
	createEnemy(targetPosition, function(t) {
		[this.longitudinalSpeed, this.longitudinalAcceleration] = processNaturalSpeed(this.longitudinalSpeed, this.longitudinalAcceleration, (t < startOfMotion) ? 0.25 : Math.min((t - startOfMotion) / 25, (t - startOfMotion) / 100 + 4));
		this.longitudinalDisplacement += this.longitudinalSpeed;
		let transverseAmplitude = maxTransverseDisplacement * Math.max(0.25, Math.min(0.25 + (t - startOfMotion) / 250, 1));
		let transverseDisplacement = polarToCartesian(transverseAmplitude * Math.sin(t / 20), motionDirection + Math.PI / 2);
		this.position = addVectors(targetPosition, polarToCartesian(this.longitudinalDisplacement, motionDirection), polarToCartesian(transverseAmplitude * Math.sin(t / 20), motionDirection + Math.PI / 2));
		let spiritId = this.id;
		// We animate the spirit's flame using bullets.
		spiritFlameAnimation(this.position, "#ffff00");
		// If the spirit reaches any side of the screen, self-destruct.
		if ((Math.abs(this.position[0]) > 250) || (Math.abs(this.position[1]) > 300)) {
			this.score = 0;
			this.dropList = {};
			this.HP = 0;
			this.isAutokilled = true;
		}
	}, spiritRenderFunction("#ffff00", "#ffff99"), radialCollisionCheck(8), 10, 1000, (yellowSpiritSpawnCounter % 2 === 0) ? {point: 1, power: 2} : {point: 2, power: 1}, function(position) {
		let waveSize;
		if (this.isAutokilled) {
			waveSize = [8, 12, 20, 32][difficulty];
		} else {
			waveSize = [6, 10, 14, 20][difficulty];
		}
		let waveSpeed = [2.8, 3.2, 4.2, 5.6][difficulty];
		let angularSpeed = [0.06, 0.075, 0.095, 0.12][difficulty];
		playAudio("se_kira00", 0.3);
		for (let waveOrientation of [-1, 1]) {
			let principalAngle = Math.PI * 2 * Math.random();
			for (let bulletNum = 0; bulletNum < waveSize; bulletNum++) {
				let initialAngle = principalAngle + Math.PI * 2 * bulletNum / waveSize;
				createBullet(structuredClone(position), function(t) {
					this.speed = this.speed * 0.975 + waveSpeed * 0.025;
					this.radius += this.speed;
					this.angle += waveOrientation * angularSpeed / Math.sqrt(this.radius + 100);
					this.position = addVectors(position, polarToCartesian(this.radius, this.angle));
				}, circularRenderFunction(8, "#999900", "#ffff00"), radialCollisionCheck(8), 360, 360, {radius: 0, speed: 0, angle: initialAngle});
			}
		}
	}, 999, 999, {longitudinalAcceleration: 0, longitudinalSpeed: 0.1, longitudinalDisplacement: 0, isAutokilled: false});
	yellowSpiritSpawnCounter++;
};
// The magma elementals that shoot singular explosive bullets which create pillars of lava when they reach the bottom of the screen, and then random rings of fire bullets.
// Fire starts shooting at the moment that the explosive reaches the ground and creates a magma pillar.
var magmaElementalsDefeated = 0;
function createMagmaElemental(targetPosition) {
	createEnemy([targetPosition[0], -360], function(t) {
		if (t <= 420) {
			this.position[1] = this.position[1] * 0.97 + targetPosition[1] * 0.03;
		} else {
			this.position[1] += t / 30 - 14;
		}
		if ([180, 330].includes(t)) {
			targetPosition = addVectors(targetPosition, randomPolarVector(45, 60));
		}
		if (t === 30) {
			magmaElementalExplosiveShot(this.position, this.id);
			this.canShootExplosive = false;
		}
		let fireWaveInterval = [6, 5, 4, 3][difficulty];
		if ((this.explosiveShotsLanded > 0) && (t <= 450) && (t % fireWaveInterval === 0)) {
			playAudio("se_tan00", 0.08);
			let fireWaveSize = [8, 10, 13, 16][difficulty];
			let fireWaveMaxSpeed = [6.3, 7.5, 9.4, 11.8][difficulty];
			for (let bulletNum = 0; bulletNum < fireWaveSize; bulletNum++) {
				let angle = Math.PI * 2 * (bulletNum + this.fireSeed) / fireWaveSize;
				let hue = randomReal(18, 42);
				createBullet(addVectors(this.position, polarToCartesian(36, angle)), function(t) {
					let speed = fireWaveMaxSpeed * (Math.max(1 - t * fireWaveMaxSpeed / 160, 0.15) + Math.max(1 - Math.exp(3 - 0.04 * t), 0));
					this.position = addVectors(this.position, polarToCartesian(speed, angle));
				}, circularRenderFunction(8, hsltohex(hue, 100, 30), hsltohex(hue, 100, 50)), radialCollisionCheck(8));
			}
			this.fireSeed += randomReal(1/3, 2/3);
		}
		// The first defeated drops a bomb piece, the second a life piece.
	}, magmaElementalRenderFunction(0.75), radialCollisionCheck(30), 450, 20000, {point: 18, power: 18, bombpiece: 1 - magmaElementalsDefeated, lifepiece: magmaElementalsDefeated}, function() {
		if (this.canShootExplosive) {
			magmaElementalExplosiveShot(this.position, this.id);
		}
	}, undefined, undefined, {canShootExplosive: true, explosiveShotsLanded: 0, fireSeed: Math.random()});
}
function magmaElementalExplosiveShot(position, magmaElementalId, horizontalDirection) { // `horizontalDirection` is optional.
	// We always aim this shot to land a fixed number of pixels away from the elemental, horizontally, in either direction.
	// We use a fixed range of vertical speeds, and thus calculate a horizontal speed which achieves this.
	let horizontalDeflection = [155, 145, 139, 135][difficulty];
	let shotVerticalMinSpeed = 4;
	let shotVerticalMaxSpeed = 5;
	let shotVerticalSpeed = randomReal(shotVerticalMinSpeed, shotVerticalMaxSpeed);
	let gravity = (shotVerticalMinSpeed + shotVerticalMaxSpeed) * 0.007;
	// Calculate the landing time using the quadratic formula.
	let quadCoefficients = [gravity / 2, shotVerticalSpeed, position[1] - 300];
	let timeToReachGround = (-quadCoefficients[1] + Math.sqrt(quadCoefficients[1] ** 2 - 4 * quadCoefficients[0] * quadCoefficients[2])) / (2 * quadCoefficients[0]);
	// Select a horizontal landing point for the explosive, and thus calculate the total horizontal distance travelled by the shot.
	// Determinant determines (a) the number of reflections and (b) whether the explosive lands near or far the last side it reflects from.
	// Determinant 1 = 0 reflections, far; determinant 2 = 1 reflection, near; determinant 3 = 1 reflection, far; determinant 4 = 2 reflections, near; etc.
	// However, if `horizontalDirection` has been defined, ignore determinant and always land in this direction.
	let determinant = ranint(1, [2, 3, 4, 5][difficulty]);
	let numberOfReflections = Math.floor(determinant / 2);
	// We land on the same side as the initial velocity if either: near and odd reflections, or: far and even reflections. Thus, the determinant and number of reflections have the same parity.
	let landingOnSideOfInitialVelocity = (determinant % 2) !== (numberOfReflections % 2);
	let landingPoint = position[0] + horizontalDeflection * (horizontalDirection ?? (landingOnSideOfInitialVelocity ? 1 : -1));
	// We (re)define this here instead of in the arguments so that `landingPoint` can be controlled while simultaneously preserving behaviour when `horizontalDirection` is initially undefined.
	horizontalDirection = Math.sign(randomReal(-100, 100) - position[0]);
	let effectiveDisplacement = 500 * horizontalDirection * numberOfReflections + landingPoint * ((numberOfReflections % 2 === 1) ? -1 : 1);
	let shotHorizontalSpeed = (effectiveDisplacement - position[0]) / timeToReachGround;
	let v = [shotHorizontalSpeed, shotVerticalSpeed];
	createBullet(structuredClone(position), function() {
		this.position = addVectors(this.position, v);
		v[1] += gravity;
		if (Math.abs(this.position[0]) > 250) { // Reflect off vertical sides.
			v[0] *= -1;
			this.position[0] = Math.sign(this.position[0]) * (500 - Math.abs(this.position[0]));
		}
		if (this.position[1] > 300) { // Create pillars of lava upon reaching the ground.
			playSingleAudio("se_kira00", "magmaelementalexplosion1_" + frame, 0.3);
			playSingleAudio("se_don00", "magmaelementalexplosion2_" + frame, 0.9);
			if (enemies[magmaElementalId] !== undefined) { // In case the magma elemental is already defeated.
				enemies[magmaElementalId].explosiveShotsLanded++;
			}
			let totalBullets = [150, 165, 180, 200][difficulty];
			let lavaHorizontalMaxSpeed = [0.1, 0.115, 0.13, 0.15][difficulty];
			let lavaVerticalMaxSpeed = [13, 14, 15, 16][difficulty];
			let realMaximumY = this.position[1] + 5;
			for (let bulletNum = 0; bulletNum < totalBullets; bulletNum++) {
				let hue = randomReal(0, 60); // Lava bullets have random colors between red and yellow.
				let w = [randomReal(-lavaHorizontalMaxSpeed, lavaHorizontalMaxSpeed), randomReal(-lavaVerticalMaxSpeed, 0)];
				let radius = randomReal(4, 8);
				createBullet(structuredClone(this.position), function(t) {
					this.position = addVectors(this.position, w);
					w[1] += lavaVerticalMaxSpeed * 0.005; // This clears out after 400 frames.
					if (this.position[1] > realMaximumY) { // These bullets have very high `maximumY` as they can go significantly above the visible screen, but should be deleted as soon as they reach the bottom.
						this.position[0] = 1000;
					}
				}, circularRenderFunction(radius, hsltohex(hue, 100, 30), hsltohex(hue, 100, 50)), radialCollisionCheck(radius), 260, 5000, {indestructible: true});
			}
			this.position[0] = 1000; // Delete this bullet.
		}
	}, circularRenderFunction(10, "#999900", "#ffff00"), radialCollisionCheck(10), undefined, undefined, {indestructible: true}); // These are indestructible as if they do not go off then magma elementals do not shoot fire waves.
	playAudio("se_boon00");
}
// The yin-yang orbs in the volcano section that move down shooting criss-crossing bullets, then come out of the bottom of the screen and shoot streaming bullets.
function createYinYangOrbVariantD(orientation, latencySeed) {
	let startPosition = [200 * orientation, -440];
	startPosition = addVectors(startPosition, randomCartesianVector(10, 5));
	let xPhase = Math.PI * 2 * Math.random();
	let pauseSeed = Math.random(); // How long the orb takes to stop ascending and move horizontally.
	let streamingShotInterval = [300, 225, 150, 100][difficulty];
	let streamingShotTime = ranint(1, streamingShotInterval - 1);
	createEnemy(structuredClone(startPosition), function(t) {
		if (t < 525) { // Criss-crossing phase.
			this.position[0] = startPosition[0] + 15 * Math.sin(xPhase + t * 0.05);
			this.position[1] += 5.9 + latencySeed * 0.1;
			// Creates criss-crossing bullets.
			let shotInterval = [80, 60, 45, 36][difficulty];
			let shotTime = Math.round(1 + (shotInterval - 2) * latencySeed)
			if ((this.position[1] < 300) && (t % shotInterval === shotTime)) { // Check position so audio is not played when off screen.
				playSingleAudio("se_tan00", "yinyangcross" + frame, 0.2);
				let totalBullets = [2, 4, 6, 8][difficulty];
				let minSpeed = [3, 3.9, 4.7, 5.5][difficulty];
				let maxSpeed = [3.5, 4.7, 6, 7.5][difficulty];
				let angle = bearingToAngle(180 + randomReal(70, 75) * orientation);
				for (let bulletNum = 0; bulletNum < totalBullets; bulletNum++) {
					let v = polarToCartesian(minSpeed + (maxSpeed - minSpeed) * bulletNum / (totalBullets - 1), angle);
					createBullet(this.position, function(t) {
						this.position = addVectors(this.position, v);
					}, arrowBulletRenderFunction("#80ff80", 5, angle), radialCollisionCheck(5));
				}
			}
		} else if (t === 525) { // Teleport before streaming phase
			this.position = [randomReal(195, 225) * -orientation, randomReal(330, 350)];
		} else { // Streaming phase
			this.position[0] += 0.4 * clampNumber(0.3, 78 + pauseSeed * 2 - t / 10, 2) * Math.sin(xPhase + t * 0.04) + clampNumber(0, t / 20 - 39 - pauseSeed * 2, 1) * orientation;
			this.position[1] -= clampNumber(0.3, 78 + pauseSeed * 2 - t / 10, 2);
			if ((t - 585) % streamingShotInterval === streamingShotTime) {
				playSingleAudio("se_tan00", "yinyangstream" + frame, 0.2);
				let bulletSpeed = [2.4, 2.8, 3.6, 4.8][difficulty];
				let angle = angleToPlayer(this.position) + Math.PI * [0.9, 0.7, 0.6, 0.5][difficulty] * randomReal(-1, 1) * randomReal(-1, 1); // Aim most bullets at the player, with the possibility of variable deflection.
				let v = polarToCartesian(bulletSpeed, angle);
				createBullet(addVectors(this.position, polarToCartesian(20, angle)), function() {
					this.position = addVectors(this.position, v);
				}, circularRenderFunction(7, "#00ff00", "#80ff80"), radialCollisionCheck(7));
			}
		}
	}, yinYangOrbRenderFunction("#ccffcc", "#00cc00"), radialCollisionCheck(9), 15, 500, (yinYangOrbSpawnCounter % 4 > 1) ? {power: 1} : {point: 1}, undefined, 320, 4000);
	yinYangOrbSpawnCounter++;
}
// Creates the giant magma elemental before Lexan's boss fight.
// This elemental first creates up to 4 lava pillars while shooting large and small fire waves.
// It then shoots 2 explosives to the bottom corners of the screen, creating waves of fire moving upwards at small angles.
// It then repeats its lava pillar attack before moving out of the screen downwards.
function createSuperMagmaElemental() {
	let totalPillars = [2, 3, 3, 4][difficulty]
	let explosiveOffsets = [
		[-1, 1],
		[-1.8, 0, 1.8],
		[-1.9, -0.8, 0.8, 1.9]
	][totalPillars - 2];
	createEnemy([0, -550], function(t) {
		if (t < 200) { // Initial motion
			this.position[1] = -(350 + 0.005 * (t - 200) ** 2);
		}
		if (t % 650 === 0) {
			this.explosiveShotsLanded = 0; // When the first explosive lands, we start shooting small fire waves. When the large explosive lands, we start shooting large fire waves.
		}
		if ([50, 700].includes(t)) { // Creates explosive lava pillar shots
			explosiveOffsets = shuffleArray(explosiveOffsets);
			let id = this.id;
			for (let offsetNum = 0; offsetNum < totalPillars; offsetNum++) {
				scheduleStageEvent(offsetNum * (35 - totalPillars * 5) + 1, function() {
					if (enemies[id] !== undefined) { // In case the elemental is defeated while shooting.
						magmaElementalExplosiveShot(addVectors(enemies[id].position, randomPolarVector(0, 5)), id, explosiveOffsets[offsetNum]);
					}
				});
			}
		}
		if ((t - 50) % 650 < 320) { // Small and large fire waves.
			let smallFireWaveInterval = [11, 9, 7, 5][difficulty];
			if ((this.explosiveShotsLanded > 0) && (t % smallFireWaveInterval === 0)) {
				playAudio("se_tan00", 0.08);
				let waveSize = [12, 15, 18, 20][difficulty];
				let waveMaxSpeed = [5.7, 6.8, 8.5, 10.6][difficulty];
				for (let bulletNum = 0; bulletNum < waveSize; bulletNum++) {
					let angle = Math.PI * 2 * (bulletNum + this.smallFireSeed) / waveSize;
					let hue = randomReal(18, 42);
					createBullet(addVectors(this.position, polarToCartesian(40, angle)), function(t) {
						let speed = waveMaxSpeed * (Math.max(1 - t * waveMaxSpeed / 320, 0.1) + Math.max(1 - Math.exp(3 - 0.04 * t), 0));
						this.position = addVectors(this.position, polarToCartesian(speed, angle));
					}, circularRenderFunction(8, hsltohex(hue, 100, 30), hsltohex(hue, 100, 50)), radialCollisionCheck(8));
				}
				this.smallFireSeed += randomReal(1/3, 2/3);
			}
			let largeFireWaveInterval = [30, 25, 20, 16][difficulty];
			if ((this.explosiveShotsLanded === totalPillars) && (t % largeFireWaveInterval === 0)) {
				playAudio("se_tan00", 0.25);
				let waveSize = [12, 15, 18, 20][difficulty];
				let waveMaxSpeed = [4.4, 5.3, 6.6, 8.3][difficulty];
				for (let bulletNum = 0; bulletNum < waveSize; bulletNum++) {
					let angle = Math.PI * 2 * (bulletNum + this.largeFireSeed) / waveSize;
					let hue = randomReal(18, 42);
					createBullet(addVectors(this.position, polarToCartesian(40, angle)), function(t) {
						let speed = waveMaxSpeed * (Math.max(1 - t * waveMaxSpeed / 240, 0.1) + Math.max(1 - Math.exp(3 - 0.04 * t), 0));
						this.position = addVectors(this.position, polarToCartesian(speed, angle));
					}, circularRenderFunction(24, hsltohex(hue, 100, 30), hsltohex(hue, 100, 50)), radialCollisionCheck(24));
				}
				this.largeFireSeed += randomReal(1/3, 2/3);
			}
		}
		let fireWaveTimes = [[460], [460], [455, 505], [450, 485, 520]][difficulty];
		if (fireWaveTimes.includes(t)) { // Rising fire waves.
			playAudio("se_boon00");
			for (let angle of [angleToObject(this.position, [-250, 300]), angleToObject(this.position, [250, 300])]) {
				let speed = [6.6, 8, 10, 15][difficulty];
				let v = polarToCartesian(speed, angle);
				createBullet(addVectors(this.position, polarToCartesian(18, angle)), function() {
					this.position = addVectors(this.position, v);
					if (this.position[1] > 310) { // Deletes the bullet and schedules fire waves to form.
						let initialX = this.position[0];
						let bulletsPerFrame = [0.35, 0.45, 0.5, 0.52][difficulty];
						for (let time = 1; time < 50; time++) {
							let bulletsThisFrame = Math.floor(bulletsPerFrame + Math.random());
							scheduleStageEvent(time, function() {
								if (time % 5 === 1) {
									playAudio("se_kira00", 0.15);
								}
								for (let bulletNum = 0; bulletNum < bulletsThisFrame; bulletNum++) {
									let hue = randomReal(18, 42);
									let speed = [1, 1.3, 1.6, 2][difficulty] * randomReal(0.75, 1.25);
									let angle = bearingToAngle(randomReal(-22.5, 22.5));
									let v = polarToCartesian(speed, angle);
									createBullet(addVectors([initialX * (1 - (time + randomReal(-1, 1)) / 25), 310], randomPolarVector(0, 5)), function(t) {
										this.position = addVectors(this.position, multiplyVectors(v, 1 + t / 100));
									}, circularRenderFunction(6, hsltohex(hue, 100, 30), hsltohex(hue, 100, 50)), radialCollisionCheck(6));
								}
							});
						}
						this.position[0] = 1000; // Deletes the bullet.
					}
				}, circularRenderFunction(10, "#999900", "#ffff00"), radialCollisionCheck(10), 400, 400, {indestructible: true});
			}
		}
		if (t > 1080) { // Exits the screen.
			this.position[1] += (t - 1080) / 30;
		}
	}, magmaElementalRenderFunction(5.5), radialCollisionCheck(220), 3000, 100000, {extend: 1, power: 50, point: 50}, undefined, 600, undefined,
	{explosiveShotsLanded: 0, smallFireSeed: 0, largeFireSeed: 0})
}

export function scheduleStageEvent(time, func) { // Schedules a stage event to happen in `time` frames.
	if (extraStageEvents[frame + time] === undefined) {
		extraStageEvents[frame + time] = [];
	}
	extraStageEvents[frame + time].push(func);
}
export var extraStageEvents = {}; // We store these separately from the main stage events as otherwise we would have to store each primary stage event in an array, and also these get cleared by `clearScreen`.
export function clearExtraStageEvents(clearUnclearable = false) {
	extraStageEvents = {};
	if (clearUnclearable) {
		unclearableExtraStageEvents = {};
	}
}
export var unclearableExtraStageEvents = {};
export function scheduleUnclearableStageEvent(time, func) {
	if (unclearableExtraStageEvents[frame + time] === undefined) {
		unclearableExtraStageEvents[frame + time] = [];
	}
	unclearableExtraStageEvents[frame + time].push(func);
}
export const stageEvents = { // The usual stage effects are such that no more than one function is run per frame, but events scheduled by enemies may be scheduled for the same frame which is why an array is used.
	1: function() {
		// Clears all the stage data in case this is a replay.
		playerPosition[0] = 0;
		playerPosition[1] = 250;
		yinYangOrbSpawnCounter = 0;
		amberOrbsDefeated = 0;
		UFOsDefeated = 0;
		eyeSpawnCounter = 0;
		yellowSpiritSpawnCounter = 0;
		magmaElementalsDefeated = 0;
		Bosses.zenryaku.frameDefeated = 99999;
		Bosses.zenryaku.attacks.N1.randomSeed = Math.random();
		Bosses.lexan.attacks.S1.nextFloor = undefined;
		Bosses.lexan.attacks.S1.initialBulletLocations = [];
		Bosses.lexan.attacks.S1.towerBulletsSpawned = 0;
		Bosses.lexan.attacks.S1.towerFormationInProgress = false;
		Bosses.lexan.attacks.S4.chargeAngle = 0;
		Bosses.lexan.attacks.S4.chargeAngularSpeed = 0;
		Bosses.lexan.attacks.S7.rinVerticalOffset = -1;
		Bosses.lexan.attacks.S7.phase = 0;
		Bosses.lexan.attacks.N8.rotationDirection = plusMinus1();
		Bosses.lexan.attacks.S9.nextShardPosition = [220 * plusMinus1(), 270 * plusMinus1()];
		Bosses.lexan.attacks.S10.slowDefeat = true;
		Bosses.lexan.attacks.S10.currentPhase = 1;
		Bosses.lexan.attacks.S10.phase2PrincipalAngle = undefined;
		Bosses.lexan.attacks.S10.phase2Direction = plusMinus1();
		Bosses.lexan.isDefeated = false;
	},
	10: function() {
//		skipFrames(18280);
	},
	100: function() {
		playBGM("bgm_stage", 368, 389.8);
		document.getElementById("div_autocollectionLineIndicator").style.opacity = 0;
	},
	130: function() {
		createStartingYinYangOrb([-170, -200]);
		createStartingYinYangOrb([170, -200]);
	},
	150: function() {
		createStartingYinYangOrb([-40, -190]);
		createStartingYinYangOrb([40, -190]);
	},
	180: function() {
		createStartingYinYangOrb([-215, -195]);
		createStartingYinYangOrb([215, -195]);
	},
	210: function() {
		createStartingYinYangOrb([-110, -185]);
		createStartingYinYangOrb([110, -185]);
	},
	290: function() {
		createStartingYinYangOrb([-30, -245]);
		createStartingYinYangOrb([30, -245]);
	},
	310: function() {
		createStartingYinYangOrb([-120, -245]);
		createStartingYinYangOrb([120, -245]);
	},
	340: function() {
		createStartingYinYangOrb([-185, -245]);
		createStartingYinYangOrb([185, -245]);
	},
	460: function() {
		createStartingYinYangOrb([-145, -210]);
		createStartingYinYangOrb([145, -210]);
	},
	490: function() {
		createStartingYinYangOrb([-20, -250]);
		createStartingYinYangOrb([20, -250]);
	},
	700: function() {
		document.getElementById("div_stageTitle1").style.opacity = 1;		
		document.getElementById("div_stageTitle2").style.opacity = 1;
	},
	850: function() {
		document.getElementById("div_stageTitle1").style.opacity = 0;
		document.getElementById("div_stageTitle2").style.opacity = 0;
		createAmberShard([0, -200]);
	},
	1125: function() {
		createYinYangOrbVariantB([-100, -190]);
	},
	1145: function() {
		createYinYangOrbVariantB([-160, -195]);
	},
	1160: function() {
		createYinYangOrbVariantB([-200, -205]);
	},
	1180: function() {
		createYinYangOrbVariantB([-225, -220]);
	},
	1200: function() {
		createAmberShard([160, -170]);
	},
	1330: function() {
		createYinYangOrbVariantB([-125, -230]);
	},
	1330: function() {
		createYinYangOrbVariantB([-185, -240]);
	},
	1700: function() {
		// One will always shoot 7 diamonds per wave and the other 8 diamonds per wave here (double on Lunatic).
		let orientation = ranint(0, 1);
		createAmberShard([-120, -225], orientation);
		createAmberShard([120, -225], 1 - orientation);
	},
	2280: function() {
		// The two side shards follow the same logic as in the previous wave here.
		let orientation = ranint(0, 1);
		createAmberShard([-30, -230], orientation);
		createAmberShard([30, -230], 1 - orientation);
		// The central shard always shoots 15 diamonds per wave on Lunatic as opposed to 14 or 16.
		createAmberShard([0, -180], randomReal(0.4, 0.6));
	},
	2800: function() {
		createAmberOrb([0, -215]);
	},
	3390: function() {
		createYinYangOrbVariantCWave(6, 3875);
	},
	3500: function() {
		createYinYangOrbVariantCWave(6, 3900);
	},
	3615: function() {
		createYinYangOrbVariantCWave(6, 3925);
	},
	3735: function() {
		createYinYangOrbVariantCWave(6, 3950);
	},
	3860: function() {
		createYinYangOrbVariantCWave(6, 3975);
	},
	4000: function() {
		createAmberOrb([0, -215]);
	},
	4550: function() {
		createUFO([-150, -210], "I");
	},
	4755: function() {
		createUFO([150, -210], "O");
	},
	4960: function() {
		createUFO([-180, -225], "L");
	},
	5165: function() {
		createUFO([180, -225], "Z");
	},
	5370: function() {
		createUFO([0, -220], "T");
	},
	5580: function() {
		createSuperAmberShard([0, -50]);
	},
	5875: function() {
		createBlueSpirit([0, -220]);
	},
	5905: function() {
		createBlueSpirit([-105, -160]);
	},
	5915: function() {
		createBlueSpirit([105, -140]);
		for (let spiritNum = 0; spiritNum < 20; spiritNum++) {
			scheduleUnclearableStageEvent(15 + spiritNum * 21 + ranint(0, 50), function() {
				createBlueSpirit([randomReal(-200, 200), randomReal(-270, -15)]);
			})
		}
	},
	6575: function() {
		createWitch(1);
	},
	6925: function() {
		for (let pairNum = 0; pairNum < 9; pairNum++) {
			scheduleUnclearableStageEvent(1 + pairNum * 20, function() {
				let x = 30 + (pairNum * 87.5 + 31.25) % 212.5;
				let y = -275 + pairNum * 15;
				createEye([x, y], 0.5);
				createEye([-x, y], 0.5);
			})
		}
	},
	7125: function() {
		createWitch(1);
	},
	7475: function() {
		for (let pairNum = 0; pairNum < 16; pairNum++) {
			scheduleUnclearableStageEvent(1 + pairNum * 7, function() {
				let x = 215 - pairNum * 2;
				let y = (pairNum * 112.5 + 56.25) % 600 - 300;
				createEye([x, y], 1);
				createEye([-x, y], 1);
			})
		}
	},
	7650: function() {
		let principalAngle = Math.PI * 2 * Math.random();
		for (let orientation of [-1]) {
			for (let spiritNum = 0; spiritNum < 7; spiritNum++) {
				createRedSpirit((principalAngle + Math.PI * 2 * spiritNum / 7) * orientation, orientation, 0);
			}
		}
	},
	7750: function() {
		for (let eyeNum = 0; eyeNum < 30; eyeNum++) {
			createSpecialEye(275, Math.PI * eyeNum / 15);
		}
	},
	8400: function() {
		createWitch(2);
	},
	9000: function() {
		createBoss("zenryaku");
		currentBoss.targetPosition = [0, -150];
	},
	9075: function() {
		startDialogue(0);
		showBossTitleCard("zenryaku");
	},
	// Zenryaku is very unlikely to be defeated before approximately frame 10400.
	10500: function() {
		for (let spiritNum = 0; spiritNum < 38; spiritNum++) {
			scheduleUnclearableStageEvent(Math.min(spiritNum * 50 + ranint(1, 100), 1850), function() {
				if (frame - Bosses.zenryaku.frameDefeated > 70) { // Only spawn these if Zenryaku has been defeated. These fill time until frame 12650.
					createYellowSpirit([randomReal(-200, 200), randomReal(-270, -15)]);
				}
			})
		}
		// Latest possible spawn from this loop is at frame 12545.
	},
	12625: function() {
		// Attempt to spawn a magma elemental, and if this fails (due to Zenryaku still being active), schedule more yellow spirits to avoid a 12 second idle period.
		if (Bosses.zenryaku.frameDefeated < 12600) {
			createMagmaElemental([0, -200]);
		} else {
			for (let spiritNum = 0; spiritNum < 10; spiritNum++) {
				scheduleUnclearableStageEvent(Math.min(spiritNum * 44 + ranint(1, 80), 400), function() {
					if (frame - Bosses.zenryaku.frameDefeated > 70) { // Only spawn these if Zenryaku has been defeated. These fill time until frame 12650.
						createYellowSpirit([randomReal(-200, 200), randomReal(-270, -15)]);
					}
				})
			}
		}
	},
	13220: function() {
		if (Bosses.zenryaku.frameDefeated < 13195) {
			let initialOrientation = plusMinus1();
			magmaElementalExplosiveShot([20 * initialOrientation, -350], 0, initialOrientation);
			scheduleUnclearableStageEvent(25, function() {
				magmaElementalExplosiveShot([-20 * initialOrientation, -350], 0, -initialOrientation);
			});
		}
	},
	13350: function() {
		if (Bosses.zenryaku.frameDefeated < 13325) {
			createYinYangOrbVariantCWave(4, 13650);
		}
	},
	// Latest possible Zenryaku end time is frame 13375.
	13480: function() {
		if (Bosses.zenryaku.frameDefeated < 13455) {
			createYinYangOrbVariantCWave(4, 13675);
		}
	},
	13610: function() {
		if (Bosses.zenryaku.frameDefeated < 13585) {
			createYinYangOrbVariantCWave(4, 13700);
		}
	},
	13775: function() {
		createMagmaElemental([0, -200]);
	},
	14400: function() {
		let initialOrientation = plusMinus1();
		magmaElementalExplosiveShot([60 * initialOrientation, -350], 0, initialOrientation);
		scheduleUnclearableStageEvent(25, function() {
			magmaElementalExplosiveShot([-60 * initialOrientation, -350], 0, -initialOrientation);
		});
		let interval = [19, 19, 19, 19][difficulty];
		for (let time = 1; time < 400; time += interval) {
			scheduleUnclearableStageEvent(time + ranint(0, 2), function() {
				let latencySeed = Math.random();
				for (let orientation of [-1, 1]) {
					createYinYangOrbVariantD(orientation, latencySeed);
				}
			});
		}
	},
	15000: function() {
		// If the green yin-yang orbs are mostly defeated (e.g. due to a bomb), we spawn an extra wave of yellow spirits to avoid idle time.
		let totalEnemies = Object.keys(enemies).length;
		let times = (totalEnemies === 0) ? [10, 210, 410] : (totalEnemies <= 8) ? [110, 360] : (totalEnemies <= 20) ? [310] : [];
		for (let time of times) {
			for (let spiritNum = 0; spiritNum < 4; spiritNum++) {
				scheduleUnclearableStageEvent(time + ranint(0, 40), function() {
					createYellowSpirit([125 * (spiritNum - randomReal(1.08, 1.92)), randomReal(-275, -75)]);
				})
			}
		}
	},
	15940: function() {
		let principalAngle = Math.PI * 2 * Math.random();
		for (let orientation of [-1]) {
			for (let spiritNum = 0; spiritNum < 7; spiritNum++) {
				createRedSpirit((principalAngle + Math.PI * 2 * spiritNum / 7) * orientation, orientation, 70); // These are spawned with their centre below the origin to give room for the blue and yellow spirits to spawn.
			}
		}
	},
	15950: function() {
		for (let blueSpiritNum = 0; blueSpiritNum < 15; blueSpiritNum++) {
			scheduleUnclearableStageEvent(blueSpiritNum * 55 + ranint(1, 90), function() {
				createBlueSpirit([ranint(-225, 225), ranint(-275, -100)])
			})
		}
		for (let yellowSpiritNum = 0; yellowSpiritNum < 6; yellowSpiritNum++) {
			scheduleUnclearableStageEvent(yellowSpiritNum * 136 + ranint(1, 90), function() {
				createYellowSpirit([ranint(-225, 225), ranint(-275, -100)])
			})
		}
	},
	16925: function() {
		createSuperMagmaElemental();
	},
	18300: function() {
		beginCutscene();
	},
	18375: function() {
		startDialogue(2);
	}
}