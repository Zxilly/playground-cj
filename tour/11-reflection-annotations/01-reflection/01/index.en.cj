import std.reflect.*

// Define a simple counter class
public class Counter {
    public static var step: Int64 = 2      // Static variable
    public var value: Int64 = 10           // Instance variable
}

main(): Unit {
    // Create an object instance
    let counter = Counter()
    
    // Get type information of the object
    let info = ClassTypeInfo.of(counter)
    println("Type name: ${info.name}")
    println()
    
    // Find member variables by name
    let valueInfo = info.getInstanceVariable("value")
    let stepInfo = info.getStaticVariable("step")
    
    // Read initial values
    println("Before modification:")
    println("  value = ${(valueInfo.getValue(counter) as Int64).getOrThrow()}")
    println("  step = ${(stepInfo.getValue() as Int64).getOrThrow()}")
    println()
    
    // Modify variable values through reflection
    valueInfo.setValue(counter, 25)
    stepInfo.setValue(5)
    
    // Read modified values
    println("After modification:")
    println("  value = ${(valueInfo.getValue(counter) as Int64).getOrThrow()}")
    println("  step = ${(stepInfo.getValue() as Int64).getOrThrow()}")
}