// Visible only within the file
private func secretHelper(): String {
    return "This is a file-private function"
}

// Visible only within current package and subpackages (default)
func packageGreet(): String {
    return "This is a package-visible function"
}

// Visible only within the current module
protected func moduleHelper(): String {
    return "This is a module-visible function"
}

// Visible both inside and outside the module
public func publicGreet(name: String): String {
    return "Hello, ${name}! This is a publicly accessible function"
}

// Demonstrate default internal visibility
class InternalClass {
    public func show(): String {
        return "InternalClass is package-visible by default"
    }
}

main(): Unit {
    // All functions are visible within the same file
    println(secretHelper())
    println(packageGreet())
    println(moduleHelper())
    println(publicGreet("Developer"))
    
    // Using the class
    let obj = InternalClass()
    println(obj.show())
    
    println("\nVisibility summary:")
    println("private   - Current file only")
    println("internal  - Current package and subpackages (default)")
    println("protected - Current module")
    println("public    - Everywhere")
}