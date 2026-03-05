// Annotations provide metadata to code elements
// Here we demonstrate the concept with a practical example

interface Validator {
    func validate(): Bool
}

struct Email {
    let value: String

    public init(value: String) {
        this.value = value
    }

    func isValid(): Bool {
        // Simple validation: check for @ symbol
        var hasAt = false
        var hasDot = false
        for (c in this.value) {
            if (c == '@') {
                hasAt = true
            }
            if (c == '.') {
                hasDot = true
            }
        }
        return hasAt && hasDot
    }
}

struct Age {
    let value: Int64

    public init(value: Int64) {
        this.value = value
    }

    func isValid(): Bool {
        return this.value > 0 && this.value < 150
    }
}

main() {
    let email1 = Email("user@example.com")
    let email2 = Email("invalid-email")
    let age1 = Age(25)
    let age2 = Age(-5)

    println("'${email1.value}' valid: ${email1.isValid()}")
    println("'${email2.value}' valid: ${email2.isValid()}")
    println("Age ${age1.value} valid: ${age1.isValid()}")
    println("Age ${age2.value} valid: ${age2.isValid()}")
}