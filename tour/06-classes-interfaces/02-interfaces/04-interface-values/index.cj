interface Drawable {
    func draw(): String
}

class Point <: Drawable {
    let x: Int64
    let y: Int64

    init(x: Int64, y: Int64) {
        this.x = x
        this.y = y
    }

    func draw(): String {
        "Point(${x}, ${y})"
    }
}

class Line <: Drawable {
    let label: String

    init(label: String) {
        this.label = label
    }

    func draw(): String {
        "Line: ${label}"
    }
}

class Text <: Drawable {
    let content: String

    init(content: String) {
        this.content = content
    }

    func draw(): String {
        "Text: \"${content}\""
    }
}

func render(items: Array<Drawable>) {
    println("Rendering ${items.size} items:")
    for (item in items) {
        println("  ${item.draw()}")
    }
}

main() {
    // Different types stored as interface values
    let canvas: Array<Drawable> = [
        Point(10, 20),
        Line("horizontal"),
        Text("Hello World"),
        Point(30, 40)
    ]

    render(canvas)
}