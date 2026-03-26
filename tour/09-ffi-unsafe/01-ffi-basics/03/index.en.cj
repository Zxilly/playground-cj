foreign func rand(): Int32

// Entire function can be marked as unsafe
// Calling unsafe functions also requires unsafe context
unsafe func getRandomPair(): (Int32, Int32) {
    return (rand(), rand())
}

// unsafe functions can contain multiple unsafe operations
unsafe func rollDice(): Int32 {
    let n = rand()
    // Map random number to 1-6
    return (n % 6) + 1
}

main() {
    // unsafe block - must use when calling foreign functions
    let single = unsafe { rand() }
    println("Single random number: ${single}")
    
    // Calling unsafe function also requires unsafe context
    let pair = unsafe { getRandomPair() }
    println("Random pair: (${pair[0]}, ${pair[1]})")
    
    // Simulate dice rolling
    println("Dice roll result: ${unsafe { rollDice() }}")
    
    // unsafe block can contain multiple statements
    unsafe {
        let a = rand()
        let b = rand()
        let sum = a + b
        println("Sum calculated in unsafe block: ${sum}")
    }
}