// 泛型接口：定义值的容器
interface Container<T> {
    func get(): T
    func describe(): String
}

// 泛型结构体实现泛型接口
struct Box<T> <: Container<T> {
    let value: T

    public init(value: T) {
        this.value = value
    }

    public func get(): T {
        value
    }

    public func describe(): String {
        "Box 包含一个值"
    }
}

// 另一个泛型接口实现
struct NamedBox<T> <: Container<T> {
    let value: T
    let name: String

    public init(value: T, name: String) {
        this.value = value
        this.name = name
    }

    public func get(): T {
        value
    }

    public func describe(): String {
        "${name} 包含一个值"
    }
}

// 接受泛型接口作为参数的函数
func showIntContainer(item: Container<Int64>) {
    println("描述: ${item.describe()}")
    println("值: ${item.get()}")
}

func showStringContainer(item: Container<String>) {
    println("描述: ${item.describe()}")
    println("值: ${item.get()}")
}

main() {
    // 创建 Container<Int64> 实例
    let intBox = Box<Int64>(42)
    let intNamed = NamedBox<Int64>(100, "计数器")

    showIntContainer(intBox)
    showIntContainer(intNamed)

    println("---")

    // 创建 Container<String> 实例
    let strBox = Box<String>("仓颉")
    let strNamed = NamedBox<String>("编程语言", "语言名称")

    showStringContainer(strBox)
    showStringContainer(strNamed)
}