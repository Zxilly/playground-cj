sealed abstract class Result {
    public func message(): String
}

class Success <: Result {
    let value: Int64

    init(value: Int64) {
        this.value = value
    }

    public func message(): String {
        "success = ${value}"
    }
}

class Failure <: Result {
    let reason: String

    init(reason: String) {
        this.reason = reason
    }

    public func message(): String {
        "failure = ${reason}"
    }
}

main() {
    let results: Array<Result> = [Success(42), Failure("network timeout")]
    for (result in results) {
        println(result.message())
    }
}
