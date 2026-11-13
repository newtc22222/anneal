use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::thread;

fn run(correct: bool) -> u64 {
    let count = Arc::new(AtomicU64::new(0));
    let handles: Vec<_> = (0..8)
        .map(|_| {
            let count = Arc::clone(&count);
            thread::spawn(move || {
                for _ in 0..100_000 {
                    if correct {
                        count.fetch_add(1, Ordering::Relaxed); // one indivisible step
                    } else {
                        let n = count.load(Ordering::Relaxed); // read...
                        count.store(n + 1, Ordering::Relaxed); // ...then write: another thread can slip in between
                    }
                }
            })
        })
        .collect();
    for h in handles {
        h.join().unwrap();
    }
    count.load(Ordering::Relaxed)
}

fn main() {
    println!("fetch_add:    {}", run(true));
    println!("load + store: {}", run(false));
}
