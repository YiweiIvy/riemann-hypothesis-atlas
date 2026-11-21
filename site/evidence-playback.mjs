import { evaluateGraph, mergeReviews } from './trust.mjs';
import { count, icon } from './ui.mjs';

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC',
});

// Each checkpoint closes a timestamp. A correction and the original evidence
// appear together in the prefix passed to the ordinary review engine.
export function evidenceFrames(nodes, reviews) {
  const ordered = mergeReviews(reviews);
  const points = [{at: null, end: 0}];
  for (const [index, review] of ordered.entries()) {
    if (points.at(-1).at !== review.at) points.push({at: review.at, end: index + 1});
    else points.at(-1).end = index + 1;
  }
  const cache = new Map();
  function frame(index) {
    if (!Number.isInteger(index) || index < 0 || index >= points.length) throw new RangeError('Unknown evidence checkpoint');
    if (cache.has(index)) return cache.get(index);
    const {at, end} = points[index];
    const records = ordered.slice(0, end);
    const value = {at, records, model: evaluateGraph(nodes, records)};
    // A long-running ledger can have thousands of timestamps. Keep only a
    // handful of snapshots in memory while retaining nearby scrub positions.
    if (cache.size === 5) cache.delete(cache.keys().next().value);
    cache.set(index, value);
    return value;
  }
  return {points, frame};
}

const shapes = {
  prev: '<path d="m14 5-7 7 7 7"/>', next: '<path d="m10 5 7 7-7 7"/>',
  play: '<path d="m8 5 11 7-11 7z" fill="currentColor"/>', pause: '<path d="M8 5v14m8-14v14" stroke-width="3"/>',
};
const glyph = (shape) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[shape]}</svg>`;
const control = (action, label) => `<button type="button" data-ep="${action}" aria-label="${label}" title="${label}">${glyph(action)}</button>`;

export function mountEvidencePlayback(host, {nodes, reviews, onFrame}) {
  const {points, frame} = evidenceFrames(nodes, reviews);
  const last = points.length - 1;
  // Give each observation a tick and scale its height by the number of records.
  // At large scales sample the marks, leaving every checkpoint on the slider.
  const tickEvery = Math.max(1, Math.ceil(last / 64));
  const ticks = points.slice(1).map(({end}, i) => {
    if (i % tickEvery && i + 1 !== last) return '';
    const height = Math.min(11, 3 + 2 * Math.log2(1 + end - points[i].end));
    return `<i style="left:${100 * (i + 1) / last}%;height:${height.toFixed(1)}px"></i>`;
  }).join('');
  host.innerHTML = `<div class="ev-playback" role="group" aria-label="Evidence replay">
    <span class="ev-name">${icon('evidence')} Evidence replay</span>
    <div class="ev-transport">${control('prev','Previous checkpoint')}${control('play','Play evidence history')}${control('next','Next checkpoint')}</div>
    <div class="ev-track"><span class="ev-marks" aria-hidden="true">${ticks}</span><input type="range" min="0" max="${last}" step="1" aria-label="Evidence checkpoint"></div>
    <div class="ev-at"><span class="ev-date"></span><small class="ev-count"></small></div></div>`;
  const root = host.firstElementChild;
  const slider = root.querySelector('input');
  const prev = root.querySelector('[data-ep=prev]');
  const next = root.querySelector('[data-ep=next]');
  const play = root.querySelector('[data-ep=play]');
  const date = root.querySelector('.ev-date');
  const quantity = root.querySelector('.ev-count');
  let current = -1, timer = null;

  function setFrame(index) {
    if (index === current || index < 0 || index > last) return;
    current = index;
    const state = frame(index);
    const label = state.at ? dateFormat.format(new Date(state.at)) + ' UTC' : last ? 'Before first review' : 'No reviews';
    const qty = count(state.records.length) + (state.records.length === 1 ? ' record' : ' records');
    date.textContent = label;
    if (state.at) date.title = state.at;
    else date.removeAttribute('title');
    quantity.textContent = qty;
    slider.value = String(current);
    slider.setAttribute('aria-valuetext', label + ', ' + qty);
    root.style.setProperty('--ev-progress', (last ? 100 * current / last : 0) + '%');
    prev.disabled = current === 0;
    next.disabled = current === last;
    onFrame(state);
  }
  function playbackState(active) {
    play.innerHTML = glyph(active ? 'pause' : 'play');
    const label = active ? 'Pause evidence history' : 'Play evidence history';
    play.setAttribute('aria-label', label);
    play.setAttribute('aria-pressed', String(active));
    play.title = label;
  }
  function stop() {
    if (timer === null) return;
    clearInterval(timer);
    timer = null;
    playbackState(false);
  }
  function playOrPause() {
    if (timer !== null) { stop(); return; }
    if (!last) return;
    if (current === last) setFrame(0);
    playbackState(true);
    // Playback only starts on request. A slower cadence also accommodates
    // reduced-motion users who choose to play the sequence.
    const slower = host.ownerDocument.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches;
    timer = setInterval(() => {
      setFrame(current + 1);
      if (current === last) stop();
    }, slower ? 1800 : 1100);
  }
  function seek(event) {
    stop();
    setFrame(Number(event.target.value));
  }
  function step(event) {
    const button = event.target.closest('[data-ep]');
    if (!button || button.disabled) return;
    if (button === play) playOrPause();
    else { stop(); setFrame(current + (button === prev ? -1 : 1)); }
  }
  root.addEventListener('click', step);
  slider.addEventListener('input', seek);
  play.disabled = slider.disabled = last === 0;
  playbackState(false);
  setFrame(last);
  return {destroy() {
    stop();
    root.removeEventListener('click', step);
    slider.removeEventListener('input', seek);
    root.remove();
  }};
}
