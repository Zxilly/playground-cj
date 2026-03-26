// 探索仓颉资源示例

import std.collection.ArrayList
import std.random.Random

main() {
    println("=== 仓颉学习资源 ===\n")
    
    // 官方资源
    println("官方文档: https://cangjie-lang.cn/docs")
    println("标准库源码: https://gitcode.com/Cangjie/cangjie-stdlib")
    println("社区包索引: https://gitcode.com/Cangjie-TPC")
    println("官方论坛: https://cangjie-lang.cn/community\n")
    
    // 展示更多可以学习的主题
    let topics = ArrayList<String>()
    topics.add("网络编程 (std.net.*)")
    topics.add("文件系统 (std.fs.*)")
    topics.add("数据库访问")
    topics.add("JSON/XML 处理")
    topics.add("反射与注解")
    topics.add("FFI 互操作")
    topics.add("并发高级模式")
    
    println("进阶学习方向:")
    for ((topic, i) in topics) {
        println("  ${i + 1}. ${topic}")
    }
    
    println("\n祝你学习愉快，编码顺利！")
    
    // 小彩蛋：用学过的知识做一个简单的随机选择器
    println("\n随机推荐学习: ${topics[Random().nextUInt64() % topics.size.toUInt64()].value}")
}