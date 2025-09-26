package playground

// Call C standard library rand and printf functions
foreign func rand(): Int32
foreign func printf(fmt: CString, ...): Int32

unsafe main() {
    let text = LibC.mallocCString("random number: %d\n")
    for (_ in 0..5) {
        printf(text, rand())
    }
    LibC.free(text)
}