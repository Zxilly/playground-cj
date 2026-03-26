// 定义飞行接口
interface Flyable {
    func fly(): String
    func altitude(): Int64
}

// 鸟类
class Bird <: Flyable {
    let name: String

    init(name: String) {
        this.name = name
    }

    public func fly(): String {
        "${name} 展翅高飞"
    }

    public func altitude(): Int64 {
        100  // 鸟类飞行高度
    }
}

// 飞机类
class Airplane <: Flyable {
    let model: String

    init(model: String) {
        this.model = model
    }

    public func fly(): String {
        "${model} 起飞巡航"
    }

    public func altitude(): Int64 {
        10000  // 飞机巡航高度
    }
}

// 统一的发射函数，接受任何 Flyable
func launch(item: Flyable) {
    println("发射: ${item.fly()}")
    println("高度: ${item.altitude()} 米")
}

// 比较飞行高度
func compareAltitude(a: Flyable, b: Flyable) {
    let ha = a.altitude()
    let hb = b.altitude()
    if (ha > hb) {
        println("第一个飞行物更高")
    } else if (ha < hb) {
        println("第二个飞行物更高")
    } else {
        println("两者高度相同")
    }
}

main() {
    let bird = Bird("老鹰")
    let plane = Airplane("波音747")

    println("=== 多态演示 ===")
    launch(bird)
    println()
    launch(plane)

    println("\n=== 高度比较 ===")
    compareAltitude(bird, plane)
}