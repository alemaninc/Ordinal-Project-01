// Use this `audioContext` to play all in-game audio.
export const audioContext = new AudioContext();
// Stores all audio which may be played as a `buffer` to be passed to `playAudio`.
const audio = {};
// Lists all the audio files which must be loaded by their file name (excluding the file ending).
export const requiredAudio = ["bgm_boss", "bgm_ending", "bgm_stage", "bgm_title", "se_big", "se_bonus", "se_boon00", "se_boon01", "se_cancel00", "se_cardget", "se_cat00", "se_ch00", "se_ch02", "se_damage00", "se_don00", "se_enep00", "se_enep01", "se_enep02", "se_etbreak", "se_extend", "se_fault", "se_graze", "se_invalid", "se_item00", "se_kira00", "se_lazer00", "se_lgods1", "se_lgods2", "se_lgods4", "se_nep00", "se_ok00", "se_pause", "se_pldead00", "se_pldead01", "se_plst00", "se_power0", "se_power1", "se_powerup", "se_select00", "se_tan00", "se_timeout"];
// We store this to be able to calculate how many files have been loaded for the loading screen.
export var audioFilesLoaded = 0;
// Retrieves a `buffer` for `playAudio` given a file path (e.g. "assets/audio/stage.mp3").
async function loadAudio(id) {
  let response = await fetch("assets/audio/" + id + ".mp3");
  let arrayBuffer = await response.arrayBuffer();
  audio[id] = await audioContext.decodeAudioData(arrayBuffer);
  audioFilesLoaded++;
}
// Creates a "source" to play a sound and plays it.
function playAudioFromBuffer(buffer, volume = 1) {
  let source = audioContext.createBufferSource();
  source.buffer = buffer;
  let gainNode = audioContext.createGain();
  gainNode.gain.value = volume;
  gainNode.connect(audioContext.destination);
  source.connect(gainNode);
  source.start();
}
/* Stores the source of the currently active background music. This is different from the standard `loadAudio` function because:
   - the source object is returned so it can be stopped when required in cases such as the stage theme;
   - the track loops. */
function playBGMFromBuffer(buffer, loopStart, loopEnd, startTime = 0) {
  if (activeBGMProperties.source !== undefined) { // If a background music is already playing, stop it.
    activeBGMProperties.source.stop();
  }
  let source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.loop = loopStart !== undefined;
  source.loopStart = loopStart;
  source.loopEnd = loopEnd;
  source.connect(audioContext.destination);
  source.start(0, startTime);
  activeBGMProperties.source = source;
}
// We store the source so that we can pause the BGM when needed, `loopStart`, `loopEnd` and `startTime` to pass into `playBGM` if a restart is needed, `startTimestamp` so we can recalculate `startTime` on pause and `id` so we can restart the sound on unpause.
export const activeBGMProperties = {source: undefined, loopStart: undefined, loopEnd: undefined, startTime: undefined, id: undefined, startTimestamp: undefined};
// Plays audio based on only its id in the `audio` object.
export function playAudio(id, volume = 1) {
  playAudioFromBuffer(audio[id], volume);
}
export function playBGM(id, loopStart, loopEnd, startTime = 0) {
  playBGMFromBuffer(audio[id], loopStart, loopEnd, startTime);
  activeBGMProperties.loopStart = loopStart;
  activeBGMProperties.loopEnd = loopEnd;
  activeBGMProperties.startTime = startTime;
  activeBGMProperties.id = id;
  activeBGMProperties.startTimestamp = audioContext.currentTime;
}
// Pauses, unpauses or completely stops the currently active BGM, if it exists.
export function pauseBGM() {
  if (activeBGMProperties.source !== undefined) {
    activeBGMProperties.startTime += audioContext.currentTime - activeBGMProperties.startTimestamp;
    activeBGMProperties.source.stop();
  }
}
export function unpauseBGM() {
  if (activeBGMProperties.source !== undefined) {
    playBGM(activeBGMProperties.id, activeBGMProperties.loopStart, activeBGMProperties.loopEnd, activeBGMProperties.startTime);
  }
}
export function stopBGM() {
  if (activeBGMProperties.source !== undefined) {
    activeBGMProperties.source.stop();
    activeBGMProperties.source = undefined; // This prevents restarting unlike `pauseBGM`.
  }
}
const singleAudioObject = {};
export function playSingleAudio(id, label, volume = 1) { // If multiple objects may cause the same audio to be played many times in one frame, pass them here, and only the first instance of a label that gets passed in a given frame will play audio.
  if (singleAudioObject[label] === undefined) {
    singleAudioObject[label] = true;
    playAudio(id, volume);
  }
}
// Preloads all required audio.
export function loadRequiredAudio() {
	for (let id of requiredAudio) {
		loadAudio(id);
	}
}