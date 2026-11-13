use std::sync::{Arc, Mutex, RwLock};
use std::thread;

fn main() {
    let config = Arc::new(RwLock::new(String::from("v1")));
    let hits = Arc::new(Mutex::new(0u32));

    let mut handles = Vec::new();
    for i in 0..4 {
        let config = Arc::clone(&config);
        let hits = Arc::clone(&hits);
        handles.push(thread::spawn(move || {
            let version = config.read().unwrap().clone(); // many readers at once
            *hits.lock().unwrap() += 1;                   // one writer at a time
            format!("worker {i} saw {version}")
        }));
    }
    for h in handles {
        println!("{}", h.join().unwrap());
    }

    *config.write().unwrap() = String::from("v2"); // waits until no reader holds it
    println!("hits = {}, config = {}", hits.lock().unwrap(), config.read().unwrap());
}
