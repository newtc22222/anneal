use std::future::Future;
use std::pin::Pin;
use std::task::{Context, Poll};

struct Countdown(u32);

impl Future for Countdown {
    type Output = &'static str;

    fn poll(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        if self.0 == 0 {
            Poll::Ready("liftoff")
        } else {
            println!("poll: {} left, returning Pending", self.0);
            self.0 -= 1;
            cx.waker().wake_by_ref(); // "poll me again soon"
            Poll::Pending
        }
    }
}

async fn small() {
    tokio::task::yield_now().await;
}

async fn big() {
    let buf = [0u8; 4096]; // lives across the .await, so it is stored in the future
    tokio::task::yield_now().await;
    println!("{}", buf.len());
}

#[tokio::main]
async fn main() {
    let out = Countdown(3).await;
    println!("{out}");

    println!("small(): {} bytes", std::mem::size_of_val(&small()));
    println!("big():   {} bytes", std::mem::size_of_val(&big()));
}
