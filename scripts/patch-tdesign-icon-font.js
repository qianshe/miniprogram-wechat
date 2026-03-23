/*
  Restore official TDesign icon font URLs for WeChat miniprogram.
  - Avoid the broken local font path rewriting seen in WeChat DevTools
  - Apply to both node_modules and miniprogram_npm copies so rebuilds stay consistent
*/
const fs = require('fs');
const path = require('path');

const targets = [
  'node_modules/tdesign-miniprogram/miniprogram_dist/icon/icon.wxss',
  'miniprogram/miniprogram_npm/tdesign-miniprogram/icon/icon.wxss',
];

const OFFICIAL_FONT_FACE = "@font-face{font-family:t;src:url(https://tdesign.gtimg.com/icon/0.3.2/fonts/t.eot),url(https://tdesign.gtimg.com/icon/0.3.2/fonts/t.eot?#iefix) format('ded-opentype'),url(https://tdesign.gtimg.com/icon/0.3.2/fonts/t.woff) format('woff'),url(https://tdesign.gtimg.com/icon/0.3.2/fonts/t.ttf) format('truetype'),url(https://tdesign.gtimg.com/icon/0.3.2/fonts/t.svg) format('svg');font-weight:400;font-style:normal;}";

function patchFile(file) {
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) return { file, status: 'skip_not_found' };

  const before = fs.readFileSync(abs, 'utf8');
  let text = before;
  const reBlock = /@font-face\{\s*font-family\s*:\s*t\s*;[\s\S]*?font-weight:400;\s*font-style:normal;\s*\}/;

  if (reBlock.test(text)) {
    text = text.replace(reBlock, OFFICIAL_FONT_FACE);
  }

  if (text !== before) {
    fs.writeFileSync(abs, text);
    return { file, status: 'patched' };
  }

  return { file, status: 'no_change' };
}

const results = targets.map(patchFile);
for (const r of results) console.log(`[patch-tdesign] ${r.status} -> ${r.file}`);
