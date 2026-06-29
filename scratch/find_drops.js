const fs = require('fs');
const code = fs.readFileSync('apps/editor-desktop/src/features/graphics/components/GraphicElementPropertiesPanel.tsx', 'utf8');

let lines = code.split('\n');
let braceBalance = 0;
let parenBalance = 0;
let inString = null;
let inComment = false;

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  let lineNum = i + 1;

  for (let j = 0; j < line.length; j++) {
    let char = line[j];
    let next = line[j + 1];
    let prev = line[j - 1];

    if (inComment) {
      if (inComment === '//' && char === '\n') {
        inComment = false;
      } else if (inComment === '/*' && char === '*' && next === '/') {
        inComment = false;
        j++;
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
      j++;
      continue;
    }
    if (char === '/' && next === '*') {
      inComment = '/*';
      j++;
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      inString = char;
      continue;
    }

    if (char === '{') braceBalance++;
    if (char === '}') braceBalance--;
    if (char === '(') parenBalance++;
    if (char === ')') parenBalance--;
  }

  // Inside the return block of the function (lines 121 to 1600), balance should be at least Braces: 2, Parens: 2
  if (lineNum > 120 && lineNum < 1600) {
    if (braceBalance < 2 || parenBalance < 2) {
      console.log(`LOW BALANCE at line ${lineNum}: Braces=${braceBalance}, Parens=${parenBalance} | ${line.trim()}`);
    }
  }
}
