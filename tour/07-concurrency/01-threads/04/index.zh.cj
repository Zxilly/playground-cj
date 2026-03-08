main() {
    var left = 3
    while (left > 0) {
        println("${left}...")
        sleep(200 * Duration.millisecond)
        left -= 1
    }

    println("go")
}
