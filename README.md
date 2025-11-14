# Windsurf Workflow Launcher

A Visual Studio Code extension that automatically discovers workflow definitions inside a project's `.windsurf/` directory and exposes them as one-click actions in a dedicated Windsurf sidebar. The extension is backend agnostic and simply runs whatever command is defined inside each workflow file.

## Features

- 🔍 **Auto-discovery** – Recursively scans every workspace folder for workflow files located under `.windsurf/`.
- 🧭 **Custom sidebar** – Displays workflows in their own view container so they are always one click away.
- ⚡ **Inline actions** – Click a workflow (or choose from the command palette) to execute the associated command in a new VS Code terminal.
- ♻️ **Live updates** – File system watcher refreshes the view whenever workflow files are created, updated, or deleted.
- 🧩 **Format agnostic** – Supports `.json`, `.yaml`, `.yml`, and `.workflow` files; anything with a `name`, `description`, and optional `command` field works.

## Getting started

1. Install dependencies and compile the extension:

   ```bash
   npm install
   npm run compile
   ```

2. Open the workspace in VS Code and press `F5` to launch a new Extension Development Host.

3. Create a `.windsurf/` directory in the root of your project and add workflow files. Example (`.windsurf/chat.yaml`):

   ```yaml
   name: Chat with context
   description: Use Cascade to analyze the active file
   command: cascade run chat.yaml
   ```

4. Open the **Windsurf** activity bar icon to see all discovered workflows. Click a workflow (or run `Windsurf Workflow Launcher: Run Windsurf Workflow` from the Command Palette) to execute it. The extension will open a VS Code terminal, change into the workflow's folder, and run the command defined in the file (defaults to `windsurf run <file>` when omitted).

## Development notes

- The tree view refresh button can be used to manually rescan workflows.
- When a workflow file cannot be parsed, the extension still surfaces it using the filename and shows a warning notification.
- You can store shell scripts, CLI invocations, or custom runners in the `command` field—no hardcoded backend assumptions are made.
