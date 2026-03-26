// Trailing lambda: syntactic sugar for function calls

func myIf(flag: Bool, onTrue: () -> Int64): Int64 {
    if (flag) {
        onTrue()
    } else {
        0
    }
}

func applyTwice(action: (Int64) -> Int64): Int64 {
    action(action(2))
}

func repeat(n: Int64, action: (Int64) -> Unit): Unit {
    for (i in 1..=n) {
        action(i)
    }
}

main() {
    // Conventional call
    println(myIf(true, { => 100 }))
    
    // Trailing lambda: clearer syntax
    println(myIf(true) {
        100
    })
    
    // When there's only one function parameter, parentheses can be omitted
    println(applyTwice { value => value + 3 })
    
    // Equivalent to
    println(applyTwice({ value: Int64 => value + 3 }))
    
    // Common pattern: repeat execution
    repeat(3) { i =>
        println("Execution ${i}")
    }
    
    // Combined usage
    let result = myIf(5 > 3) {
        let x = 10
        x * 2
    }
    println("Conditional result: ${result}")
}