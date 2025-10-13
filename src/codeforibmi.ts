import * as vscode from 'vscode';

interface CodeForIBMiAPI {
  version?: string;
  runCommand?(command: string, options?: {
    environment?: 'ile' | 'qsh' | 'pase';
    cwd?: string;
    env?: Record<string, string>;
    onStdout?: (data: Buffer) => void;
    onStderr?: (data: Buffer) => void;
    stdin?: string;
  }): Promise<{ code: number; signal?: string | null; stdout: string; stderr: string; command?: string }>;
  getContent?(): {
    read?(path: string): Promise<string>;
    downloadStream?(path: string): Promise<Buffer>;
  };
}

const EXT_ID = 'halcyontechltd.code-for-ibmi';

let cachedApi: CodeForIBMiAPI | undefined;

function findCodeForIBMiExtension(): vscode.Extension<unknown> | undefined {
  return (
    vscode.extensions.getExtension(EXT_ID) ||
    vscode.extensions.all.find(ext => ext.id.toLowerCase() === EXT_ID)
  );
}

function isValidApi(api: unknown): api is CodeForIBMiAPI {
  if (!api || typeof api !== 'object') return false;
  const maybe = api as CodeForIBMiAPI;
  return typeof maybe.runCommand === 'function' || typeof maybe.getContent === 'function';
}

// Debug helpers to describe the export shape when validation fails
function safeKeys(obj: unknown): string[] {
  try { return obj && typeof obj === 'object' ? Object.keys(obj as any) : []; } catch { return []; }
}
function buildExportDiagnostics(exportsVal: unknown): string {
  if (exportsVal == null) return 'exports: undefined';
  const root: any = exportsVal;
  const parts: string[] = [];
  const rootKeys = safeKeys(root);
  parts.push(`exports type=${typeof root} keys=[${rootKeys.join(', ')}]`);
  if (typeof root?.runCommand === 'function' || typeof root?.getContent === 'function') {
    parts.push('exports has known API members');
  }
  if (root?.default) {
    const defKeys = safeKeys(root.default);
    parts.push(`default type=${typeof root.default} keys=[${defKeys.join(', ')}]`);
  }
  if (root?.api) {
    const apiKeys = safeKeys(root.api);
    parts.push(`api type=${typeof root.api} keys=[${apiKeys.join(', ')}]`);
  }
  if (typeof root?.getAPI === 'function') {
    parts.push('getAPI: function');
  }
  if (typeof exportsVal === 'function') {
    parts.push('exports is function');
  }
  return parts.join('; ');
}

function extractApi(exportsVal: unknown): CodeForIBMiAPI | undefined {
  // 1) Direct object export
  if (isValidApi(exportsVal)) return exportsVal as CodeForIBMiAPI;

  // 2) default export
  const def = (exportsVal as any)?.default;
  if (isValidApi(def)) return def;

  // 3) nested api or getter
  const apiProp = (exportsVal as any)?.api;
  if (isValidApi(apiProp)) return apiProp;

  const getAPI = (exportsVal as any)?.getAPI;
  if (typeof getAPI === 'function') {
    try {
      const res = getAPI();
      if (isValidApi(res)) return res;
    } catch {/* ignore */}
  }

  // 4) function export returning API
  if (typeof exportsVal === 'function') {
    try {
      const res = (exportsVal as any)();
      if (isValidApi(res)) return res;
    } catch {/* ignore */}
  }

  return undefined;
}

export async function getIBMiAPI(): Promise<CodeForIBMiAPI | undefined> {
  if (cachedApi) return cachedApi;

  const ext = findCodeForIBMiExtension();
  if (!ext) {
    console.warn('[rpgiv2free] Code for IBM i extension not found.');
    return undefined;
  }

  try {
    if (!ext.isActive) {
      await ext.activate();
    }
  } catch (err) {
    console.warn('[rpgiv2free] Failed to activate Code for IBM i:', err);
    return undefined;
  }

  const api = extractApi(ext.exports as unknown);
  if (!api) {
    const info = `${ext.id}@${(ext.packageJSON as any)?.version ?? 'unknown'}`;
    const diag = buildExportDiagnostics(ext.exports as unknown);
    console.warn(
      `[rpgiv2free] Code for IBM i did not export a compatible API from ${info}. ` +
      `Expected runCommand() or getContent(). ${diag}`
    );
    return undefined;
  }

  cachedApi = api;
  return cachedApi;
}

export function resetIBMiApiCache(): void {
  cachedApi = undefined;
}