# let Immutable Binding

In Cangjie, use the `let` keyword to declare immutable bindings. Once assigned, the value of a `let` binding cannot be changed.

Immutable bindings are the recommended default in Cangjie. Using immutable data makes programs safer and easier to reason about.

If you try to modify a `let` binding, the compiler will report an error. When you actually need to change a variable, use `var` (covered in the next section).
