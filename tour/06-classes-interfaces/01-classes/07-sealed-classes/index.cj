sealed abstract class Result {
    func isSuccess(): Bool
}

class Success <: Result {
    let value: Int64

    init(value: Int64) {
        this.value = value
    }

    func isSuccess(): Bool {
        true
    }
}

class Failure <: Result {
    let message: String

    init(message: String) {
        this.message = message
    }

    func isSuccess(): Bool {
        false
    }
}

func process(r: Result): String {
    match (r) {
        case s: Success => "Success: ${s.value}"
        case f: Failure => "Error: ${f.message}"
    }
}

main() {
    let results: Array<Result> = [
        Success(42),
        Failure("not found"),
        Success(100)
    ]

    for (r in results) {
        println(process(r))
    }
}