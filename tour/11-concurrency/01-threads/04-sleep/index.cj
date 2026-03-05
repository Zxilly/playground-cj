import std.time.*

main() {
    println("Countdown starts!")

    let counter = spawn {
        var i = 5
        while (i > 0) {
            println("${i}...")
            sleep(100 * Duration.millisecond)
            i -= 1
        }
        println("Liftoff!")
    }

    // Meanwhile, main thread does other work
    let worker = spawn {
        sleep(200 * Duration.millisecond)
        println("(Background task completed)")
    }

    counter.get()
    worker.get()
    println("All done!")
}