open class Animal {
    let name: String

    init(name: String) {
        this.name = name
    }

    open func speak(): String {
        "..."
    }
}

class Dog <: Animal {
    let breed: String

    init(name: String, breed: String) {
        super(name)
        this.breed = breed
    }

    public override func speak(): String {
        "Woof!"
    }

    func fetch(): String {
        "${name} fetches the ball!"
    }
}

class Cat <: Animal {
    init(name: String) {
        super(name)
    }

    public override func speak(): String {
        "Meow!"
    }

    func purr(): String {
        "${name} purrs..."
    }
}

main() {
    let animals: Array<Animal> = [
        Dog("Buddy", "Labrador"),
        Cat("Luna"),
        Dog("Max", "Poodle")
    ]

    for (a in animals) {
        println("${a.name}: ${a.speak()}")

        // Type check and cast with pattern matching
        match (a) {
            case d: Dog => println("  ${d.fetch()} (breed: ${d.breed})")
            case c: Cat => println("  ${c.purr()}")
            case _ => ()
        }
    }
}