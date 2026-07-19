import { activeBGMProperties, pauseBGM, playAudio, playBGM, unpauseBGM } from "./audio.js";
import { advanceDialogue, currentDialogueId, dialogueList, startDialogue } from "./boss_data.js";
import { continuesLeft, difficulty, endGame, frame, gameIsPaused, gameOverScreenActive, isInCutscene, lastBomb, startGame, togglePause, useBomb, useContinue } from "./game.js";
import { initializationComplete } from "./initialize.js";
import { loadPersistentData, savePersistentData, updateRecordInteface, updateUpgradeInterface, wipeSave } from "./persistent_data.js";
import { modulo } from "./utility.js";

// The currently active window.
export var activeWindow = "initialize";
// The number of clicks still needed to wipe save.
var wipeSaveClicksLeft = 10;
// Functions that run whenever "X" is pressed, corresponding to the currently active button. Does not run while the active window is "game" (due to no buttons).
export const ZPresses = {
	initialize: {
		// "Press [Z] to begin". All assets must be loaded before this is clickable.
		0: async function() {
			openMainMenu();
		}
	},
	mainMenu: {
		// Game Start: open difficulty selector
		0: function() {
			openMenuWindow("chooseDifficulty");
		},
		// Upgrades
		1: function() {
			openMenuWindow("upgrades");
			updateUpgradeInterface();
		},
		// Records
		2: function() {
			openMenuWindow("records");
			updateRecordInteface();
		},
		// Credits
		3: function() {
			openMenuWindow("credits");
			advanceCredits(-currentCreditsTable); // Rewinds to table 0.
		},
		// Wipe Save
		4: function() {
			wipeSaveClicksLeft--;
			if (wipeSaveClicksLeft === 0) {
				wipeSave();
				wipeSaveClicksLeft = 10;
				document.getElementById("button_mainMenu_wipeSave").innerText = "Wipe Save";
			} else {
				document.getElementById("button_mainMenu_wipeSave").innerText = "Wipe Save (" + wipeSaveClicksLeft + " click" + ((wipeSaveClicksLeft === 1) ? "" : "s") + " left)";
			}
		}
	},
	chooseDifficulty: {
		// Easy Difficulty
		0: function() {
			startGame(0);
		},
		// Normal Difficulty
		1: function() {
			startGame(1);
		},
		// Hard Difficulty
		2: function() {
			startGame(2);
		},
		// Lunatic Difficulty
		3: function() {
			startGame(3);
		}
	},
	pauseMenu: {
		// Continue the Game
		0: function() {
			togglePause();
		},
		// Return to Main Menu
		1: function() {
			endGame(false);
		},
		// Start Over
		2: function() {
			endGame(true);
			startGame(difficulty);
		}
	},
	gameOver: {
		// Use Continue
		get 0() {
			return (continuesLeft === 0) ? undefined : useContinue;
		},
		// Return to Main Menu
		1: function() {
			endGame(false);
		},
		// Start Over
		2: function() {
			endGame(true);
			startGame(difficulty);
		}
	},
	ending: {
		// Press [Z] to continue
		0: function() {
			endingParagraphsVisible++;
			if (endingParagraphsVisible === totalEndingParagraphs) {
				openMenuWindow("credits");
				advanceCredits(-currentCreditsTable); // Rewinds to table 0.
			} else {
				if (endingParagraphClearPoints.includes(endingParagraphsVisible)) {
					for (let i = 0; i < endingParagraphsVisible; i++) {
						document.getElementById("p_ending" + i).style.display = "none";
					}
				}
				document.getElementById("p_ending" + endingParagraphsVisible).style.display = "block";
			}
		}
	},
	upgrades: {}, // This empty object gets initialised dynamically based on what upgrades exist.
}
const EscPresses = {
	chooseDifficulty: function() {
		openMenuWindow("mainMenu");
	},
	pauseMenu: function() {
		togglePause();
	},
	upgrades: function() {
		openMenuWindow("mainMenu");
	},
	records: function() {
		openMenuWindow("mainMenu");
	},
	credits: function() {
		openMenuWindow("mainMenu");
		if (activeBGMProperties.id !== "bgm_title") { // The credits theme plays instead of the title theme if this was opened after clearing the stage. Return to the stage theme on exit.
			playBGM("bgm_title", 3, 60);
		}
	},
	badEnding: function() {
		openMenuWindow("mainMenu");
	}
}
export function openMainMenu() {
	if (initializationComplete) {
		openMenuWindow("mainMenu");
		playBGM("bgm_title", 3, 60);
	}
}
// Moves up or down a button in a menu.
function switchMenuButton(displacement) {
	let buttons = Array.from(document.querySelectorAll("[data-menuWindow='" + activeWindow + "']"));
	let currentPosition = buttons.map(x => x.classList.contains("active")).indexOf(true);
	let newPosition = modulo(currentPosition + displacement, buttons.length);
	buttons[currentPosition].classList.remove("active");
	buttons[newPosition].classList.add("active");
	if (currentPosition !== newPosition) { // i.e. if there is not only one button in this menu
		playAudio("se_select00");
	}
}
// Switches the 13 buttons in Upgrades, accounting for their columnar layout.
// Here, horizontal arrows advance by 1 and vertical arrows advance by 3, with changed behaviour surrounding the fifth row.
function switchUpgradeMenuButton(displacement) {
	let buttons = Array.from(document.querySelectorAll("[data-menuWindow='" + activeWindow + "']"));
	let currentPosition = buttons.map(x => x.classList.contains("active")).indexOf(true);
	if (displacement > 0) {
		if (currentPosition !== 12) {
			displacement = Math.min(displacement, 12 - currentPosition);
		}
	} else {
		displacement = -Math.min(-displacement, currentPosition + 1);
	}
	let newPosition = modulo(currentPosition + displacement, buttons.length);
	buttons[currentPosition].classList.remove("active");
	buttons[newPosition].classList.add("active");
	updateUpgradeInterface();
	playAudio("se_select00");
}
// Displays a credits table.
var currentCreditsTable = 0;
function advanceCredits(displacement) {
	document.getElementById("div_creditsTable" + currentCreditsTable).style.display = "none";
	currentCreditsTable = modulo(currentCreditsTable + displacement, 2);
	document.getElementById("div_creditsTable" + currentCreditsTable).style.display = "inline-block";
	playAudio("se_select00");
	document.getElementById("div_creditsTableNumber").innerText = (currentCreditsTable + 1) + " / 2 | Use arrow keys to advance";
}
// Contains which keys (arrow keys + shift for focus + z for shoot) are currently being held.
export const activeKeys = {
	ArrowUp: false,
	ArrowDown: false,
	ArrowLeft: false,
	ArrowRight: false,
	Shift: false,
	z: false
}
// Updates `activeKeys` when a key is pressed, and processes menu button clicks.
export function keyDown(event) {
	if (activeKeys[event.key] !== undefined) {
		activeKeys[event.key] = true;
	}
	if (activeWindow === "game") { // If the game is currently active, we ignore all key presses except those governed by `activeKeys`, and pausing.
		if (gameOverScreenActive) {
			return;
		}
		if (event.key === "Escape") {
			togglePause();
		}
		if (gameIsPaused) {
			return;
		}
		if ((event.key === "x") && (frame - lastBomb > 350) && (!gameIsPaused) && (!isInCutscene)) { // Bomb duration is 6s.
			useBomb();
		}
		if ((event.key === "z") && (currentDialogueId !== undefined)) {
			advanceDialogue();
		}
	} else {
		if (event.key === "z") {
			let buttons = Array.from(document.querySelectorAll("[data-menuWindow='" + activeWindow + "']"));
			let currentPosition = buttons.map(x => x.classList.contains("active")).indexOf(true);
			if (ZPresses[activeWindow][currentPosition] !== undefined) {
				ZPresses[activeWindow][currentPosition]();
				playAudio("se_ok00");
			} else {
				playAudio("se_invalid");
			}
		} else if (event.key === "Escape") {
			if (EscPresses[activeWindow] !== undefined) {
				EscPresses[activeWindow]();
				playAudio("se_cancel00");
			} else {
				playAudio("se_invalid");
			}
		} else { // Switching works differently in Upgrades due to the columnar layout.
			if (activeWindow === "upgrades") {
				if (event.key === "ArrowUp") {
					switchUpgradeMenuButton(-3);
				} else if (event.key === "ArrowDown") {
					switchUpgradeMenuButton(3);
				} else if (event.key === "ArrowLeft") {
					switchUpgradeMenuButton(-1);
				} else if (event.key === "ArrowRight") {
					switchUpgradeMenuButton(1);
				}
			} else if (activeWindow === "credits") {
				if (event.key === "ArrowLeft") {
//					advanceCredits(-1);
				} else if (event.key === "ArrowRight") {
//					advanceCredits(1);
				}
			} else {
				if (event.key === "ArrowUp") {
					switchMenuButton(-1);
				} else if (event.key === "ArrowDown") {
					switchMenuButton(1);
				}
			}
		}
	}
}
// Updates `activeKeys` when a key is released.
export function keyUp(event) {
	if (activeKeys[event.key] !== undefined) {
		activeKeys[event.key] = false;
	}
}
// Changes the active window.
export function openMenuWindow(id) {
	document.getElementById("window_" + activeWindow).style.display = "none";
	activeWindow = id;
	document.getElementById("window_" + activeWindow).style.display = "block";
}
var endingParagraphsVisible = 1; // `4` means 0, 1, 2, 3 and 4 are visible, for example.
const endingParagraphClearPoints = [7]; // [7, 14] means that when the paragraphs with ID 7 and 14 are loaded, the screen is cleared.
const totalEndingParagraphs = 14;
export function openEnding() {
	openMenuWindow("ending");
	endingParagraphsVisible = 1;
	for (let i = 0; i < totalEndingParagraphs; i++) {
		document.getElementById("p_ending" + i).style.display = (i < 2) ? "block" : "none";
	}
	document.getElementById("p_ending13").innerHTML = document.getElementById("sidebar_difficulty").innerText.toUpperCase() + " Mode Clear! Thank you for playing <i>Ordinal Project 01</i>.";
	playBGM("bgm_ending", 7, 73.667);
}