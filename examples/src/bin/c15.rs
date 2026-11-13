use std::hint::black_box;
use std::time::Instant;

#[derive(Clone, Copy)]
struct Point {
    x: f64,
    y: f64,
}

const N: usize = 2_000_000;

fn main() {
    // Side by side: one allocation, Points next to each other.
    let flat: Vec<Point> = (0..N).map(|i| Point { x: i as f64, y: 1.0 }).collect();

    // One Box per Point: same values, but each Point is its own allocation.
    let mut boxed: Vec<Box<Point>> = (0..N).map(|i| Box::new(Point { x: i as f64, y: 1.0 })).collect();
    // Shuffle the pointers, as happens after a program has run for a while:
    // neighbours in the Vec now point far apart in memory.
    let mut seed = 0x2545_f491_4f6c_dd1du64;
    for i in (1..N).rev() {
        seed ^= seed << 13;
        seed ^= seed >> 7;
        seed ^= seed << 17;
        boxed.swap(i, (seed % (i as u64 + 1)) as usize);
    }

    for round in 0..2 {
        let t = Instant::now();
        let a: f64 = black_box(&flat).iter().map(|p| p.x + p.y).sum();
        let flat_ms = t.elapsed().as_secs_f64() * 1000.0;

        let t = Instant::now();
        let b: f64 = black_box(&boxed).iter().map(|p| p.x + p.y).sum();
        let boxed_ms = t.elapsed().as_secs_f64() * 1000.0;

        if round == 1 {
            println!("Vec<Point>:      {flat_ms:>5.1} ms (sum {a})");
            println!("Vec<Box<Point>>: {boxed_ms:>5.1} ms (sum {b})");
        }
    }
}
