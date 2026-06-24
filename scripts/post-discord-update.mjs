import fs from "node:fs";
import { execSync } from "node:child_process";

const webhookUrl =
  process.env.DISCORD_UPDATE_WEBHOOK_URL ||
  process.env.DISCORD_UPDATE_WEBHOOK;

const changelogPath = "CHANGELOG.md";

if (!webhookUrl) {
  console.log("No Discord webhook found. Skipping Discord update log post.");
  console.log("Expected env variable: DISCORD_UPDATE_WEBHOOK_URL");
  process.exit(0);
}

if (!fs.existsSync(changelogPath)) {
  console.log("CHANGELOG.md not found. Skipping Discord update log post.");
  process.exit(0);
}

const changelog = fs.readFileSync(changelogPath, "utf8").trim();

if (!changelog) {
  console.log("CHANGELOG.md is empty. Skipping Discord update log post.");
  process.exit(0);
}

function getLatestUpdate(text) {
  const lines = text.split("\n");

  const firstHeadingIndex = lines.findIndex((line) =>
    line.trim().startsWith("## ")
  );

  if (firstHeadingIndex === -1) {
    return text;
  }

  const nextHeadingIndex = lines.findIndex(
    (line, index) =>
      index > firstHeadingIndex && line.trim().startsWith("## ")
  );

  return lines
    .slice(
      firstHeadingIndex,
      nextHeadingIndex === -1 ? lines.length : nextHeadingIndex
    )
    .join("\n")
    .trim();
}

function splitMessage(text, maxLength = 1800) {
  const chunks = [];
  let current = "";

  for (const line of text.split("\n")) {
    const next = current ? `${current}\n${line}` : line;

    if (next.length > maxLength) {
      if (current.trim()) {
        chunks.push(current.trim());
      }

      current = line;
    } else {
      current = next;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

function safeGit(command, fallback = "unknown") {
  try {
    return execSync(command, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return fallback;
  }
}

const latestUpdate = getLatestUpdate(changelog);
const chunks = splitMessage(latestUpdate);

const branch =
  process.env.CF_PAGES_BRANCH ||
  safeGit("git rev-parse --abbrev-ref HEAD");

const commit =
  process.env.CF_PAGES_COMMIT_SHA?.slice(0, 7) ||
  safeGit("git rev-parse --short HEAD");

const siteUrl =
  process.env.CF_PAGES_URL ||
  process.env.PUBLIC_SITE_URL ||
  "";

const headerLines = [
  "**VEXTOR v1.9.7 is live**",
  "",
  `Branch: \`${branch}\``,
  `Commit: \`${commit}\``
];

if (siteUrl) {
  headerLines.push(`Site: ${siteUrl}`);
}

headerLines.push("");

for (let i = 0; i < chunks.length; i++) {
  const payload = {
    username: "VEXTOR Update Logs",
    allowed_mentions: {
      parse: []
    },
    content: i === 0 ? `${headerLines.join("\n")}\n${chunks[i]}` : chunks[i]
  };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Discord webhook failed: ${response.status} ${response.statusText}\n${errorText}`
    );
  }
}

console.log("Discord update log posted successfully.");
