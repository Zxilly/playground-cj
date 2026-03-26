main() {
    println("函数课程完成！")
    
    // 用学到的知识写一个综合示例
    printUserInfo(name: "小明", age!: 20)
    printUserInfo(name: "小红", age!: 22, city!: "北京")
}

// 综合运用：普通参数、命名参数、默认值、元组返回
func getUserInfo(name!: String, age!: Int64, city!: String = "未知"): (String, Int64) {
    println("获取用户信息：${name}，${age}岁，来自${city}")
    (name, age)
}

func printUserInfo(name!: String, age!: Int64, city!: String = "上海") {
    let (n, a) = getUserInfo(name: name, age: age, city: city)
    println("保存用户：${n}（${a}岁）")
}