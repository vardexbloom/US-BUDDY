#!/usr/bin/env node
const git = require("isomorphic-git");
const http = require("isomorphic-git/http/node");
const fs = require("fs");
const path = require("path");

const dir = path.resolve(__dirname, "..");
const token = process.argv[2] || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

if (!token) {
  console.error("Usage: node scripts/push.cjs <GITHUB_TOKEN>");
  console.error("Or set GITHUB_TOKEN environment variable.");
  process.exit(1);
}

async function run() {
  console.log("Pushing to https://github.com/vardexbloom/US-BUDDY.git (branch main)...");
  try {
    const res = await git.push({
      fs,
      http,
      dir,
      remote: "origin",
      ref: "main",
      force: true,
      onAuth: () => ({ username: token.trim() }),
    });
    console.log("Push succeeded!", res);
  } catch (err) {
    console.error("Push failed:", err.message);
    process.exit(1);
  }
}

run();
