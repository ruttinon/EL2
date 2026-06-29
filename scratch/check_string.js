const fs = require('fs');
const code = fs.readFileSync('apps/editor-desktop/src/features/graphics/components/GraphicElementPropertiesPanel.tsx', 'utf8');

let inString = null;
let inComment = false;

for (let i = 0; i < code.length; i++) {
  let char = code[i];
  let next = code[i + 1];
  let prev = code[i - 1];

  if (inComment) {
    if (inComment === '//' && char === '\n') {
      inComment = false;
    } else if (inComment === '/*' && char === '*' && next === '/') {
      inComment = false;
      i++;
    }
    continue;
  }

  if (inString) {
    if (char === inString && prev !== '\\') {
      inString = null;
    }
    continue;
  }

  if (char === '/' && next === '/') {
    inComment = '//';
    i++;
    continue;
  }
  if (char === '/' && next === '*') {
    inComment = '/*';
    i++;
    continue;
  }

  if (char === '"' || char === "'" || char === '`') {
    inString = char;
    continue;
  }
}

console.log('Final inString:', inString);
console.log('Final inComment:', inComment);
