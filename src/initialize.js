import { audioFilesLoaded, loadRequiredAudio, requiredAudio } from "./audio.js";
import { keyDown, keyUp } from "./menu.js";
import { initialiseUpgradeInterface, loadPersistentData, updateUpgradeInterface } from "./persistent_data.js";
import { imageFilesLoaded, loadRequiredImages, requiredImages } from "./visuals.js";
function calculateTotalAssetsLoaded() {
	return audioFilesLoaded + imageFilesLoaded;
}
export var initializationComplete = false;
const requiredAssets = requiredAudio.length + requiredImages.length;
function updateLoadingScreen() {
	document.getElementById("div_loadScreenProgressBar").innerHTML = calculateTotalAssetsLoaded() + " / " + requiredAssets;
	let progressBarPercentage = calculateTotalAssetsLoaded() * 100 / requiredAssets;
	document.getElementById("div_loadScreenProgressBar").style.background = "linear-gradient(90deg, #00ff00, #00ff00 " + progressBarPercentage + "%, #808080 " + progressBarPercentage + "%, #808080)"
	if (calculateTotalAssetsLoaded() === requiredAssets) {
		initializationComplete = true;
		document.getElementById("button_initialize").style.display = "block";
		clearInterval(loadingScreenClockId);
	}
}
var loadingScreenClockId;
function bootload() {
	loadRequiredAudio();
	loadRequiredImages();
	document.body.addEventListener("keydown", keyDown);
	document.body.addEventListener("keyup", keyUp);
	loadPersistentData();
	initialiseUpgradeInterface();
	updateUpgradeInterface();
	loadingScreenClockId = setInterval(updateLoadingScreen);
}
bootload();