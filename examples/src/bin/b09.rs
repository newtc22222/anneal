use std::time::{Duration, Instant};

// A task that wants to run every 50 ms. Returns the worst gap it saw.
async fn ticker() -> u128 {
    let mut last = Instant::now();
    let mut worst = 0;
    for _ in 0..6 {
        tokio::time::sleep(Duration::from_millis(50)).await;
        worst = worst.max(last.elapsed().as_millis());
        last = Instant::now();
    }
    worst
}

#[tokio::main(flavor = "current_thread")] // one thread, to make the effect obvious
async fn main() {
    let tick = tokio::spawn(ticker());
    tokio::time::sleep(Duration::from_millis(10)).await;
    tokio::spawn(async {
        std::thread::sleep(Duration::from_millis(200)); // blocks the only thread
    })
    .await
    .unwrap();
    println!("blocking in a task:  worst gap {} ms", tick.await.unwrap());

    let tick = tokio::spawn(ticker());
    tokio::time::sleep(Duration::from_millis(10)).await;
    tokio::task::spawn_blocking(|| {
        std::thread::sleep(Duration::from_millis(200)); // runs on a separate thread pool
    })
    .await
    .unwrap();
    println!("spawn_blocking:      worst gap {} ms", tick.await.unwrap());
}
