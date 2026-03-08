import std.reflect.*

@Annotation
public class Version {
    let code: String

    const init(code: String) {
        this.code = code
    }
}

@Version["1.0"]
class ApiV1 {}

@Version["2.0"]
class ApiV2 {}

main() {
    let objects = [ApiV1(), ApiV2()]
    for (obj in objects) {
        let annOpt = ClassTypeInfo.of(obj).findAnnotation<Version>()
        if (let Some(ann) <- annOpt) {
            println(ann.code)
        }
    }
}
