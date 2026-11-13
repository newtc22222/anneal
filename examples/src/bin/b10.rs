use std::time::Duration;
use tokio::time::{sleep, timeout};

struct Cleanup(&'static str);

impl Drop for Cleanup {
    fn drop(&mut self) {
        println!("  drop: {}", self.0);
    }
}

async fn slow_query() -> &'static str {
    let _guard = Cleanup("query state released");
    sleep(Duration::from_millis(500)).await;
    "rows"
}

#[tokio::main]
async fn main() {
    match timeout(Duration::from_millis(100), slow_query()).await {
        Ok(rows) => println!("got {rows}"),
        Err(_) => println!("timeout: gave up after 100 ms"),
    }

    tokio::select! {
        rows = slow_query() => println!("got {rows}"),
        _ = sleep(Duration::from_millis(100)) => println!("select: the timer won"),
    }
}
