use std::time::{Duration, Instant};

#[tokio::main]
async fn main() {
    let start = Instant::now();
    let mut handles = Vec::new();
    for id in 0..10_000u64 {
        // Each spawn is a task: a future handed to the runtime to drive.
        handles.push(tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(50)).await;
            id * 2
        }));
    }
    let mut sum = 0;
    for h in handles {
        sum += h.await.unwrap(); // JoinHandle: wait for the task's result
    }
    println!("10,000 tasks, sum = {sum}, in {} ms", start.elapsed().as_millis());
}
