package playground

// 示例场景：为 String 扩展循环右移运算符 >>
// 涉及特性：extend 类型扩展、operator func 运算符重载、字符串切片
extend String {
    operator func >>(n: Int64): String {
        if (n <= 0) {
            return this.clone()
        }
        let size = this.size
        let offset = size - n % size
        this[offset..size] + this[0..offset]
    }
}

main() {
    let text = "Cangjie2024"
    println(text >> 2 >> 2)
}
