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
