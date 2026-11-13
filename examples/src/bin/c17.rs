use std::hint::black_box;
use std::time::Instant;

fn sum_of_squares(n: u64) -> u64 {
    (0..n).map(|x| x * x % 7).sum()
}

fn main() {
    let t = Instant::now();
    let r = sum_of_squares(black_box(50_000_000)); // black_box: the optimizer can't precompute it
    println!("result {r} in {} ms", t.elapsed().as_millis());
}
