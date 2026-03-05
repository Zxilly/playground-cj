# Unit 与 Nothing

仓颉有两个特殊类型：`Unit` 和 `Nothing`。

**Unit** 类型只有一个值 `()`。那些只关心副作用而不返回有意义值的表达式，其类型就是 `Unit`。例如 `println()` 的返回类型、赋值表达式、循环表达式的类型都是 `Unit`。

**Nothing** 是一种不包含任何值的特殊类型，它是所有类型的子类型。`break`、`continue`、`return` 和 `throw` 表达式的类型是 `Nothing`，因为执行到这些表达式时，后续代码不会被执行。
