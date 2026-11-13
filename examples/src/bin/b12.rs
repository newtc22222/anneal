use std::time::Duration;
use tokio::task::JoinSet;
use tokio::time::sleep;
use tokio_util::sync::CancellationToken;

async fn worker(id: u32, token: CancellationToken) -> String {
    let mut jobs = 0;
    loop {
        tokio::select! {
            _ = token.cancelled() => break,       // stop between jobs
            _ = sleep(Duration::from_millis(60)) => jobs += 1, // one job
        }
    }
    format!("worker {id} stopped after {jobs} jobs")
}

#[tokio::main]
async fn main() {
    let token = CancellationToken::new();
    let mut workers = JoinSet::new();
    for id in 1..=3 {
        workers.spawn(worker(id, token.clone()));
    }

    // In a real service: tokio::signal::ctrl_c().await
    sleep(Duration::from_millis(200)).await;
    println!("shutdown signal");
    token.cancel();

    let mut reports: Vec<String> = Vec::new();
    while let Some(done) = workers.join_next().await {
        reports.push(done.unwrap());
    }
    reports.sort();
    for r in reports {
        println!("{r}");
    }
    println!("all workers finished, exiting");
}
