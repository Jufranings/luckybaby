/* =========================================================
   GBET Lucky Draw
   ---------------------------------------------------------
   users.json holds everything: names[0] is tonight's winner,
   names[1..8] fill the slots around it, winner_history feeds
   the overlay. Publish the file before 20:00 and the page
   reveals it at 20:00.

   Three things differ from the original build:
     - the file is read again as the reel lands, so a tab
       opened this morning shows the same name as one opened
       a minute ago
     - the clock comes from the server that served the file,
       not from worldtimeapi.org
     - the file is fetched from this same site rather than
       raw.githubusercontent.com, which is rate-limited
   ========================================================= */

const DATA_URL   = 'users.json';   // same origin — served by the CDN, not raw.githubusercontent
const DRAW_TIME  = 72000;   // 20:00:00, in seconds past local midnight
const DRAW_GRACE = 10;      // seconds after DRAW_TIME that still trigger the spin
const SPIN_TICK  = 50;      // ms between name changes while spinning
const SPIN_TIME  = 5000;    // ms the reel runs before landing

/* ---------- Elements ---------- */

const movingWeb        = document.querySelector('.movingWeb');
const movingMobile     = document.querySelector('.movingMobile');
const historyContainer = document.querySelector('.historyContainer');
const winnerSlot       = document.getElementById('userNames');
const nameSlots        = document.querySelectorAll('.namesContainer');   // 8 slots

/* ---------- State ---------- */

let data       = null;    // users.json once loaded
let spinTimer  = null;
let isSpinning = false;
let hasRevealed = false;

let hours = 0, minutes = 0, seconds = 0;   // Manila wall clock
let clockReady = null;

// Left undefined on purpose: updateCountdown() only runs at the end of the
// first tick, and an initial 0 here would fire a draw immediately.
let secondsToDraw;
let cdHours = 99, cdMinutes = 99, cdSeconds = 99;

/* ---------- Background pulse ---------- */
/* Both layers toggle a .moved / .movedMobile class every second; the CSS
   transition is 1.3s, so the scale never fully settles — that overlap is
   what produces the slow breathing effect. */

setInterval(() => movingMobile.classList.toggle('movedMobile'), 1000);
setInterval(() => movingWeb.classList.toggle('moved'), 1000);

/* ---------- Winner history overlay ---------- */

function showHistory() {
  document.querySelector('.winnerHistoryContainer').classList.add('showContainer');
  setTimeout(() => historyContainer.classList.add('opacityOne'), 200);
}

function hideContainer(event) {
  if (event.target !== event.currentTarget) return;   // ignore clicks inside the panel
  const overlay = document.querySelector('.winnerHistoryContainer');
  historyContainer.classList.remove('opacityOne');
  setTimeout(() => overlay.classList.remove('showContainer'), 200);
}

/* ---------- Clock ---------- */

// Split a moment into Manila hours, minutes and seconds. Asia/Manila has no
// DST, but go through Intl rather than assuming a fixed +8.
function manilaParts(moment) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).formatToParts(moment);

  const get = type => Number(parts.find(p => p.type === type).value);
  return { hours: get('hour') % 24, minutes: get('minute'), seconds: get('second') };
}

// Every HTTP response carries a Date header set by the server that sent it.
// That gives us an authoritative clock from the request we were making
// anyway — no second request, and no third-party API to go down. Falls back
// to the device clock, which is only wrong if the viewer's own clock is.
function startClock(response) {
  const header = response && response.headers.get('date');
  const moment = header ? new Date(header) : new Date();

  const now = manilaParts(Number.isNaN(moment.getTime()) ? new Date() : moment);
  hours = now.hours;
  minutes = now.minutes;
  seconds = now.seconds;
  clockReady = header ? 'Server' : 'Device';
}

/* ---------- Load the draw data ---------- */

function renderHistory(entries) {
  entries.forEach(entry => {
    const row = document.createElement('div');
    row.className = 'previousWinner';

    const name = document.createElement('div');
    name.className = 'historyName';
    name.innerHTML = `<strong>${entry.name}</strong>`;

    const date = document.createElement('div');
    date.className = 'historyDate';
    date.textContent = entry.date;

    row.appendChild(name);
    row.appendChild(date);
    historyContainer.appendChild(row);
  });
}

