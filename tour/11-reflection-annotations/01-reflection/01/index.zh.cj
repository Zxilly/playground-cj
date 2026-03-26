import std.reflect.*

// 定义一个简单的计数器类
public class Counter {
    public static var step: Int64 = 2      // 静态变量
    public var value: Int64 = 10           // 实例变量
}

main(): Unit {
    // 创建对象实例
    let counter = Counter()
    
    // 获取对象的类型信息
    let info = ClassTypeInfo.of(counter)
    println("类型名称: ${info.name}")
    println()
    
    // 通过名称查找成员变量
    let valueInfo = info.getInstanceVariable("value")
    let stepInfo = info.getStaticVariable("step")
    
    // 读取初始值
    println("修改前:")
    println("  value = ${(valueInfo.getValue(counter) as Int64).getOrThrow()}")
    println("  step = ${(stepInfo.getValue() as Int64).getOrThrow()}")
    println()
    
    // 通过反射修改变量值
    valueInfo.setValue(counter, 25)
    stepInfo.setValue(5)
    
    // 读取修改后的值
    println("修改后:")
    println("  value = ${(valueInfo.getValue(counter) as Int64).getOrThrow()}")
    println("  step = ${(stepInfo.getValue() as Int64).getOrThrow()}")
}