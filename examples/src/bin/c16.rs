use std::mem::size_of;

trait Shape {
    fn area(&self) -> f64;
}

struct Square(f64);
struct Circle(f64);

impl Shape for Square {
    fn area(&self) -> f64 {
        self.0 * self.0
    }
}
impl Shape for Circle {
    fn area(&self) -> f64 {
        3.14159 * self.0 * self.0
    }
}

// Static dispatch: one compiled copy per type; the call is direct.
fn total_generic<T: Shape>(shapes: &[T]) -> f64 {
    shapes.iter().map(|s| s.area()).sum()
}

// Dynamic dispatch: one compiled copy; each call looks up a vtable.
fn total_dyn(shapes: &[Box<dyn Shape>]) -> f64 {
    shapes.iter().map(|s| s.area()).sum()
}

fn main() {
    let squares = vec![Square(1.0), Square(2.0)];
    let mixed: Vec<Box<dyn Shape>> = vec![Box::new(Square(1.0)), Box::new(Circle(1.0))];
    println!("generic, squares only: {}", total_generic(&squares));
    println!("dyn, mixed:            {:.2}", total_dyn(&mixed));
    println!("&Square:     {} bytes", size_of::<&Square>());
    println!("&dyn Shape:  {} bytes (data pointer + vtable pointer)", size_of::<&dyn Shape>());
}
