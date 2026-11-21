const film = document.querySelector("#walkthrough");
const captions = film.querySelector("track");
const cueList = document.querySelector("#cues");
function renderTranscript() {
  if (cueList.childElementCount) return;
  for (const cue of captions.track.cues ?? []) {
    const time = document.createElement("time");
    const seconds = Math.floor(cue.startTime);
    time.textContent =
      Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
    const words = document.createElement("span");
    words.textContent = cue
      .getCueAsHTML()
      .textContent.replace(/\s+/g, " ")
      .trim();
    const button = document.createElement("button");
    button.type = "button";
    button.append(time, words);
    button.addEventListener("click", () => {
      film.currentTime = cue.startTime;
      film.play().catch(() => film.focus());
    });
    const row = document.createElement("li");
    row.append(button);
    cueList.append(row);
  }
}
captions.addEventListener("load", renderTranscript);
captions.track.mode = "hidden";
if (captions.readyState === 2) renderTranscript();
