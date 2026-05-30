// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 1996-2026 by R. Cozzi, Jr.
// @author BobCozzi

import * as vscode from 'vscode';

// Minimal interface reflecting the real Code for IBM i extension export shape.
// See: https://github.com/codefori/vscode-ibmi/blob/master/src/typings.ts
// Connection methods mirror IBMi.ts signatures exactly.
interface CodeForIBMiAPI {
  instance?: {
    getConnection?(): {
      // Matches IBMi.runCommand(data: RemoteCommand): Promise<CommandResult>
      runCommand?(params: {
        command: string;
        environment?: 'ile' | 'qsh' | 'pase';
        noLibList?: boolean;
        singleUserLibraryList?: string[];
      }): Promise<{ code: number; stdout: string; stderr: string }>;
      // Matches IBMi.runSQL(statements, options?): Promise<Tools.DB2Row[]>
      runSQL?(statements: string | string[], options?: {
        bindings?: unknown[];
      }): Promise<Record<string, string | number | boolean | null>[]>;
      getContent?(): unknown;
    };
  };
  connectionManager?: unknown;
  deployTools?: unknown;
  searchTools?: unknown;
  tools?: unknown;
  componentRegistry?: unknown;
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
  // Check for properties that actually exist on the real Code for IBM i export
  return maybe.instance !== undefined || maybe.connectionManager !== undefined;
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
  if (root?.instance !== undefined || root?.connectionManager !== undefined) {
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
      `Expected instance or connectionManager properties. ${diag}`
    );
    return undefined;
  }

  cachedApi = api;
  return cachedApi;
}

export function resetIBMiApiCache(): void {
  cachedApi = undefined;
}