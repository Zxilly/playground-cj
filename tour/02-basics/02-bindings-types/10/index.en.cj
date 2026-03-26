main() {
    // Unit type: println returns Unit
    let result: Unit = println("println returns Unit type")
    println("Unit value: ${result}")
    println("Unit literal: ${()}")

    // Assignment expression also returns Unit
    var x = 10
    let assignment: Unit = (x = 20)
    println("After assignment x = ${x}")
    println("Assignment expression type: ${assignment}")

    // Loop expression returns Unit
    var count = 0
    let loopResult = while (count < 3) {
        println("In loop: ${count}")
        count = count + 1
    }
    println("Loop ended, loop body type: ${loopResult}")

    // Nothing type for control flow
    // break, continue, return, throw all have Nothing type
    var i = 0
    while (i < 5) {
        if (i == 3) {
            println("Encountered break, loop terminates")
            break  // break has Nothing type
            // This code will never execute
            // println("After break")
        }
        println("i = ${i}")
        i = i + 1
    }

    println("Program continues")

    // Unit type only supports assignment, equality, and inequality
    let a: Unit = ()
    let b: Unit = ()
    println("() == (): ${a == b}")
    println("() != (): ${a != b}")
}