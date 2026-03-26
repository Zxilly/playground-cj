// Animal base class
open class Animal {
    public open func speak(): String {
        "Animal sound"
    }
}

// Dog class
class Dog <: Animal {
    public override func speak(): String {
        "Woof woof!"
    }

    public func fetch(): String {
        "The dog fetched the ball"
    }
}

// Cat class
class Cat <: Animal {
    public override func speak(): String {
        "Meow meow~"
    }

    public func climb(): String {
        "The cat climbed the tree"
    }
}

// Function to handle animals
func handleAnimal(a: Animal) {
    println("Animal speaks: ${a.speak()}")

    // Use is to check runtime type
    println("Is dog? ${a is Dog}")
    println("Is cat? ${a is Cat}")

    // Use as for safe conversion and access to type-specific methods
    match (a as Dog) {
        case Some(dog) => 
            println("Dog-specific action: ${dog.fetch()}")
        case None => ()
    }

    match (a as Cat) {
        case Some(cat) =>
            println("Cat-specific action: ${cat.climb()}")
        case None => ()
    }
}

// Process animals in batch
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

    println("Statistics: ${dogCount} dogs, ${catCount} cats")
}

main() {
    println("=== Type Checking and Casting ===\n")

    // Create different animals
    let dog: Animal = Dog()  // Declared type is Animal
    let cat: Animal = Cat()
    let generic = Animal()

    println("--- Handle Dog ---")
    handleAnimal(dog)

    println("\n--- Handle Cat ---")
    handleAnimal(cat)

    println("\n--- Handle Generic Animal ---")
    handleAnimal(generic)

    // Batch processing
    let zoo: Array<Animal> = [
        Dog(), Cat(), Dog(), Animal(), Cat()
    ]
    println("\n=== Zoo Statistics ===")
    processAnimals(zoo)
}