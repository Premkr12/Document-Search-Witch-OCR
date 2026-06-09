const sharp = require('sharp');
const Tesseract = require('tesseract.js');
const path = require('path');

const imagePath = path.join(__dirname, 'uploads', '1779861543729-753249083.jpeg');

async function testRotation(angle) {
  const preprocessed = await sharp(imagePath)
    .rotate(angle)
    .greyscale()
    .sharpen({ sigma: 1.5 })
    .normalise()
    .resize({ width: 3000, withoutEnlargement: true })
    .png()
    .toBuffer();

  const { data: { text, confidence } } = await Tesseract.recognize(preprocessed, 'eng');
  return { angle, confidence, textLen: text.length, preview: text.substring(0, 200) };
}

async function findBestRotation() {
  console.log('Testing 4 rotation angles to find the best one...\n');

  const results = [];
  for (const angle of [0, 90, 180, 270]) {
    console.log(`  Testing rotation: ${angle}°...`);
    const r = await testRotation(angle);
    console.log(`    Confidence: ${r.confidence}%, Text length: ${r.textLen}`);
    results.push(r);
  }

  // Best = highest confidence
  results.sort((a, b) => b.confidence - a.confidence);
  const best = results[0];

  console.log(`\n=== Best rotation: ${best.angle}° (confidence ${best.confidence}%) ===`);
  console.log('Preview:', best.preview);
  
  // Now do full OCR at best rotation
  const preprocessed = await sharp(imagePath)
    .rotate(best.angle)
    .greyscale()
    .sharpen({ sigma: 1.5 })
    .normalise()
    .resize({ width: 3000, withoutEnlargement: true })
    .png()
    .toBuffer();

  const { data: { text } } = await Tesseract.recognize(preprocessed, 'eng');
  console.log('\n=== Full OCR at best rotation ===');
  console.log(text);
}

findBestRotation().catch(console.error);
