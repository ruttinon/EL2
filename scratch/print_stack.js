const fs = require('fs');
const code = fs.readFileSync('apps/editor-desktop/src/features/graphics/components/GraphicElementPropertiesPanel.tsx', 'utf8');

let lines = code.split('\n');
let braceStack = [];
let parenStack = [];
let inString = null;
let inComment = false;

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  let lineNum = i + 1;

  for (let j = 0; j < line.length; j++) {
    let char = line[j];
    let next = code[i + 1]; // not correct index helper, but not used
    let prev = line[j - 1];

    if (inComment) {
      if (inComment === '//' && char === '\n') {
        inComment = false;
      } else if (inComment === '/*' && char === '*' && code[code.indexOf(char, i) + 1] === '/') {
        // simple comment parser inside loop
      }
      continue;
    }

    if (inString) {
      if (char === inString && prev !== '\\') {
        inString = null;
      }
      continue;
    }

    // simple comments/strings skip (not needed since we validated check_string)
    if (char === '"' || char === "'" || char === '`') {
      inString = char;
      continue;
    }

    if (char === '{') {
      braceStack.push({ line: lineNum, col: j + 1 });
    }
    if (char === '}') {
      braceStack.pop();
    }

    if (char === '(') {
      parenStack.push({ line: lineNum, col: j + 1 });
    }
    if (char === ')') {
      parenStack.pop();
    }
  }

  if (lineNum === 1600) {
    console.log('Brace stack at 1600:', braceStack);
    console.log('Paren stack at 1600:', parenStack);
  }
}
