const git = require("isomorphic-git");
const http = require("isomorphic-git/http/node");
const fs = require("fs");
const path = require("path");

const dir = "/Users/maksudali/Downloads/your-ai-app";

// Helper to recursively collect files excluding ignored directories
function getFiles(baseDir, currentDir = "") {
  const fullPath = path.join(baseDir, currentDir);
  const entries = fs.readdirSync(fullPath, { withFileTypes: true });
  let files = [];

  for (const entry of entries) {
    const relPath = currentDir ? `${currentDir}/${entry.name}` : entry.name;
    if (
      entry.name === ".git" ||
      entry.name === "node_modules" ||
      entry.name === "dist" ||
      entry.name === ".DS_Store" ||
      entry.name === ".env" ||
      entry.name.endsWith(".tsbuildinfo")
    ) {
      continue;
    }

    if (entry.isDirectory()) {
      files = files.concat(getFiles(baseDir, relPath));
    } else if (entry.isFile()) {
      files.push(relPath);
    }
  }
  return files;
}

async function main() {
  console.log("Initializing git repo...");
  await git.init({ fs, dir, defaultBranch: "main" });

  const files = getFiles(dir);
  console.log(`Found ${files.length} files to stage.`);

  for (const file of files) {
    await git.add({ fs, dir, filepath: file });
  }

  console.log("Committing files...");
  const sha = await git.commit({
    fs,
    dir,
    author: {
      name: "vardexbloom",
      email: "vardexbloom@users.noreply.github.com",
    },
    message: "Initial commit: Complete Your AI application with all screens, components, and edge functions",
  });

  console.log(`Committed successfully! Commit SHA: ${sha}`);

  // Set remote origin
  try {
    await git.addRemote({
      fs,
      dir,
      remote: "origin",
      url: "https://github.com/vardexbloom/US-BUDDY.git",
    });
    console.log("Added remote origin: https://github.com/vardexbloom/US-BUDDY.git");
  } catch (e) {
    // If remote already exists, update it
    console.log("Remote origin already exists.");
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
