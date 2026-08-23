const ts = require("typescript");
const fs = require("fs");
const path = require("path");

const SRC_DIR = path.resolve(__dirname, "../src");
const EXTENSIONS = [".ts", ".tsx"];

function transformFile(filePath) {
  const sourceCode = fs.readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceCode,
    ts.ScriptTarget.Latest,
    true
  );

  const replacements = [];

  function visit(node, parent) {
    if (
      node.kind === ts.SyntaxKind.PropertyAccessExpression &&
      parent &&
      (parent.kind === ts.SyntaxKind.JsxOpeningElement ||
        parent.kind === ts.SyntaxKind.JsxSelfClosingElement ||
        parent.kind === ts.SyntaxKind.JsxClosingElement) &&
      parent.tagName === node
    ) {
      ts.forEachChild(node, (child) => visit(child, node));
      return;
    }

    if (node.kind === ts.SyntaxKind.PropertyAccessExpression) {
      if (
        parent &&
        (parent.kind === ts.SyntaxKind.ExpressionWithTypeArguments ||
          parent.kind === ts.SyntaxKind.TypeOfExpression)
      ) {
        ts.forEachChild(node, (child) => visit(child, node));
        return;
      }

      const prop = node.name;
      if (prop && prop.kind === ts.SyntaxKind.Identifier) {
        const start = node.questionDotToken
          ? node.questionDotToken.pos
          : prop.pos - 1;
        replacements.push({
          start,
          end: prop.getEnd(sourceFile),
          name: prop.text,
          optional: !!node.questionDotToken,
        });
      }
    }

    ts.forEachChild(node, (child) => visit(child, node));
  }

  visit(sourceFile, null);

  if (replacements.length === 0) return false;

  replacements.sort((a, b) => a.start - b.start);

  let transformed = "";
  let lastEnd = 0;
  for (const { start, end, name, optional } of replacements) {
    transformed += sourceCode.slice(lastEnd, start) + (optional ? "?.[" : "[") + `"${name}"]`;
    lastEnd = end;
  }
  transformed += sourceCode.slice(lastEnd);

  fs.writeFileSync(filePath, transformed, "utf-8");
  return true;
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory() && file !== "node_modules" && file !== ".next") {
      walkDir(fullPath);
    } else if (stat.isFile() && EXTENSIONS.includes(path.extname(file))) {
      console.log(`Processing: ${fullPath}`);
      transformFile(fullPath);
    }
  }
}

console.log("Starting dot-to-bracket transformation...");
walkDir(SRC_DIR);
console.log("Transformation complete.");
