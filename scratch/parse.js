const fs = require('fs');
const code = fs.readFileSync('apps/editor-desktop/src/features/graphics/components/GraphicElementPropertiesPanel.tsx', 'utf8');

// Basic tag and bracket tracker
let lines = code.split('\n');
let jsxStack = [];
let braceDepth = 0;
let parenDepth = 0;

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  let lineNum = i + 1;

  // Track brackets and parens
  for (let char of line) {
    if (char === '{') braceDepth++;
    if (char === '}') braceDepth--;
    if (char === '(') parenDepth++;
    if (char === ')') parenDepth--;
  }

  // Simple tag matching helper
  let tagMatches = [...line.matchAll(/<([a-zA-Z0-9]+)(?:\s|>|\/)/g)];
  let closeMatches = [...line.matchAll(/<\/([a-zA-Z0-9]+)>/g)];

  for (let match of tagMatches) {
    let tagName = match[1];
    // Ignore self closing tags or specific JSX elements
    if (line.includes(`<${tagName}`) && (line.includes(`/>`) || line.includes(`>`))) {
      if (line.includes(`<${tagName}`) && line.includes(`/>`)) {
        continue;
      }
      jsxStack.push({ tag: tagName, line: lineNum });
    }
  }

  for (let match of closeMatches) {
    let tagName = match[1];
    if (jsxStack.length > 0) {
      let last = jsxStack[jsxStack.length - 1];
      if (last.tag === tagName) {
        jsxStack.pop();
      } else {
        console.log(`Mismatched tag at line ${lineNum}: closed </${tagName}> but expected </${last.tag}> (opened at line ${last.line})`);
      }
    }
  }
}

console.log('Final Stack Size:', jsxStack.length);
if (jsxStack.length > 0) {
  console.log('Unclosed tags:', jsxStack);
}
console.log('Braces balance:', braceDepth, 'Parens balance:', parenDepth);
