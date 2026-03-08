main() {
    println("main: before spawn")

    let first = spawn {
        println("worker 1: hello")
    }

    let second = spawn {
        println("worker 2: hello")
    }

    println("main: waiting")
    first.get()
    second.get()
    println("main: done")
}
