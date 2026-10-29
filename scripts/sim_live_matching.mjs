import fs from 'node:fs';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

function decodeImage(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    const png = PNG.sync.read(buf);
    return { data: png.data, width: png.width, height: png.height };
  } else {
    return jpeg.decode(buf);
  }
}

// 1. Load enrolled samples from sample_EMP-xxx
const enrolled = [
  { id: 'EMP-001', name: 'Galih Primananda', img: decodeImage('sample_EMP-001.jpg') },
  { id: 'EMP-022', name: 'SELVI KARTIKA SARI', img: decodeImage('sample_EMP-022.jpg') },
  { id: 'EMP-030', name: 'PEPO SENJAYA', img: decodeImage('sample_EMP-030.jpg') },
  { id: 'EMP-160', name: 'WAHYUNING WULANDARI', img: decodeImage('sample_EMP-160.jpg') }
];

const liveImg = decodeImage('live_attendance_photo.jpg');
console.log('Live image size:', liveImg.width, 'x', liveImg.height);

function downsampleGrayscale(img, sx, sy, boxW, boxH, targetW, targetH, mirror = false) {
  const result = new Float64Array(targetW * targetH);
  const xRatio = (boxW - 1) / targetW;
  const yRatio = (boxH - 1) / targetH;

  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      const actualX = mirror ? (targetW - 1 - x) : x;
      const srcX = Math.floor(sx + actualX * xRatio);
      const srcY = Math.floor(sy + y * yRatio);
      const clampedX = Math.max(0, Math.min(img.width - 1, srcX));
      const clampedY = Math.max(0, Math.min(img.height - 1, srcY));
      const idx = (clampedY * img.width + clampedX) * 4;
      const r = img.data[idx];
      const g = img.data[idx + 1];
      const b = img.data[idx + 2];
      const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      result[y * targetW + x] = luma;
    }
  }
  return result;
}

// Emulate extractFeaturePatch(img) on enrolled
const enrolledPatches = enrolled.map(e => ({
  id: e.id,
  name: e.name,
  patch: downsampleGrayscale(e.img, 0, 0, e.img.width, e.img.height, 32, 32)
}));

// Emulate extractLiveFaceCandidates on liveImg
const sw = liveImg.width;
const sh = liveImg.height;
const targetAspect = 3 / 4;
let visibleW = sw, visibleH = sh, visibleX = 0, visibleY = 0;
if (sw / sh > targetAspect) {
  visibleW = sh * targetAspect;
  visibleX = (sw - visibleW) / 2;
} else {
  visibleH = sw / targetAspect;
  visibleY = (sh - visibleH) / 2;
}
const faceBaseBox = Math.round(visibleW * 0.72);
const faceCenterX = visibleX + (visibleW / 2);
const faceCenterY = visibleY + (visibleH * 0.44);

const configs = [
  [1.0, 0.0],
  [0.85, 0.0],
  [1.15, 0.0],
  [1.0, -0.05]
];

const liveCandidates = [];
for (const [scale, yOffset] of configs) {
  const box = Math.max(48, Math.round(faceBaseBox * scale));
  const sx = Math.max(0, Math.min(sw - box, Math.round(faceCenterX - (box / 2))));
  const sy = Math.max(0, Math.min(sh - box, Math.round(faceCenterY - (box / 2) + (visibleH * yOffset))));
  liveCandidates.push(downsampleGrayscale(liveImg, sx, sy, box, box, 32, 32, false));
  liveCandidates.push(downsampleGrayscale(liveImg, sx, sy, box, box, 32, 32, true));
}
// Fallback
const fbBox = Math.min(sw, sh);
const fbSx = Math.round((sw - fbBox) / 2);
const fbSy = Math.round((sh - fbBox) / 2);
liveCandidates.push(downsampleGrayscale(liveImg, fbSx, fbSy, fbBox, fbBox, 32, 32, false));

function computeCosineSimilarity(vecA, vecB) {
  const n = vecA.length;
  let sumA = 0, sumB = 0;
  for (let i = 0; i < n; i++) {
    sumA += vecA[i];
    sumB += vecB[i];
  }
  const meanA = sumA / n;
  const meanB = sumB / n;
  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < n; i++) {
    const a = vecA[i] - meanA;
    const b = vecB[i] - meanB;
    num += a * b;
    denA += a * a;
    denB += b * b;
  }
  const denom = Math.sqrt(denA * denB);
  if (denom === 0) return { r: 0, score: 0 };
  const r = num / denom;
  let score = 0;
  if (r <= 0.05) score = 0;
  else if (r < 0.22) score = Math.round(((r - 0.05) / 0.17) * 45);
  else {
    const matchRatio = (r - 0.22) / 0.28;
    score = Math.min(100, Math.max(65, Math.round(65 + matchRatio * 35)));
  }
  return { r, score };
}

console.log('\n--- EVALUATING LIVE ATTENDANCE PHOTO AGAINST GALLERY ---');
for (const emp of enrolledPatches) {
  let maxScore = 0;
  let maxR = 0;
  let candIdx = -1;
  liveCandidates.forEach((cand, idx) => {
    const res = computeCosineSimilarity(cand, emp.patch);
    if (res.score > maxScore) {
      maxScore = res.score;
      maxR = res.r;
      candIdx = idx;
    }
  });
  console.log(`${emp.name.padEnd(25)} [${emp.id}]: Max Pearson r = ${maxR.toFixed(4)}, Score = ${maxScore}% (Candidate ${candIdx})`);
}
