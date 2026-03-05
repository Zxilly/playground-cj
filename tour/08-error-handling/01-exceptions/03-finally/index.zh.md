# finally

`finally` 块中的代码无论是否发生异常都会执行。这使得 `finally` 成为清理资源（如关闭文件、释放连接）的理想位置。

`try-catch-finally` 的执行顺序是：先执行 `try` 块，如果发生异常则执行匹配的 `catch` 块，最后无论如何都执行 `finally` 块。

即使 `catch` 块中又抛出了新异常，或者 `try` 块中有 `return` 语句，`finally` 块仍然会执行。
