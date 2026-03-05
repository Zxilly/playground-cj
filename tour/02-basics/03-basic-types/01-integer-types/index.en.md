# Integer Types

Cangjie provides multiple integer types, divided into signed and unsigned categories.

**Signed integers**: `Int8`, `Int16`, `Int32`, `Int64`, occupying 8, 16, 32, and 64 bits respectively.

**Unsigned integers**: `UInt8`, `UInt16`, `UInt32`, `UInt64`, which can only represent non-negative values.

Integer literals default to `Int64`. Cangjie also supports binary (`0b`), octal (`0o`), and hexadecimal (`0x`) notation, and underscores `_` can be used as separators for readability.

In general, `Int64` is recommended as it has a large enough range and avoids unnecessary type conversions.
