class Counter {
    var count: Int64
    var label: String

    // 构造函数必须初始化所有成员变量
    init(count: Int64, label: String) {
        this.count = count
        this.label = label
    }

    // 成员函数
    public func increment() {
        count += 1
    }

    public func describe(): String {
        "${label}: ${count}"
    }
}

main() {
    // 创建实例
    let counter = Counter(0, "点击")
    println(counter.describe())

    // 调用成员函数
    counter.increment()
    counter.increment()
    println("调用后: ${counter.describe()}")

    // 引用类型行为：赋值不复制数据
    let sameCounter = counter
    sameCounter.label = "访问"
    sameCounter.count = 100
    println("原变量: ${counter.describe()}")
    println("新变量: ${sameCounter.describe()}")
}