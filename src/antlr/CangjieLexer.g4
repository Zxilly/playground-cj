


lexer grammar CangjieLexer;

// Comments
DelimitedComment: '/*' ( DelimitedComment | .)*? '*/';
LineComment: '//' ~[\u000A\u000D]*;

// Whitespace and newlines
WS: [\u0020\u0009\u000C] -> skip;
NL: '\u000A' | '\u000D' '\u000A';

// Symbols
DOT: '.';
COMMA: ',';
LPAREN: '(';
RPAREN: ')';
LSQUARE: '[';
RSQUARE: ']';
LCURL: '{';
RCURL: '}';
EXP: '**';
MUL: '*';
MOD: '%';
DIV: '/';
ADD: '+';
SUB: '-';
PIPELINE: '|>';
COMPOSITION: '~>';
INC: '++';
DEC: '--';
AND: '&&';
OR: '||';
NOT: '!';
BITAND: '&';
BITOR: '|';
BITXOR: '^';
LSHIFT: '<<';
RSHIFT: '>>';
COLON: ':';
SEMI: ';';
ASSIGN: '=';
ADD_ASSIGN: '+=';
SUB_ASSIGN: '-=';
MUL_ASSIGN: '*=';
EXP_ASSIGN: '**=';
DIV_ASSIGN: '/=';
MOD_ASSIGN: '%=';
AND_ASSIGN: '&&=';
OR_ASSIGN: '||=';
BITAND_ASSIGN: '&=';
BITOR_ASSIGN: '|=';
BITXOR_ASSIGN: '^=';
LSHIFT_ASSIGN: '<<=';
RSHIFT_ASSIGN: '>>=';
ARROW: '->';
BACKARROW: '<-';
DOUBLE_ARROW: '=>';
ELLIPSIS: '...';
CLOSEDRANGEOP: '..=';
RANGEOP: '..';
HASH: '#';
AT: '@';
QUEST: '?';
UPPERBOUND: '<:';
LT: '<';
GT: '>';
LE: '<=';
GE: '>=';
NOTEQUAL: '!=';
EQUAL: '==';
WILDCARD: '_';
BACKSLASH: '\\';
QUOTESYMBOL: '`';
DOLLAR: '$';
QUOTE_OPEN: '"' -> pushMode(IN_STRING);
TRIPLE_QUOTE_OPEN: '"""' NL -> pushMode(IN_MULTI_LINE_STRING);
LineStrExprStart: '${' -> pushMode(DEFAULT_MODE);
MultiLineStrExprStart: '${' -> pushMode(DEFAULT_MODE);

// Keywords
INT8: 'Int8';
INT16: 'Int16';
INT32: 'Int32';
INT64: 'Int64';
INTNATIVE: 'IntNative';
UINT8: 'UInt8';
UINT16: 'UInt16';
UINT32: 'UInt32';
UINT64: 'UInt64';
UINTNATIVE: 'UIntNative';
FLOAT16: 'Float16';
FLOAT32: 'Float32';
FLOAT64: 'Float64';
RUNE: 'Rune';
BOOLEAN: 'Bool';
UNIT: 'Unit';
Nothing: 'Nothing';
STRUCT: 'struct';
ENUM: 'enum';
THISTYPE: 'This';
PACKAGE: 'package';
IMPORT: 'import';
CLASS: 'class';
INTERFACE: 'interface';
FUNC: 'func';
MAIN: 'main';
LET: 'let';
VAR: 'var';
CONST: 'const';
TYPE_ALIAS: 'type';
INIT: 'init';
THIS: 'this';
SUPER: 'super';
IF: 'if';
ELSE: 'else';
CASE: 'case';
TRY: 'try';
CATCH: 'catch';
FINALLY: 'finally';
FOR: 'for';
DO: 'do';
WHILE: 'while';
THROW: 'throw';
RETURN: 'return';
CONTINUE: 'continue';
BREAK: 'break';
IS: 'is';
AS: 'as';
IN: 'in';
MATCH: 'match';
FROM: 'from';
WHERE: 'where';
EXTEND: 'extend';
SPAWN: 'spawn';
SYNCHRONIZED: 'synchronized';
MACRO: 'macro';
QUOTE: 'quote';
TRUE: 'true';
FALSE: 'false';
STATIC: 'static';
PUBLIC: 'public';
PRIVATE: 'private';
PROTECTED: 'protected';
OVERRIDE: 'override';
REDEF: 'redef';
ABSTRACT: 'abstract';
OPEN: 'open';
OPERATOR: 'operator';
FOREIGN: 'foreign';
INOUT: 'inout';
PROP: 'prop';
MUT: 'mut';
UNSAFE: 'unsafe';
GET: 'get';
SET: 'set';

// Literals
IntegerLiteralSuffix:
    'i8'
    | 'i16'
    | 'i32'
    | 'i64'
    | 'u8'
    | 'u16'
    | 'u32'
    | 'u64'
;
IntegerLiteral:
    BinaryLiteral IntegerLiteralSuffix?
    | OctalLiteral IntegerLiteralSuffix?
    | DecimalLiteral '_'* IntegerLiteralSuffix?
    | HexadecimalLiteral IntegerLiteralSuffix?
