# Parameters & Return Values

Function parameters define the inputs a function accepts. Each parameter has a name and a type, separated by commas when there are multiple parameters.

The return type is specified after the parameter list with a colon. When the last expression in the function body is the return value, the `return` keyword can be omitted.

The example shows several parameter and return value combinations: `multiply` takes two parameters and returns their product; `isEven` takes an integer and returns a boolean; `describe` takes a string and returns a formatted description.

All parameters in Cangjie are passed by value. For value types like `Int64` and `Bool`, the function receives a copy of the value.