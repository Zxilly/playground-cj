import std.reflect.*

class Animal {
    let name: String
    let legs: Int64

    public init(name: String, legs: Int64) {
        this.name = name
        this.legs = legs
    }

    func speak(): String {
        return "${this.name} makes a sound"
    }

    func describe(): String {
        return "${this.name} has ${this.legs} legs"
    }
}

main() {
    // Get TypeInfo for different types
    let intInfo = TypeInfo.of<Int64>()
    println("Type: ${intInfo}")

    let strInfo = TypeInfo.of<String>()
    println("Type: ${strInfo}")

    let animalInfo = TypeInfo.of<Animal>()
    println("Type: ${animalInfo}")

    // Create an instance and inspect it
    let dog = Animal("Dog", 4)
    println(dog.describe())
    println(dog.speak())
}