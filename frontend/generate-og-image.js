// generate-og-image.js
// Generates OpenGraph preview image for CivicCheckYYC
// Adapted from og-image-generator (Puppeteer approach)

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const generateHTML = () => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;700;800;900&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      width: 1200px;
      height: 630px;
      overflow: hidden;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .container {
      position: relative;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #991b1b 0%, #dc2626 40%, #b91c1c 70%, #7f1d1d 100%);
      overflow: hidden;
    }

    /* Decorative blurred blobs */
    .blob-1 {
      position: absolute;
      top: -200px;
      right: -200px;
      width: 600px;
      height: 600px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 50%;
      filter: blur(80px);
    }

    .blob-2 {
      position: absolute;
      bottom: -150px;
      left: -150px;
      width: 500px;
      height: 500px;
      background: rgba(255, 255, 255, 0.06);
      border-radius: 50%;
      filter: blur(80px);
    }

    .blob-3 {
      position: absolute;
      top: 50%;
      left: 60%;
      width: 300px;
      height: 300px;
      background: rgba(0, 0, 0, 0.1);
      border-radius: 50%;
      filter: blur(60px);
    }

    /* Subtle grid pattern */
    .grid-pattern {
      position: absolute;
      inset: 0;
      opacity: 0.06;
      background-image:
        linear-gradient(white 1px, transparent 1px),
        linear-gradient(90deg, white 1px, transparent 1px);
      background-size: 60px 60px;
    }

    /* Content */
    .content {
      position: relative;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 56px 60px;
      z-index: 1;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.25);
      border-radius: 100px;
      padding: 10px 22px;
    }

    .badge-dot {
      width: 8px;
      height: 8px;
      background: #86efac;
      border-radius: 50%;
    }

    .badge-text {
      color: white;
      font-size: 17px;
      font-weight: 500;
      letter-spacing: 0.2px;
    }

    .emojis {
      font-size: 40px;
      margin-bottom: 12px;
      letter-spacing: 8px;
    }

    .main-content {
      margin-top: -20px;
    }

    .title {
      color: white;
      font-size: 96px;
      font-weight: 900;
      line-height: 1;
      letter-spacing: -3px;
      margin-bottom: 20px;
    }

    .title-yyc {
      color: white;
      opacity: 0.95;
    }

    .subtitle {
      color: rgba(255, 255, 255, 0.95);
      font-size: 36px;
      font-weight: 700;
      margin-bottom: 12px;
    }

    .description {
      color: rgba(255, 255, 255, 0.75);
      font-size: 26px;
      font-weight: 500;
      max-width: 700px;
    }

    .footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .stats {
      display: flex;
      gap: 48px;
    }

    .stat {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .stat-label {
      color: rgba(255, 255, 255, 0.6);
      font-size: 16px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .stat-value {
      color: white;
      font-size: 36px;
      font-weight: 800;
    }

    .url {
      color: rgba(255, 255, 255, 0.7);
      font-size: 22px;
      font-weight: 600;
      text-align: right;
    }

    /* Thin white line separator above footer */
    .divider {
      width: 100%;
      height: 1px;
      background: linear-gradient(to right, transparent, rgba(255,255,255,0.2) 20%, rgba(255,255,255,0.2) 80%, transparent);
      margin-bottom: 28px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="blob-1"></div>
    <div class="blob-2"></div>
    <div class="blob-3"></div>
    <div class="grid-pattern"></div>

    <div class="content">
      <div class="top">
        <div class="badge">
          <div class="badge-dot"></div>
          <span class="badge-text">Open data &bull; Calgary council votes</span>
        </div>
      </div>

      <div class="main-content">
        <div class="emojis">🤠 🗳️ ⚖️</div>
        <h1 class="title">CivicCheck<span class="title-yyc">YYC</span></h1>
        <p class="subtitle">Beyond promises. Real votes.</p>
        <p class="description">Track how Calgary council candidates actually voted on the issues that matter to you.</p>
      </div>

      <div class="footer-section">
        <div class="divider"></div>
        <div class="footer">
          <div class="stats">
            <div class="stat">
              <div class="stat-label">Votes</div>
              <div class="stat-value">5,300+</div>
            </div>
            <div class="stat">
              <div class="stat-label">Motions</div>
              <div class="stat-value">2,600+</div>
            </div>
            <div class="stat">
              <div class="stat-label">Decisions</div>
              <div class="stat-value">190+</div>
            </div>
          </div>

          <div class="url">local archive</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
};

async function generateImage() {
  console.log('Generating CivicCheckYYC OG image...\n');

  // Create public directory if needed
  const outputDir = path.join(__dirname, 'public');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  const outputPath = path.join(outputDir, 'og-image.png');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  await page.setViewport({
    width: 1200,
    height: 630,
    deviceScaleFactor: 2
  });

  const html = generateHTML();
  await page.setContent(html, {
    waitUntil: 'networkidle0'
  });

  // Brief pause to ensure fonts are loaded
  await new Promise(r => setTimeout(r, 1000));

  await page.screenshot({
    path: outputPath,
    type: 'png'
  });

  await browser.close();

  const stats = fs.statSync(outputPath);
  const sizeKB = Math.round(stats.size / 1024);

  console.log(`✓ Generated: ${outputPath}`);
  console.log(`  Size: ${sizeKB}KB`);
  console.log(`  Dimensions: 2400×1260px (2x for retina)`);
  console.log('\n✅ Done! Image saved to public/og-image.png');
}

generateImage().catch(console.error);
