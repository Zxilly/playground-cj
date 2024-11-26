// 调用 C 标准库中的 rand 和 printf 函数
foreign func rand(): Int32
foreign func printf(fmt: CString, ...): Int32

unsafe main() {
    let text = LibC.mallocCString("random number: %d\n")
    for (_ in 0..5) {
        printf(text, rand())
    }
    LibC.free(text)
}
