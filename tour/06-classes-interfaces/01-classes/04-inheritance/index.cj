open class Animal {
    let name: String
    var age: Int64

    init(name: String, age: Int64) {
        this.name = name
        this.age = age
    }

    open func speak(): String {
        "..."
    }

    func describe(): String {
        "${name} (age ${age})"
    }
}

class Dog <: Animal {
    let breed: String

    init(name: String, age: Int64, breed: String) {
        super(name, age)
        this.breed = breed
    }

    public override func speak(): String {
        "Woof!"
    }
}

class Cat <: Animal {
    init(name: String, age: Int64) {
        super(name, age)
    }

    public override func speak(): String {
        "Meow!"
    }
}

main() {
    let dog = Dog("Buddy", 3, "Labrador")
    let cat = Cat("Luna", 2)

    println("${dog.describe()} says ${dog.speak()}")
    println("Breed: ${dog.breed}")
    println("${cat.describe()} says ${cat.speak()}")
}