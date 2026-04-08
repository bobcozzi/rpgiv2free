# RPG IV Enhancements Chronology

**Bob Cozzi's RPG IV Modernization Summary for IBM i V7R3 and Later**
- [Bob's GitHub page](https://github.com/bobcozzi)

---

## V7.3 Enhancements

| Feature | VxRy | PTF | Notes |
|---------|------|-----|-------|
| **Fully Free-Format** | V7.3 | - | Using `**FREE` in line 1, column 1, RPG IV source can start in column 1 with unlimited line width. |
| **%SCANR** | V7.3 | V7.2 | Scan reverser — scans a string starting on the right end of the string. |
| **%SCAN Length Parameter** | V7.3 | - | 4th parameter controls the number of bytes to scan. |
| **Full ALIAS Support** | V7.3 | - | Used with File specs; includes long field names directly in the program. |
| **Data Structure on I/O** | V7.3 | - | Use a data structure as a File I/O target in more situations. |
| **NULLIND Keyword** | V7.3 | - | Defines a field as having a NULL indicator, or identifies another field/DS that is the NULL indicator for this field. |
| **EXTNAME / LIKEREC \*NULL Support** | V7.3 | - | Define a data structure with null indicator subfields whose names match the external file or "like" data structure. |
| **DCLOPT(\*NOCHGDSLEN)** | V7.3 | - | Allows `%SIZE` to be used on the DISK keyword of File Specs to better define program-described files. |

---

## V7.4 Enhancements

| Feature | VxRy | PTF | Notes |
|---------|------|-----|-------|
| **Variable Dimension Arrays** | V7.4 | - | `DCL-S arrayName DIM(*AUTO : maxSize);` — element count changes at runtime. Use `%ELEM(arr)` to read current size; `%ELEM(arr:*ALLOC) = n` to resize. |
| **%ELEM Enhancements** | V7.4 | - | New 2nd parameter: as rValue — `*ALLOC` (allocated count), `*MAX` (defined max). As lValue — `*ALLOC` (allocate new size), `*KEEP` (allocate without initializing new elements). |
| **SAMEPOS Keyword** | V7.4 | V7.3 | Defines a DS subfield at the same position as another subfield using a name rather than a numeric offset. Similar to `POS`/`OVERLAY` but more readable. |
| **PSDS Enhancements** | V7.4 | V7.3 | System (partition) name and 16-byte hex internal job ID now returned to PSDS. `SYSNAME CHAR(8) POS(396)` and `INTJOBID CHAR(16) POS(380)`. |
| **ON-EXIT Opcode** | V7.4 | V7.2 | All operations after `ON-EXIT` always run regardless of how the procedure returns, including abnormal exits. Ensures cleanup always executes. |
| **Nested / In-Line Data Structures** | V7.4 | V7.2 | `DCL-DS` can be coded inside a parent `DCL-DS` to create a nested data structure. Nested DS's are implicitly `QUALIFIED`. |
| **DATA-INTO Opcode** | V7.4 | V7.2 | Reads data from a stream using a user-written input processor. Use for reading JSON, CSV, EDI, XML, etc. |
| **%PROC Built-in** | V7.4 | V7.2 | Returns the name of the current procedure. In mainline calcs returns the `*MODULE` name; in subprocedures returns the subprocedure name. |
| **%MIN / %MAX** | V7.4 | V7.2 | Returns the minimum or maximum of two or more values. |
| **ALIGN(\*FULL) Keyword** | V7.4 | V7.2 | Aligns a DS and rounds up its length to a multiple of the alignment size (2, 4, 8, or 16-byte boundary). |

---

## V7.5 Enhancements

| Feature | VxRy | PTF | Notes |
|---------|------|-----|-------|
| **%MINARR / %MAXARR** | V7.5 | V7.3 | Returns the array index of the minimum/maximum value. Assumes array is ordered or was sorted with `SORTA` beforehand. |
| **SND-MSG** | V7.5 | V7.3 | Sends an `*INFO` message to the job log. Supports impromptu text (`SND-MSG 'Hello';`) or message IDs via `%MSG('CPF9897':'QCPFMSG':'text')`. |
| **Enhanced SND-MSG** | V7.5 | V7.4 | Adds `*INFO`, `*COMP`, `*DIAG`, `*ESCAPE`, `*NOTIFY`, `*STATUS` message types. New `%TARGET(*CTLBDY \| *PGMBDY \| *EXT)` controls message destination. |
| **ON-EXCP** | V7.5 | V7.3 | Used with `MONITOR` for CL-style `MONMSG` handling. Example: `MONITOR; open custmast; ON-EXCP 'CPF4101'; SND-MSG 'File not open.'; ENDMON;` |
| **DATA-GEN Opcode** | V7.5 | V7.3 | Complement of `DATA-INTO`. Writes data to an output stream using a user-defined generator program (for JSON, CSV, etc.). |
| **FOR-EACH Opcode** | V7.5 | V7.3 | Iterates over a `%LIST`, `%SUBARR`, or array. Example: `FOR-EACH pet IN %LIST('CAT':'DOG':'BIRD'); SND-MSG pet; ENDFOR;` Cannot read through a file. |
| **SORTA %FIELDS** | V7.5 | V7.3 | Sort a DS array by one or more subfield names. Example: `SORTA sales %FIELDS(custNo : total);` |
| **%LIST / %RANGE / IN Operator** | V7.5 | V7.3 | `%LIST` defines a list of values usable anywhere an array can be used. `%RANGE` defines a lower-to-upper range. Use with `IN` operator: `IF region IN %LIST('IL':'IN':'WI');` or `IF sales IN %RANGE(min:max);` |
| **%UPPER / %LOWER** | V7.5 | V7.3 | CCSID-safe upper/lower case conversion. Syntax: `%UPPER(var [: start [: length [: *NATURAL \| *STDCHARSIZE]]])`. Use `*NATURAL` to respect UTF-8 character boundaries. |
| **%SPLIT** | V7.5 | V7.3 | Splits a string into tokens using a delimiter. `FOR-EACH csv IN %SPLIT(data:','); SND-MSG csv; ENDFOR;` Consecutive delimiters are collapsed unless `*ALLSEP` is used (V7.6). |
| **EXPROPTS(\*STRICTKEYS)** | V7.5 | V7.3 | When specified on `CTL-OPT`, key list or `%KDS` fields must be less than or equal to the declared size of the actual key fields in the file. |
| **EXPROPTS(\*USEDECEDIT)** | V7.5 | V7.3 | Allows `%DEC`, `%INT`, etc. to accept values with thousands-notation separators. Example: `varField = %DEC('1,202.50');` |
| **OVERLOAD Keyword on Prototype** | V7.5 | V7.3 | Identifies other prototypes to dispatch to based on the data-type of the parameters passed at call time. `DCL-PR myFunc OVERLOAD(p1:p2:p3);` |
| **OPTIONS(\*EXACT) Parameter** | V7.5 | V7.3 | The value passed for this parameter must match its defined data-type exactly, with length less than or equal to the defined parameter length. No implicit conversion. |
| **LIKEDS(qual.name)** | V7.5 | V7.3 | Qualified subfield names may be used on the `LIKEDS` keyword to base a new DS on a nested subfield of another data structure. |
| **Infinite Loop with \*ON / \*OFF** | V7.5 | V7.3 | Conditional opcodes now support `*ON` or `*OFF` directly without a comparison expression. Example: `DOW *ON; ... ENDDO;` |
| **%TIMESTAMP(\*UNIQUE)** | V7.5 | V7.3 | Returns the system timestamp with microseconds. The last 6 fractional digits are uniquely generated by the system, providing 12 digits of precision. |
| **%KDS(ds-name \[:keycount\])** | V7.5 | V7.3 | A second parameter specifies the number of DS subfields to use as the key list when using `%KDS` on file I/O operations. |

---

## V7.6 Enhancements

| Feature | VxRy | PTF | Notes |
|---------|------|-----|-------|
| **%SPLIT(\*ALLSEP)** | V7.6 | V7.4 | Each consecutive separator produces an empty token. For `"val1",,,"val4"`: without `*ALLSEP` returns 2 values; with `*ALLSEP` returns 4 (including the 2 empty tokens). |
| **Implicit CCSID Conversion** | V7.6 | V7.5 | Most string built-ins now perform automatic CCSID conversion, including: `%CHECK`, `%CHECKR`, `%SCAN`, `%SCANRPL`, `%REPLACE`, `%SPLIT`, `%TRIM`, `%TRIML`, `%TRIMR`, `%XLATE`, `%LOOKUPxx`, `%TLOOKUPxx`. |
| **\*LONGJOBRUN Date Format** | V7.6 | V7.4 | When converting to/from dates in job format, causes the year portion to use a 4-digit year. |
| **\*DMYY / \*MDYY / \*YYMD Date Formats** | V7.6 | V7.5 | Explicit 4-digit year variants of `*DMY`, `*MDY`, `*YMD`. Usable in `%CHAR`, `%DEC`, `%DATE`, `MOVE`, `MOVEL`, and `TEST(D)`. |
| **DATEYY(\*WARN \| \*NOALLOW)** | V7.6 | V7.4 | `CTL-OPT` keyword that warns or prevents use of date formats containing only a 2-digit year. |
| **%HIVAL(var) / %LOVAL(var)** | V7.6 | V7.4 | Returns the highest or lowest value storable in a variable. For numerics: e.g. `99999.99` / `-99999.99`. For ENUMs: the highest/lowest defined ENUM value. |
| **SND-MSG — Message Type and Target** | V7.6 | V7.4 | `SND-MSG` now supports all types: `*INFO`, `*COMP`, `*DIAG`, `*NOTIFY`, `*ESCAPE`, `*STATUS`. Target via `%TARGET(*CALLER \| *EXT \| *SELF \| *CTLBDY \| *PGMBDY)` or a procedure name. |
| **CONST — Read-Only Fields** | V7.6 | V7.4 | `CONST` keyword on any `DCL-S` or `DCL-DS` makes the variable read-only after initialization. Value must be set via `INZ`. Example: `DCL-S JOBDATE DATE INZ(*JOB) CONST;` |
| **%LEFT(var:len) / %RIGHT(var:len)** | V7.6 | V7.4 | Extracts the leftmost or rightmost `len` characters. Optional `*NATURAL` or `*STDCHARSIZE` parameter controls UTF-8 vs. byte-based length handling. |
| **%CONCAT(sep : arg1 : arg2 : ...)** | V7.6 | V7.4 | Concatenates values into one string using the first parameter as a separator. Use `*NONE` for no separator or `*BLANKS` in place of `' '`. |
| **%CONCATARR(sep : array)** | V7.6 | V7.4 | Concatenates elements of a character array into a string. Separator can be `*NONE` or `*BLANKS`. Second parameter accepts an array, `%SUBARR`, `%LIST`, or `%SPLIT`. |
| **Qualified ENUMs** | V7.6 | V7.4 | `QUALIFIED` keyword on `DCL-ENUM` qualifies each ENUM entry to its parent name, preventing naming conflicts. |
| **Typed ENUM Data-Types** | V7.6 | V7.5 | A data-type and length can be specified once on `DCL-ENUM`, making all entries that type. Individual entries do not need their own type declaration. |
| **ENUM Default (DFT Keyword)** | V7.6 | V7.5 | A typed ENUM entry with `DFT` is used as the initial value when a field is declared with `LIKE(enumName)` and no explicit `INZ` is provided. |
| **%PASSED(parm) / %OMITTED(parm)** | V7.6 | V7.4 | For `OPTIONS(*OMIT)` parameters: `%PASSED` returns `*ON` if a value was passed; `%OMITTED` returns `*ON` if `*OMIT` was specified. Combine with `%PARMS >= %PARMNUM(name)` to check `OPTIONS(*NOPASS)` parameters too. |
| **SELECT / WHEN-IS / WHEN-IN** | V7.6 | V7.4 | `SELECT` with an argument enables switch/case logic. `WHEN-IS` tests equality; `WHEN-IN` tests against `%LIST` or `%RANGE`. Example: `SELECT region; WHEN-IS 'CHICAGO'; ...; WHEN-IN %LIST('DETROIT':'FLORIDA'); ...; ENDSL;` |
| **PPMINOUTLN Parameter** | V7.6 | V7.3 | Sets the record length of the RPG preprocessor's temporary source file in QTEMP. Embed in `CRTSQLRPGI` via `COMPILEOPT('PPMINOUTLN(1024)')`, or set via env var `QIBM_RPG_PPSRCFILE_LENGTH`. |
| **REQPREXP** | V7.6 | - | Controls whether prototypes are required for exported procedures. Options: `*NO` (not required), `*WARN` (sev-10 warning if missing), `*REQUIRE` (sev-30 error if missing). |
| **CHARCOUNT(\*NATURAL) / CHARCOUNTTYPES(\*UTF8)** | V7.6 | V7.4 | `CTL-OPT` keywords controlling how character string lengths and UTF-8 variable character counts are calculated throughout the module. |
| **OPTIONS(\*CONVERT)** | V7.6 | V7.4 | Automatically converts the value passed on a parameter to the target data-type. Eliminates intermediate conversion steps — e.g., pass a numeric to a character parameter or a date to a numeric parameter. |

---

*Last updated: April 2026*
