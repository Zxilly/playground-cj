# Abstract Classes

Abstract classes are defined with the `abstract` keyword and cannot be instantiated directly. They can contain abstract methods (without implementation) and concrete methods (with implementation).

Subclasses must implement all abstract methods, or they must also be declared abstract. Abstract classes define a common interface and partial default implementation for a group of related classes.

Abstract classes are well-suited for the "template method" pattern -- defining the skeleton of an algorithm in the base class while deferring specific steps to subclasses.

The example shows an abstract `Shape` class whose subclasses must implement `area` and `name` methods.
