import * as vscode from 'vscode';

export async function getIBMiAPI(): Promise<any | undefined> {
  const ibmiExt = vscode.extensions.getExtension('HalcyonTechLtd.code-for-ibmi');
  if (!ibmiExt) {
    vscode.window.showErrorMessage('Code for IBM i extension is not installed.');
    return undefined;
  }
  if (!ibmiExt.isActive) {
    await ibmiExt.activate();
  }
  return ibmiExt.exports;
}
