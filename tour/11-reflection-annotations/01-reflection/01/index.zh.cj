import std.reflect.*

public class Counter {
    public static var step: Int64 = 2
    public var value: Int64 = 10
}

main(): Unit {
    let counter = Counter()
    let info = ClassTypeInfo.of(counter)

    let valueInfo = info.getInstanceVariable("value")
    let stepInfo = info.getStaticVariable("step")

    println("before:")
    println((valueInfo.getValue(counter) as Int64).getOrThrow())
    println((stepInfo.getValue() as Int64).getOrThrow())

    valueInfo.setValue(counter, 25)
    stepInfo.setValue(5)

    println("after:")
    println((valueInfo.getValue(counter) as Int64).getOrThrow())
    println((stepInfo.getValue() as Int64).getOrThrow())
}
