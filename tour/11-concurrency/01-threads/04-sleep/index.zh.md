# 线程 sleep

有时你需要让线程暂停执行一段时间。仓颉提供了 `sleep` 函数来暂停当前线程。

使用 `sleep` 需要导入 `std.time.*` 包。`Duration` 类型用于表示时间间隔，提供了便捷的构造方式如 `Duration.second`、`Duration.millisecond` 等。

`sleep` 在以下场景中有用：
- 模拟延迟操作
- 定期轮询
- 限制执行速率

右侧的代码展示了如何使用 `sleep` 创建一个简单的倒计时程序。
