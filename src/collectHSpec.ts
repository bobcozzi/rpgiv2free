import * as rpgiv from './rpgedit'


type CollectResult = {
  lines: string[],
  indexes: number[];
  comments: string[];
};

export function collectHSpecs(allLines: string[], startIndex: number): CollectResult {

  // Move backward to find the first H-spec in the block
  let start = startIndex;
  while (start > 0) {
    const prevLine = allLines[start-1];
    if (rpgiv.getSpecType(prevLine) === 'h') {
      start--;
    } else {
      break;
    }
  }
  const {
    lines: lines,
    indexes: indexes,
    comments: comments
  } = collectHKeywords(allLines, start);
  return { lines, indexes, comments };
}


export function collectHKeywords(
  allLines: string[],
  firstIndex: number
): CollectResult {
  let hspec = '';
  const commentIndexes: number[] = [];
  const indexes: number[] = [];
  const comments: string[] = [];
  let inQuote = false;
  let wasQuoted = false;

  let startLine = allLines[firstIndex];

  for (let i = firstIndex; i < allLines.length; i++) {
    const line = allLines[i];
    if (rpgiv.isComment(line)) {
      comments.push(rpgiv.convertCmt(line));
      commentIndexes.push(i);
      indexes.push(i);
      continue;
    }
    if (rpgiv.isSpecEmpty(line)) continue;
    if (rpgiv.getSpecType(line) !== 'h') break;  // NOT H spec?
    if (rpgiv.isDirective(line)) {
      continue
    };


    const ctlopt = rpgiv.getCol(line, 7, 80).trimEnd();

    let buffer = '';
    for (let j = 0; j < ctlopt.length; j++) {
      const ch = ctlopt[j];
      if (ch === "'") {
        if (j < ctlopt.length && ctlopt[j + 1] !== "'") {
          inQuote = !inQuote;
        }
      }
      buffer += ch;
    }

    const endsWith = hspec.trimEnd().slice(-1);
    const endsWithDots = hspec.trimEnd().endsWith('...');
    if ((endsWithDots && !wasQuoted) || ((endsWith === '+' || endsWith === '-') && wasQuoted)) {
      if (endsWithDots) {
        hspec = hspec.slice(0, -3).trimEnd();
        hspec += buffer.trimStart();
      }
      else {
        hspec = hspec.replace(/[+-]$/, '');
        if (endsWith === '-') {
          hspec += buffer;
        }
        else {
          hspec += buffer.trim();
        }
      }
    }
    else {
      if (endsWith && hspec) {
        hspec += ' ' + buffer.trim();
      }
      else {
        hspec += buffer.trim();
      }
    }
    wasQuoted = inQuote;

    indexes.push(i);
  }

  let i = indexes.length - 1;
  let c = commentIndexes.length - 1;

  // Remove trailing indexes that match in both sets
  while (
    i >= 0 &&
    c >= 0 &&
    indexes[i] === commentIndexes[c]
  ) {
    indexes.pop();
    commentIndexes.pop();
    comments.pop(); // <-- Remove the last collected ("embedded") comment as well
    i--;
    c--;
  }
  hspec = 'ctl-opt ' + hspec.trimStart();
  return { lines: [hspec], indexes: indexes, comments: comments };
}