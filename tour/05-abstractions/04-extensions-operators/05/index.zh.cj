struct Temperature {
    public let celsius: Float64

    public init(celsius: Float64) {
        this.celsius = celsius
    }

    // 重载相等运算符
    public operator func ==(rhs: Temperature): Bool {
        return this.celsius == rhs.celsius
    }

    // 重载不等运算符
    public operator func !=(rhs: Temperature): Bool {
        return this.celsius != rhs.celsius
    }

    // 重载小于运算符
    public operator func <(rhs: Temperature): Bool {
        return this.celsius < rhs.celsius
    }

    // 重载大于运算符
    public operator func >(rhs: Temperature): Bool {
        return this.celsius > rhs.celsius
    }

    // 重载小于等于运算符
    public operator func <=(rhs: Temperature): Bool {
        return this.celsius <= rhs.celsius
    }

    // 重载大于等于运算符
    public operator func >=(rhs: Temperature): Bool {
        return this.celsius >= rhs.celsius
    }

    // 格式化输出
    public func toString(): String {
        return "${this.celsius}°C"
    }
}

main() {
    let boiling = Temperature(100.0)    // 沸点
    let freezing = Temperature(0.0)     // 冰点
    let body = Temperature(37.0)        // 体温
    let another = Temperature(37.0)     // 另一个体温

    println("沸点: ${boiling.toString()}")
    println("冰点: ${freezing.toString()}")
    println("体温: ${body.toString()}")
    println()

    // 使用重载的比较运算符
    println("沸水 > 冰水: ${boiling > freezing}")
    println("冰水 < 体温: ${freezing < body}")
    println("体温 == 另一个体温: ${body == another}")
    println("沸水 != 冰水: ${boiling != freezing}")
    println("体温 <= 沸水: ${body <= boiling}")
    println("冰水 >= 沸水: ${freezing >= boiling}")
    println()

    // 找出最高温度
    let temps = [freezing, body, boiling]
    var maxTemp = temps[0]
    for (t in temps) {
        if (t > maxTemp) {
            maxTemp = t
        }
    }
    println("最高温度: ${maxTemp.toString()}")
}