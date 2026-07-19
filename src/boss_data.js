import { playAudio, playBGM, playSingleAudio } from "./audio.js";
import { hsltohex } from "./color_converter.js";
import { angleToObject, angleToPlayer, bearingToAngle, beginCutscene, bombIsActive, bullets, continuesLeft, createBoss, createBullet, createEnemy, currentBoss, difficulty, endCutscene, endGame, enemies, enemyCounter, frame, isInCutscene, playerBullets, playerPosition, radialCollisionCheck, rectangularCollisionCheck, skipPhases } from "./game.js"
import { openEnding, openMenuWindow } from "./menu.js";
import { processVirtueGain } from "./persistent_data.js";
import { scheduleStageEvent, scheduleUnclearableStageEvent } from "./stage_events.js";
import { addVectors, clampNumber, clampVector, countTo, modulo, multiplyVectors, numberIsBounded, plusMinus1, polarToCartesian, randomCartesianVector, randomPolarVector, randomReal, ranint, rotateVector, shuffleArray, squaredDistance } from "./utility.js";
import { amberShardRenderFunction, arrowBulletRenderFunction, blackHoleRenderFunction, circularRenderFunction, drawImage, memoryShardRenderFunction } from "./visuals.js";

export const Bosses = {
	zenryaku: {
		name: "Zenryaku",
		title: "Eye Spy of a Mouldy Fry",
		color: "#ff0000",
		darkColor: "#800000",
		hasPreBossDialogue: false,
		phases: 4,
		autocollectAtStart: true,
		autocollectAtEnd: false,
		renderFunction: function(position) {
			drawImage("assets/img/zenryaku.png", position[0], position[1] + 15 * Math.sin(0.025 * frame), 0, 0.25);
		},
		collisionCheckFunction: rectangularCollisionCheck(150, 125),
		frameDefeated: 99999, // Set this to something else at time of defeat. Used for post-midboss enemy waves.
		attacks: {
			N1: {
				HP: 1050,
				guaranteedScore: 100000,
				dropList: {point: 6, power: 6},
				maxFrames: 1000,
				randomSeed: Math.random(),
				behaviourFunction: function(t) {
					// Creates lasers that reflect off the sides of the screen.
					let shotInterval = [17, 11, 12, 14][difficulty];
					if ((t - 40) % shotInterval === 1) {
						playAudio("se_kira00", 0.3);
						let angularSpeed = [0.17, 0.125, 0.11, 0.1][difficulty];
						let bulletsPerAngle = [11, 11, 10, 9][difficulty];
						let numberOfAngles = [2, 2, 3, 5][difficulty];
						let bulletMinSpeed = [3.5, 4.5, 5.5, 7][difficulty];
						let bulletMaxSpeed = [5, 6, 7, 9][difficulty];
						let primaryAngle = angularSpeed * (this.randomSeed + (t - 40) / shotInterval) - Math.PI / 2;
						for (let angleNum = 0; angleNum < numberOfAngles; angleNum++) {
							let angle = primaryAngle + Math.PI * 2 * angleNum / numberOfAngles;
							for (let bulletNum = 0; bulletNum < bulletsPerAngle; bulletNum++) {
								let speed = bulletMinSpeed + (bulletMaxSpeed - bulletMinSpeed) * bulletNum / (bulletsPerAngle - 1);
								let vx = speed * Math.cos(angle);
								let vy = speed * Math.sin(angle);
								createBullet(addVectors(enemies[currentBoss.enemyId].position, polarToCartesian(20, angle)), function(t) {
									this.position[0] += vx;
									this.position[1] += vy;
									if ((Math.abs(this.position[0]) > 250) && this.canReflect) {
										this.position[0] = Math.sign(this.position[0]) * (500 - Math.abs(this.position[0]));
										vx *= -1;
										this.angle = Math.atan2(vy, vx);
										this.canReflect = false;
									}
									if ((Math.abs(this.position[1]) > 300) && this.canReflect) {
										this.position[1] = Math.sign(this.position[1]) * (600 - Math.abs(this.position[1]));
										vy *= -1;
										this.angle = Math.atan2(vy, vx);
										this.canReflect = false;
									}
								}, arrowBulletRenderFunction("#ff0000", 4), radialCollisionCheck(4), 260, 310, {angle: angle, canReflect: true});
							}
						}
					}
				},
			},
			S2: {
				name: "Legacy \"Pseudo-Random Quiz\"",
				HP: 975,
				guaranteedScore: 100000,
				captureScore: 1000000,
				dropList: {power: 30, point: 30, bombpiece: 1},
				maxFrames: 1000,
				currentSmallColour: 0,
				outerColors: ["#990000", "#999900", "#009999", "#000099", "#009900", "#990099"],
				innerColors: ["#ff0000", "#ffff00", "#00ffff", "#0000ff", "#00cc00", "#cc00cc"],
				behaviourFunction: function(t) {
					if (t % 110 === 35) {
						currentBoss.targetPosition = addVectors(currentBoss.targetPosition, randomPolarVector(30, 40));
						currentBoss.targetPosition = clampVector(currentBoss.targetPosition, -150, 150, -225, -100);
					}
					// Creates waves of circular bullets in four to six colours. At any given point, the bullets of one colour are hidden while the others are visible. These reset every few seconds.
					// The colours are: red (0), yellow (1), cyan (2), blue (3), green (4), magenta (5).
					// Use 4 colours on Easy and Normal, 5 on Hard and 6 on Lunatic.
					let totalColours = [4, 4, 5, 6][difficulty];
					let shotInterval = [96, 80, 70, 64][difficulty];
					if ((t - 100) % shotInterval === 1) { // Creates the bullet waves.
						playAudio("se_tan00", 0.4);
						let waveSize = [52, 56, 65, 72][difficulty];
						let waveSpeed = [1.7, 2, 2.2, 2.3][difficulty];
						let principalAngle = Math.PI * 2 * Math.random();
						let colourOrientation = shuffleArray(countTo(totalColours, true));
						for (let bulletNum = 0; bulletNum < waveSize; bulletNum++) {
							let angle = principalAngle + Math.PI * 2 * bulletNum / waveSize;
							let v = polarToCartesian(waveSpeed, angle);
							let colour = colourOrientation[bulletNum % totalColours];
							createBullet(addVectors(enemies[currentBoss.enemyId].position, polarToCartesian(24, angle)), function() {
								this.position = addVectors(this.position, v);
							}, circularRenderFunction((colour === this.currentSmallColour) ? 0 : 20, this.outerColors[colour], this.innerColors[colour]), radialCollisionCheck((colour === this.currentSmallColour) ? 0 : 20), 270, 320, {colour: colour});
						}
					}
					if ((t - 100) % 50 === 1) { // Plays chimes to indicate the timing of the next change.
						playAudio("se_lgods1");
					} else if ((t - 100) % 25 === 1) {
						playAudio("se_lgods2");
					}
					if ((t - 100) % 100 === 1) { // Changes bullets.
						playAudio("se_kira00", 0.75);
						let newColour = (this.currentSmallColour += ranint(1, totalColours - 1)) % totalColours;
						this.currentSmallColour = newColour;
						let bulletIds = Object.keys(bullets);
						for (let bulletId of bulletIds) {
							bullets[bulletId].renderFunction = circularRenderFunction((bullets[bulletId].colour === this.currentSmallColour) ? 0 : 20, this.outerColors[bullets[bulletId].colour], this.innerColors[bullets[bulletId].colour]);
							bullets[bulletId].collisionCheckFunction = radialCollisionCheck((bullets[bulletId].colour === this.currentSmallColour) ? 0 : 20);
						}
					}
				}
			},
			S3: {
				name: "Memento \"Letter Nations\"",
				HP: 800,
				guaranteedScore: 100000,
				captureScore: 1000000,
				dropList: {power: 30, point: 30, bombpiece: 1},
				maxFrames: 1000,
				letters: [
					/* A */ [[-1, 1], [-0.875, 0.75], [-0.75, 0.5], [-0.625, 0.25], [-0.5, 0], [-0.375, -0.25], [-0.25, -0.5], [-0.125, -0.75], [0, -1], [0.125, -0.75], [0.25, -0.5], [0.375, -0.25], [0.5, 0], [0.625, 0.25], [0.75, 0.5], [0.875, 0.75], [1, 1], [-0.25, 0], [0, 0], [0.25, 0]],
					/* B */ [[-0.75, -1], [-0.75, -0.75], [-0.75, -0.5], [-0.75, -0.25], [-0.75, 0], [-0.75, 0.25], [-0.75, 0.5], [-0.75, 0.75], [-0.75, 1], [-0.5, -1], [-0.25, -1], [0, -1], ...countTo(7, true).map(i => addVectors([0.25, -0.5], polarToCartesian(0.5, Math.PI * (i - 3) / 6))), [0, 0], [-0.25, 0], [-0.5, 0], ...countTo(6, true).map(i => addVectors([0.25, 0.5], polarToCartesian(0.5, Math.PI * (i - 2) / 6))), [-0, 1], [-0.25, 1], [-0.5, 1]],
					/* C */ countTo(19, true).map(i => polarToCartesian(1, Math.PI * (21 - i) / 12)),
					/* D */ [[-1, -1], [-1, -0.75], [-1, -0.5], [-1, -0.25], [-1, 0], [-1, 0.25], [-1, 0.5], [-1, 0.75], [-1, 1], [-0.75, -1], [-0.5, -1], [-0.25, -1], ...countTo(13, true).map(i => polarToCartesian(1, Math.PI * (i - 6) / 12)), [-0.25, 1], [-0.5, 1], [-0.75, 1]],
					/* E */ [[1, -1], [0.75, -1], [0.5, -1], [0.25, -1], [0, -1], [-0.25, -1], [-0.5, -1], [-0.75, -1], [-1, -1], [-1, -0.75], [-1, -0.5], [-1, -0.25], [-1, 0], [-1, 0.25], [-1, 0.5], [-1, 0.75], [-1, 1], [-0.75, 1], [-0.5, 1], [-0.25, 1], [0, 1], [0.25, 1], [0.5, 1], [0.75, 1], [1, 1], [-0.75, 0], [-0.5, 0], [-0.25, 0], [0, 0]],
					/* F */ [[1, -1], [0.75, -1], [0.5, -1], [0.25, -1], [0, -1], [-0.25, -1], [-0.5, -1], [-0.75, -1], [-1, -1], [-1, -0.75], [-1, -0.5], [-1, -0.25], [-1, 0], [-1, 0.25], [-1, 0.5], [-1, 0.75], [-1, 1], [-0.75, 0], [-0.5, 0], [-0.25, 0], [0, 0]],
					/* G */ [...countTo(22, true).map(i => polarToCartesian(1, Math.PI * -(i + 3) / 12)), [0.75, 0], [0.5, 0], [0.25, 0], [0, 0]],
					/* H */ [[-1, -1], [-1, -0.75], [-1, -0.5], [-1, -0.25], [-1, 0], [-1, 0.25], [-1, 0.5], [-1, 0.75], [-1, 1], [-0.75, 0], [-0.5, 0], [-0.25, 0], [0, 0], [0.25, 0], [0.5, 0], [0.75, 0], [1, 0], [1, -1], [1, -0.75], [1, -0.5], [1, -0.25], [1, 0.25], [1, 0.5], [1, 0.75], [1, 1]],
					/* I */ [[-0.5, -1], [-0.25, -1], [0, -1], [0.25, -1], [0.5, -1], [0, -0.75], [0, -0.5], [0, -0.25], [0, 0], [0, 0.25], [0, 0.5], [0, 0.75], [0, 1], [-0.5, 1], [-0.25, 1], [0.25, 1], [0.5, 1]],
					/* J */ [[-1, 1], [-0.75, -1], [-0.5, -1], [-0.25, -1], [0, -1], [0.25, -1], [0.5, -1], [0.75, -1], [1, -1], [0, -0.75], [0, -0.5], [0, -0.25], ...countTo(6, true).map(i => addVectors([-1, 0], polarToCartesian(1, Math.PI * i / 12)))],
					/* K */ [[-0.75, -1], [-0.75, -0.75], [-0.75, -0.5], [-0.75, -0.25], [-0.75, 0], [-0.75, 0.25], [-0.75, 0.5], [-0.75, 0.75], [-0.75, 1], [0.75, -1], [0.5, -5/6], [0.25, -2/3], [0, -0.5], [-0.25, -1/3], [-0.5, -1/6], [-0.5, 1/6], [-0.25, 1/3], [0, 0.5], [0.25, 2/3], [0.5, 5/6], [0.75, 1]],
					/* L */ [[-1, -1], [-1, -0.75], [-1, -0.5], [-1, -0.25], [-1, 0], [-1, 0.25], [-1, 0.5], [-1, 0.75], [-1, 1], [-0.75, 1], [-0.5, 1], [-0.25, 1], [0, 1], [0.25, 1], [0.5, 1], [0.75, 1], [1, 1]],
					/* M */ [[-1, 1], [-1, 0.75], [-1, 0.5], [-1, 0.25], [-1, 0], [-1, -0.25], [-1, -0.5], [-1, -0.75], [-1, -1], [-0.75, -0.75], [-0.5, -0.5], [-0.25, -0.25], [0, 0], [0.25, -0.25], [0.5, -0.5], [0.75, -0.75], [1, -1], [1, -0.75], [1, -0.5], [1, -0.25], [1, 0], [1, 0.25], [1, 0.5], [1, 0.75], [1, 1]],
					/* N */ [[-1, 1], [-1, 0.75], [-1, 0.5], [-1, 0.25], [-1, 0], [-1, -0.25], [-1, -0.5], [-1, -0.75], [-1, -1], [-0.75, -0.75], [-0.5, -0.5], [-0.25, -0.25], [0, 0], [0.25, 0.25], [0.5, 0.5], [0.75, 0.75], [1, 1], [1, 0.75], [1, 0.5], [1, 0.25], [1, 0], [1, -0.25], [1, -0.5], [1, -0.75], [1, -1]],
					/* O */ countTo(24, true).map(i => polarToCartesian(1, Math.PI * i / 12)),
					/* P */ [[-0.75, -1], [-0.75, -0.75], [-0.75, -0.5], [-0.75, -0.25], [-0.75, 0], [-0.75, 0.25], [-0.75, 0.5], [-0.75, 0.75], [-0.75, 1], [-0.5, -1], [-0.25, -1], [0, -1], ...countTo(7, true).map(i => addVectors([0.25, -0.5], polarToCartesian(0.5, Math.PI * (i - 3) / 6))), [0, 0], [-0.25, 0], [-0.5, 0]],
					/* Q */ [...countTo(24, true).map(i => polarToCartesian(1, Math.PI * i / 12)), [0.25, 0.25], [0.5, 0.5], [0.75, 0.75], [1, 1]],
					/* R */ [[-0.75, -1], [-0.75, -0.75], [-0.75, -0.5], [-0.75, -0.25], [-0.75, 0], [-0.75, 0.25], [-0.75, 0.5], [-0.75, 0.75], [-0.75, 1], [-0.5, -1], [-0.25, -1], [0, -1], ...countTo(7, true).map(i => addVectors([0.25, -0.5], polarToCartesian(0.5, Math.PI * (i - 3) / 6))), [0, 0], [-0.25, 0], [-0.5, 0], [0.375, 0.25], [0.5, 0.5], [0.625, 0.75], [0.75, 1]],
					/* T */ [[-1, -1], [-0.75, -1], [-0.5, -1], [-0.25, -1], [0, -1], [0.25, -1], [0.5, -1], [0.75, -1], [1, -1],  [0, -0.75], [0, -0.5], [0, -0.25], [0, 0], [0, 0.25], [0, 0.5], [0, 0.75], [0, 1]],
					/* U */ [[-1, -1], [-1, -0.75], [-1, -0.5], [-1, -0.25], ...countTo(13, true).map(i => polarToCartesian(1, Math.PI * (1 - i / 12))), [1, -0.25], [1, -0.5], [1, -0.75], [1, -1]],
					/* V */ [[-1, -1], [-0.875, -0.75], [-0.75, -0.5], [-0.625, -0.25], [-0.5, 0], [-0.375, 0.25], [-0.25, 0.5], [-0.125, 0.75], [0, 1], [0.125, 0.75], [0.25, 0.5], [0.375, 0.25], [0.5, 0], [0.625, -0.25], [0.75, -0.5], [0.875, -0.75], [1, -1]],
					/* W */ [[-1, -1], [-11/12, -0.75], [-5/6, -0.5], [-3/4, -0.25], [-2/3, 0], [-7/12, 0.25], [-0.5, 0.5], [-5/12, 0.75], [-1/3, 1], [-0.25, 0.75], [-1/6, 0.5], [-1/12, 0.25], [0, 0], [1/12, 0.25], [1/6, 0.5], [0.25, 0.75], [1/3, 1], [5/12, 0.75], [0.5, 0.5], [7/12, 0.25], [2/3, 0], [0.75, -0.25], [5/6, -0.5], [11/12, -0.75], [1, -1]],
					/* X */ [[-1, -1], [-0.75, -0.75], [-0.5, -0.5], [-0.25, -0.25], [0, 0], [0.25, 0.25], [0.5, 0.5], [0.75, 0.75], [1, 1], [1, -1], [0.75, -0.75], [0.5, -0.5], [0.25, -0.25], [-0.25, 0.25], [-0.5, 0.5], [-0.75, 0.75], [-1, 1]],
					/* Y */ [[-1, -1], [-0.75, -0.75], [-0.5, -0.5], [-0.25, -0.25], [0, 0], [0.25, -0.25], [0.5, -0.5], [0.75, -0.75], [1, -1], [0, 0.25], [0, 0.5], [0, 0.75], [0, 1]],
					/* Z */ [[-1, -1], [-0.75, -1], [-0.5, -1], [-0.25, -1], [0, -1], [0.25, -1], [0.5, -1], [0.75, -1], [1, -1], [0.75, -0.75], [0.5, -0.5], [0.25, -0.25], [0, 0], [-0.25, 0.25], [-0.5, 0.5], [-0.75, 0.75], [-1, 1], [-0.75, 1], [-0.5, 1], [-0.25, 1], [0, 1], [0.25, 1], [0.5, 1], [0.75, 1], [1, 1]]
				],
				behaviourFunction: function(t) {
					if (t % 60 === 15) {
						currentBoss.targetPosition = addVectors(currentBoss.targetPosition, randomPolarVector(10, 20));
						currentBoss.targetPosition = clampVector(currentBoss.targetPosition, -150, 150, -225, -100);
					}
					// Creates Latin letters which rain down the screen.
					let shotTimes = [
						[20, 27, 28, 32, 33, 37],
						[20, 27, 31, 36, 42, 47],
						[20, 23, 26, 29, 32, 35, 38],
						[20, 24, 25, 29, 32, 33, 34, 38]
					][difficulty]
					let shotInterval = [60, 55, 52, 50][difficulty]
					if (shotTimes.includes((t - 90) % shotInterval)) {
						playAudio("se_kira00", 0.2);
						let letter = this.letters[ranint(0, this.letters.length - 1)];
						let letterPosition = [randomReal(-242, 242), randomReal(-292, -208)];
						let fallTime = ranint(30, 50);
						let letterMinSpeed = [3.5, 4.5, 5.5, 7][difficulty];
						let letterMaxSpeed = [4.5, 6, 7.5, 10][difficulty];
						let letterSpeed = randomReal(letterMinSpeed, letterMaxSpeed);
						let letterHSL = [randomReal(0, 360), randomReal(90, 100), randomReal(25, 75)];
						let letterColor = hsltohex(letterHSL[0], letterHSL[1], letterHSL[2]);
						let letterDarkColor = hsltohex(letterHSL[0], letterHSL[1], letterHSL[2] - 25);
						let letterSize = randomReal([24, 24, 24, 28][difficulty], [24, 32, 36, 36][difficulty]);
						for (let time = 1; time <= letter.length; time++) {
							scheduleStageEvent(time, function() {
								for (let bulletNum = time; bulletNum <= Math.min(time, letter.length); bulletNum++) {
									createBullet(addVectors(letterPosition, multiplyVectors(letter[bulletNum - 1], letterSize)), function(t) {
										if (t > (fallTime - time)) { // The whole letter should fall at the same time, so account for the different spawn times of the bullets.
											this.position[1] += letterSpeed;
										}
									}, circularRenderFunction(5, letterDarkColor, letterColor), radialCollisionCheck(5), 260, 330);
								}
							})
						}
					}
				}
			},
			S4: {
				name: "Enigma \"Wave-Particle Tsunami\"",
				HP: 875,
				guaranteedScore: 100000,
				captureScore: 1000000,
				dropList: {power: 30, point: 30, extend: 1},
				maxFrames: 1000,
				onDefeat: function() {
					Bosses.zenryaku.frameDefeated = frame; // Store the frame at which Zenryaku was defeated. Used for time-filling waves before the volcano section properly begins.
				},
				behaviourFunction: function(t) {
					if (t === 0) {
						currentBoss.targetPosition = clampVector(currentBoss.targetPosition, -25, 25, -175, -125);
					}
					// Creates alternating horizontal and vertical water waves, and falling raindrops in the same orientations.
					let waveInterval = [135, 115, 102, 96][difficulty];
					if ((t - 60) % waveInterval === 1) {
						playAudio("se_kira00", 1);
						let waveOrientation = ((t - 60) % (waveInterval * 2) < waveInterval) ? 0 : 1; // 0 = horizontal, 1 = vertical
						let wavePhase = Math.PI * 2 * Math.random();
						let wavePeriod = [140, 125, 115, 110][difficulty];
						let safeZoneWidth = [160, 152, 144, 135][difficulty];
						let waveAmplitude = [105, 111, 118, 125][difficulty];
						let dropsPerSide = [3, 7, 15, 25][difficulty];
						// Parallel and perpendicular here are relative to the sides the wave is being created at.
						let dropParallelMinSpeed = [0, 0, 0, 0][difficulty];
						let dropParallelMaxSpeed = [0.2, 0.4, 0.8, 1.2][difficulty];
						let dropPerpendicularMinSpeed = [0.3, 0.4, 0.5, 0.6][difficulty];
						let dropPerpendicularMaxSpeed = [0.9, 1.2, 1.5, 1.8][difficulty];
						if (waveOrientation === 0) {
							// At the start of each pair of vertical waves, move to be horizontally at the safe position for a random y between 100 and 200.
							currentBoss.targetPosition[0] = waveAmplitude * Math.sin(wavePhase + randomReal(0.75, 1.5));
							currentBoss.targetPosition[1] = clampNumber(currentBoss.targetPosition[1] + randomReal(-30, 30), -225, -75);
							for (let y = -315; y <= 315; y += 6) {
								let safeX = waveAmplitude * Math.sin(wavePhase + 0.0075 * y);
								for (let side of [-1, 1]) {
									let initialX = 310 * side;
									let finalX = safeX + safeZoneWidth * side;
									let amplitudeMultiplier = Math.sin(modulo(y * 0.618 * 1.57 / 6, 1.57)); // This creates more values close to 1 where the boundaries of the wave are actually visible.
									createBullet([310 * side, y], function(t) {
										let scaledT = t / wavePeriod;
										this.position[0] = initialX + (finalX - initialX) * scaledT * (2 - scaledT) * amplitudeMultiplier;
										if (scaledT > 2) {
											this.position[0] = 1000;
										}
									}, circularRenderFunction(50, "#00cccc", "#00cccc", 1), radialCollisionCheck(50), 500, 500);
								}
							}
							for (let dropNum = 0; dropNum < dropsPerSide * 2; dropNum++) {
								let side = plusMinus1();
								let vx = randomReal(dropPerpendicularMinSpeed, dropPerpendicularMaxSpeed) * side;
								let vy = randomReal(dropParallelMinSpeed, dropParallelMaxSpeed);
								createBullet([300 * -side, randomReal(-300, 300)], function() {
									this.position[0] += vx;
									vy += 0.002;
									this.position[1] += vy;
								}, circularRenderFunction(4, "#00cccc", "#00cccc", 1), radialCollisionCheck(4))
							}
						} else {
							// At the start of each pair of vertical waves, move randomly.
							currentBoss.targetPosition = addVectors(currentBoss.targetPosition, randomPolarVector(30, 40));	
							for (let x = -265; x <= 265; x += 6) {
								let safeY = waveAmplitude * Math.sin(wavePhase + 0.0075 * x) + 100;
								for (let side of [-1, 1]) {
									let initialY = 360 * side;
									let finalY = safeY + safeZoneWidth * side;
									let amplitudeMultiplier = Math.sin(modulo(x * 0.618 * 1.57 / 6, 1.57)); // This creates more values close to 1 where the boundaries of the wave are actually visible.
									createBullet([x, 360 * side], function(t) {
										let scaledT = t / wavePeriod;
										this.position[1] = initialY + (finalY - initialY) * scaledT * (2 - scaledT) * amplitudeMultiplier;
										if (scaledT > 2) {
											this.position[1] = 1000;
										}
									}, circularRenderFunction(50, "#00cccc", "#00cccc", 1), radialCollisionCheck(50), 500, 500);
								}
							}
							for (let dropNum = 0; dropNum < dropsPerSide; dropNum++) {
								let vx = randomReal(-dropParallelMinSpeed, dropParallelMaxSpeed);
								let vy = randomReal(dropPerpendicularMinSpeed, dropPerpendicularMaxSpeed);
								createBullet([randomReal(-250, 250), -315], function() {
									this.position[0] += vx;
									vy += 0.002;
									this.position[1] += vy;
								}, circularRenderFunction(4, "#00cccc", "#00cccc", 1), radialCollisionCheck(4))
							}
						}
					}
				}
			}
		}
	},
	lexan: {
		name: "Lexan",
		title: "Administrative Celestial of Decadence and Disarray",
		color: "#0000ff",
		darkColor: "#000080",
		hasPreBossDialogue: false,
		phases: 10,
		autocollectAtStart: true,
		autocollectAtEnd: true,
		renderFunction: function(position) {
			drawImage("assets/img/lexan.png", position[0], position[1] + 15 * Math.sin(0.025 * frame), 0, 0.25);
		},
		collisionCheckFunction: rectangularCollisionCheck(150, 125),
		isDefeated: false, // We use this for the virtue progress multiplier (so it doesn't think we are in a stage section if the stage is cleared).
		attacks: {
			N1: {
				HP: 1000,
				guaranteedScore: 250000,
				dropList: {point: 6, power: 6},
				maxFrames: 1500,
				behaviourFunction: function(t) {
					// A simple, basic nonspell 1.
					let shotInterval = [150, 130, 110, 90][difficulty];
					let spawnerRingSize = [18, 26, 36, 50][difficulty];
					let spawnerSpeed = [1.8, 2, 2.5, 3][difficulty];
					let seekerRingSize = [12, 16, 20, 24][difficulty];
					let seekerSpeed = [1.4, 1.5, 1.75, 2][difficulty];
					let seekerAdjacencyInterval = [1, 1, 1, 1][difficulty];
					let moveTime = Math.ceil((70 / spawnerSpeed) ** 0.8) + 1; // Time this to be at the same time as the arrow ring splitting.
					if ((t - 80) % shotInterval === 1) {
						lexanNonspell(enemies[currentBoss.enemyId].position, spawnerRingSize, spawnerSpeed, 100, seekerRingSize, seekerSpeed, seekerAdjacencyInterval);
					} else if ((t - 80) % shotInterval === moveTime) {
						currentBoss.targetPosition = addVectors(currentBoss.targetPosition, randomPolarVector(20, 40));
						currentBoss.targetPosition = clampVector(currentBoss.targetPosition, -75, 75, -175, -75);
					}
				}
			},
			S1: {
				name: "Unity Sign \"Ministry of Anarchy\"",
				HP: 1800,
				guaranteedScore: 250000,
				captureScore: 1500000,
				dropList: {power: 30, point: 30, lifepiece: 1},
				maxFrames: 2250,
				nextFloor: undefined,
				initialBulletLocations: [],
				towerBulletsSpawned: 0, // The number of tower bullets already spawned.
				towerFormationInProgress: false, // Used so that multiple towers are not instantiated simultaneously while there are less than 100 bullets.
				behaviourFunction: function(t) {
					// Creates a vertical tower of bullets at the player's horizontal position, starting at the bottom of the screen and continuing to y = -450 (25% of a screen above the top of the screen).
					// Upon the last bullet being spawned, the tower collapses and its bullets fly off into random downward-facing directions.
					let horizontalWidth = [80, 100, 120, 140][difficulty]; // The total width of the tower.
					let horizontalDensity = [1, 2, 3, 4][difficulty]; // Determines the number of bullets spawned at each vertical level.
					let verticalDensity = [18, 18, 18, 18][difficulty]; // The distance between adjacent vertical levels.
					let bulletSpeed = [0.9, 1, 1.2, 1.5][difficulty];
					let bulletInterval = [2.4, 2, 1.7, 1.4][difficulty]; // The time that must pass before adjacent vertical levels are spawned in.
					if (t === 1) {
						currentBoss.targetPosition = [0, -220];
					} else if (t % 300 === 1) {
						currentBoss.targetPosition = addVectors(currentBoss.targetPosition, randomCartesianVector(60, 40));
						currentBoss.targetPosition = clampVector(currentBoss.targetPosition, -150, 150, -250, -200);
					}
					if ((t > 55) && (Object.keys(bullets).length <= [20, 40, 80, 120][difficulty]) && (!this.towerFormationInProgress)) {
						playAudio("se_ch02");
						this.nextFloor = t + 30;
						scheduleStageEvent(35, function() {
							playAudio("se_kira00");
							Bosses.lexan.attacks.S1.initialBulletLocations = [];
							Bosses.lexan.attacks.S1.towerBulletsSpawned = 0;
							let horizontalCentre = clampNumber(horizontalWidth / 2 - 240, playerPosition[0], 240 - horizontalWidth / 2);
							let towerPhase = Math.random() * horizontalWidth * 2;
							for (let y = 320; -700 < y; y -= verticalDensity) {
								let offsets = [];
								for (let bulletNum = 0; bulletNum < horizontalDensity; bulletNum++) {
									let nextOffset = (horizontalWidth * 2 * bulletNum / horizontalDensity + towerPhase) % (horizontalWidth * 2);
									offsets.push(Math.min(nextOffset, horizontalWidth * 2 - nextOffset) - horizontalWidth / 2);
								}
								towerPhase += verticalDensity;
								offsets.push(horizontalWidth / 2, -horizontalWidth / 2);
								for (let offset of offsets) {
									Bosses.lexan.attacks.S1.initialBulletLocations.push([horizontalCentre + offset, y]);
								}
							}
						});
						this.towerFormationInProgress = true;
					}
					while ((this.towerBulletsSpawned !== this.initialBulletLocations.length) && (t > this.nextFloor)) {
						let speed = bulletSpeed * randomReal(0.8, 1.2);
						let angle = bearingToAngle(randomReal(105, 255));
						let v = polarToCartesian(speed, angle);
						if (frame % 6 === 0) {
							playSingleAudio("se_kira00", "ministry" + frame, 0.2);
						}
						createBullet(this.initialBulletLocations[this.towerBulletsSpawned], function(t) {
							if (!this.indestructible) { // Bullets are indestructible before the tower collapses.
								this.speedMult = this.speedMult * 0.98 + 0.02;
								this.position = addVectors(this.position, multiplyVectors(v, this.speedMult));
								v[1] += 0.005;
								// Reflect at the sides of the screen.
								if (Math.abs(this.position[0]) > 250) {
									v[0] *= -1;
									this.position[0] = Math.sign(this.position[0]) * (500 - Math.abs(this.position[0]));
								}
								// Despawn at bottom of screen (but not top).
								if (this.position[1] > 320) {
									this.position[0] = 1000;
								}
							}
						}, circularRenderFunction(8, "#663300", "#996600"), radialCollisionCheck(8), 300, 1000, {indestructible: true, speedMult: 0});
						let heightReached = this.initialBulletLocations[this.towerBulletsSpawned][1];
						this.nextFloor += bulletInterval * Math.exp(0.0015 * Math.min(heightReached - 300, heightReached * 2)); // Once the tower reaches above the screen, artificially make it rise faster to reduce idle time.
						this.towerBulletsSpawned++;
						if (this.towerBulletsSpawned === this.initialBulletLocations.length) { // Not the same as the previous check as `towerBulletsSpawned` has incremented.
							playAudio("se_don00");
							for (let bulletId of Object.keys(bullets)) {
								bullets[bulletId].indestructible = false;
							}
							this.towerFormationInProgress = false;
						}
					}
				}
			},
/*			N2: {
				HP: 1200,
				guaranteedScore: 250000,
				dropList: {point: 6, power: 6},
				maxFrames: 1750,
				initialPhase: undefined,
				behaviourFunction: function(t) {
					// Identical to nonspell 1, but the spawner ring is now split into 2, and the 2 groups of arrows are shot with a delay.
					let shotInterval = [150, 130, 110, 90][difficulty];
					let spawnerRingSize = [18, 26, 36, 50][difficulty];
					let spawnerSpeed = [1.8, 2, 2.5, 3][difficulty];
					let seekerRingSize = [12, 16, 20, 24][difficulty];
					let seekerSpeed = [1.4, 1.5, 1.75, 2][difficulty];
					let seekerAdjacencyInterval = [1, 1, 1, 1][difficulty];
					let shotDelay = [10, 10, 15, 20][difficulty];
					let moveTime = Math.ceil((70 / spawnerSpeed) ** 0.8) + shotDelay + 1; // Time this to be at the same time as the second arrow ring splitting.
					if ((t - 80) % shotInterval === 1) {
						this.initialPhase = Math.PI * 2 * Math.random();
						lexanNonspell(enemies[currentBoss.enemyId].position, spawnerRingSize / 2, spawnerSpeed, 100, seekerRingSize, seekerSpeed, seekerAdjacencyInterval, this.initialPhase);
					} else if ((t - 80) % shotInterval === shotDelay + 1) {
						lexanNonspell(enemies[currentBoss.enemyId].position, spawnerRingSize / 2, spawnerSpeed, 100, seekerRingSize, seekerSpeed, seekerAdjacencyInterval, this.initialPhase + Math.PI * 2 / spawnerRingSize);
					} else if ((t - 80) % shotInterval === moveTime) {
						currentBoss.targetPosition = addVectors(currentBoss.targetPosition, randomPolarVector(20, 40));
						currentBoss.targetPosition = clampVector(currentBoss.targetPosition, -200, 200, -200, -100);
					}
				}
			}, */
			N2: {
				HP: 1200,
				guaranteedScore: 250000,
				dropList: {point: 6, power: 6},
				maxFrames: 1750,
				initialPhase: undefined,
				behaviourFunction: function(t) {
					if (t === 1) {
						currentBoss.targetPosition = [0, -150];
					}
					// Shoots 3 or 4 rings of arrows which split at different radii. All 3 rings are shot in roughly the same direction.
					let shotInterval = [170, 150, 135, 125][difficulty];
					let spawnerRingSize = [16, 20, 28, 40][difficulty];
					let spawnerSpeed = [1.8, 2, 2.5, 3][difficulty];
					let seekerRingSize = [14, 16, 18, 22][difficulty];
					let seekerSpeed = [1.4, 1.5, 1.75, 2][difficulty];
					let seekerAdjacencyInterval = [2, 2, 2, 2][difficulty];
					let totalShots = [3, 3, 4, 4][difficulty];
					let shotDelay = [4, 4, 4, 4][difficulty];
					let moveTime = Math.ceil((190 / spawnerSpeed) ** 0.8) + shotDelay * (totalShots - 1) + 1; // Time this to be at the same time as the second arrow ring splitting.
					if ((t - 80) % shotInterval === 1) {
						this.initialPhase = Math.PI * 2 * Math.random();
					}
					for (let shotNum = 0; shotNum < totalShots; shotNum++) {
						if ((t - 80) % shotInterval === (shotDelay * shotNum + 1)) {
							let maxDeflection = [0.1, 0.08, 0.06, 0.04][difficulty];
							lexanNonspell(enemies[currentBoss.enemyId].position, spawnerRingSize, spawnerSpeed, 75 + shotNum * 37.5, seekerRingSize, seekerSpeed, seekerAdjacencyInterval, this.initialPhase + randomReal(-maxDeflection, maxDeflection));
						}
					}
					if ((t - 80) % shotInterval === moveTime) {
						currentBoss.targetPosition = addVectors(currentBoss.targetPosition, randomPolarVector(20, 40));
						currentBoss.targetPosition = clampVector(currentBoss.targetPosition, -100, 100, -200, -100);
					}
				}
			},
			S2: {
				name: "Ink Sign \"Plasma of the Galaxy of Origin\"",
				HP: 1200,
				guaranteedScore: 250000,
				captureScore: 1500000,
				dropList: {power: 30, point: 30, lifepiece: 1},
				maxFrames: 2250,
				createPlasmaBullet: function(currentPosition, targetPosition) {
					// Bullets first travel outward, away from Lexan, then are rapidly redirected to the player before homing.
					createBullet(addVectors(currentPosition, addVectors(polarToCartesian(30, angleToObject(currentPosition, targetPosition)))), function(t) {
						if (t === 50) {
							this.velocity = [(playerPosition[0] - this.position[0]) / 80, (playerPosition[1] - this.position[1]) / 80];
						}
						let maxSpeed = [0.75, 0.9, 1.1, 1.35][difficulty];
						let angle = angleToPlayer(this.position);
						this.velocity = addVectors(multiplyVectors(this.velocity, 0.98), polarToCartesian(maxSpeed * clampNumber(0, t / 200 - 0.25, 1) * 0.02, angle));
						this.position = addVectors(this.position, this.velocity);
					}, circularRenderFunction(6, "#333377", "#111155"), radialCollisionCheck(6), 1000, 1000, {velocity: [(targetPosition[0] - currentPosition[0]) / 50, (targetPosition[1] - currentPosition[1]) / 50]});
				},
				behaviourFunction: function(t) {
					// Creates plasma bullets which fly out to target positions, then start homing into the player at fixed speeds.
					// Alternating rings of shots are fired with single and double the base amount of bullets.
					// The radii of these rings are the largest possible such that every bullet is still in the screen when it starts homing.
					// Between rings, shots are also fired in the player's direction. These go further the higher the difficulty.
					if (t === 1) {
						currentBoss.targetPosition = [0, -50];
					} else if (t % 120 === 1) {
						currentBoss.targetPosition = addVectors(currentBoss.targetPosition, randomPolarVector(20, 40));
						currentBoss.targetPosition = clampVector(currentBoss.targetPosition, -60, 60, -110, 10);
					}
					let shotInterval = [100, 90, 80, 70][difficulty];
					if ((t - 80) % shotInterval === 0) {
						playAudio("se_boon00");
						let primaryAngle = angleToPlayer(enemies[currentBoss.enemyId].position);
						let ringSize = [3, 4, 5, 6][difficulty];
						if ((t - 80) % (shotInterval * 2) >= shotInterval) {
							ringSize *= 2;
						}
						let ringRadius = Infinity;
						for (let ringNum = 0; ringNum < ringSize; ringNum++) { // Determine the radius of the ring first.
							let angle = primaryAngle + Math.PI * 2 * (ringNum + 0.5) / ringSize;
							ringRadius = Math.min(ringRadius, (250 - Math.abs(enemies[currentBoss.enemyId].position[0])) / Math.abs(Math.cos(angle) ?? 100), (300 - Math.abs(enemies[currentBoss.enemyId].position[1])) / Math.abs(Math.sin(angle) ?? 100));
						}
						ringRadius = ringRadius * [2, 1.75, 1.6, 1.5][difficulty];
						for (let ringNum = 0; ringNum < ringSize; ringNum++) { // Now, shoot the actual ring.
							let angle = primaryAngle + Math.PI * 2 * (ringNum + 0.5) / ringSize;
							this.createPlasmaBullet(addVectors(enemies[currentBoss.enemyId].position, polarToCartesian(15, angle)), addVectors(enemies[currentBoss.enemyId].position, polarToCartesian(ringRadius, angle)));
						}
					} else if ((t - 80) % shotInterval === shotInterval / 2) { // Shoot the aimed shot.
						playAudio("se_boon00");
						let angle = angleToPlayer(enemies[currentBoss.enemyId].position);
						let distanceToPlayer = Math.sqrt(squaredDistance(enemies[currentBoss.enemyId].position, playerPosition));
						let aimedShotDistance = [1, 1.2, 1.4, 1.6][difficulty];
						this.createPlasmaBullet(addVectors(enemies[currentBoss.enemyId].position, polarToCartesian(18, angle)), addVectors(enemies[currentBoss.enemyId].position, polarToCartesian(distanceToPlayer * aimedShotDistance, angle)));
					}
				}
			},
			N3: {
				HP: 1100,
				guaranteedScore: 250000,
				dropList: {point: 6, power: 6},
				maxFrames: 2000,
				behaviourFunction: function(t) {
					// Like nonspell 1, but less dense. However, several waves are shot in quick succession, followed by a short break before the pattern repeats.
					let shotInterval = [63, 50, 42, 35][difficulty];
					let spawnerRingSize = [14, 18, 22, 26][difficulty];
					let spawnerSpeed = [1.8, 2, 2.5, 3][difficulty];
					let seekerRingSize = [12, 14, 16, 18][difficulty];
					let seekerSpeed = [1.4, 1.5, 1.75, 2][difficulty];
					let seekerAdjacencyInterval = [1, 1, 1, 1][difficulty];
					let moveTime = Math.ceil((70 / spawnerSpeed) ** 0.8) + shotInterval * Math.floor(250 / shotInterval) + 1; // Time this to be at the same time as the fifth arrow ring splitting.
					if (t === 1) {
						currentBoss.targetPosition = [0, -150];
					} else if (((t - 125) % shotInterval === 1) && ((t - 125) % 350 < 250)) {
						lexanNonspell(enemies[currentBoss.enemyId].position, spawnerRingSize, spawnerSpeed, 100, seekerRingSize, seekerSpeed, seekerAdjacencyInterval);
					} else if ((t - 125) % 350 === moveTime) {
						currentBoss.targetPosition = addVectors(currentBoss.targetPosition, randomPolarVector(20, 40));
						currentBoss.targetPosition = clampVector(currentBoss.targetPosition, -75, 75, -200, -100);
					}
				}
			},
			S3: {
				name: "Magic Sign \"Wave of Four Paths\"",
				HP: 2000,
				guaranteedScore: 250000,
				captureScore: 1500000,
				dropList: {power: 30, point: 30, lifepiece: 1},
				maxFrames: 2400,
				colours: ["#00ff00", "#ff3333", "#3333ff", "#ff33ff"],
				darkColours: ["#00cc00", "#cc0000", "#0000cc", "#cc00cc"],
				cornerPositions: [[-255, 305], [-255, -305], [255, -305], [255, 305]],
				cornerPrincipalAngles: [45, 135, 225, 315], // To minimise lag, we only shoot within 60 degrees of this angle for each corner since everything else gets instantly deleted.
				colourMapping: [0, 1, 2, 3],
				behaviourFunction: function(t) {
					// Alternates between creating circular waves of bullets from the 4 corners, and circular waves of bullets at 4 speeds at Lexan's position.
					if (t === 1) {
						currentBoss.targetPosition = clampVector(currentBoss.targetPosition, -50, 50, -200, -100);
					} else if (t % 150 === 1) {
						currentBoss.targetPosition = addVectors(currentBoss.targetPosition, randomPolarVector(20, 30));
						currentBoss.targetPosition = clampVector(currentBoss.targetPosition, -75, 75, -225, -75);
					} else if (t % 300 === 50) {
						this.colourMapping = shuffleArray(this.colourMapping);
					}
					let cornerShotInterval = [30, 25, 35, 30][difficulty];
					let cornerShotSize = [6, 8, 6, 8][difficulty];
					let cornerShotSpeed = [1.6, 2, 2.4, 2.8][difficulty];
					if (numberIsBounded(0, (t - 80) % 600, 225) && (t % cornerShotInterval === 0)) {
						playAudio("se_tan00");
						// Shoot from two opposite corners at a time on Easy and Normal, and all four on Hard and Lunatic.
						for (let cornerNum = (difficulty < 2) ? Math.floor((t / cornerShotInterval) % 2) : 0; cornerNum < 4; cornerNum += (difficulty < 2) ? 2 : 1) {
							let phase = Math.random();
							for (let bulletNum = 0; bulletNum < cornerShotSize; bulletNum++) {
								let angle = bearingToAngle(this.cornerPrincipalAngles[cornerNum] + 120 * (bulletNum + phase) / cornerShotSize - 60);
								let v = polarToCartesian(cornerShotSpeed, angle);
								createBullet(structuredClone(this.cornerPositions[cornerNum]), function() {
									this.position = addVectors(this.position, v);
								}, circularRenderFunction(6, this.darkColours[this.colourMapping[cornerNum]], this.colours[this.colourMapping[cornerNum]]), radialCollisionCheck(6));
							}
						}
					}
					let centreShotInterval = [30, 25, 35, 30][difficulty];
					let centreShotSize = [16, 20, 24, 30][difficulty];
					let centreShotMinSpeed = [1.6, 2, 2.4, 2.8][difficulty];
					if (numberIsBounded(300, (t - 80) % 600, 525) && (t % centreShotInterval === 0)) {
						playAudio("se_tan00");
						// Likewise, shoot two non-adjacent speeds at a time on Easy and Normal, and all four on Lunatic.
						for (let speedNum = (difficulty < 2) ? Math.floor((t / centreShotInterval) % 2) : 0; speedNum < 4; speedNum += (difficulty < 2) ? 2 : 1) {
							let principalAngle = Math.PI * 2 * Math.random();
							for (let bulletNum = 0; bulletNum < centreShotSize; bulletNum++) {
								let angle = principalAngle + Math.PI * 2 * bulletNum / centreShotSize;
								let v = polarToCartesian(centreShotMinSpeed * 9 / (9 - speedNum), angle);
								createBullet(addVectors(enemies[currentBoss.enemyId].position, multiplyVectors(v, 4)), function() {
									this.position = addVectors(this.position, v);
								}, circularRenderFunction(6, this.darkColours[this.colourMapping[speedNum]], this.colours[this.colourMapping[speedNum]]), radialCollisionCheck(6));
							}
						}
					}
				}
			},
			N4: {
				HP: 1300,
				guaranteedScore: 250000,
				dropList: {point: 6, power: 6},
				maxFrames: 1800,
				behaviourFunction: function(t) {
					if (t === 1) {
						currentBoss.targetPosition = clampVector(currentBoss.targetPosition, -30, 30, -30, 30);
					}
					// Another simple nonspell, but this time instead of splitting close to Lexan, the bullets split near the sides of the screen.					
					let shotInterval = [400, 370, 350, 330][difficulty];
					let spawnerRingSize = [14, 18, 22, 26][difficulty];
					let spawnerSpeed = [1.8, 2, 2.5, 3][difficulty];
					let seekerRingSize = [10, 14, 18, 22][difficulty];
					let seekerSpeed = [0.7, 0.8, 0.9, 1][difficulty];
					let seekerAdjacencyInterval = [1, 1, 1, 1][difficulty];
					let moveTime = Math.ceil((330 / spawnerSpeed) ** 0.8) + 1; // Time this to be at the same time as the arrow ring splitting.
					if ((t - 80) % shotInterval === 1) {
						lexanNonspell(enemies[currentBoss.enemyId].position, spawnerRingSize, spawnerSpeed, 360, seekerRingSize, seekerSpeed, seekerAdjacencyInterval);
					} else if ((t - 80) % shotInterval === moveTime) {
						currentBoss.targetPosition = addVectors(currentBoss.targetPosition, randomPolarVector(20, 40));
						currentBoss.targetPosition = clampVector(currentBoss.targetPosition, -75, 75, -175, -75);
					}
				}
			},
			S4: {
				name: "Simplex \"Brain Field Lines\"",
				HP: 1400,
				guaranteedScore: 250000,
				captureScore: 2000000,
				dropList: {power: 30, point: 30, lifepiece: 1},
				maxFrames: 2250,
				chargeSeparation: 550,
				chargeAngle: 0,
				chargeAngularSpeed: 0,
				behaviourFunction: function(t) {
					// Two very large indestructible point charges (sources) are created, a positive and negative. Small positive charges are then spawned at the positive source, which travel to the negative source according to electric field laws.
					// We apply forces to the bullets' positions here rather than their velocities as otherwise the desired field line pattern does not form.
					if (t === 1) {
						playAudio("se_ch00");
						currentBoss.targetPosition = clampVector(currentBoss.targetPosition, -150, 150, -250, -200);
						let fieldStrength = [140000, 160000, 180000, 200000][difficulty];
						let chargeSpawnsPerFrame = [0.5, 1, 1.5, 2][difficulty];
						let orientation = plusMinus1(); // Determines if the positive source starts on the left or right.
						// Creates the positive source. This source spawns smaller charges, and repels them towards the negative.
						createBullet([-1000, 0], function(t) {
							this.position = polarToCartesian(Bosses.lexan.attacks.S4.chargeSeparation * orientation, Bosses.lexan.attacks.S4.chargeAngle);
							// Creates charges.
							let chargesToSpawn = Math.floor(chargeSpawnsPerFrame * clampNumber(0, t / 80 - 1, 1) + Math.random());
							if (t % 5 === 0) {
								playAudio("se_kira00", 0.15);
							}
							for (let chargeNum = 0; chargeNum < chargesToSpawn; chargeNum++) {
								createBullet(addVectors(this.position, randomPolarVector(125, 150)), function() {
									// Since both sources are spawned before this bullets, their behaviour functions (which determine this charge's motion) run first.
									this.position = addVectors(this.position, this.instantaneousVelocity)
									this.angle = Math.atan2(this.instantaneousVelocity[1], this.instantaneousVelocity[0]);
									this.instantaneousVelocity = [0, 0];
								}, arrowBulletRenderFunction("#00ffff", 5), radialCollisionCheck(5), 1000, 1000, {angle: 0, instantaneousVelocity: [0, 0]})
							}
							// Repels existing charges.
							for (let id of Object.keys(bullets)) {
								if (bullets[id].instantaneousVelocity !== undefined) { // Do not affect the sources or extra bullets
									bullets[id].instantaneousVelocity = addVectors(bullets[id].instantaneousVelocity, polarToCartesian(fieldStrength / squaredDistance(this.position, bullets[id].position), angleToObject(this.position, bullets[id].position)));
								}
							}
						}, circularRenderFunction(200, "#00ffff", "#00ffff", 5), radialCollisionCheck(200), 1000, 1000, {indestructible: true});
						// Creates the negative source. This source destroys smaller charges, and attracts them from the positive.
						createBullet([-1000, 0], function() {
							this.position = polarToCartesian(-Bosses.lexan.attacks.S4.chargeSeparation * orientation, Bosses.lexan.attacks.S4.chargeAngle);
							for (let id of Object.keys(bullets)) {
								if (bullets[id].instantaneousVelocity !== undefined) { // Again, do not affect the sources or extra bullets
									if (squaredDistance(this.position, bullets[id].position) < 32400) { // Destroys charges.
										bullets[id].position[0] = 10000;
									} else { // Repels existing charges.
										bullets[id].instantaneousVelocity = addVectors(bullets[id].instantaneousVelocity, polarToCartesian(fieldStrength / squaredDistance(this.position, bullets[id].position), angleToObject(bullets[id].position, this.position)));
									}
								}
							}
						}, circularRenderFunction(200, "#00ffff", "#00ffff", 5), radialCollisionCheck(200), 1000, 1000, {indestructible: true});
					} else if (t % 100 === 1) {
						currentBoss.targetPosition = addVectors(currentBoss.targetPosition, randomPolarVector(30, 50));
						currentBoss.targetPosition = clampVector(currentBoss.targetPosition, -150, 150, -250, -200);
					}
					// Moves the charges.
					this.chargeSeparation = (t < 200) ? (500 - t / 2) : (400 - 50 * Math.sin(t / 100 - 2));
					this.chargeAngle += this.chargeAngularSpeed;
					// Charge angle obeys simple harmonic motion with some random damping.
					let maxAngularAcceleration = [0.00025, 0.00032, 0.0004, 0.0005][difficulty];
					this.chargeAngularSpeed = this.chargeAngularSpeed * 0.999 + maxAngularAcceleration * randomReal(-1, 1) - this.chargeAngle * 0.0001;
					// On Normal and above, Lexan shoots additional rings of bullets.
					if (difficulty !== 0) {
						let shotInterval = [200, 100, 50][difficulty - 1];
						if ((t - 270) % shotInterval === 1) {
							playAudio("se_tan00", 0.8);
	 						let shotSize = [10, 12, 16][difficulty - 1];
							let shotSpeed = [3.6, 4.8, 6.4][difficulty - 1];
							let principalAngle = Math.PI * 2 * Math.random();
							for (let bulletNum = 0; bulletNum < shotSize; bulletNum++) {
								let angle = principalAngle + Math.PI * 2 * bulletNum / shotSize;
								let v = polarToCartesian(shotSpeed, angle);
								createBullet(addVectors(enemies[currentBoss.enemyId].position, polarToCartesian(48, angle)), function() {
									this.position = addVectors(this.position, v);
								}, arrowBulletRenderFunction("#0000ff", 18, angle), radialCollisionCheck(18));
							}
						}
					}
				}
			},
			N5: {
				HP: 1200,
				guaranteedScore: 250000,
				dropList: {point: 6, power: 6},
				maxFrames: 2000,
				behaviourFunction: function(t) {
					if (t === 1) {
						currentBoss.targetPosition = clampVector(currentBoss.targetPosition, -25, 25, -210, -190);
					}
					// A single, slow but very dense wave of arrows is shot, producing rotating rings of seekers which are not necessarily aimed at the player.
					let shotInterval = [300, 275, 250, 225][difficulty];
					let seekerAim = (t - 80) % (shotInterval * 2) < shotInterval;
					let spawnerRingSize = [60, 72, 90, 100][difficulty];
					let spawnerSpeed = [1.8, 2, 2.5, 3][difficulty];
					let seekerRingSize = [60, 72, 75, 90][difficulty];
					let seekerSpeed = [1.4, 1.5, 1.75, 2][difficulty];
					let seekerAdjacencyInterval = seekerAim ? [30, 24, 15, 10][difficulty] : [15, 15, 14, 15][difficulty];
					let moveTime = Math.ceil((90 / spawnerSpeed) ** 0.8) + 1; // Time this to be at the same time as the arrow ring splitting.
					if ((t - 80) % shotInterval === 1) {
						lexanNonspell(enemies[currentBoss.enemyId].position, spawnerRingSize, spawnerSpeed, 60, seekerRingSize, seekerSpeed, seekerAdjacencyInterval, undefined, seekerAim);
					} else if ((t - 80) % shotInterval === moveTime) {
						currentBoss.targetPosition = addVectors(currentBoss.targetPosition, randomPolarVector(20, 40));
						currentBoss.targetPosition = clampVector(currentBoss.targetPosition, -125, 125, -225, -175);
					}
				}
			},
			S5: {
				name: "Ellipticity \"The Opposition's Four-Dimensional Timeline\"",
				HP: 1500,
				guaranteedScore: 250000,
				captureScore: 2000000,
				dropList: {power: 30, point: 30, lifepiece: 1},
				maxFrames: 2550,
				behaviourFunction: function(t) {
					if (t % 250 === 1) {
						currentBoss.targetPosition = addVectors(currentBoss.targetPosition, randomPolarVector(20, 40));
						currentBoss.targetPosition = clampVector(currentBoss.targetPosition, -150, 150, -225, -175);
					}
					// Creates waves of straight lasers surrounded by sinusoidal lasers.
					// After several such waves, creates two pairs of radial lasers (see "Moon Dragon").
					if (t === 76) {
						playAudio("se_ch02");
					}
					if ((t - 110) % 501 < 310) {
						let shotInterval = [96, 88, 82, 78][difficulty];
						if ((t - 110) % shotInterval === 1) { // Processes the linear lasers.
							playAudio("se_lazer00");
							let timelineSpacing = [100, 90, 84, 78][difficulty];
							let timelineMinAmplitude = [48, 45, 42, 39][difficulty];
							let timelineMaxAmplitude = [48, 60, 70, 78][difficulty];
							let timelineShotAngle = bearingToAngle([12, 14, 16, 18][difficulty] * randomReal(-1, 1));
							let timelineSpeed = [3, 3.5, 4.2, 5][difficulty];
							// Timelines are spawned 400px away from the origin, regardless of angle. Calculate the maximum deflection that a timeline needs to be spawned at.
							let maximumDeflection = 250 * Math.abs(Math.sin(timelineShotAngle)) + 300 * Math.abs(Math.cos(timelineShotAngle)) + timelineMaxAmplitude + 10;
							let phase = Math.PI * 2 * Math.random();
							let amplitude = randomReal(timelineMinAmplitude, timelineMaxAmplitude);
							let waveOffset = Math.PI * [0.5, 0.5, 2/3, 2/3][difficulty]; // Every timeline is offset 90 degrees (E/N) or 120 degrees (H/L) from the previous.
							let phaseCounter = 0;
							for (let deflection = -maximumDeflection + randomReal(0, timelineSpacing); deflection < maximumDeflection; deflection += timelineSpacing) {
								let initialPhase = phase + phaseCounter * waveOffset;
								phaseCounter++;
								let angularSpeed = randomReal(0.095, 0.105);
								for (let waveNum of [-1, 0, 1]) { // 0 is the linear laser, -1 and 1 are the sinusoidal lasers around this.
									for (let timeDisplacement = 0; timeDisplacement <= 60; timeDisplacement += 3) {
										createBullet([-350, 0], function(t) {
											let time = t - timeDisplacement;
											this.position = rotateVector([400 - timelineSpeed * time, deflection + amplitude * waveNum * (0.5 + 0.5 * Math.sin(initialPhase + angularSpeed * time))], timelineShotAngle);
										}, circularRenderFunction(4, "#00cc66", "#00ff80"), radialCollisionCheck(4), 700, 700);
									}
								}
							}
						}
					} else if ((t - 110) % 501 === 405) {
						playAudio("se_ch02");
					} else if ([440, 459 - difficulty * 4].includes((t - 110) % 501)) { // Processes the radial lasers
						playAudio("se_lazer00");
						let initialPosition = structuredClone(enemies[currentBoss.enemyId].position);
						let circleSize = [16, 18, 20, 22][difficulty];
						let timelineSpeed = [3.2, 4, 5, 6.3][difficulty];
						let amplitude = [15, 18, 21, 25][difficulty];
						let angularSpeed = randomReal(0.19, 0.21);
						let rotationDirection = (frame % 2 === 0) ? 1 : -1;
						let rotationSpeed = randomReal(0.095, 0.105) * rotationDirection;
						let principalAngle = Math.PI * 2 * Math.random();
						for (let laserNum = 0; laserNum < circleSize; laserNum++) {
							let initialAngle = principalAngle + Math.PI * 2 * laserNum / circleSize;
							for (let waveNum of [-1, 1]) { // No linear laser here.
								for (let timeDisplacement = 0; timeDisplacement <= 60; timeDisplacement += 3) {
									createBullet([-350, 0], function(t) {
										let time = Math.max(t - timeDisplacement, 0);
										this.position = addVectors(initialPosition, rotateVector([timelineSpeed * time, amplitude * waveNum * (0.5 + 0.5 * Math.sin(angularSpeed * time))], initialAngle + rotationSpeed * Math.sqrt(time * timelineSpeed + 100)));
									}, circularRenderFunction(4, "#00cc66", "#00ff80"), radialCollisionCheck(4), 700, 700);
								}
							}
						}
					}
				}
			},
			N6: {
				HP: 1500,
				guaranteedScore: 250000,
				dropList: {point: 6, power: 6},
				maxFrames: 2000,
				initialPhase: undefined,
				behaviourFunction: function(t) {
					if (t === 1) {
						currentBoss.targetPosition = clampVector(currentBoss.targetPosition, -75, 75, -210, -190);
					}
					// Triangular formations of arrow bullets are shot which explode very close to Lexan.
					// This alternates between 2 arrow waves aimed directly at the player and 2 arrow waves aimed directly away from the player.
					let shotInterval = [90, 82, 76, 72][difficulty];
					let spawnerRingSize = [16, 20, 24, 28][difficulty];
					let spawnerSpeed = [1.8, 2, 2.5, 3][difficulty];
					let seekerRingSize = [12, 16, 20, 24][difficulty];
					let seekerSpeed = [1, 1, 1, 1][difficulty];
					let seekerAdjacencyInterval = [2, 2, 2, 2][difficulty];
					let totalShots = [4, 4, 4, 4][difficulty];
					let shotDelay = [3, 3, 3, 3][difficulty];
					let shotPhaseDifference = [0.021, 0.02, 0.019, 0.018][difficulty];
					let moveTime = Math.ceil((20 / spawnerSpeed) ** 0.8) + (totalShots - 1) * shotDelay + 1; // Time this to be at the same time as the arrow ring splitting.
					if ((t - 80) % shotInterval === 1) {
						this.initialPhase = angleToPlayer(enemies[currentBoss.enemyId].position);
						if ((t - 80) % (shotInterval * 4) > (shotInterval * 2)) {
							this.initialPhase += Math.PI / spawnerRingSize;
						}
					}
					for (let shotNum = 0; shotNum < totalShots; shotNum++) {
						if ((t - 80) % shotInterval === shotNum * shotDelay + 1) {
							let deflections = (shotNum === 0) ? [0] : [shotNum, -shotNum];
							for (let deflection of deflections) {
								lexanNonspell(enemies[currentBoss.enemyId].position, spawnerRingSize, spawnerSpeed, 50, (shotNum === 0) ? seekerRingSize : 0, seekerSpeed, seekerAdjacencyInterval, this.initialPhase + shotPhaseDifference * deflection);
							}
						}
					}
					if ((t - 80) % shotInterval === moveTime) {
						currentBoss.targetPosition = addVectors(currentBoss.targetPosition, randomPolarVector(20, 40));
						currentBoss.targetPosition = clampVector(currentBoss.targetPosition, -150, 150, -225, -175);
					}
				}
			},
			S6: {
				name: "Fission Orb \"Solar Wind of the Revolution\"",
				HP: 1800,
				guaranteedScore: 250000,
				captureScore: 2000000,
				dropList: {power: 30, point: 30, lifepiece: 1},
				maxFrames: 2300,
				behaviourFunction: function(t) {
					if (t === 1) {
						currentBoss.targetPosition = [0, -190];
					}
					// Creates large star bullets which send out periodically interrupted streams of wind bullets at steadily changing angles. (See Hoshikun Tenkinomiya's nonspell 1).
					// After 9 seconds (twice the interval between star bullet spawns), star bullets stop shooting, and instead fly at the player.
					// Upon reaching the edge of the screen, these star bullets then explode, sending out circular waves of bullets.
					if (t % 225 === 80) {
						playAudio("se_boon01");
						let orientation = (frame % 2 === 0) ? 1 : -1;
						let hue = randomReal(0, 60);
						let velocity = [randomReal(1.3, 1.4) * orientation, randomReal(-0.7, -0.65)];
						let windRingSize = [9, 10, 11, 12][difficulty];
						let windMaxSpeed = [4, 4.8, 5.8, 7][difficulty];
						let windShootPeriod = [24, 23, 22, 21][difficulty];
						let windIdlePeriod = [20, 16, 12, 8][difficulty];
						let initialWindAngle = Math.PI * 2 * Math.random();
						let windRotationSpeed = [0.004, 0.0042, 0.0045, 0.005][difficulty];
						let starLifespan = (windShootPeriod + windIdlePeriod) * Math.floor(450 / (windShootPeriod + windIdlePeriod)) - windIdlePeriod; // Time the death of this star to be at the end of a shooting period.
						let initialTargetPosition = [randomReal(190, 215) * orientation, randomReal(-120, -45)];
						createBullet(structuredClone(enemies[currentBoss.enemyId].position), function(t) {
							if (t < starLifespan) { // Main sequence: moves towards the target position and shoots solar wind.
								let targetPosition = addVectors(initialTargetPosition, [0, t / 10]);
								let positionDecayRate = Math.min(t / 20000, 0.01);
								this.position = addVectors(multiplyVectors(this.position, 1 - positionDecayRate), multiplyVectors(targetPosition, positionDecayRate));
								velocity = addVectors(velocity, [-0.00375 * orientation, 0.0025]);
								if ((t % 2 === 0) && (t % (windShootPeriod + windIdlePeriod) < windShootPeriod)) { // Creates the solar wind.
									if (t % 6 === 0) {
										playSingleAudio("se_tan00", "solarwind" + frame, 0.15);
									}
									let principalAngle = initialWindAngle + windRotationSpeed * orientation * t;
									for (let windNum = 0; windNum < windRingSize; windNum++) {
										let angle = principalAngle + Math.PI * 2 * windNum / windRingSize;
										let motionAngle = angle - Math.PI * orientation / 2;
										createBullet(addVectors(this.position, polarToCartesian(30, angle)), function(t) {
											let speed = windMaxSpeed * (1 - Math.exp(t * -0.015));
											this.position = addVectors(this.position, polarToCartesian(speed, motionAngle));
										}, circularRenderFunction(4, hsltohex(hue, 100, 50) + "80", hsltohex(hue, 100, 50)), radialCollisionCheck(4));
									}
								}
							} else if (t === starLifespan) {
								this.angle = angleToPlayer(this.position); // Only set this once.
							} else { // Death phase: moves towards the player's position at the end of lifespan.
								let speed = [4, 5, 6, 7][difficulty] * (1 - Math.exp((t - starLifespan) * -0.005));
								this.position = addVectors(this.position, polarToCartesian(speed, this.angle));
								if ((Math.abs(this.position[0]) > 250) || (Math.abs(this.position[1]) > 300)) {
									playAudio("se_kira00");
									let totalWaves = [1, 1, 2, 3][difficulty];
									let waveSize = [6, 16, 16, 18][difficulty];
									let principalAngle = Math.PI * 2 * Math.random(); // Waves after the first one are static.
									for (let waveNum = 0; waveNum < totalWaves; waveNum++) {
										for (let bulletNum = 0; bulletNum < waveSize; bulletNum++) {
											let speed = 1.5 + waveNum * 1.5;
											let angle = principalAngle + Math.PI * (waveNum + bulletNum * 2) / waveSize;
											let v = polarToCartesian(speed, angle);
											createBullet(addVectors(this.position, multiplyVectors(v, 0.2 + 0.2 * waveNum)), function(t) {
												this.position = addVectors(this.position, multiplyVectors(v, 1 - Math.exp(t * -0.0075)));
											}, circularRenderFunction(6, hsltohex(hue, 100, 50) + "80", hsltohex(hue, 100, 50)), radialCollisionCheck(6));
										}
									}
									this.position[0] = 2000;
								}
							}
						}, circularRenderFunction(40, hsltohex(hue, 100, 50), hsltohex(hue, 100, 50)), radialCollisionCheck(40), 1000, 1000, {indestructible: true});
					}
				}
			},
			N7: {
				HP: 1200,
				guaranteedScore: 250000,
				dropList: {point: 4, power: 4},
				maxFrames: 2500,
				rinId: undefined, // The enemy ID of the second Lexan.
				behaviourFunction: function(t) {
					if (t === 1) {
						currentBoss.targetPosition = clampVector(currentBoss.targetPosition, 150, 200, -200, -100);
						this.rinId = enemyCounter;
						createEnemy([500, -300], function() {
							// This enemy does nothing except transfer his damage to Lexan and mirror his position. The behaviour of the two attack-wise is controlled by the general boss behaviour function.
							let targetPosition = [currentBoss.targetPosition[0] * -1, currentBoss.targetPosition[1]];
							this.position = addVectors(multiplyVectors(this.position, 0.95), multiplyVectors(targetPosition, 0.05));
							if (!enemies[currentBoss.enemyId].invincible) {
								enemies[currentBoss.enemyId].HP -= 1000000 - this.HP;
							}
							this.HP = 1000000;
						}, Bosses.rin.renderFunction, Bosses.lexan.collisionCheckFunction, 1000000, 0, {point: 4, power: 4});
					}
					// This nonspell is like nonspell 1, but less dense and slower (especially on Easy and Normal).
					// However, there is a second Lexan that shoots arrow waves simultaneously with the first.
					let shotInterval = [150, 130, 110, 90][difficulty];
					let spawnerRingSize = [16, 24, 32, 44][difficulty];
					let spawnerSpeed = [1, 1.4, 2.1, 2.8][difficulty];
					let seekerRingSize = [10, 14, 18, 22][difficulty];
					let seekerSpeed = [1.4, 1.5, 1.75, 2][difficulty];
					let seekerAdjacencyInterval = [1, 1, 1, 1][difficulty];
					let moveTime = Math.ceil((70 / spawnerSpeed) ** 0.8) + 1; // Time this to be at the same time as the arrow ring splitting.
					if ((t - 80) % shotInterval === 1) {
						lexanNonspell(enemies[currentBoss.enemyId].position, spawnerRingSize, spawnerSpeed, 100, seekerRingSize, seekerSpeed, seekerAdjacencyInterval, undefined, undefined, false);
						lexanNonspell(enemies[this.rinId].position, spawnerRingSize, spawnerSpeed, 100, seekerRingSize, seekerSpeed, seekerAdjacencyInterval, undefined, undefined, true);
					} else if ((t - 80) % shotInterval === moveTime) {
						currentBoss.targetPosition = addVectors(currentBoss.targetPosition, randomPolarVector(20, 40));
						currentBoss.targetPosition = clampVector(currentBoss.targetPosition, 150, 200, -200, -100);
					}
				}
			},
/*			S7X: {
				name: "Delusion \"Potential of Our Grand Tour\"",
				HP: 2700,
				guaranteedScore: 250000,
				captureScore: 2500000,
				dropList: {power: 16, point: 16, lifepiece: 1},
				maxFrames: 3300,
				rinId: undefined,
				phase: 0, // Whether the attack is in phase 1 (transmitting and seeking bullets) or phase 2 (rotating bullets). 0 means no attacks.
				behaviourFunction: function(t) {
					if (t === 1) {
						this.rinId = enemyCounter;
						createEnemy([-enemies[currentBoss.enemyId].position[0], enemies[currentBoss.enemyId].position[1]], function() {
							// This enemy does nothing except transfer his damage to Lexan and mirror his position. The behaviour of the two attack-wise is controlled by the general boss behaviour function.
							let targetPosition = [currentBoss.targetPosition[0] * -1, currentBoss.targetPosition[1]];
							this.position = addVectors(multiplyVectors(this.position, 0.95), multiplyVectors(targetPosition, 0.05));
							if (!enemies[currentBoss.enemyId].invincible) {
								enemies[currentBoss.enemyId].HP -= 1000000 - this.HP;
							}
							this.HP = 1000000;
						}, Bosses.rin.renderFunction, Bosses.lexan.collisionCheckFunction, 1000000, 0, {power: 16, point: 16, spellcard: 1});
						currentBoss.targetPosition = clampVector(currentBoss.targetPosition, 75, 125, -240, -200);
					}
					// Rin and Lexan move close together. Rin shoots circular waves of bullets that transmit to the other side of the screen up to three times.
					// Meanwhile Lexan shoots waves of bullets that upon travelling far enough, are redirected to small angles away from the player.
					// Below 1100 HP or 30 seconds left, Rin and Lexan move apart, and start shooting patterns resembling those of the yellow spirit.
					if (t === 80) {
						Bosses.lexan.attacks.S7.phase = 1;
					}
					if (Bosses.lexan.attacks.S7.phase === 1) {
						if ((enemies[currentBoss.enemyId].HP <= 1100) || (t >= 1800)) {
							for (let bulletId of Object.keys(bullets)) {
								delete bullets[bulletId];
							}
							Bosses.lexan.attacks.S7.phase = 0; // No attacks for a while.
							scheduleStageEvent(50, function() {
								Bosses.lexan.attacks.S7.phase = 2;
							})
							currentBoss.targetPosition[0] += 60;
						}
						// Processes Rin's shots.
						let rinShotInterval = [50, 49, 48, 47][difficulty];
						if (t % rinShotInterval === 0) {
							let rinShotSize = [6, 8, 10, 12][difficulty];
							let rinShotSpeed = [0.9, 1.1, 1.3, 1.6][difficulty];
							let principalAngle = Math.PI * 2 * 0.618 * frame / (rinShotSize * rinShotInterval) + randomReal(-0.1, 0.1);
							for (let bulletNum = 0; bulletNum < rinShotSize; bulletNum++) {
								let angle = principalAngle + Math.PI * 2 * bulletNum / rinShotSize;
								let v = polarToCartesian(rinShotSpeed, angle);
								createBullet(addVectors(enemies[this.rinId].position, polarToCartesian(48, angle)), function() {
									this.position = addVectors(this.position, v);
									if (this.transmissionsLeft > 0) {
										if (Math.abs(this.position[0]) > 255) {
											this.position[0] -= 510 * Math.sign(this.position[0]);
											this.transmissionsLeft--;
										} else if (Math.abs(this.position[1]) > 305) {
											this.position[1] -= 610 * Math.sign(this.position[1]);
											this.transmissionsLeft--;
										}
									}
								}, arrowBulletRenderFunction("#ff9900", 5, angle), radialCollisionCheck(5), 270, 320, {transmissionsLeft: 2});
							}
						}
						// Processes Lexan's shots.
						let lexanShotInterval = [50, 49, 48, 47][difficulty];
						if (t % lexanShotInterval === 0) {
							let lexanShotSize = [3, 4, 5, 6][difficulty];
							let reversalDistance = [500, 600, 700, 800][difficulty]; // The initial distance from the player that a bullet needs to be to be deflected. This decreases by 0.5 per frame.
							let maxClosestApproachDistance = [240, 225, 210, 200][difficulty];
							let lexanShotSpeed = [1.2, 1.4, 1.7, 2.1][difficulty];
							let principalAngle = -Math.PI * 2 * 0.618 * frame / (lexanShotSize * lexanShotInterval) + randomReal(-0.1, 0.1);
							for (let bulletNum = 0; bulletNum < lexanShotSize; bulletNum++) {
								let angle = principalAngle + Math.PI * 2 * bulletNum / lexanShotSize;
								let v = polarToCartesian(lexanShotSpeed, angle);
								createBullet(addVectors(enemies[currentBoss.enemyId].position, polarToCartesian(48, angle)), function(t) {
									let distanceToPlayer = Math.sqrt(squaredDistance(this.position, playerPosition));
									if (this.canReverse && (distanceToPlayer > reversalDistance - t / 2)) {
										v = polarToCartesian(lexanShotSpeed, angleToPlayer(this.position) + randomReal(-1, 1) * maxClosestApproachDistance / distanceToPlayer);
										this.maximumX = Math.max(Math.abs(this.position[0]) + 10, 260);
										this.maximumY = Math.max(Math.abs(this.position[1]) + 10, 310);
										this.canReverse = false;
									}
									this.position = addVectors(this.position, v);
								}, circularRenderFunction(8, "#0000cc", "#0000ff"), radialCollisionCheck(8), 1500, 1500, {canReverse: true})
							}
						}
					} else if (Bosses.lexan.attacks.S7.phase === 2) {
						let mutualShotInterval = [50, 49, 48, 47][difficulty];
						if (t % mutualShotInterval === 0) {
							let shotSize = [10, 14, 24, 36][difficulty];
							let radialSpeed = [1.6, 1.7, 1.8, 1.9][difficulty];
							let angularSpeed = [0.06, 0.075, 0.095, 0.12][difficulty];
							for (let rotationDirection of [1, -1]) {
								let principalAngle = Math.PI * 2 * Math.random();
								for (let isRin of [true, false]) {
									for (let bulletNum = 0; bulletNum < shotSize; bulletNum++) {
										let initialAngle = principalAngle + Math.PI * 2 * bulletNum / shotSize;
										let rootPosition = structuredClone(enemies[isRin ? this.rinId : currentBoss.enemyId].position);
										createBullet([300, 0], function(t) {
											let radius = 48 + radialSpeed * t;
											let angle = initialAngle + Math.log(radius + 100) * rotationDirection;
											if (isRin) {
												angle = Math.PI - angle;
											}
											this.position = addVectors(rootPosition, polarToCartesian(radius, angle));
										}, circularRenderFunction(6, isRin ? "#cc8000" : "#0000cc", isRin ? "#ff9900" : "#0000ff"), radialCollisionCheck(6), 400, 400);
									}
								}
							}
						}
					}
				}
			}, */
			S7: {
				name: "Delusion \"A Grand Tour's False Potential\"",
				HP: 2500,
				guaranteedScore: 250000,
				captureScore: 2500000,
				dropList: {power: 16, point: 16, lifepiece: 1},
				maxFrames: 4300,
				rinId: undefined,
				rinVerticalOffset: -1,
				phase: 0, // Whether the attack is in phase 1 (transmitting and seeking bullets) or phase 2 (rotating bullets). 0 means no attacks.
				behaviourFunction: function(t) {
					if (t === 1) {
						this.rinId = enemyCounter;
						createEnemy([-enemies[currentBoss.enemyId].position[0], enemies[currentBoss.enemyId].position[1]], function() {
							// This enemy does nothing except transfer his damage to Lexan and mirror his position. The behaviour of the two attack-wise is controlled by the general boss behaviour function.
							this.position = addVectors(multiplyVectors(this.position, 0.95), multiplyVectors(this.targetPosition, 0.05));
							if (!enemies[currentBoss.enemyId].invincible) {
								enemies[currentBoss.enemyId].HP -= 1000000 - this.HP;
							}
							this.HP = 1000000;
						}, Bosses.rin.renderFunction, Bosses.lexan.collisionCheckFunction, 1000000, 0, {power: 16, point: 16, spellcard: 1}, undefined, undefined, undefined, {targetPosition: [-220, 0]});
						currentBoss.targetPosition = [220, 0];
					}
					// Rin and Lexan move close together. Rin shoots circular waves of bullets that transmit to the other side of the screen up to three times.
					// Meanwhile Lexan shoots waves of bullets that upon reaching the sides are redirected to small angles away from the player.
					// Below 1100 HP or 38 seconds left, Rin and Lexan move apart, and start shooting patterns resembling those of the yellow spirit.
					if (t === 80) {
						Bosses.lexan.attacks.S7.phase = 1;
					}
					let motionProgress = (Math.max(t - 80, 0) / 320 + 0.5) % 4;
					currentBoss.targetPosition = (motionProgress < 1) ? [220, motionProgress * 540 - 270] : (motionProgress < 2) ? [660 - motionProgress * 440, 270] : (motionProgress < 3) ? [-220, 1350 - motionProgress * 540] : [motionProgress * 440 - 1540, -270];
					enemies[this.rinId].targetPosition = [-currentBoss.targetPosition[0], currentBoss.targetPosition[1] * this.rinVerticalOffset];
					if (Bosses.lexan.attacks.S7.phase === 1) {
//						currentBoss.targetPosition = polarToCartesian(Math.min(225 + t / 5, 200), t / 160 - 0.5);
						if ((enemies[currentBoss.enemyId].HP <= 1100) || (t >= 2400)) {
							for (let bulletId of Object.keys(bullets)) {
								delete bullets[bulletId];
							}
							Bosses.lexan.attacks.S7.phase = 3; // 3 is identical to 0 (no attacks) except Rin moves to mirror Lexan.
							scheduleStageEvent(100, function() {
								Bosses.lexan.attacks.S7.phase = 2;
							})
							currentBoss.targetPosition[0] += 60;
							return; // Prevent shots being fired this frame after other phase 1 bullets have been deleted.
						}
						// Processes Rin's shots.
						let rinShotInterval = [100, 50, 48, 47][difficulty];
						if (t % rinShotInterval === 0) {
							playSingleAudio("se_tan00", "rinlexan" + frame, 0.4);
							let rinShotSize = [8, 6, 8, 12][difficulty];
							let rinShotSpeed = [0.9, 1.1, 1.3, 1.6][difficulty];
							let principalAngle = Math.PI * 2 * 0.618 * frame / (rinShotSize * rinShotInterval) + randomReal(-0.1, 0.1);
							for (let bulletNum = 0; bulletNum < rinShotSize; bulletNum++) {
								let angle = principalAngle + Math.PI * 2 * bulletNum / rinShotSize;
								let v = polarToCartesian(rinShotSpeed, angle);
								createBullet(addVectors(enemies[this.rinId].position, polarToCartesian(24, angle)), function() {
									this.position = addVectors(this.position, v);
									if (this.transmissionsLeft > 0) {
										if (Math.abs(this.position[0]) > 255) {
											this.position[0] -= 510 * Math.sign(this.position[0]);
											this.transmissionsLeft--;
										} else if (Math.abs(this.position[1]) > 305) {
											this.position[1] -= 610 * Math.sign(this.position[1]);
											this.transmissionsLeft--;
										}
									}
								}, arrowBulletRenderFunction("#ff9900", 5, angle), radialCollisionCheck(5), 270, 320, {transmissionsLeft: 1});
							}
						}
						// Processes Lexan's shots.
						let lexanShotInterval = [100, 50, 48, 47][difficulty];
						if (t % lexanShotInterval === 0) {
							playSingleAudio("se_tan00", "rinlexan" + frame, 0.4);
							let lexanShotSize = [4, 3, 4, 6][difficulty];
							let reversalDistance = [500, 600, 700, 800][difficulty]; // The initial distance from the player that a bullet needs to be to be deflected. This decreases by 0.5 per frame.
							let maxClosestApproachDistance = [240, 225, 210, 200][difficulty];
							let lexanShotSpeed = [1.2, 1.4, 1.7, 2.1][difficulty];
							let principalAngle = -Math.PI * 2 * 0.618 * frame / (lexanShotSize * lexanShotInterval) + randomReal(-0.1, 0.1);
							for (let bulletNum = 0; bulletNum < lexanShotSize; bulletNum++) {
								let angle = principalAngle + Math.PI * 2 * bulletNum / lexanShotSize;
								let v = polarToCartesian(lexanShotSpeed, angle);
								createBullet(addVectors(enemies[currentBoss.enemyId].position, polarToCartesian(24, angle)), function(t) {
									let distanceToPlayer = Math.sqrt(squaredDistance(this.position, playerPosition));
									if (this.canReverse && ((Math.abs(this.position[0]) > 250) || (Math.abs(this.position[1]) > 300))) {
										v = polarToCartesian(lexanShotSpeed, angleToPlayer(this.position) + randomReal(-1, 1) * maxClosestApproachDistance / distanceToPlayer);
										this.maximumX = Math.max(Math.abs(this.position[0]) + 10, 260);
										this.maximumY = Math.max(Math.abs(this.position[1]) + 10, 310);
										this.canReverse = false;
									}
									this.position = addVectors(this.position, v);
								}, circularRenderFunction(8, "#0000cc", "#0000ff"), radialCollisionCheck(8), 1500, 1500, {canReverse: true})
							}
						}
					} else if (Bosses.lexan.attacks.S7.phase === 2) {
						let mutualShotInterval = [100, 100, 90, 75][difficulty];
						if (t % mutualShotInterval === 0) {
							playSingleAudio("se_kira00", "rinlexan" + frame);
							let shotSize = [12, 16, 24, 32][difficulty];
							let radialSpeed = [1.6, 1.7, 1.8, 1.9][difficulty];
							let angularSpeed = [0.06, 0.075, 0.085, 0.09][difficulty];
							for (let rotationDirection of [1, -1]) {
								let principalAngle = Math.PI * 2 * Math.random();
								for (let isRin of [true, false]) {
									for (let bulletNum = 0; bulletNum < shotSize; bulletNum++) {
										let initialAngle = principalAngle + Math.PI * 2 * bulletNum / shotSize;
										let rootPosition = structuredClone(enemies[isRin ? this.rinId : currentBoss.enemyId].position);
										createBullet([300, 0], function(t) {
											let radius = 48 + radialSpeed * t;
											let angle = initialAngle + Math.log(radius + 100) * rotationDirection;
											if (isRin) {
												angle = Math.PI - angle;
											}
											this.position = addVectors(rootPosition, polarToCartesian(radius, angle));
										}, circularRenderFunction(6, isRin ? "#cc8000" : "#0000cc", isRin ? "#ff9900" : "#0000ff"), radialCollisionCheck(6), 400, 400);
									}
								}
							}
						}
					}
					if ((Bosses.lexan.attacks.S7.phase > 1) && (this.rinVerticalOffset < 1)) {
						this.rinVerticalOffset = Math.min(this.rinVerticalOffset * 1.03 + 0.04, 1);
					}
				}
			},
			N8: {
				HP: 1300,
				guaranteedScore: 250000,
				dropList: {point: 8, power: 8},
				maxFrames: 2500,
				initialPhase: Math.PI * 2 * Math.random(),
				rotationDirection: plusMinus1(),
				behaviourFunction: function(t) {
					// Rapidly shoots rings of only a few arrows.
					if (t === 50) {
						currentBoss.targetPosition = [0, -100];
					}
					let shotInterval = [13, 12, 11, 10][difficulty];
					let spawnerRingSize = [5, 3, 4, 6][difficulty];
					let twin = difficulty !== 0; // If true, there are two patterns rotating in opposite directions. Otherwise, there is only one pattern.
					let spawnerSpeed = [1.8, 2, 2.5, 3][difficulty];
					let seekerRingSize = [12, 16, 20, 24][difficulty];
					let seekerSpeed = [1.4, 1.5, 1.75, 2][difficulty];
					let seekerAdjacencyInterval = [1, 1, 1, 1][difficulty];
					let firePeriod = [200, 200, 300, 500][difficulty];
					let idlePeriod = [200, 175, 155, 140][difficulty];
					let moveTime = Math.ceil((70 / spawnerSpeed) ** 0.8) + 1; // Time this to be at the same time as the arrow ring splitting.
					if (numberIsBounded(1, (t - 125) % (firePeriod + idlePeriod), firePeriod) && (t % shotInterval === 0)) {
						let principalAngle = this.initialPhase + 0.015 * t * this.rotationDirection;
						for (let angle of (difficulty === 0) ? [principalAngle] : [principalAngle, Math.PI - principalAngle]) {
							lexanNonspell(enemies[currentBoss.enemyId].position, spawnerRingSize, spawnerSpeed, 100, seekerRingSize, seekerSpeed, seekerAdjacencyInterval, angle);
						}
					}
					if ((t - 125) % (firePeriod + idlePeriod) === firePeriod) {
						this.initialPhase = Math.PI * 2 * Math.random();
						this.rotationDirection = plusMinus1();
						currentBoss.targetPosition = addVectors(currentBoss.targetPosition, randomPolarVector(20, 40));
						currentBoss.targetPosition = clampVector(currentBoss.targetPosition, -25, 25, -125, -75);
					}
				}
			},
			S8: {
				name: "New Age \"Magma Fireworks\"",
				HP: 1700,
				guaranteedScore: 250000,
				captureScore: 2500000,
				dropList: {power: 36, point: 36, extend: 1},
				maxFrames: 3200,
				explosiveShot: function(targetX, cinderPhase) {
					// Like the explosive shots of magma elementals, but they shoot less bullets and slower, but with a much larger horizontal reach.
					// They also create firework bullets that move almost straight upwards, and explode, creating rings of cinders at a constant phase.
					playAudio("se_boon00");
					let totalLavaBullets = [27, 30, 33, 36][difficulty];
					let lavaVerticalMaxSpeed = [7, 7.5, 8.1, 9][difficulty];
					let lavaHorizontalMaxSpeed = [0.33, 0.44, 0.5, 0.5][difficulty];
					let cinderRingSize = [16, 20, 22, 24][difficulty];
					let cinderMaxSpeed = [3, 4, 5, 6][difficulty];
					let startPosition = addVectors(enemies[currentBoss.enemyId].position, randomPolarVector(0, 5));
					let v = [(targetX - startPosition[0]) / 60, (300 - startPosition[1]) / 60];
					createBullet(structuredClone(startPosition), function(t) {
						// Reach the target position after exactly 60 frames.
						this.position = addVectors(this.position, v);
						if (t === 60) {
							playSingleAudio("se_kira00", "magmaelementalexplosion1_" + frame, 0.3);
							playSingleAudio("se_don00", "magmaelementalexplosion2_" + frame, 0.9);
							let realMaximumY = this.position[1] + 5;
							// Creates lava bullets.
							for (let bulletNum = 0; bulletNum < totalLavaBullets; bulletNum++) {
								let hue = randomReal(0, 60); // Lava bullets have random colors between red and yellow.
//								let w = [randomReal(-lavaHorizontalMaxSpeed, lavaHorizontalMaxSpeed), randomReal(-lavaVerticalMaxSpeed, 0)];
								let w = [randomReal(-lavaHorizontalMaxSpeed, lavaHorizontalMaxSpeed), -lavaVerticalMaxSpeed * (bulletNum + randomReal(0, 1)) / totalLavaBullets];
								let radius = randomReal(4, 8);
								createBullet(structuredClone(this.position), function(t) {
									this.position = addVectors(this.position, w);
									w[1] += lavaVerticalMaxSpeed * 0.004; // This clears out after 500 frames.
									if (this.position[1] > realMaximumY) { // These bullets have very high `maximumY` as they can go significantly above the visible screen, but should be deleted as soon as they reach the bottom.
										this.position[0] = 1000;
									}
								}, circularRenderFunction(radius, hsltohex(hue, 100, 30), hsltohex(hue, 100, 50)), radialCollisionCheck(radius), 260, 5000);
							}
							// Creates the firework.
							let hue = randomReal(0, 360);
							let explosionHeight = randomReal(-240, -210);
							let flightAngle = bearingToAngle(randomReal(-5, 5));
							let fireworkSpeed = 25;
							createBullet(addVectors(this.position, polarToCartesian(10, flightAngle)), function() {
								this.position = addVectors(this.position, polarToCartesian(fireworkSpeed, flightAngle));
								fireworkSpeed *= 0.97;
								// Creates a contrail behind the firework.
								createBullet(addVectors(this.position, polarToCartesian(-7, flightAngle), randomCartesianVector(2, 2)), function(t) {
									this.position = addVectors(this.position, polarToCartesian(-4, flightAngle));
									if (t === 5) {
										this.position[0] = 1000;
									}
								}, circularRenderFunction(4, hsltohex(hue, 100, 45), hsltohex(hue, 100, 50)), radialCollisionCheck(4));
								if (this.position[1] < explosionHeight) {
									playAudio("se_tan02");
									for (let bulletNum = 0; bulletNum < cinderRingSize; bulletNum++) {
										let angle = cinderPhase + Math.PI * 2 * bulletNum / cinderRingSize;
										createBullet(addVectors(this.position, polarToCartesian(5, angle)), function(t) {
											this.position = addVectors(this.position, polarToCartesian(cinderMaxSpeed * ((bulletNum % 2 === 0) ? 0.67 : 1) * (1 - Math.exp(-t * 0.025)), angle));
										}, circularRenderFunction(4, hsltohex(hue, 100, 35), hsltohex(hue, 100, 50)), radialCollisionCheck(4));
									}
									this.position[0] = 1000;
								}
							}, circularRenderFunction(7, hsltohex(hue, 100, 35), hsltohex(hue, 100, 50)), radialCollisionCheck(7), 500, 500);
						}
					}, circularRenderFunction(10, "#999900", "#ffff00"), radialCollisionCheck(10), undefined, undefined, {indestructible: true});
				},
				waveOrientation: plusMinus1(), // Determines if the first wave of fireworks sweeps to the left or right.
				currentShotX: randomReal(-245, -225),
				cinderPhase: Math.PI * 2 * Math.random(),
				behaviourFunction: function(t) {
					if (t === 1) {
						currentBoss.targetPosition = [185 * this.waveOrientation, -200];
					}
					// Periodically sweeps out about two-thirds of the board with explosive shots, like those of magma elementals except they create less lava bullets which travel more slowly but with a much higher horizontal range.
					// These shots also create fireworks, which fly vertically upwards and explode creating circular cinder waves at a constant phase.
					let shotSpacing = [60, 45, 36, 30][difficulty];
					let shotMaxX = [75, 120, 150, 165][difficulty];
					let shotInterval = [20, 15, 12, 10][difficulty];
					let waveInterval = [450, 450, 450, 450][difficulty];
					if (((t - 80) % shotInterval === 1) && (this.currentShotX < shotMaxX)) {
						this.explosiveShot(this.currentShotX * this.waveOrientation, this.cinderPhase);
						this.currentShotX += shotSpacing;
					} else if ((t - 80) % waveInterval === waveInterval - 125) {
						this.waveOrientation *= -1; // Alternates left-sweeping and right-sweeping waves. We change this before 
					} else if ((t - 80) % waveInterval === waveInterval - 1) {
						// We set this slightly after `waveOrientation` so Lexan starts moving before the next wave is fired.
						this.currentShotX = randomReal(0, shotSpacing) - 250;
						this.cinderPhase = Math.PI * 2 * Math.random();
					}
/*					if (t % 150 === 149) {
						currentBoss.targetPosition = addVectors(currentBoss.targetPosition, randomPolarVector(15, 30));
						currentBoss.targetPosition = clampVector(currentBoss.targetPosition, -150, 150, -225, -175);
					} */
					if (t > 50) {
						currentBoss.targetPosition[0] = clampNumber(currentBoss.targetPosition[0] - 2, 185 * this.waveOrientation, currentBoss.targetPosition[0] + 2);
					}
				}
			},
			S9: {
				name: "\"Still Room of Seven Shards\"",
				HP: Number.MIN_VALUE, // Not used, but makes the boss health bar appear full during the spell.
				isSurvival: true,
				guaranteedScore: 500000,
				captureScore: 4280000,
				dropList: {point: 100, fullpower: 1},
				maxFrames: 5600,
				createWallBullet: function(startPosition, startVelocityX, startVelocityY) {
					createBullet(startPosition, function() {
						let T = currentBoss.currentAttackTime;
						if (T < 2450) {
							this.position[0] += startVelocityX * clampNumber(0, 18 - T / 100, 1);
							this.position[1] += startVelocityY * clampNumber(0, 18 - T / 100, 1);
						} else if (T === 2450) {
							this.collapseStart = structuredClone(this.position);
							this.collapseCentre = structuredClone(playerPosition);
						} else if (T < 3200) {
							let collapseTime = [175, 150, 125, 100][difficulty];
							this.position[0] = this.collapseStart[0] + (this.collapseCentre[0] - this.collapseStart[0]) * ((T - 2450) / collapseTime) ** 2;
							this.position[1] = this.collapseStart[1] + (this.collapseCentre[1] - this.collapseStart[1]) * ((T - 2450) / collapseTime) ** 2;
						} else { // Special case if `collapseStart` and `collapseCentre` are the same, causing the wall to never move at all.
							this.position[0] = 10000;
						}
					}, circularRenderFunction(4, "#cccccc", "#ffffff"), radialCollisionCheck(4), (startVelocityX === 0) ? 900 : 270, (startVelocityY === 0) ? 900 : 320, {indestructible: true});
				},
				createMemoryShard: function(targetPosition, timer, isWeak = false) {
					playSingleAudio("se_boon00", "memoryshard" + frame);
					// Approaches the target position from either the top or bottom of the screen, depending on the player's position.
					createEnemy([targetPosition[0], (playerPosition[1] < targetPosition[1]) ? 420 : -420], function(t) {
						this.position[1] = this.position[1] * 0.96 + targetPosition[1] * 0.04;
						if (timer < t) {
							if (t % 5 === 0) {
								playSingleAudio("se_kira00", "memoryshardbullet" + frame, 0.5);
							}
							let totalBullets = isWeak ? [1, 2, 3, 4][difficulty] : [16, 20, 24, 28][difficulty];
							let minSpeed = [0.165, 0.15, 0.135, 0.125][difficulty];
							let maxSpeed = [4.5, 6, 8, 10][difficulty] * (isWeak ? 1 : 4);
							for (let bulletNum = 0; bulletNum < totalBullets; bulletNum++) {
								let angle = Math.PI * 2 * Math.random();
								let targetSpeed = minSpeed * (maxSpeed / minSpeed) ** Math.random();
								let initialSpeed = randomReal(targetSpeed, maxSpeed);
								let decayRate = randomReal(0, [0.04, 0.05, 0.06, 0.07][difficulty]);
								createBullet(addVectors(this.position, polarToCartesian(100, angle)), function() {
									this.indestructible = Math.random() > (bombIsActive() ? 0.001 : 0.015); // Not deleting bullets on miss/bomb makes this spell card extremely difficult, deleting all makes it trivial: middle ground.
									this.speed = this.speed * (1 - decayRate) + targetSpeed * decayRate;
									this.position = addVectors(this.position, polarToCartesian(this.speed, angle));
								}, circularRenderFunction(6, "#990000", "#cc0000"), radialCollisionCheck(6), undefined, undefined, {speed: initialSpeed, indestructible: true});
							}
						}
						if (t === (timer + (isWeak ? 250 : 100))) {
							this.HP = 0;
						}
					}, memoryShardRenderFunction(timer), radialCollisionCheck(17), 100, 1000, {power: 1}, undefined, undefined, undefined, {invincible: true}); // Store the timer for the render function.
				},
				createAmberShard: function(targetPosition) {
					playSingleAudio("se_boon00", "memoryshard" + frame);
					// Again, approaches the target position from either the top or bottom of the screen.
					createEnemy([targetPosition[0], (playerPosition[1] < targetPosition[1]) ? 350 : -350], function(t) {
						this.position[1] = this.position[1] * 0.96 + targetPosition[1] * 0.04;						
						if ((50 <= t) && (t % 3 === 0)) {
							if (t % 9 === 0) {
								playAudio("se_tan00", 0.3);
							}
							let totalAngles = [4, 5, 6, 8][difficulty];
							let averageSpeed = [2.4, 2.5, 2.7, 3][difficulty];
							for (let angleNum = 0; angleNum < totalAngles; angleNum++) {
								let primaryAngle = angleToPlayer(this.position); // Tracks the player during the burst.
								let angle = primaryAngle + Math.PI * 2 * angleNum / totalAngles;
								// Total lifetime of the amber shard is 675 frames; fire speeds up uniformly from 0.8x to 1.2x in this time.
								let v = polarToCartesian(averageSpeed * randomReal(0.9, 1.1) * (0.8 + t / 1687.5), angle);
								createBullet(addVectors(this.position, randomPolarVector(0, 15)), function() {
									this.position = addVectors(this.position, v);
								}, circularRenderFunction(7, "#fd5909", "#ff9933"), radialCollisionCheck(7));
							}
						}
					}, amberShardRenderFunction, radialCollisionCheck(17), 100, 1000, {power: 1}, undefined, undefined, undefined, {invincible: true});
				},
				nextShardPosition: [220 * plusMinus1(), 270 * plusMinus1()],
				behaviourFunction: function(t) {
					if (t === 30) { // Removes Lexan from the screen...
						currentBoss.targetPosition = [(playerPosition[0] < 0) ? 500 : -500, -300];
					} else if (t === 150) { // ... and then teleports him to be right above the screen so that this card's item drops work correctly.
						currentBoss.targetPosition = [0, -400];
						enemies[currentBoss.enemyId].position = [0, -400];
						currentBoss.currentAttackTime += 2300;
					}
					// In the first phase, creates ten sets of white walls which close in from all four directions.
					// The centres of adjacent walls are 200 pixels apart.
					let wallInterval = 200;
					if (numberIsBounded(100, t, 1700) && ((t - 100) % wallInterval === 1)) {
						playSingleAudio("se_tan00", "lexansurvival" + frame);
						let wallWidth = [64, 64, 64, 64][difficulty];
						let wallSpeed = [0.8, 0.8, 0.8, 0.8][difficulty];
						let wallSpacing = [240, 208, 184, 160][difficulty];
						let xStart = -260 - wallWidth + wallSpacing * randomReal(0, 1);
						for (let x0 = xStart; x0 <= 260; x0 += wallSpacing) {
							for (let x = x0; x <= x0 + wallWidth; x += 8) {
								this.createWallBullet([x, -310], 0, wallSpeed);
								this.createWallBullet([-x, 310], 0, -wallSpeed);
							}
						}
						let yStart = -310 - wallWidth + wallSpacing * randomReal(0, 1);
						for (let y0 = yStart; y0 <= 310; y0 += wallSpacing) {
							for (let y = y0; y <= y0 + wallWidth; y += 8) {
								this.createWallBullet([-260, y], wallSpeed, 0);
								this.createWallBullet([260, -y], -wallSpeed, 0);
							}
						}
					}
					// Starting with the second set of walls, shoot gas from outside the screen at the player at wide angles.
					// Starting with the fifth set, gas is shot in the interval between two walls as well.
					// After the ninth set, the walls become stationary, and gas is now shot twice as frequently again.
					if ([301, 501, 701, 901, 1001, 1101, 1201, 1301, 1401, 1501, 1601, 1701, 1751, 1801, 1851, 1901, 1951, 2001, 2051, 2101, 2151, 2201, 2251, 2301].includes(t)) {
						playSingleAudio("se_tan00", "lexansurvival" + frame);
						let startPosition = randomPolarVector(400);
						let principalAngle = angleToPlayer(startPosition);
						let angleSpread = [0.1, 0.115, 0.13, 0.15][difficulty];
						let totalBullets = [16, 32, 48, 64][difficulty];
						let minSpeed = [1.5, 1.65, 1.8, 2][difficulty];
						let maxSpeed = [2, 2.5, 3, 3.5][difficulty];
						for (let bulletNum = 0; bulletNum < totalBullets; bulletNum++) {
							let radius = randomReal(4, 6);
							let v = randomPolarVector(minSpeed, maxSpeed, principalAngle - angleSpread, principalAngle + angleSpread);
							createBullet(structuredClone(startPosition), function() {
								this.position = addVectors(this.position, v);
							}, circularRenderFunction(radius, "#6600cc", "#9900ff"), radialCollisionCheck(radius));
						}
					}
					if (t === 2450) {
						playAudio("se_boon01"); // This is when the walls close in on the player.
					}
					// In the second phase, sequentially creates 7 red shards which stay stationary for a while, then shoot bullets which reach all parts of the screen except those immediately adjacent to each shard.
					// The first shard is in the centre of the screen.
					// The second shard is in a corner of the screen.
					// The third shard is in one of the orthogonally adjacent corners of the screen.
					// The fourth shard is in the diagonally opposite corner of the screen.
					// The fifth and sixth shards spawn together at opposite horizontal sides. They shoot slower bullets than the others.
					// The seventh shard is a super amber shard similar to the one in the transition from the Capitol to ocean section.
					if (t === 2650) {
						document.getElementById("div_bossSpellCaptureText").innerText = "Get to the safe zone!"
						document.getElementById("div_bossSpellCaptureText").style.opacity = 1;
						scheduleUnclearableStageEvent(100, function() {
							document.getElementById("div_bossSpellCaptureText").style.opacity = 0;
						})
						this.createMemoryShard([0, 0], 175, false);
					}
					if (t === 2925) {
						this.createMemoryShard(structuredClone(this.nextShardPosition), 300, false);
						this.nextShardPosition[ranint(0, 1)] *= -1;
					}
					if (t === 3325) {
						this.createMemoryShard(structuredClone(this.nextShardPosition), 375, false);
						this.nextShardPosition[0] *= -1;
						this.nextShardPosition[1] *= -1;
					}
					if (t === 3800) {
						this.createMemoryShard(structuredClone(this.nextShardPosition), 500, false);
					}
					if (t === 4400) {
						this.createMemoryShard([0, -270], 200, true);
						this.createMemoryShard([0, 270], 200, true);
					}
					if (t === 4925) {
						this.createAmberShard([0, 0]);
					}
				}
			},
			S10: { // Final spell.
				name: "\"Exotic Matter World of Universal Gravitation\"",
				HP: 9000,
				guaranteedScore: 1000000,
				captureScore: 9999990,
				dropList: {},
				maxFrames: 9860,
				slowDefeat: true,
				phaseTransitions: { // Only one of these needs to be met for the next phase to start - i.e. either this section of the health bar must be reached or the current phase is timed out.
					HP: [7500, 5500, 3000],
					frames: [1860, 3860, 6360] // 160, 120 and 70 seconds left.
				},
				calculatePhase: function() {
					for (let phaseNum = 1; phaseNum < 4; phaseNum++) {
						if ((enemies[currentBoss.enemyId].HP > this.phaseTransitions.HP[phaseNum - 1]) && (currentBoss.currentAttackTime < this.phaseTransitions.frames[phaseNum - 1]))  {
							return phaseNum;
						}
					}
					return 4;
				},
				currentPhase: 1,
				blackHoleCollisionCheck: function(position1, position2) {
					return radialCollisionCheck(this.radius)(position1, position2);
				},
				phase2PrincipalAngle: undefined,
				phase2Direction: plusMinus1(),
				onDefeat: function() {
					Bosses.lexan.isDefeated = true;
					if (continuesLeft === 3) { // If no continues have been used
						scheduleUnclearableStageEvent(70, function() {
							startDialogue(42);
							beginCutscene();
						});
					} else {
						playAudio("se_pldead00");
						endGame();
						processVirtueGain();
						setTimeout(function() {
							openMenuWindow("badEnding");
							playBGM("bgm_title", 3, 60);
						}, 4000);
					}
				},
				behaviourFunction: function(t) {
					if (this.currentPhase < this.calculatePhase()) {
						this.currentPhase++;
						playAudio("se_tan00");
					}
					if (t === 1) {
						if (playerPosition[1] < -150) { // Prevent Lexan ramming the player if they are right at the top of the screen. We do this here rather than at the end of spell 9 so drops are not instantly despawned.
							enemies[currentBoss.enemyId].position[1] = 400;
						}
						currentBoss.targetPosition = [0, -150];
					}
					// Creates a black hole which attracts all other bullets, as well as the player.
					if (t === 100) {
						playAudio("se_big");
						createBullet([0, -150], function(t) {
							// Moves up to the desired position at [0, -240].
							this.position[1] = this.position[1] * 0.98 - 4.8;
							// After the 50th frame, grows from 6px to 40px. It then grows 4px more after each phase transition.
							if (50 < t) {
								this.radius = this.radius * 0.975 + 0.9 + 0.1 * Bosses.lexan.attacks.S10.currentPhase;
							}
							// Attracts all other bullets according to the inverse square law and their `mass` property.
							// All bullets for this spell card have a `velocity` property, and for the most part their motion is entirely governed by the black hole.
							// As such, they have empty behaviour functions.
							let fieldStrength = [25, 30, 35, 40][difficulty] * this.radius;
							for (let bulletId of Object.keys(bullets)) {
								if (bulletId != this.id) { // Prevent division by zero
									bullets[bulletId].velocity = addVectors(bullets[bulletId].velocity, polarToCartesian(fieldStrength / (squaredDistance(bullets[bulletId].position, this.position) * bullets[bulletId].mass), angleToObject(bullets[bulletId].position, this.position)));
									bullets[bulletId].position = addVectors(bullets[bulletId].position, bullets[bulletId].velocity);
									if (squaredDistance(bullets[bulletId].position, this.position) < 1600) {
										delete bullets[bulletId];
									}
								}
							}
							for (let bulletId of Object.keys(playerBullets)) {
								playerBullets[bulletId].velocity = addVectors(playerBullets[bulletId].velocity, polarToCartesian(fieldStrength / (squaredDistance(playerBullets[bulletId].position, this.position) * playerBullets[bulletId].mass), angleToObject(playerBullets[bulletId].position, this.position)));
								playerBullets[bulletId].position = addVectors(playerBullets[bulletId].position, playerBullets[bulletId].velocity);
								if (squaredDistance(playerBullets[bulletId].position, this.position) < 1600) {
									delete playerBullets[bulletId];
								}
							}
							// Attracts the player. The player has a very low mass of 0.01 as we apply the force to their position rather than their velocity.
							let playerFieldStrength = fieldStrength / 500000;
							let playerSquaredDistance = squaredDistance(playerPosition, this.position);
							let newPlayerPosition = addVectors(playerPosition, polarToCartesian(Math.min(fieldStrength / (playerSquaredDistance * 0.01), Math.sqrt(playerSquaredDistance)), angleToObject(playerPosition, this.position)));
							// We write the new player position this way to avoid `Uncaught TypeError: "playerPosition" is read-only`.
							playerPosition[0] = newPlayerPosition[0];
							playerPosition[1] = newPlayerPosition[1];
							// Animates the black hole.
							for (let fieldParticle = randomReal(0, 1); fieldParticle < fieldStrength / 1000; fieldParticle++) {
								createBullet(addVectors(this.position, randomPolarVector(150)), function() {}, circularRenderFunction(3, "#0000cc", "#0000ff"), radialCollisionCheck(3), 1000, 1000, {indestructible: true, velocity: [0, 0], mass: 1});
							}
						}, blackHoleRenderFunction, this.blackHoleCollisionCheck, 260, 310, {massive: true, indestructible: true, radius: 6});
					}
					// Phase 1. Spawns random bullets with random velocities off the screen.
					if (100 < t) {
						if (t % 6 === 0) {
							playAudio("se_tan00", 0.07);
						}
						let phase1BulletsPerFrame = [0.25, 0.35, 0.45, 0.6][difficulty];
						let phase1BulletMaxSpeed = [0.3, 0.4, 0.7, 1][difficulty];
						let phase1BulletsThisFrame = Math.floor(phase1BulletsPerFrame + Math.random());
						for (let bulletNum = 0; bulletNum < phase1BulletsThisFrame; bulletNum++) {
							let spawnAngle = Math.PI * 2 * Math.random();
							let maxDeflection = [0.3, 0.4, 0.5, 0.6][difficulty];
							let velocityAngle = spawnAngle + Math.PI * (1 + maxDeflection * randomReal(-1, 1));
							createBullet(polarToCartesian(400, spawnAngle), function() {}, circularRenderFunction(5, "#00cccc", "#00ffff"), radialCollisionCheck(5), 1000, 1000, {velocity: polarToCartesian(randomReal(0, phase1BulletMaxSpeed), velocityAngle), mass: 1});
						}
					}
					// Phase 2. Spawns streams of bullets off the screen aimed directly into the black hole at random angles.
					if (2 <= this.currentPhase) {
						let phase2WavePeriod = [75, 99, 111, 120][difficulty];
						if (t % phase2WavePeriod === phase2WavePeriod - 1) {
							this.phase2PrincipalAngle = Math.PI * 2 * Math.random();
							this.phase2Direction *= -1;
						}
						let phase2WaveDuration = [33, 51, 75, 99][difficulty];
						if ((t % phase2WavePeriod < phase2WaveDuration) && (t % 3 === 0) && (this.phase2PrincipalAngle !== undefined)) {				
							if (t % 6 === 0) {
								playAudio("se_tan00", 0.12);
							}
							let phase2RingSize = [10, 12, 14, 16][difficulty];
							for (let bulletNum = 0; bulletNum < phase2RingSize; bulletNum++) {
								let angle = this.phase2PrincipalAngle + Math.PI * 2 * bulletNum / phase2RingSize;
								createBullet(addVectors(polarToCartesian(-610, angle), [0, -240]), function() {}, arrowBulletRenderFunction("#bf9000", 4), radialCollisionCheck(4), undefined, undefined, {angle: angle, velocity: polarToCartesian(3, angle), mass: 0.4});
							}
							this.phase2PrincipalAngle += [0.004, 0.005, 0.006, 0.007][difficulty] * this.phase2Direction;
						}
					}
					// Phase 3. Spawns rings of bullets off the screen aimed directly into the black hole at fixed angles.
					if (3 <= this.currentPhase) {
						let phase3RingSize = [12, 16, 20, 24][difficulty];
						let phase3RingSpeed = [2, 2.5, 3.2, 4][difficulty];
						let phase3RingInterval = [100, 75, 60, 50][difficulty];
						if (t % phase3RingInterval === 0) {
							playAudio("se_lgods4");
							for (let bulletNum = 0; bulletNum < phase3RingSize; bulletNum++) {
								let angle = Math.PI * (bulletNum * 2 + 1) / phase3RingSize; // Each orthogonal direction is directly between two bullet angles.
								createBullet(addVectors(polarToCartesian(-610, angle), [0, -240]), function() {}, circularRenderFunction(8, "#990000", "#ff0000"), radialCollisionCheck(8), undefined, undefined, {velocity: polarToCartesian(phase3RingSpeed, angle), mass: 2});
							}
						}
					}
					// Phase 4. Lexan shoots bullets which explode into circular waves of smaller bullets on the screen.
					if (this.currentPhase === 4) {
						let phase4TotalShots = [2, 2, 4, 4][difficulty];
						let phase4ShotInterval = [150, 110, 120, 90][difficulty];
						let phase4RingSize = [8, 8, 8, 8][difficulty];
						let phase4RingSpeed = [2, 2.3, 2.4, 2.5][difficulty];
						if (t % phase4ShotInterval === 0) {
							playAudio("se_boon00");
							let bossPosition = enemies[currentBoss.enemyId].position;
							let angleFromPlayer = Math.PI + angleToPlayer(bossPosition);
							for (let shotNum = 0; shotNum < phase4TotalShots; shotNum++) {
								let shotTargetPosition = clampVector(addVectors(playerPosition, polarToCartesian(250, angleFromPlayer + Math.PI * [1, 5, 2, 4][shotNum] / 3 + randomReal(-0.1, 0.1))), -235, 235, -285, 285);
								let startingVelocity = [(shotTargetPosition[0] - bossPosition[0]) / 67.5, (shotTargetPosition[1] - bossPosition[1]) / 67.5];
								createBullet(structuredClone(bossPosition), function(t) {
									this.velocity = addVectors(this.velocity, multiplyVectors(startingVelocity, -0.005)); // Air resistance
									if (t === 90) {
										playAudio("se_kira00", 1);
										let principalAngle = Math.PI * 2 * Math.random();
										for (let bulletNum = 0; bulletNum < phase4RingSize; bulletNum++) {
											let angle = principalAngle + Math.PI * 2 * bulletNum / phase4RingSize;
											createBullet(addVectors(this.position, polarToCartesian(4, angle)), function() {}, circularRenderFunction(6, "#cc9900", "#fac112"), radialCollisionCheck(6), 1000, 1000, {velocity: polarToCartesian(phase4RingSpeed, angle), mass: 3});
										}
										this.position[0] = 1000;
									}
								}, circularRenderFunction(9, "#cc9900", "#fac112"), radialCollisionCheck(9), undefined, undefined, {velocity: startingVelocity, mass: 8});
							}
						}
					}
					// Moves Lexan.
					if ((250 < t) && (t % 150 === 110)) {
						currentBoss.targetPosition = addVectors(currentBoss.targetPosition, randomPolarVector(30, 40));
						currentBoss.targetPosition = clampVector(currentBoss.targetPosition, -125, 125, -175, -125);
					}
				}
			}
		}
	},
	rin: {
		id: undefined, // Stores the second Lexan's id
		renderFunction: function(position) {
			drawImage("assets/img/lexan2.png", position[0], position[1] + 15 * Math.sin(0.025 * frame), 0, 0.25, true);
		}
	}
}
function lexanNonspell(startPosition, spawnerRingSize, spawnerRingSpeed, spawnerSplitPoint, seekerRingSize, seekerRingSpeed, seekerAdjacencyInterval, spawnerRingPhase = Math.PI * 2 * Math.random(), seekerAim = true, isRin = false) {
	// Creates the pattern present in every nonspell.
	// One or more rings of arrow bullets are shot in a circle, and upon traveling a certain distance, these split into:
	// (a) lasers of smaller arrow bullets travelling in the same direction but at a faster speed;
	// (b) rings of small white circle bullets, which are oriented such that one bullet in every ring is aimed at the player.
	playSingleAudio("se_tan00", "lexanNonspellSpawn" + frame, 0.5);
	for (let spawnerNum = 0; spawnerNum < spawnerRingSize; spawnerNum++) {
		let angle = spawnerRingPhase + Math.PI * 2 * spawnerNum / spawnerRingSize;
		createBullet(addVectors(startPosition, polarToCartesian(30, angle)), function(t) {
			let radius = 30 + spawnerRingSpeed * t * (t + 50) / 50;
			this.position = addVectors(startPosition, polarToCartesian(radius, angle));
			if (radius > spawnerSplitPoint) {
				playSingleAudio("se_kira00", "lexanNonspellSplit" + frame, 0.8);
				// Create the laser first.
				let extraT = t;
				let radiusAtSplit = 30 + spawnerRingSpeed * extraT * (extraT + 50) / 50;
				for (let arrowNum = 0; arrowNum < 7; arrowNum++) {
					let speedMult = 9 / (12 - arrowNum);
					createBullet(addVectors(startPosition, polarToCartesian(radiusAtSplit, angle)), function(t) {
						let rawRadius = 30 + spawnerRingSpeed * (t + extraT) * (t + extraT + 50) / 50;
						let trueRadius = radiusAtSplit + (rawRadius - radiusAtSplit) * speedMult;
						this.position = addVectors(startPosition, polarToCartesian(trueRadius, angle));
					}, arrowBulletRenderFunction(isRin ? "#ff9933" : "#6666ff", 4.5, angle), radialCollisionCheck(4.5)); // Arrows have default maximum X and Y after split as they now act as simple linear bullets.
				}
				let principalAngle = seekerAim ? angleToPlayer(this.position) : (Math.PI * 2 * Math.random());
				for (let seekerNum = spawnerNum % seekerAdjacencyInterval; seekerNum < seekerRingSize; seekerNum += seekerAdjacencyInterval) {
					let angle = principalAngle + Math.PI * 2 * seekerNum / seekerRingSize;
					createBullet(addVectors(this.position, polarToCartesian(2.5, angle)), function(t) {
						this.position = addVectors(this.position, polarToCartesian(seekerRingSpeed * (1 + t / 100), angle));
					}, circularRenderFunction(3.5, seekerAim ? "#cccccc" : "#999999", seekerAim ? "#ffffff" : "#cccccc"), radialCollisionCheck(3.5));
				}
				this.position[0] = 1000000;
			}
		}, arrowBulletRenderFunction(isRin ? "#ff9933" : "#6666ff", 6, angle), radialCollisionCheck(6), 1000, 1000); // Do not allow these to despawn before they split.
	}
}
function lexanNonspellX(startPosition, spawnerRingSize, spawnerRingSpeed, spawnerSplitPoint, seekerRingSize, seekerRingSpeed, seekerAdjacencyInterval, spawnerRingPhase = Math.PI * 2 * Math.random()) {
	// Creates the pattern present in every nonspell.
	// One or more rings of arrow bullets are shot in a circle, and upon traveling a certain distance, these split into:
	// (a) lasers of smaller arrow bullets travelling in the same direction but at a faster speed;
	// (b) rings of small white circle bullets, which are oriented such that one bullet in every ring is aimed at the player.
	for (let spawnerNum = 0; spawnerNum < spawnerRingSize; spawnerNum++) {
		let angle = spawnerRingPhase + Math.PI * 2 * spawnerNum / spawnerRingSize;
		createBullet(addVectors(startPosition, polarToCartesian(30, angle)), function(t) {
			let radius = 30 + spawnerRingSpeed * t * (t + 50) / 50;
			this.position = addVectors(startPosition, polarToCartesian(radius, angle));
			if (radius > spawnerSplitPoint) {
				// Create the laser first.
				let extraT = t;
				let radiusAtSplit = 30 + spawnerRingSpeed * extraT * (extraT + 50) / 50;
				for (let arrowNum = 0; arrowNum < 9; arrowNum++) {
					let speedMult = 12 / (16 - arrowNum);
					createBullet(addVectors(startPosition, polarToCartesian(radiusAtSplit, angle)), lexanNonspellSplitArrowBehaviourFunction, arrowBulletRenderFunction("#6666ff", 4.5, angle), radialCollisionCheck(4.5), undefined, undefined, {spawnerRingSpeed: spawnerRingSpeed, extraT: extraT, radiusAtSplit: radiusAtSplit, speedMult: speedMult, startPosition: startPosition}); // Arrows have default maximum X and Y after split as they now act as simple linear bullets.
				}
				let principalAngle = angleToPlayer(this.position);
				for (let seekerNum = spawnerNum % seekerAdjacencyInterval; seekerNum < seekerRingSize; seekerNum += seekerAdjacencyInterval) {
					let angle = principalAngle + Math.PI * 2 * seekerNum / seekerRingSize;
					createBullet(addVectors(this.position, polarToCartesian(2.5, angle)), lexanNonspellSeekerBehaviourFunction, circularRenderFunction(3.5, "#cccccc", "#ffffff"), radialCollisionCheck(3.5), undefined, undefined, {seekerRingSpeed: seekerRingSpeed, angle: angle});
				}
				this.position[0] = 1000000;
			}
		}, arrowBulletRenderFunction("#6666ff", 6, angle), radialCollisionCheck(6), 1000, 1000); // Do not allow these to despawn before they split.
	}
}
function lexanNonspellSplitArrowBehaviourFunction(t) {
	let rawRadius = 30 + this.spawnerRingSpeed * (t + this.extraT) * (t + this.extraT + 50) / 50;
	let trueRadius = this.radiusAtSplit + (rawRadius - this.radiusAtSplit) * this.speedMult;
	this.position = addVectors(this.startPosition, polarToCartesian(trueRadius, this.angle));
}
function lexanNonspellSeekerBehaviourFunction(t) {
	this.position = addVectors(this.position, polarToCartesian(this.seekerRingSpeed * (1 + t / 100), this.angle));
}
// Visibility is 0 before appearing, 0.4 when idle, 0.9 when speaking.
export const dialoguePortraitVisibilities = {
	player: 0,
	boss: 0,
	playerTarget: 0,
	bossTarget: 0
}
export const dialogueList = {
	// Zenryaku's midboss dialogue
	0: {
		speaker: "Zenryaku",
		text: "Oh, you're here? They just keep coming...",
		maxFrames: 150
	},
	1: {
		speaker: "Zenryaku",
		text: "The Mountain is about to erupt. Please turn back immediately!",
		maxFrames: 150,
		onAdvance: function() {
			hideBossTitleCard();
			currentDialogueId = undefined;
			endCutscene();
		}
	},
	// Lexan's boss dialogue
	2: {
		speaker: "Luigin",
		text: "It's just as I expected.",
		maxFrames: 200,
	},
	3: {
		speaker: "Luigin",
		text: "The Mountain has been rebuilt.",
		maxFrames: 200,
		onAdvance: function() {
			createBoss("lexan");
			currentBoss.targetPosition = [0, -120];
			currentDialogueId = undefined;
			scheduleUnclearableStageEvent(100, function() {
				startDialogue(4);
			});
		}
	},
	4: {
		speaker: "Lexan",
		text: "Have you come to watch the show?",
		maxFrames: 300
	},
	5: {
		speaker: "Luigin",
		text: "The show?",
		maxFrames: 300
	},
	6: {
		speaker: "Lexan",
		text: "Every year we have a firework show on the night of Annuation. Have you forgotten already?",
		maxFrames: 300
	},
	7: {
		speaker: "Luigin",
		text: "But... why are we here?",
		maxFrames: 300,
		onAdvance: function() {
			showBossTitleCard("lexan");
			startDialogue(8);
		}
	},
	8: {
		speaker: "Lexan",
		text: "Ah, you have forgotten why we call this place Annuation Mountain as well.",
		maxFrames: 300
	},
	9: {
		speaker: "Lexan",
		text: "Do not worry. I will remind you.",
		maxFrames: 300
	},
	10: {
		speaker: "Lexan",
		text: "When the Capitol was founded, this volcano was designed to erupt on every Annuation.",
		maxFrames: 300
	},
	11: {
		speaker: "Lexan",
		text: "Instead of these primitive, artificial fireworks, the whole world would witness a meteor shower rising from the depths of the earth.",
		maxFrames: 300
	},
	12: {
		speaker: "Lexan",
		text: "But after the second Annuation, it collapsed and never erupted again.",
		maxFrames: 300,
		onAdvance: function() {
			hideBossTitleCard();
			startDialogue(13);
		}
	},
	13: {
		speaker: "Luigin",
		text: "You mean...",
		maxFrames: 300
	},
	14: {
		speaker: "Luigin",
		text: "You rebuilt it for this?",
		maxFrames: 300
	},
	15: {
		speaker: "Lexan",
		text: "To give a straightforward and evasive answer, no one still lives here with that kind of power.",
		maxFrames: 300
	},
	16: {
		speaker: "Lexan",
		text: "We at the Ministry were all sure that the Mountain would stay dormant year after year until the end of time.",
		maxFrames: 300
	},
	17: {
		speaker: "Lexan",
		text: "That was, until the Chancemaker retrieved this artifact from the ruins of the Old World.",
		maxFrames: 300
	},
	18: {
		speaker: "Lexan",
		text: "With this staff's power, we were able to recreate the Mountain.",
		maxFrames: 300
	},
	19: {
		speaker: "Lexan",
		text: "So too, with its power, I can make it erupt in time for midnight.",
		maxFrames: 300
	},
	20: {
		speaker: "Lexan",
		text: "Where is Zenryaku anyway?",
		maxFrames: 300
	},
	21: {
		speaker: "Luigin",
		text: "I saw them at the bottom of the mountain.",
		maxFrames: 300
	},
	22: {
		speaker: "Luigin",
		text: "They were stopping everyone from climbing up because of this show...",
		maxFrames: 300
	},
	23: {
		speaker: "Lexan",
		text: "So that is why no one else has come here yet...",
		maxFrames: 300
	},
	24: {
		speaker: "Lexan",
		text: "They too have complained that this is too dangerous.",
		maxFrames: 300,
	},
	25: {
		speaker: "Lexan",
		text: "Foolish of you both, I must say.",
		maxFrames: 300
	},
	26: {
		speaker: "Luigin",
		text: "Last time the Mountain erupted, it nearly destroyed the world!",
		maxFrames: 300
	},
	27: {
		speaker: "Lexan",
		text: "The world is more stable now than it was then.",
		maxFrames: 300
	},
	28: {
		speaker: "Luigin",
		text: "It has only been four years since then...",
		maxFrames: 300
	},
	29: {
		speaker: "Lexan",
		text: "Four years is a long time.",
		maxFrames: 300
	},
	30: {
		speaker: "Lexan",
		text: "And in any case, who is Zenryaku to tell me \"this might destroy the Capitol\"?",
		maxFrames: 300
	},
	31: {
		speaker: "Lexan",
		text: "How is that any different from what their kind did...",
		maxFrames: 300
	},
	32: {
		speaker: "Lexan",
		text: "...having abandoned it and left it to die?",
		maxFrames: 300
	},
	33: {
		speaker: "Lexan",
		text: "This land is almost completely deserted now. With this show, I will breathe new life into it.",
		maxFrames: 300
	},
	34: {
		speaker: "Luigin",
		text: "I can't allow this... I will get backup from the Capitol!",
		maxFrames: 300
	},
	35: {
		speaker: "Lexan",
		text: "You get on with that then.",
		maxFrames: 300
	},
	36: {
		speaker: "Lexan",
		text: "By the time you reach the Capitol, they will be watching the show!",
		maxFrames: 300
	},
	37: {
		speaker: "Luigin",
		text: "Ah, there's not enough time...",
		maxFrames: 300
	},
	38: {
		speaker: "Luigin",
		text: "Well, it doesn't matter. I will handle this myself!",
		maxFrames: 300,
		onAdvance: function() {
			playBGM("bgm_boss", 24, 180.75);
			startDialogue(39);
		}
	},
	39: {
		speaker: "Lexan",
		text: "I won't allow you to ruin the festival.",
		maxFrames: 300
	},
	40: {
		speaker: "Lexan",
		text: "Standing before you is the Celestial of Exotic Matter, Potential, Plasma and Terraforming.",
		maxFrames: 300
	},
	41: {
		speaker: "Lexan",
		text: "Now, begone and keep us in the dark ages no longer!",
		maxFrames: 300,
		onAdvance: function() {
			endCutscene();
			currentDialogueId = undefined;
			skipPhases(0);
		}
	},
	// Lexan's post-fight dialogue
	42: {
		speaker: "Luigin",
		text: "See? This is the power of nuclear fusion!",
		maxFrames: 300
	},
	43: {
		speaker: "Lexan",
		text: "Since when are you of all people so strong...",
		maxFrames: 300
	},
	44: {
		speaker: "Luigin",
		text: "Now, will you stop trying to blow up the Capitol?",
		maxFrames: 300
	},
	45: {
		speaker: "Lexan",
		text: "Why, obviously not!",
		maxFrames: 300
	},
	46: {
		speaker: "Lexan",
		text: "Your fireworks will never compare to the beauty of nature that is this mountain.",
		maxFrames: 300
	},
	47: {
		speaker: "Luigin",
		text: "*sigh*",
		maxFrames: 300
	},
	48: {
		speaker: "Luigin",
		text: "Let me go look for Zenryaku...",
		maxFrames: 300,
		onAdvance: function() {
			endGame();
			processVirtueGain();
			setTimeout(function() {
				openEnding();
			}, 4000);
		}
	}
}
export var currentDialogueId = undefined;
export var currentDialogueOpenTime = undefined;
export function startDialogue(id) {
	if (currentDialogueId === undefined) { // Initialises the visibility if this is the first dialogue in a set.
		dialoguePortraitVisibilities.player = 0;
		dialoguePortraitVisibilities.playerTarget = 0;
		dialoguePortraitVisibilities.boss = 0;
		dialoguePortraitVisibilities.bossTarget = 0;
	}
	if (dialogueList[id].speaker === "Luigin") {
		dialoguePortraitVisibilities.playerTarget = 1;
		dialoguePortraitVisibilities.bossTarget = Math.min(dialoguePortraitVisibilities.bossTarget, 0.5);
	} else {
		dialoguePortraitVisibilities.bossTarget = 1;
		dialoguePortraitVisibilities.playerTarget = Math.min(dialoguePortraitVisibilities.playerTarget, 0.5);
	}
	currentDialogueId = id;
	currentDialogueOpenTime = frame;
	document.getElementById("div_dialogueName").style["background-color"] = (dialogueList[id].speaker === "Luigin") ? "#008000" : Bosses[dialogueList[id].speaker.toLowerCase()].darkColor;
	document.getElementById("div_dialogueName").style.opacity = 1;
	document.getElementById("div_dialogueName").innerText = dialogueList[id].speaker;
	document.getElementById("div_dialogueText").style.opacity = 1;
	document.getElementById("div_dialogueText").innerText = dialogueList[id].text;
}
export function advanceDialogue() {
	if (dialogueList[currentDialogueId].onAdvance !== undefined) {
		dialogueList[currentDialogueId].onAdvance();
		if (dialogueList[currentDialogueId + 1] === undefined) {
			currentDialogueId = undefined;
			document.getElementById("div_dialogueName").style.opacity = 0;
			document.getElementById("div_dialogueText").style.opacity = 0;
		}
	} else {
		startDialogue(currentDialogueId + 1);
	}
}
export function clearCurrentDialogue() {
	currentDialogueId = undefined;
}
export function showBossTitleCard(bossId) {
	document.getElementById("div_dialogueBossTitle").style.opacity = 1;
	document.getElementById("div_dialogueBossTitle").style.color = Bosses[bossId].color;
	document.getElementById("span_dialogueBossTitle").innerText = Bosses[bossId].title;
	document.getElementById("span_dialogueBossName").innerText = Bosses[bossId].name;
}
function hideBossTitleCard() {
	document.getElementById("div_dialogueBossTitle").style.opacity = 0;
}