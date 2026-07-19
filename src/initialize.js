import { audioContext, audioFilesLoaded, BGMNode, loadRequiredAudio, requiredAudio } from "./audio.js";
import { keyDown, keyUp } from "./menu.js";
import { initialiseUpgradeInterface, loadPersistentData, persistentData, savePersistentData, updateUpgradeInterface } from "./persistent_data.js";
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
function initialiseSettings() {
	for (let soundType of Object.keys(persistentData.settings.volume)) {
		document.getElementById("input_settings_volume_" + soundType).value = persistentData.settings.volume[soundType];
		document.getElementById("span_settings_volume_" + soundType).innerText = Math.round(persistentData.settings.volume[soundType] * 100);
		document.getElementById("input_settings_volume_" + soundType).addEventListener("input", function() {
			persistentData.settings.volume[soundType] = document.getElementById("input_settings_volume_" + soundType).value;
			document.getElementById("span_settings_volume_" + soundType).innerText = Math.round(persistentData.settings.volume[soundType] * 100);
			savePersistentData();
		});
	}
	BGMNode.gain.value = persistentData.settings.volume.masterVolume * persistentData.settings.volume.BGM;
	for (let soundType of ["masterVolume", "BGM"]) {
		document.getElementById("input_settings_volume_" + soundType).addEventListener("input", function() { // Smoothly changes BGM volume.
			BGMNode.gain.cancelScheduledValues(audioContext.currentTime);
			BGMNode.gain.setValueAtTime(BGMNode.gain.value, audioContext.currentTime);
			BGMNode.gain.linearRampToValueAtTime(persistentData.settings.volume.masterVolume * persistentData.settings.volume.BGM, audioContext.currentTime + 0.25);
		})
	};
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
	initialiseSettings();
	loadingScreenClockId = setInterval(updateLoadingScreen);
}
bootload();