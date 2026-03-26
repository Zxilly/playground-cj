// 定义一个开放的可继承类 Animal
open class Animal {
    let name: String

    init(name: String) {
        this.name = name
    }

    public open func speak(): String {
        "${name} 发出声音"
    }
}

// Dog 继承 Animal
class Dog <: Animal {
    init(name: String) {
        super(name)
    }

    public override func speak(): String {
        "${name} 说: 汪汪!"
    }
}

// Cat 继承 Animal
class Cat <: Animal {
    init(name: String) {
        super(name)
    }

    public override func speak(): String {
        "${name} 说: 喵喵!"
    }
}

// 使用类型约束实现多态
// T 必须是 Animal 的子类型
func makeSpeak<T>(animal: T): Unit where T <: Animal {
    println(animal.speak())
}

// 使用基类型数组存储不同子类型
func speakAll(animals: Array<Animal>): Unit {
    println("动物合唱团:")
    for (a in animals) {
        println("  ${a.speak()}")
    }
}

main() {
    let dog = Dog("大黄")
    let cat = Cat("小白")

    // 方法 1: 泛型函数配合约束
    // 每次调用时 T 被实例化为具体类型
    println("=== 单独调用 ===")
    makeSpeak(dog)  // T = Dog
    makeSpeak(cat)  // T = Cat

    // 方法 2: 基类型数组存放多种子类型
    println("\n=== 集体调用 ===")
    let animals: Array<Animal> = [
        Dog("旺财"),
        Cat("咪咪"),
        Dog("小黑"),
        Cat("花花")
    ]
    speakAll(animals)
}