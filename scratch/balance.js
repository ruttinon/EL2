const fs = require('fs');
const code = fs.readFileSync('apps/editor-desktop/src/features/graphics/components/GraphicElementPropertiesPanel.tsx', 'utf8');

let braceStack = [];
let parenStack = [];
let braceBalance = 0;
let parenBalance = 0;

let inString = null; // '"', "'", "`"
let inComment = false; // '/*', '//'
let inRegex = false;

for (let i = 0; i < code.length; i++) {
  let char = code[i];
  let next = code[i + 1];
  let prev = code[i - 1];

  let lineNum = code.substring(0, i).split('\n').length;

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

  if (char === '{') {
    braceStack.push(lineNum);
    braceBalance++;
  }
  if (char === '}') {
    if (braceStack.length === 0) {
      console.log(`Extra closing brace at line ${lineNum}`);
    } else {
      braceStack.pop();
    }
    braceBalance--;
  }

  if (char === '(') {
    parenStack.push(lineNum);
    parenBalance++;
  }
  if (char === ')') {
    if (parenStack.length === 0) {
      console.log(`Extra closing paren at line ${lineNum}`);
    } else {
      parenStack.pop();
    }
    parenBalance--;
  }
}

console.log('Final brace stack:', braceStack);
console.log('Final paren stack:', parenStack);
