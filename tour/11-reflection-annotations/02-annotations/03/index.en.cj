import std.reflect.TypeInfo

// Annotation that can only be used on member functions
@Annotation[target: [MemberFunction]]
public class Log {
    let level: String
    const init(level: String) {
        this.level = level
    }
}

// Annotation that can only be used on type declarations
@Annotation[target: [Type]]
public class Entity {
    let tableName: String
    const init(tableName: String) {
        this.tableName = tableName
    }
}

// Correct usage: @Entity applied to a class
@Entity["users"]
class User {
    public let id: Int64
    public let name: String
    
    public init(id: Int64, name: String) {
        this.id = id
        this.name = name
    }
    
    // Correct usage: @Log applied to member functions
    @Log["info"]
    public func display(): Unit {
        println("User(${id}, ${name})")
    }
    
    @Log["debug"]
    public func save(): Unit {
        println("Saving user to database")
    }
}

main() {
    let user = User(1, "Zhang San")
    
    // Get the Entity annotation of the class via reflection
    let entityOpt = TypeInfo.of(user).findAnnotation<Entity>()
    if (let Some(entity) <- entityOpt) {
        println("Entity table name: ${entity.tableName}")
    }
    
    // Call annotated methods
    user.display()
    user.save()
}