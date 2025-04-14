

// File: src/extension.ts
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand('rpgConverter.convert', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active text editor found.');
      return;
    }
    const document = editor.document;
    const selection = editor.selection;

    let textToConvert = '';
    if (!selection.isEmpty) {
      textToConvert = document.getText(selection);
    } else {
      textToConvert = document.getText();
    }

    try {
      // Split the text into lines (array of strings)
      const lines = textToConvert.split('\n');

      // Convert the lines from fixed-format to free-format
      const convertedLines = convertFixedToFree(lines);

      // Join the converted lines back into a single string
      const convertedText = convertedLines.join('\n');

      await editor.edit(editBuilder => {
        if (!selection.isEmpty) {
          editBuilder.replace(selection, convertedText);
        } else {
          const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length)
          );
          editBuilder.replace(fullRange, convertedText);
        }
      });
    } catch (err) {
      vscode.window.showErrorMessage('Conversion failed: ' + err);
    }
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}


export function convertFixedToFree(inputLines: string[]): string[] {
    return inputLines.map(line => convertLine(line));
}

// Function to convert individual lines based on the RPG spec type
function convertLine(inputLine: string): string {
    // Check the first character to determine the spec type
    const specType = inputLine.trim().charAt(0);
    switch (specType) {
        case 'D':
            return convertDSpec(inputLine);  // Convert D spec lines
        case 'F':
            return convertFSpec(inputLine);  // Convert F spec lines
        // Add additional cases here for other specs (e.g., C spec, P spec)
        default:
            return inputLine;  // If it's not recognized, return the line as-is
    }
}

//////////////////////////
// Helper function to convert a single fixed line to free format
//////////////////////////
function convertFSpec(line: string): string {
    const code = line.substring(6).padEnd(74, ' ');

    const fileName = code.substring(1, 11).trim();
    const fileType = code.charAt(11); // I, O, U, etc.
    const fileDesc = code.charAt(12); // F = Prog Described, E = Externally Described
    const fileFormat = code.substring(13, 16).trim(); // K
    const deviceRaw = code.substring(16, 20).trim().toUpperCase();
    const keywordStr = code.substring(20).trim();

    let usage = '';
    if (fileType === 'I') usage = '*input';
    else if (fileType === 'O') usage = '*output';
    else if (fileType === 'U') usage = '*update';
    else if (fileType === 'C') usage = '*input *output';

    // Program Described vs Externally Described
    const isExternallyDescribed = fileDesc === 'E'; // 'E' means Externally described
    const isKeyed = fileFormat.includes('K');

    // Break apart keywords
    const keywords = keywordStr
      .split(/\s+/)
      .map(k => k.toLowerCase());

    const hasUsropn = keywords.includes('usropn');
    const extFile = keywords.find(k => k.startsWith('extfile'));
    const extFmt = keywords.find(k => k.startsWith('extfmt'));

    let decl = `dcl-f ${fileName}`;

    // Add device type
    if (['DISK', 'PRINTER', 'WORKSTN', 'SPECIAL'].includes(deviceRaw)) {
      if (isExternallyDescribed) {
        decl += ` ${deviceRaw.toLowerCase()}(*ext)`;
      } else {
        // For program-described files, specify length (e.g., 132 for PRINTER)
        const lengthMatch = extFmt?.match(/\((\d+)\)/);
        const length = lengthMatch ? lengthMatch[1] : deviceRaw === 'PRINTER' ? '132' : '80';
        decl += ` ${deviceRaw.toLowerCase()}(${length})`;
      }
    }

    // Add usage
    if (usage) decl += ` usage(${usage})`;
    if (isKeyed) decl += ' keyed';
    if (hasUsropn) decl += ' usropn';

    // EXTFILE(...)
    if (extFile) {
      const match = extFile.match(/extfile\(([^)]+)\)/i);
      if (match) {
        decl += ` extfile(${match[1]})`;
      }
    }

    decl += ';';
    return decl;
}
// Function to convert D specs from fixed-format to free-format
export function convertDSpec(inputLine: string): string {
    const columns = inputLine.split('');

    // Check if the line is a valid D spec (starts with 'D')
    if (columns[0] === 'D') {
        // Extract the relevant fields from the fixed format
        const name = columns.slice(6, 26).join('').trim();  // 6-25: Name of the data structure or field
        const length = columns.slice(26, 30).join('').trim();  // 26-29: Length or size
        const type = columns.slice(30, 32).join('').trim();  // 30-31: Data type (P, S, or Blank)
        const decimals = columns.slice(32, 34).join('').trim();  // 32-33: Decimal positions or blank
        const varying = columns.slice(34, 45).join('').trim(); // 34-44: Check for 'VARYING' or other attributes like DIM

        // Determine the data type for the free format conversion
        let fieldType: string;

        if (type === 'P') {
            // Packed (P) type maps to packed() in free format
            fieldType = `packed(${length}:${decimals})`;
        } else if (type === 'S') {
            // Zoned (S) type maps to zoned() in free format
            fieldType = `zoned(${length}:${decimals})`;
        } else {
            // Blank or unspecified type handling
            if (decimals) {
                // If decimals are specified, default to character (char) type
                fieldType = `char(${length})`;
            } else {
                // Otherwise, default to zoned() for numeric fields or char for others
                fieldType = `zoned(${length})`;
            }

            // Handle the VARYING keyword for CHAR fields
            if (varying.toUpperCase() === 'VARYING') {
                // If the field is CHAR and VARYING is specified, use VARCHAR in free format
                fieldType = `varchar(${length})`;
            }
        }

        // Construct the free-format equivalent line
        let freeFormat = `dcl-ds ${name} ${fieldType}`;

        // If it's a data structure, check for special attributes like DIM or Liked
        const dim = columns.slice(45, 50).join('').trim();  // 45-49: DIM or other attributes
        if (dim && dim.startsWith('DIM')) {
            freeFormat += `(${dim})`;
        }

        return freeFormat;
    }

    // Return the original line if it's not a D spec
    return inputLine;
}