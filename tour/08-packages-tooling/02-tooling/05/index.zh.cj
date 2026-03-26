// 恭喜完成工具链学习！
//
// 你已经学会了：
// - 使用 cjc 编译单个文件和包
// - 使用 cjpm init 初始化项目
// - 使用 cjpm build 编译项目
// - 使用 cjpm run 编译并运行
// - 使用 cjpm test 运行测试
// - 使用工作区管理多模块项目

main(): Unit {
    println("恭喜！你已经掌握了仓颉工具链的基础知识")
    
    let skills = [
        "cjc 编译器",
        "cjpm 包管理器",
        "项目初始化",
        "构建与运行",
        "工作区管理"
    ]
    
    println("\n已掌握的技能：")
    for (skill in skills) {
        println("  ✓ ${skill}")
    }
    
    println("\n继续探索仓颉编程语言吧！")
}