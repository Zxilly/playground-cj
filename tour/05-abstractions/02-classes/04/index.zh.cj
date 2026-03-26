// 父类必须用 open 修饰才能被继承
open class Animal {
    let name: String

    public init(name: String) {
        this.name = name
    }

    // open 方法才可以被子类重写
    public open func speak(): String {
        "..."
    }

    public func summary(): String {
        "${name} 说: ${speak()}"
    }
}

// 子类使用 <: 继承
class Dog <: Animal {
    public init(name: String) {
        // 必须调用父类构造器
        super(name)
    }

    public override func speak(): String {
        "汪汪"
    }
}

class Cat <: Animal {
    public init(name: String) {
        super(name)
    }

    public override func speak(): String {
        "喵喵"
    }
}

class Bird <: Animal {
    public init(name: String) {
        super(name)
    }

    public override func speak(): String {
        "啾啾"
    }
}

main() {
    // 创建不同子类的对象
    let dog = Dog("旺财")
    let cat = Cat("咪咪")
    let bird = Bird("小黄")

    // 子类对象可以当作父类使用
    let animals: Array<Animal> = [dog, cat, bird]
    for (animal in animals) {
        // 多态：运行时调用各自子类的 speak()
        println(animal.summary())
    }

    // 也可以直接使用子类对象
    println("\n单独调用:")
    println("狗叫: ${dog.speak()}")
    println("猫叫: ${cat.speak()}")
    println("鸟叫: ${bird.speak()}")
}