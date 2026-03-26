// 动物基类
open class Animal {
    public open func speak(): String {
        "动物发出的声音"
    }
}

// 狗类
class Dog <: Animal {
    public override func speak(): String {
        "汪汪汪!"
    }

    public func fetch(): String {
        "狗捡回了球"
    }
}

// 猫类
class Cat <: Animal {
    public override func speak(): String {
        "喵喵喵~"
    }

    public func climb(): String {
        "猫爬上了树"
    }
}

// 处理动物的函数
func handleAnimal(a: Animal) {
    println("动物说话: ${a.speak()}")

    // 使用 is 判断运行时类型
    println("是狗吗? ${a is Dog}")
    println("是猫吗? ${a is Cat}")

    // 使用 as 安全转换并访问特有方法
    match (a as Dog) {
        case Some(dog) => 
            println("狗特有动作: ${dog.fetch()}")
        case None => ()
    }

    match (a as Cat) {
        case Some(cat) =>
            println("猫特有动作: ${cat.climb()}")
        case None => ()
    }
}

// 批量处理动物
func processAnimals(animals: Array<Animal>) {
    var dogCount = 0
    var catCount = 0

    for (a in animals) {
        if (a is Dog) {
            dogCount++
        } else if (a is Cat) {
            catCount++
        }
    }

    println("统计: ${dogCount} 条狗, ${catCount} 只猫")
}

main() {
    println("=== 类型判断和转换 ===\n")

    // 创建不同的动物
    let dog: Animal = Dog()  // 声明类型是 Animal
    let cat: Animal = Cat()
    let generic = Animal()

    println("--- 处理狗 ---")
    handleAnimal(dog)

    println("\n--- 处理猫 ---")
    handleAnimal(cat)

    println("\n--- 处理普通动物 ---")
    handleAnimal(generic)

    // 批量处理
    let zoo: Array<Animal> = [
        Dog(), Cat(), Dog(), Animal(), Cat()
    ]
    println("\n=== 动物园统计 ===")
    processAnimals(zoo)
}