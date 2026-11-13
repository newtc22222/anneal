// A tiny load generator: N keep-alive connections, each sending GET /notes in a loop.
use std::time::{Duration, Instant};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;

async fn conn(requests: usize) -> Vec<Duration> {
    let stream = TcpStream::connect("127.0.0.1:3000").await.unwrap();
    let (r, mut w) = stream.into_split();
    let mut r = BufReader::new(r);
    let mut lat = Vec::with_capacity(requests);
    let mut line = String::new();
    for _ in 0..requests {
        let t = Instant::now();
        w.write_all(b"GET /notes HTTP/1.1\r\nhost: x\r\n\r\n").await.unwrap();
        let mut len = 0usize;
        loop {
            line.clear();
            r.read_line(&mut line).await.unwrap();
            if line == "\r\n" { break; }
            if let Some(v) = line.to_ascii_lowercase().strip_prefix("content-length:") { len = v.trim().parse().unwrap(); }
        }
        let mut body = vec![0u8; len];
        r.read_exact(&mut body).await.unwrap();
        lat.push(t.elapsed());
    }
    lat
}

#[tokio::main]
async fn main() {
    let conns: usize = std::env::args().nth(1).map(|s| s.parse().unwrap()).unwrap_or(32);
    let per = 100;
    let start = Instant::now();
    let hs: Vec<_> = (0..conns).map(|_| tokio::spawn(conn(per))).collect();
    let mut all = Vec::new();
    for h in hs { all.extend(h.await.unwrap()); }
    let secs = start.elapsed().as_secs_f64();
    all.sort();
    let p = |q: f64| all[((all.len() as f64 - 1.0) * q) as usize].as_secs_f64() * 1000.0;
    println!("{} requests on {} connections: {:.0} req/s, p50 {:.1} ms, p99 {:.1} ms", all.len(), conns, all.len() as f64 / secs, p(0.5), p(0.99));
}
