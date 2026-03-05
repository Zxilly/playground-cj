class Animal {
    var name: String
    var age: Int64

    init(name: String, age: Int64) {
        this.name = name
        this.age = age
    }

    func describe(): String {
        "${name}, age ${age}"
    }

    func birthday() {
        age += 1
    }
}

main() {
    let cat = Animal("Whiskers", 3)
    println(cat.describe())

    cat.birthday()
    println("After birthday: ${cat.describe()}")

    // Reference type behavior
    let sameCat = cat
    sameCat.name = "Mr. Whiskers"
    println("Original: ${cat.name}")  // also changed
    println("Reference: ${sameCat.name}")
}