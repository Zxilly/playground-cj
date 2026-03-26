func readAt(values: Array<Int64>, index: Int64): Int64 {
    values[index]
}

main() {
    let values = [10, 20, 30]

    // 正确顺序：具体类型在前，通用类型在后
    try {
        let item = readAt(values, 10)
        println(item)
    } catch (e: IndexOutOfBoundsException) {
        println("捕获到具体异常：${e.message}")
    } catch (e: Exception) {
        println("捕获到通用异常：${e.message}")
    }

    // 不同的异常类型可以分别处理
    try {
        throw ArithmeticException("除数不能为零")
    } catch (e: ArithmeticException) {
        println("算术异常：${e.message}")
    } catch (e: IllegalArgumentException) {
        println("参数异常：${e.message}")
    } catch (e: Exception) {
        println("其他异常：${e.message}")
    }

    println("程序继续执行...")
}