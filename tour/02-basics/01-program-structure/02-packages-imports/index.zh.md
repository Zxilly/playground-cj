# 包与导入

仓颉使用包（package）来组织代码。标准库提供了丰富的功能包，可以通过 `import` 语句导入使用。

导入的基本语法是 `import 包路径.名称`。使用 `*` 可以导入包中的所有公开内容，例如 `import std.collection.*`。

你也可以只导入特定的内容：`import std.math.min`。或者用花括号一次导入多个内容：`import std.math.{min, max}`。

在 Playground 环境中，常用的标准库内容已经可以直接使用，但在某些情况下你仍需要显式导入。
