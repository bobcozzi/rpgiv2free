import * as vscode from 'vscode';
import { getSpecType } from '../rpgedit';
import { getStmtVariant } from '../smartTab';
import { rpgivLegend, RPGIV_TOKEN_TYPES } from './legend';
import { getTokenRangesForLine } from './specFields';

export class RPGIVSemanticTokensProvider
  implements vscode.DocumentSemanticTokensProvider {

  provideDocumentSemanticTokens(
    doc: vscode.TextDocument
  ): vscode.SemanticTokens | null {

    const config = vscode.workspace.getConfiguration('rpgiv2free');
    if (!config.get<boolean>('enableFixedFormatHighlighting', false)) {
      return null;
    }

    const builder = new vscode.SemanticTokensBuilder(rpgivLegend);

    for (let lineIdx = 0; lineIdx < doc.lineCount; lineIdx++) {
      const lineText = doc.lineAt(lineIdx).text;

      // Skip short lines, blank lines, and full-line comments
      if (lineText.length < 6) { continue; }
      const specType = getSpecType(lineText);
      if (!specType) { continue; }   // getSpecType returns '' for comments and non-spec lines

      const variant = getStmtVariant(lineText, specType);
      const ranges = getTokenRangesForLine(lineText, variant);

      for (const range of ranges) {
        const colStart = range.start - 1;  // Convert to 0-based
        const colEnd = Math.min(range.end, lineText.length);
        if (colStart >= lineText.length) { continue; }

        // Only emit if the column range has non-whitespace content
        const content = lineText.substring(colStart, colEnd);
        if (!content.trim()) { continue; }

        const tokenTypeIndex = RPGIV_TOKEN_TYPES.indexOf(range.tokenType);
        if (tokenTypeIndex < 0) { continue; }

        builder.push(lineIdx, colStart, colEnd - colStart, tokenTypeIndex, 0);
      }
    }

    return builder.build();
  }
}

export { rpgivLegend };
