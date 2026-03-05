# Option 链式操作

`Option` 类型提供了多个实用方法，支持链式调用来处理可选值。这些方法包括 `map`、`flatMap` 和 `getOrDefault` 等。

`map` 方法在值存在时对其进行转换，`flatMap` 用于避免嵌套的 `Option`，`getOrDefault` 在值不存在时提供默认值。

链式操作使得处理可选值的代码更加简洁流畅，避免了深层嵌套的 `match` 表达式。
