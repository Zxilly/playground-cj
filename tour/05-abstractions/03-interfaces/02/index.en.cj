interface Runner {
    func run(): String
}

class Dog <: Runner {
    public func run(): String {
        "dog run"
    }
}

class Athlete <: Runner {
    public func run(): String {
        "athlete run"
    }
}

func showRun(item: Runner) {
    println(item.run())
}

main() {
    showRun(Dog())
    showRun(Athlete())
}
