const fs = require("fs");
const path = "src/components/dashboard/deal-workflow-tracker.tsx";

const buf = fs.readFileSync(path);

// Find the interface close - search backwards for first "}" 
let intCloseIdx = -1;
for (let i = buf.length - 1; i >= 0; i--) {
  if (buf[i] === 0x7d) { intCloseIdx = i; break; }
}
if (intCloseIdx === -1) { process.exit(1); }

// Find the API comment CRLF
const crlfAfter = Buffer.from('\n 0a 0a', 'utf-8');
const apiCrlfIdx = buf.indexOf(crlfAfter);
if (apiCrlfIdx === -1 || intCloseIdx === -1) { process.exit(1); }

// Find last 0x7d before API comment - end of section 1
let lastGood = -1;
for (let i = apiCrlfIdx - 1; i >= 0; i--) {
  if (buf[i] === 0x7d) { lastGood = i; break; }
}
if (lastGood === -1 || apiCrlfIdx === -1) { process.exit(1); }

// Section 1: 0 to lastGood+1 (interface + before corruption)
const section1 = buf.slice(0, lastGood + 1);
// Section 2: apiCrlfIdx to end (API comment onwards - should be clean)
const section2 = buf.slice(apiCrlfIdx);

const clean = Buffer.concat([section1, Buffer.from('\n'), section2]);
fs.writeFileSync(path, clean, 'utf-8');