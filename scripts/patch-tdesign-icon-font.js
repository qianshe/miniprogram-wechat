/*
  Patch TDesign icon font for WeChat miniprogram.
  - Convert assets/fonts/t.woff to base64 and inline into @font-face
  - Apply to both node_modules and miniprogram_npm copies to avoid path issues
*/
const fs = require('fs');
const path = require('path');

const targets = [
  'node_modules/tdesign-miniprogram/miniprogram_dist/icon/icon.wxss',
  'miniprogram_npm/tdesign-miniprogram/icon/icon.wxss',
];

function getDataUri() {
  const fontPath = path.resolve('assets/fonts/t.woff');
  if (!fs.existsSync(fontPath)) return null;
  const buf = fs.readFileSync(fontPath);
  const b64 = buf.toString('base64');
  return `src:url(data:font/woff;charset=utf-8;base64,${b64}) format('woff')`;
}

function patchFile(file) {
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) return { file, status: 'skip_not_found' };
  let text = fs.readFileSync(abs, 'utf8');
  const before = text;

  // Strategy 1: replace the whole @font-face src block for font-family t
  const reBlock = /@font-face\{\s*font-family\s*:\s*t\s*;\s*src:[^}]*?;\s*font-weight:400;\s*font-style:normal;\s*\}/;
  const dataSrc = getDataUri();
  if (reBlock.test(text)) {
    text = text.replace(reBlock, (m) => {
      // keep exact prefix and suffix while replacing only src
      const pre = '@font-face{font-family:t;';
      const suf = 'font-weight:400;font-style:normal;}';
      const srcLine = dataSrc || "src:url(../../../assets/fonts/t.woff) format('woff')";
      return pre + srcLine + ';' + suf;
    });
  }

  // Strategy 2 fallback: directly replace remote woff url with local one
  const reWoff = /https?:\/\/tdesign\.gtimg\.com\/icon\/[\w.\-]+\/fonts\/t\.woff/g;
  const repl = (dataSrc && dataSrc.match(/\(([^)]+)\)/)[1]) || '../../../assets/fonts/t.woff';
  text = text.replace(reWoff, repl);

  if (text !== before) {
    fs.writeFileSync(abs, text);
    return { file, status: 'patched' };
  }
  return { file, status: 'no_change' };
}

const results = targets.map(patchFile);
for (const r of results) console.log(`[patch-tdesign] ${r.status} -> ${r.file}`);
