// Define an open inheritable class Animal
open class Animal {
    let name: String

    init(name: String) {
        this.name = name
    }

    public open func speak(): String {
        "${name} makes a sound"
    }
}

// Dog inherits Animal
class Dog <: Animal {
    init(name: String) {
        super(name)
    }

    public override func speak(): String {
        "${name} says: Woof!"
    }
}

// Cat inherits Animal
class Cat <: Animal {
    init(name: String) {
        super(name)
    }

    public override func speak(): String {
        "${name} says: Meow!"
    }
}

// Use type constraints to achieve polymorphism
// T must be a subtype of Animal
func makeSpeak<T>(animal: T): Unit where T <: Animal {
    println(animal.speak())
}

// Use base type array to store different subtypes
func speakAll(animals: Array<Animal>): Unit {
    println("Animal Choir:")
    for (a in animals) {
        println("  ${a.speak()}")
    }
}

main() {
    let dog = Dog("Da Huang")
    let cat = Cat("Xiao Bai")

    // Method 1: Generic function with constraints
    // Each call instantiates T as a concrete type
    println("=== Individual Calls ===")
    makeSpeak(dog)  // T = Dog
    makeSpeak(cat)  // T = Cat

    // Method 2: Base type array stores multiple subtypes
    println("\n=== Group Call ===")
    let animals: Array<Animal> = [
        Dog("Wang Cai"),
        Cat("Mi Mi"),
        Dog("Xiao Hei"),
        Cat("Hua Hua")
    ]
    speakAll(animals)
}