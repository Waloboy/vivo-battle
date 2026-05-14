const fs = require('fs');
const sharp = require('sharp');

async function generate() {
  try {
    const svgBuffer = fs.readFileSync('./public/assets/images/logo.svg');
    
    await sharp(svgBuffer)
      .resize(512, 512)
      .png()
      .toFile('./public/assets/images/logo-512.png');
      
    await sharp(svgBuffer)
      .resize(192, 192)
      .png()
      .toFile('./public/assets/images/logo-192.png');
      
    console.log("Images generated successfully.");
  } catch (err) {
    console.error(err);
  }
}

generate();
