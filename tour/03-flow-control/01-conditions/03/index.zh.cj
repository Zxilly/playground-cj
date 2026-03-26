main() {
    // 定义两个 Option 类型的变量
    let a: ?Int64 = Some(42)
    let b: ?Int64 = None

    // 基本的 if-let 解包
    if (let Some(value) <- a) {
        println("a 的值: ${value}")
    } else {
        println("a 为空")
    }

    if (let Some(value) <- b) {
        println("b 的值: ${value}")
    } else {
        println("b 为空")
    }

    // if-let 配合额外条件检查
    let x: ?Int64 = Some(10)
    if (let Some(v) <- x && v > 5) {
        println("x 的值 ${v} 大于 5")
    } else {
        println("x 为空或值不大于 5")
    }

    // 多个 let pattern 组合
    let p: ?Int64 = Some(3)
    let q: ?Int64 = Some(5)
    if (let Some(m) <- p && let Some(n) <- q) {
        println("p + q = ${m + n}")
    }

    // 使用 || 连接（不绑定变量）
    let r: ?Int64 = None
    if (let Some(_) <- a || let Some(_) <- r) {
        println("a 或 r 至少有一个非空")
    }
}