fetch(DATA_URL)
  .then(response => {
    if (!response.ok) throw new Error('Network response was not ok');
    startClock(response);              // the clock rides along with the data
    return response.json();
  })
  .then(json => {
    data = json;
    renderHistory(json.winner_history);
  })
  .catch(error => {
    console.error('There was a problem with the fetch operation:', error);
    startClock(null);                  // still count down, even if the file failed
  });

/* ---------- Reveal ---------- */

function moveLogo() {
  document.querySelector('.logo').classList.add('moveLogo');
}

function addGlow() {
  document.getElementById('userNames').classList.add('glowingWhite');
}

function pickRandom() {
  return data.names[Math.floor(Math.random() * data.names.length)];
}

// Fills the board with the published result: names[0] is the winner,
// names[1..8] fill the eight surrounding slots.
function showResult() {
  winnerSlot.innerText = `${data.names[0]}`;
  for (let i = 0; i < nameSlots.length; i++) {
    nameSlots[i].innerText = data.names[i + 1];
  }
}

// Read users.json again. A tab opened at 18:00 is holding the file as it
// looked at 18:00 — without this it would land on last night's winner while
// a tab opened at 19:45 lands on tonight's.
async function refresh() {
  try {
    const response = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (response.ok) data = await response.json();
  } catch (error) {
    console.error('Could not refresh before the reveal:', error);
  }
}

function getRandomName() {
  clearInterval(spinTimer);
  isSpinning = true;
  moveLogo();

  spinTimer = setInterval(() => {
    winnerSlot.innerText = pickRandom();
    nameSlots.forEach(slot => { slot.innerText = pickRandom(); });
  }, SPIN_TICK);

  setTimeout(async () => {
    if (!hasRevealed) await refresh();

    clearInterval(spinTimer);
    winnerSlot.innerText = `${data.names[0]}`;
    isSpinning = false;

    if (!hasRevealed) {
      addGlow();
      hasRevealed = true;
      celebrate();
      showResult();
    }
  }, SPIN_TIME);
}

/* ---------- Celebration ---------- */

function celebrate() {
  document.getElementById('myAudio').play();

  const end = Date.now() + 10000;
  const colors = ['#bb0000', '#ffffff'];

  (function frame() {
    confetti({ particleCount: 2, angle: 60,  spread: 55, origin: { x: 0 }, colors });
    confetti({ particleCount: 2, angle: 120, spread: 55, origin: { x: 1 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

/* ---------- Tick ---------- */

// Seconds remaining until the next 20:00, plus the split-out countdown digits.
function updateCountdown() {
  let remaining = DRAW_TIME - (hours * 3600 + minutes * 60 + seconds);
  if (remaining < 0) remaining += 86400;

  secondsToDraw = remaining;
  cdHours   = Math.floor(remaining / 3600);
  cdMinutes = Math.floor((remaining % 3600) / 60);
  cdSeconds = remaining % 60;
}

function pad(value) {
  return value < 10 ? `0${value}` : value;
}

function updateTime() {
  if (!clockReady || !data) return;   // wait for users.json and the clock it carried

  // Advance the local counter one second.
  seconds++;
  if (seconds >= 60) {
    seconds = 0;
    minutes++;
    if (minutes >= 60) {
      minutes = 0;
      hours++;
      if (hours >= 24) hours = 0;
    }
  }

  if (secondsToDraw === 0) {
    getRandomName();                                   // exactly 20:00:00
  } else if (secondsToDraw > 86400 - DRAW_GRACE) {
    getRandomName();                                   // within 10s after 20:00
  } else if (secondsToDraw < 86400 - DRAW_GRACE && secondsToDraw > DRAW_TIME && !isSpinning) {
    // Between 20:00 and midnight — the result is already published, show it flat.
    if (!hasRevealed) {
      moveLogo();
      addGlow();
      showResult();
      hasRevealed = true;
      celebrate();
    }
  } else if (secondsToDraw < DRAW_TIME && !isSpinning) {
    // Midnight to 20:00 — count down.
    winnerSlot.innerText = `Next draw: ${pad(cdHours)}:${pad(cdMinutes)}:${pad(cdSeconds)}`;
    for (let i = 0; i < nameSlots.length; i++) nameSlots[i].innerText = '';
  }

  updateCountdown();
}

setInterval(updateTime, 1000);
