// src/extension.ts
import * as vscode from 'vscode';
import { ReadmeProvider } from './ReadmeProvider';

export function activate(context: vscode.ExtensionContext) {

  console.log('Extension "readme-navigator" is now active!');

  // 1. Crear la instancia del Proveedor
  const readmeProvider = new ReadmeProvider();

  // 2. Registrar la Vista de Árbol
  const treeView = vscode.window.registerTreeDataProvider(
    'readmeNavigatorView',
    readmeProvider
  );

  // 3. Registrar TODOS los comandos
  const refreshCommand = vscode.commands.registerCommand('readmeNavigator.refresh', () => {
    readmeProvider.refresh();
  });

  const searchCommand = vscode.commands.registerCommand('readmeNavigator.search', () => {
    readmeProvider.search();
  });

  const setModeAllCommand = vscode.commands.registerCommand('readmeNavigator.setModeAll', () => {
    readmeProvider.setMode('all');
  });

  const setModeReadmeCommand = vscode.commands.registerCommand('readmeNavigator.setModeReadme', () => {
    readmeProvider.setMode('readme');
  });


  // 4. Añadir todo al contexto para que se limpie
  context.subscriptions.push(treeView);
  context.subscriptions.push(refreshCommand);
  context.subscriptions.push(searchCommand);
  context.subscriptions.push(setModeAllCommand);
  context.subscriptions.push(setModeReadmeCommand);
}

export function deactivate() {}