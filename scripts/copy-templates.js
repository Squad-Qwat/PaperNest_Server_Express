#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const srcTemplates = path.join(__dirname, "src", "templates");
const distTemplates = path.join(__dirname, "dist", "templates");

// Copy function
function copyRecursive(src, dest) {
	if (!fs.existsSync(src)) {
		console.warn(`Source directory not found: ${src}`);
		return;
	}

	if (!fs.existsSync(dest)) {
		fs.mkdirSync(dest, { recursive: true });
	}

	const files = fs.readdirSync(src);

	files.forEach((file) => {
		const srcPath = path.join(src, file);
		const destPath = path.join(dest, file);
		const stat = fs.statSync(srcPath);

		if (stat.isDirectory()) {
			copyRecursive(srcPath, destPath);
		} else {
			fs.copyFileSync(srcPath, destPath);
		}
	});
}

console.log("Copying templates to dist...");
copyRecursive(srcTemplates, distTemplates);
console.log("✅ Templates copied successfully!");
