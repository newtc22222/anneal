use std::hint::black_box;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Instant;

const TOTAL: u64 = 8_000_000;
const THREADS: u64 = 8;

fn main() {
    // One shared counter behind one lock: every increment waits its turn.
    let start = Instant::now();
    let shared = Arc::new(Mutex::new(0u64));
    let handles: Vec<_> = (0..THREADS)
        .map(|_| {
            let shared = Arc::clone(&shared);
            thread::spawn(move || {
                for _ in 0..TOTAL / THREADS {
                    *shared.lock().unwrap() += 1;
                }
            })
        })
        .collect();
    for h in handles {
        h.join().unwrap();
    }
    println!("one lock:      {} in {} ms", shared.lock().unwrap(), start.elapsed().as_millis());

    // Each thread counts on its own, then the results are merged once.
    let start = Instant::now();
    let handles: Vec<_> = (0..THREADS)
        .map(|_| {
            thread::spawn(|| {
                let mut local = 0u64;
                for _ in 0..TOTAL / THREADS {
                    local = black_box(local + 1);
                }
                local
            })
        })
        .collect();
    let sum: u64 = handles.into_iter().map(|h| h.join().unwrap()).sum();
    println!("local + merge: {} in {} ms", sum, start.elapsed().as_millis());
}
