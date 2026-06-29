const fs = require('fs');
const code = fs.readFileSync('apps/editor-desktop/src/features/graphics/components/GraphicElementPropertiesPanel.tsx', 'utf8');

let lines = code.split('\n');
let braceBalance = 0;
let parenBalance = 0;
let inString = null;
let inComment = false;

for (let i = 720; i <= 890; i++) {
  let line = lines[i - 1];
  let lineNum = i;

  let oldBrace = braceBalance;
  let oldParen = parenBalance;

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

  console.log(`Line ${lineNum.toString().padEnd(4)} | Braces: ${oldBrace} -> ${braceBalance} | Parens: ${oldParen} -> ${parenBalance} | ${line.trim().substring(0, 50)}`);
}
