open class Animal {
    let name: String

    init(name: String) {
        this.name = name
    }

    public open func speak(): String {
        "..."
    }

    public func summary(): String {
        "${name}: ${speak()}"
    }
}

class Dog <: Animal {
    init(name: String) {
        super(name)
    }

    public override func speak(): String {
        "woof"
    }
}

class Cat <: Animal {
    init(name: String) {
        super(name)
    }

    public override func speak(): String {
        "meow"
    }
}

main() {
    let animals: Array<Animal> = [Dog("Buddy"), Cat("Luna")]
    for (animal in animals) {
        println(animal.summary())
    }
}
