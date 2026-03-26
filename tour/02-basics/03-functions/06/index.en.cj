main() {
    println("Functions lesson complete!")
    
    // Write a comprehensive example using what we learned
    printUserInfo(name: "Xiaoming", age!: 20)
    printUserInfo(name: "Xiaohong", age!: 22, city!: "Beijing")
}

// Comprehensive usage: regular parameters, named parameters, default values, tuple returns
func getUserInfo(name!: String, age!: Int64, city!: String = "Unknown"): (String, Int64) {
    println("Getting user info: ${name}, ${age} years old, from ${city}")
    (name, age)
}

func printUserInfo(name!: String, age!: Int64, city!: String = "Shanghai") {
    let (n, a) = getUserInfo(name: name, age: age, city: city)
    println("Saved user: ${n} (${a} years old)")
}