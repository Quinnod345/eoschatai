import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const featuresDir = path.join(process.cwd(), 'public/images/features');
const outputDir = path.join(featuresDir, 'optimized');

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const images = fs.readdirSync(featuresDir).filter(f => f.endsWith('.png'));

async function optimizeImages() {
  for (const img of images) {
    const inputPath = path.join(featuresDir, img);
    const outputName = img.replace('.png', '.webp');
    const outputPath = path.join(outputDir, outputName);
    
    console.log(`Optimizing ${img}...`);
    
    await sharp(inputPath)
      .resize(1200, null, { withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(outputPath);
    
    const originalSize = fs.statSync(inputPath).size;
    const newSize = fs.statSync(outputPath).size;
    console.log(`  ${img}: ${Math.round(originalSize/1024)}KB -> ${Math.round(newSize/1024)}KB (${Math.round((1 - newSize/originalSize) * 100)}% reduction)`);
  }
  
  // Also optimize the main images
  const mainImages = [
    { input: 'public/images/chatexample.png', output: 'public/images/chatexample.webp' },
    { input: 'public/images/eosai.png', output: 'public/images/eosai.webp' },
    { input: 'public/images/gradient-blue-orange.jpg', output: 'public/images/gradient-blue-orange.webp' },
    { input: 'public/images/gradient-orange-blue.jpg', output: 'public/images/gradient-orange-blue.webp' },
    { input: 'public/images/gradient-blue-red.jpg', output: 'public/images/gradient-blue-red.webp' },
  ];
  
  for (const { input, output } of mainImages) {
    const inputPath = path.join(process.cwd(), input);
    const outputPath = path.join(process.cwd(), output);
    
    if (!fs.existsSync(inputPath)) continue;
    
    console.log(`Optimizing ${input}...`);
    
    await sharp(inputPath)
      .resize(1920, null, { withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(outputPath);
    
    const originalSize = fs.statSync(inputPath).size;
    const newSize = fs.statSync(outputPath).size;
    console.log(`  ${input}: ${Math.round(originalSize/1024)}KB -> ${Math.round(newSize/1024)}KB (${Math.round((1 - newSize/originalSize) * 100)}% reduction)`);
  }
}

optimizeImages().then(() => console.log('Done!')).catch(console.error);
