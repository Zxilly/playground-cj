# ArrayList

`ArrayList` 是仓颉中最常用的动态数组类型。它可以在运行时动态增长和收缩，不需要预先指定大小。

使用 `ArrayList` 需要先导入 `std.collection.*`。创建时需要指定元素类型，如 `ArrayList<Int64>()`。常用操作包括 `append` 添加元素、通过下标访问元素、`size` 获取长度等。

`ArrayList` 支持在任意位置插入和删除元素，但在末尾操作效率最高。当需要频繁随机访问元素时，`ArrayList` 是最佳选择。