;
BinaryLiteral: '0' [bB] BinDigit (BinDigit | '_')*;
BinDigit: [01];
OctalLiteral: '0' [oO] OctalDigit (OctalDigit | '_')*;
OctalDigit: [0-7];
DecimalLiteral: (DecimalDigitWithOutZero (DecimalDigit | '_')*)
    | DecimalDigit
;
fragment DecimalFragment: DecimalDigit (DecimalDigit | '_')*;
fragment DecimalDigit: [0-9];
fragment DecimalDigitWithOutZero: [1-9];
HexadecimalLiteral: '0' [xX] HexadecimalDigits;
HexadecimalDigits: HexadecimalDigit (HexadecimalDigit | '_')*;
HexadecimalDigit: [0-9a-fA-F];
FloatLiteralSuffix: 'f16' | 'f32' | 'f64';
FloatLiteral: (
        DecimalLiteral DecimalExponent
        | DecimalFraction DecimalExponent?
        | (DecimalLiteral DecimalFraction) DecimalExponent?
    ) FloatLiteralSuffix?
    | (
        Hexadecimalprefix (
            HexadecimalDigits
            | HexadecimalFraction
            | (HexadecimalDigits HexadecimalFraction)
        ) HexadecimalExponent
    )
;
fragment DecimalFraction: '.' DecimalFragment;
fragment DecimalExponent: FloatE Sign? DecimalFragment;
fragment Sign: [-];
fragment Hexadecimalprefix: '0' [xX];
HexadecimalFraction: '.' HexadecimalDigits;
HexadecimalExponent: FloatP Sign? DecimalFragment;
FloatE: [eE];
FloatP: [pP];

RuneLiteral: '\'' (SingleChar | EscapeSeq) '\'';
SingleChar: ~['\\\r\n];
EscapeSeq: UniCharacterLiteral | EscapedIdentifier;
UniCharacterLiteral:
    '\\' 'u' '{' HexadecimalDigit '}'
    | '\\' 'u' '{' HexadecimalDigit HexadecimalDigit '}'
    | '\\' 'u' '{' HexadecimalDigit HexadecimalDigit HexadecimalDigit '}'
    | '\\' 'u' '{' HexadecimalDigit HexadecimalDigit HexadecimalDigit HexadecimalDigit '}'
    | '\\' 'u' '{' HexadecimalDigit HexadecimalDigit HexadecimalDigit HexadecimalDigit
        HexadecimalDigit '}'
    | '\\' 'u' '{' HexadecimalDigit HexadecimalDigit HexadecimalDigit HexadecimalDigit
        HexadecimalDigit HexadecimalDigit '}'
    | '\\' 'u' '{' HexadecimalDigit HexadecimalDigit HexadecimalDigit HexadecimalDigit
        HexadecimalDigit HexadecimalDigit HexadecimalDigit '}'
    | '\\' 'u' '{' HexadecimalDigit HexadecimalDigit HexadecimalDigit HexadecimalDigit
        HexadecimalDigit HexadecimalDigit HexadecimalDigit HexadecimalDigit '}'
;
EscapedIdentifier:
    '\\' (
        't'
        | 'b'
        | 'r'
        | 'n'
        | '\''
        | '"'
        | '\\'
        | 'f'
        | 'v'
        | '0'
        | '$'
    )
;
ByteLiteral: 'b' '\'' (SingleCharByte | ByteEscapeSeq) '\'';
ByteEscapeSeq: HexCharByte | ByteEscapedIdentifier;
SingleCharByte:
    [\u0000-\u0009\u000B\u000C\u000E-\u0021\u0023-\u0026\u0028-\u005B\u005D-\u007F]
;
fragment ByteEscapedIdentifier:
    '\\' (
        't'
        | 'b'
        | 'r'
        | 'n'
        | '\''
        | '"'
        | '\\'
        | 'f'
        | 'v'
        | '0'
    )
;
fragment HexCharByte:
    '\\' 'u' '{' HexadecimalDigit '}'
    | '\\' 'u' '{' HexadecimalDigit HexadecimalDigit '}'
;
ByteStringArrayLiteral:
    'b' '"' (SingleCharByte | ByteEscapeSeq)* '"'
;
JStringLiteral: 'J' '"' (SingleChar | EscapeSeq)* '"';

// Identifiers
Identifier: Ident | RawIdent;
DollarIdentifier: '$' (Ident | RawIdent);

fragment Ident: XID_Start XID_Continue* | '_' XID_Continue+;
fragment RawIdent: '`' Ident '`';

// Unicode character classes
fragment XID_Start: [\p{XID_Start}];
fragment XID_Continue: [\p{XID_Continue}];

// Modes
mode IN_STRING;
QUOTE_CLOSE: '"' -> popMode;
LineStrText: ~["\\\r\n] | EscapeSeq;

mode IN_MULTI_LINE_STRING;
TRIPLE_QUOTE_CLOSE: MultiLineStringQuote? '"""' -> popMode;
MultiLineStringQuote: '"'+;
MultiLineStrText: ~('\\') | EscapeSeq;
MultiLineRawStringLiteral: MultiLineRawStringContent;
fragment MultiLineRawStringContent:
    HASH MultiLineRawStringContent HASH
    | HASH '"' .*? '"' HASH
;