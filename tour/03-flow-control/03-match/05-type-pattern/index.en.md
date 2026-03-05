# Type Pattern

Type patterns check whether a value belongs to a specific type and can simultaneously bind it to a variable.

The syntax is `case varName: Type =>`. If the value is of the specified type, the match succeeds and the variable is bound with that type.

Type patterns are very useful when dealing with polymorphism or interface types, allowing you to execute different logic based on the concrete type.
