// Parent class must be marked with open to be inherited
open class Animal {
    let name: String

    public init(name: String) {
        this.name = name
    }

    // Only open methods can be overridden by subclasses
    public open func speak(): String {
        "..."
    }

    public func summary(): String {
        "${name} says: ${speak()}"
    }
}

// Subclass uses <: to inherit
class Dog <: Animal {
    public init(name: String) {
        // Must call parent constructor
        super(name)
    }

    public override func speak(): String {
        "Woof woof"
    }
}

class Cat <: Animal {
    public init(name: String) {
        super(name)
    }

    public override func speak(): String {
        "Meow meow"
    }
}

class Bird <: Animal {
    public init(name: String) {
        super(name)
    }

    public override func speak(): String {
        "Chirp chirp"
    }
}

main() {
    // Create objects of different subclasses
    let dog = Dog("Wangcai")
    let cat = Cat("Mimi")
    let bird = Bird("Xiaohuang")

    // Subclass objects can be used as parent class objects
    let animals: Array<Animal> = [dog, cat, bird]
    for (animal in animals) {
        // Polymorphism: calls each subclass's speak() at runtime
        println(animal.summary())
    }

    // Can also use subclass objects directly
    println("\nDirect calls:")
    println("Dog barks: ${dog.speak()}")
    println("Cat meows: ${cat.speak()}")
    println("Bird chirps: ${bird.speak()}")
}