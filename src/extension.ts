import * as vscode from 'vscode';
import * as path from 'path';
import { promises as fs } from 'fs';
import * as yaml from 'js-yaml';

interface WorkflowDefinition {
  label: string;
  description?: string;
  filePath: string;
  command?: string;
}

export function activate(context: vscode.ExtensionContext) {
  const provider = new WorkflowTreeProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('windsurfWorkflowLauncherView', provider),
    vscode.commands.registerCommand('windsurfWorkflowLauncher.refresh', () => provider.refresh()),
    vscode.commands.registerCommand('windsurfWorkflowLauncher.runWorkflow', (item?: WorkflowTreeItem) => provider.runWorkflow(item)),
    provider
  );

  provider.refresh();
}

export function deactivate() {
  // No-op - everything is disposed via subscriptions.
}

class WorkflowTreeProvider implements vscode.TreeDataProvider<WorkflowTreeItem>, vscode.Disposable {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  private workflows: WorkflowDefinition[] = [];
  private watchers: vscode.FileSystemWatcher[] = [];

  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  getTreeItem(element: WorkflowTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): vscode.ProviderResult<WorkflowTreeItem[]> {
    if (!this.workflows.length) {
      return [
        new WorkflowTreeItem(
          'No workflows found',
          undefined,
          undefined,
          {
            description: 'Add files to the .windsurf directory',
            tooltip: 'Create workflow files inside the .windsurf directory to see them here.',
            contextValue: 'empty'
          }
        )
      ];
    }

    return this.workflows.map((workflow) => {
      const item = new WorkflowTreeItem(workflow.label, workflow.description, workflow.filePath, {
        contextValue: 'workflow',
        tooltip: workflow.filePath,
        workflow
      });

      item.command = {
        command: 'windsurfWorkflowLauncher.runWorkflow',
        arguments: [item],
        title: 'Run Workflow'
      };

      return item;
    });
  }

  async refresh(): Promise<void> {
    await this.loadWorkflows();
    this._onDidChangeTreeData.fire();
  }

  async runWorkflow(item?: WorkflowTreeItem): Promise<void> {
    if (!item || !item.workflow) {
      if (!this.workflows.length) {
        vscode.window.showInformationMessage('No workflows available. Add files to the .windsurf directory.');
        return;
      }

      const picked = await vscode.window.showQuickPick(
        this.workflows.map((wf) => ({ label: wf.label, description: wf.description, workflow: wf })),
        { placeHolder: 'Select a workflow to run' }
      );

      if (!picked) {
        return;
      }

      await this.executeWorkflow(picked.workflow);
      return;
    }

    if (!item.workflow) {
      return;
    }

    await this.executeWorkflow(item.workflow);
  }

  dispose() {
    this.watchers.forEach((w) => w.dispose());
    this._onDidChangeTreeData.dispose();
  }

  private async executeWorkflow(workflow: WorkflowDefinition): Promise<void> {
    const command = workflow.command ?? `windsurf run "${workflow.filePath}"`;
    const folder = path.dirname(workflow.filePath);

    const terminal = vscode.window.createTerminal({
      name: `Windsurf: ${workflow.label}`,
      cwd: folder
    });

    terminal.show(true);
    terminal.sendText(command, true);
  }

  private async loadWorkflows(): Promise<void> {
    this.watchers.forEach((w) => w.dispose());
    this.watchers = [];

    const folders = vscode.workspace.workspaceFolders ?? [];
    const workflows: WorkflowDefinition[] = [];

    for (const folder of folders) {
      const windsorDir = path.join(folder.uri.fsPath, '.windsurf');
      const exists = await this.pathExists(windsorDir);
      if (!exists) {
        continue;
      }

      const folderWorkflows = await this.collectWorkflows(windsorDir);
      workflows.push(...folderWorkflows);

      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(folder, '.windsurf/**/*.{json,yaml,yml,workflow}')
      );
      watcher.onDidChange(() => this.refresh());
      watcher.onDidCreate(() => this.refresh());
      watcher.onDidDelete(() => this.refresh());
      this.watchers.push(watcher);
    }

    this.workflows = workflows.sort((a, b) => a.label.localeCompare(b.label));
  }

  private async collectWorkflows(dir: string): Promise<WorkflowDefinition[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const results: WorkflowDefinition[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...(await this.collectWorkflows(fullPath)));
        continue;
      }

      if (!this.isWorkflowFile(entry.name)) {
        continue;
      }

      const parsed = await this.parseWorkflow(fullPath);
      results.push(parsed);
    }

    return results;
  }

  private isWorkflowFile(fileName: string): boolean {
    return /(\.workflow|\.ya?ml|\.json)$/i.test(fileName);
  }

  private async parseWorkflow(filePath: string): Promise<WorkflowDefinition> {
    const raw = await fs.readFile(filePath, 'utf8');
    const ext = path.extname(filePath).toLowerCase();
    let data: any = {};

    try {
      if (ext === '.json') {
        data = JSON.parse(raw);
      } else {
        data = yaml.load(raw) ?? {};
      }
    } catch (error) {
      vscode.window.showWarningMessage(`Unable to parse workflow ${path.basename(filePath)}: ${error}`);
    }

    const label = typeof data?.name === 'string' && data.name.trim().length > 0 ? data.name.trim() : path.basename(filePath);
    const description = typeof data?.description === 'string' ? data.description : undefined;
    const command = typeof data?.command === 'string' ? data.command : undefined;

    return { label, description, filePath, command };
  }

  private async pathExists(fsPath: string): Promise<boolean> {
    try {
      await fs.access(fsPath);
      return true;
    } catch {
      return false;
    }
  }
}

class WorkflowTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    description?: string,
    filePath?: string,
    options: {
      command?: vscode.Command;
      contextValue?: string;
      tooltip?: string;
      workflow?: WorkflowDefinition;
    } = {}
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = description;
    this.tooltip = options.tooltip ?? filePath;
    this.contextValue = options.contextValue;
    if (options.command) {
      this.command = options.command;
    }
    this.workflow = options.workflow;
  }

  workflow?: WorkflowDefinition;
}
