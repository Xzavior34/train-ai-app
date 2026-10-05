const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const GLOBALS = new Set([
  'window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'location',
  'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame',
  'fetch', 'Response', 'Request', 'Headers', 'URL', 'URLSearchParams', 'Blob', 'File', 'FileReader', 'FormData',
  'Array', 'Object', 'String', 'Number', 'Boolean', 'RegExp', 'Date', 'Math', 'JSON', 'Promise', 'Set', 'Map', 'WeakMap', 'WeakSet',
  'Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'Symbol', 'Proxy', 'Reflect',
  'Intl', 'crypto', 'atob', 'btoa', 'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI',
  'TextEncoder', 'TextDecoder', 'Uint8Array', 'Uint16Array', 'Uint32Array', 'Int8Array', 'Int16Array', 'Int32Array', 'Float32Array', 'Float64Array', 'ArrayBuffer', 'DataView',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'undefined', 'NaN', 'Infinity', 'alert', 'confirm', 'prompt',
  'performance', 'IntersectionObserver', 'ResizeObserver', 'MutationObserver', 'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent',
  'Image', 'Audio', 'Notification', 'SpeechSynthesisUtterance', 'speechSynthesis', 'process', 'globalThis',
  'import', 'require', 'module', 'exports', '__dirname', '__filename'
]);

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

const srcDir = path.resolve(__dirname, '../src');
const files = getAllFiles(srcDir);

let totalErrors = 0;
const results = [];

console.log(`Auditing ${files.length} files in src/...`);

files.forEach((filePath) => {
  const relPath = path.relative(path.resolve(__dirname, '..'), filePath);
  const code = fs.readFileSync(filePath, 'utf-8');

  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'optionalChaining', 'nullishCoalescingOperator', 'exportDefaultFrom', 'classProperties', 'objectRestSpread', 'dynamicImport']
    });
  } catch (err) {
    console.error(`Syntax Error parsing ${relPath}:`, err.message);
    totalErrors++;
    return;
  }

  const fileUndeclared = new Set();

  traverse(ast, {
    ReferencedIdentifier(astPath) {
      const { node, scope } = astPath;
      const name = node.name;

      if (GLOBALS.has(name)) return;
      if (name.startsWith('__')) return;

      // Check if identifier is declared in scope
      if (!scope.hasBinding(name)) {
        // Exclude JSX pragma or special identifiers if any
        if (name === 'React' || name === 'jsx') return;
        
        // Exclude member expression property if it's not the object (handled by ReferencedIdentifier, but check parent)
        if (astPath.parentPath.isMemberExpression({ property: node }) && !astPath.parentPath.node.computed) {
          return;
        }
        // Exclude object property key if not computed
        if (astPath.parentPath.isObjectProperty({ key: node }) && !astPath.parentPath.node.computed) {
          return;
        }

        const line = node.loc ? node.loc.start.line : '?';
        fileUndeclared.add(`${name} (line ${line})`);
      }
    }
  });

  if (fileUndeclared.size > 0) {
    results.push({ file: relPath, issues: Array.from(fileUndeclared) });
    totalErrors += fileUndeclared.size;
  }
});

console.log('\n--- AUDIT RESULTS ---');
if (results.length === 0) {
  console.log('✓ PERFECT! 0 undeclared variables or scope errors found in any file.');
} else {
  console.log(`Found issues in ${results.length} files:`);
  results.forEach(r => {
    console.log(`\nFile: ${r.file}`);
    r.issues.forEach(i => console.log(`  - Undeclared: ${i}`));
  });
}
console.log(`\nTotal errors: ${totalErrors}`);
