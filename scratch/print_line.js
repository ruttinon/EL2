const fs = require('fs');
const code = fs.readFileSync('apps/editor-desktop/src/features/graphics/components/GraphicElementPropertiesPanel.tsx', 'utf8');

let lines = code.split('\n');
// Let's print around line 882
for (let i = 875; i <= 888; i++) {
  let line = lines[i - 1];
  console.log(`${i}: ${line}`);
}
