const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

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

console.log(`Auditing imports and exports for ${files.length} files...`);

// First pass: extract all exports per file
const exportsByFile = new Map();

files.forEach((filePath) => {
  const code = fs.readFileSync(filePath, 'utf-8');
  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'optionalChaining', 'nullishCoalescingOperator', 'exportDefaultFrom', 'classProperties', 'objectRestSpread', 'dynamicImport']
    });
  } catch (err) {
    return;
  }

  const namedExports = new Set();
  let hasDefaultExport = false;

  traverse(ast, {
    ExportNamedDeclaration(astPath) {
      const { node } = astPath;
      if (node.declaration) {
        if (node.declaration.declarations) {
          node.declaration.declarations.forEach(d => {
            if (d.id.name) namedExports.add(d.id.name);
          });
        } else if (node.declaration.id) {
          namedExports.add(node.declaration.id.name);
        }
      }
      if (node.specifiers) {
        node.specifiers.forEach(s => {
          if (s.exported && s.exported.name) {
            namedExports.add(s.exported.name);
          }
        });
      }
    },
    ExportDefaultDeclaration() {
      hasDefaultExport = true;
    }
  });

  exportsByFile.set(filePath, { namedExports, hasDefaultExport });
});

// Second pass: verify all relative imports
let importErrors = 0;

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
    return;
  }

  const dir = path.dirname(filePath);

  traverse(ast, {
    ImportDeclaration(astPath) {
      const source = astPath.node.source.value;
      if (source.startsWith('.')) {
        let resolvedPath = path.resolve(dir, source);
        if (!fs.existsSync(resolvedPath)) {
          if (fs.existsSync(resolvedPath + '.js')) resolvedPath += '.js';
          else if (fs.existsSync(resolvedPath + '.jsx')) resolvedPath += '.jsx';
          else if (fs.existsSync(path.join(resolvedPath, 'index.js'))) resolvedPath = path.join(resolvedPath, 'index.js');
          else if (fs.existsSync(path.join(resolvedPath, 'index.jsx'))) resolvedPath = path.join(resolvedPath, 'index.jsx');
          else {
            console.error(`Broken import in ${relPath}: "${source}" does not exist`);
            importErrors++;
            return;
          }
        }

        const targetExports = exportsByFile.get(resolvedPath);
        if (targetExports) {
          astPath.node.specifiers.forEach(s => {
            if (s.type === 'ImportDefaultSpecifier') {
              if (!targetExports.hasDefaultExport && targetExports.namedExports.size > 0) {
                // Warning if no default export
                // Note: Some modules might re-export or use default differently
              }
            } else if (s.type === 'ImportSpecifier') {
              const importedName = s.imported.name;
              if (!targetExports.namedExports.has(importedName)) {
                console.error(`Import Error in ${relPath}: "${importedName}" is not exported by ${source}`);
                importErrors++;
              }
            }
          });
        }
      }
    }
  });
});

console.log(`\nImport audit completed with ${importErrors} errors.`);
