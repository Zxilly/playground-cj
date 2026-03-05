# Generic Subtyping

The subtyping relationship between generic types is an important concept. If `Dog` is a subtype of `Animal`, is `Box<Dog>` a subtype of `Box<Animal>`?

This depends on the variance rules of the generic type. In Cangjie, generic types are invariant by default, meaning `Box<Dog>` and `Box<Animal>` have no subtyping relationship even if `Dog <: Animal`.

To use a subtype generic where a base type generic is expected, you typically use generic interfaces and type constraints to achieve polymorphism. The example shows how to use interfaces to achieve polymorphic behavior with generics.
