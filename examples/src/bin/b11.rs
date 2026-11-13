use std::time::{Duration, Instant};
use tokio::sync::mpsc;

#[tokio::main]
async fn main() {
    let start = Instant::now();
    let ms = move || start.elapsed().as_millis() / 10 * 10; // rounded to 10 ms
    let (tx, mut rx) = mpsc::channel::<u32>(2); // room for two jobs

    let producer = tokio::spawn(async move {
        for job in 1..=5 {
            tx.send(job).await.unwrap(); // waits while the channel is full
            println!("{:>4} ms  sent {job}", ms());
        }
    });

    while let Some(job) = rx.recv().await {
        tokio::time::sleep(Duration::from_millis(100)).await; // a slow consumer
        println!("{:>4} ms    handled {job}", ms());
    }
    producer.await.unwrap();
}
