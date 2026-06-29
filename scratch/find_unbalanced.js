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

  // Print lines where balance changes or is interesting
  if (line.includes('activeTab ===') || line.includes('</>') || line.includes('</div') || line.includes('prop-card-group')) {
    console.log(`Line ${lineNum.toString().padEnd(4)} | Braces: ${braceBalance.toString().padEnd(3)} | Parens: ${parenBalance.toString().padEnd(3)} | ${line.trim().substring(0, 60)}`);
  }
}
