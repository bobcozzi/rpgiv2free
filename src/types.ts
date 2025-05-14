
export interface collectedStmt {
  specType: string;
  lines: string[];
  indexes: number[];
  entityName: string | null; // For P and D specs, else NULL
  comments: string[] | null; // embedded comments in statement
}

export interface stmtLines {
    lines: string[];
    indexes: number[];
    comments: string[] | null; // embedded comments in statement
}