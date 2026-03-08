interface Drawable {
    func draw(): String
}

class Line <: Drawable {
    public func draw(): String {
        "draw line"
    }
}

class Circle <: Drawable {
    public func draw(): String {
        "draw circle"
    }
}

class Text <: Drawable {
    public func draw(): String {
        "draw text"
    }
}

main() {
    let drawings: Array<Drawable> = [Line(), Circle(), Text()]
    for (drawing in drawings) {
        println(drawing.draw())
    }
}
