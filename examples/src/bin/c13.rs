use std::mem::{align_of, size_of};

#[allow(dead_code)]
struct Loose {
    a: u8,
    b: u32,
    c: u8,
}

#[allow(dead_code)]
#[repr(C)] // C layout: fields stay in the written order
struct InOrder {
    a: u8,
    b: u32,
    c: u8,
}

fn main() {
    println!("Loose:   size {:>2}, align {}", size_of::<Loose>(), align_of::<Loose>());
    println!("InOrder: size {:>2}, align {}", size_of::<InOrder>(), align_of::<InOrder>());
    println!("u64:               {:>2}", size_of::<u64>());
    println!("Option<u64>:       {:>2}", size_of::<Option<u64>>());
    println!("Box<u64>:          {:>2}", size_of::<Box<u64>>());
    println!("Option<Box<u64>>:  {:>2}", size_of::<Option<Box<u64>>>());
    println!("&str:              {:>2}", size_of::<&str>());
    println!("String / Vec<u8>:  {:>2}", size_of::<String>());
}
