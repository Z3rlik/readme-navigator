// src/ReadmeProvider.ts
import * as vscode from 'vscode';
import * as path from 'path';

class ReadmeFolder extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly treeNode: any
  ) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.iconPath = new vscode.ThemeIcon('folder'); 
    this.contextValue = 'folder';
  }
}

class ReadmeFile extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly resourceUri: vscode.Uri
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);

    this.tooltip = `${this.resourceUri.fsPath}`;
    
    const fileName = path.basename(resourceUri.fsPath);
    if (fileName.toLowerCase() === 'readme.md') {
      this.iconPath = new vscode.ThemeIcon('star', new vscode.ThemeColor('list.warningForeground'));
    } else {
      this.iconPath = new vscode.ThemeIcon('primitive-dot', new vscode.ThemeColor('list.successForeground'));
    }

    this.contextValue = 'file';
    this.command = {
      command: 'vscode.open',
      title: 'Open File',
      arguments: [this.resourceUri],
    };
  }
}



export class ReadmeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {

  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private workspaceRoot: string | undefined;
  private virtualTree: any = {};
  private treeBuildPromise: Promise<void> | null = null;
  
  private currentMode: 'readme' | 'all' = 'readme';

  constructor() {
    this.workspaceRoot = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
      ? vscode.workspace.workspaceFolders[0].uri.fsPath
      : undefined;
    
    vscode.commands.executeCommand('setContext', 'readmeNavigator.mode', this.currentMode);
  }

  public setMode(mode: 'readme' | 'all'): void {
    this.currentMode = mode;
    vscode.commands.executeCommand('setContext', 'readmeNavigator.mode', this.currentMode);
    this.refresh();
  }

  public refresh(): void {
    this.treeBuildPromise = null;
    this._onDidChangeTreeData.fire();
  }

  private async buildTree(): Promise<void> {
    this.virtualTree = {};
    if (!this.workspaceRoot) {
      return;
    }

    const patternString = this.currentMode === 'readme' ? '**/README.md' : '**/*.md';
    const pattern = new vscode.RelativePattern(this.workspaceRoot, patternString);
    
    const uris = await vscode.workspace.findFiles(pattern, '**/node_modules/**,**/.git/**');

    for (const uri of uris) {
      const relativePath = vscode.workspace.asRelativePath(uri);
      const normalizedPath = relativePath.replace(/\\/g, '/');
      const parts = normalizedPath.split('/');

      let currentLevel = this.virtualTree;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (i === parts.length - 1) {
          currentLevel[part] = uri;
        } else {
          if (!currentLevel[part]) {
            currentLevel[part] = {};
          }
          currentLevel = currentLevel[part];
        }
      }
    }
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ReadmeFolder): Promise<vscode.TreeItem[]> {
    if (!this.workspaceRoot) {
      vscode.window.showInformationMessage('Open a project folder to find markdown files.');
      return [];
    }

    if (!element) { 
      if (this.treeBuildPromise) {
        await this.treeBuildPromise;
      } else {
        const loadingItem = new vscode.TreeItem("Searching for .md files...", vscode.TreeItemCollapsibleState.None);
        loadingItem.iconPath = new vscode.ThemeIcon('loading~spin');

        this.treeBuildPromise = this.buildTree();
        this.treeBuildPromise.then(() => {
          this._onDidChangeTreeData.fire();
        });
        return [loadingItem];
      }
    }

    const childrenNodes = element ? element.treeNode : this.virtualTree;
    const items = Object.keys(childrenNodes).map(key => {
      const node = childrenNodes[key];
      if (node instanceof vscode.Uri) {
        return new ReadmeFile(key, node);
      } else {
        return new ReadmeFolder(key, node);
      }
    });
    
    items.sort((a, b) => {
      if (a instanceof ReadmeFolder && b instanceof ReadmeFile) return -1;
      if (a instanceof ReadmeFile && b instanceof ReadmeFolder) return 1;
      return a.label!.localeCompare(b.label!);
    });

    return items;
  }

  public async search(): Promise<void> {
    if (!this.treeBuildPromise) {
      vscode.window.showInformationMessage("Loading files, please wait a moment...");
      this.treeBuildPromise = this.buildTree();
    }
    await this.treeBuildPromise;

    const allFiles: { label: string; uri: vscode.Uri }[] = [];
    this.flattenTree(this.virtualTree, '', allFiles);

    const quickPickItems = allFiles.map(file => ({
      label: file.label,
      description: path.basename(file.uri.fsPath),
      uri: file.uri,
    }));

    const selection = await vscode.window.showQuickPick(quickPickItems, {
      placeHolder: 'Type to search for a markdown file...',
      matchOnDescription: true,
      matchOnDetail: true,
    });

    if (selection) {
      vscode.commands.executeCommand('vscode.open', selection.uri);
    }
  }

  private flattenTree(node: any, pathPrefix: string, allFiles: { label: string; uri: vscode.Uri }[]): void {
    for (const key of Object.keys(node)) {
      const child = node[key];
      const newPath = pathPrefix ? `${pathPrefix}/${key}` : key;

      if (child instanceof vscode.Uri) {
        allFiles.push({ label: newPath, uri: child });
      } else {
        this.flattenTree(child, newPath, allFiles);
      }
    }
  }
}