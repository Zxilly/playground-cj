main() {
    println("Countdown starting...")

    var count = 5
    while (count > 0) {
        println("${count}...")
        
        // Pause for 200 milliseconds
        sleep(200 * Duration.millisecond)
        
        count -= 1
    }

    // Pause briefly before printing "go"
    sleep(300 * Duration.millisecond)
    println("go!")
    
    println("Countdown finished")
}