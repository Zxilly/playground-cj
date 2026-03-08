open class Animal {
    public open func speak(): String {
        "..."
    }
}

class Dog <: Animal {
    public override func speak(): String {
        "woof"
    }

    public func fetch(): String {
        "ball"
    }
}

main() {
    let animal: Animal = Dog()
    println("animal is Dog = ${animal is Dog}")

    match (animal as Dog) {
        case Some(dog) => println("fetch ${dog.fetch()}")
        case None => println("not a dog")
    }
}
