# Arithmetic Operator Overloading

Cangjie allows you to overload operators for custom types, enabling arithmetic operations like `+`, `-`, `*`. Operator overloading is achieved by defining `operator func` inside a type.

For example, `operator func +(rhs: Vec2): Vec2` defines the `+` operator. When you write `a + b`, it actually calls the `+` method on `a` with `b` as the argument.

Common overloadable arithmetic operators include:
- `+` (addition)
- `-` (subtraction)
- `*` (multiplication)
- `/` (division)

Operator overloading makes custom types feel natural and intuitive to use. The code on the right implements basic arithmetic operations for a 2D vector `Vec2`.
