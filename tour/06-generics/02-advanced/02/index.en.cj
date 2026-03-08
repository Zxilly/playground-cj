open class Animal {
    let name: String

    init(name: String) {
        this.name = name
    }

    public open func speak(): String {
        return "${name} makes a sound"
    }
}

class Dog <: Animal {
    init(name: String) {
        super(name)
    }

    public override func speak(): String {
        return "${name} says: Woof!"
    }
}

class Cat <: Animal {
    init(name: String) {
        super(name)
    }

    public override func speak(): String {
        return "${name} says: Meow!"
    }
}

// Using type constraints for polymorphism
func makeSpeak<T>(animal: T): Unit where T <: Animal {
    println(animal.speak())
}

func speakAll(animals: Array<Animal>): Unit {
    for (a in animals) {
        println(a.speak())
    }
}

main() {
    let dog = Dog("Rex")
    let cat = Cat("Whiskers")

    // Generic function with constraint works with subtypes
    makeSpeak(dog)
    makeSpeak(cat)

    // Array of base type can hold subtypes
    let animals: Array<Animal> = [Dog("Buddy"), Cat("Luna"), Dog("Max")]
    speakAll(animals)
}
