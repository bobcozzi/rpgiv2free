import * as vscode from 'vscode';

export const RPGIV_TOKEN_TYPES = [
  'specType',      // Column 6 spec letter (C, D, F, H, I, O, P)
  'fieldName',     // Field/variable name
  'opcode',        // Operation code (ADD, SUB, EVAL, etc.)
  'factor1',       // Factor 1
  'factor2',       // Factor 2 / Extended factor 2
  'resultField',   // Result field
  'indicator',     // Resulting/conditioning indicators
  'keyword',       // D-spec/F-spec keywords
  'constant',      // Named constant value or literal
  'dataType',      // Data type code (column 40 on D-spec)
  'positions',     // From/To positions (I-spec, O-spec)
  'reserved',      // Reserved / unused columns
];

export const RPGIV_TOKEN_MODIFIERS = [
  'declaration',
  'deprecated',
];

export const rpgivLegend = new vscode.SemanticTokensLegend(
  RPGIV_TOKEN_TYPES,
  RPGIV_TOKEN_MODIFIERS
);
