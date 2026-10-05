const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const lucide = require('lucide-react');

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

console.log(`Checking React hooks and lucide icons across ${files.length} files...`);

let issues = 0;

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
    console.error(`Syntax Error in ${relPath}:`, err.message);
    issues++;
    return;
  }

  // Check Lucide imports
  traverse(ast, {
    ImportDeclaration(astPath) {
      if (astPath.node.source.value === 'lucide-react') {
        astPath.node.specifiers.forEach(s => {
          if (s.type === 'ImportSpecifier') {
            const iconName = s.imported.name;
            if (!lucide[iconName]) {
              console.error(`Missing Lucide Icon in ${relPath}: "${iconName}" does not exist in lucide-react`);
              issues++;
            }
          }
        });
      }
    }
  });
});

console.log(`\nLucide & Syntax check completed with ${issues} issues.`);
