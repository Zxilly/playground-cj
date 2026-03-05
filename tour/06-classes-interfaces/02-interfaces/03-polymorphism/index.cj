interface Greetable {
    func greet(): String
}

class EnglishSpeaker <: Greetable {
    func greet(): String {
        "Hello!"
    }
}

class ChineseSpeaker <: Greetable {
    func greet(): String {
        "你好！"
    }
}

class FrenchSpeaker <: Greetable {
    func greet(): String {
        "Bonjour!"
    }
}

func greetAll(speakers: Array<Greetable>) {
    for (s in speakers) {
        println(s.greet())
    }
}

main() {
    let speakers: Array<Greetable> = [
        EnglishSpeaker(),
        ChineseSpeaker(),
        FrenchSpeaker()
    ]

    greetAll(speakers)
}