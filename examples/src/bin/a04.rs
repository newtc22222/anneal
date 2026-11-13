use std::sync::mpsc;
use std::thread;

enum Command {
    Add(u32),
    Get(mpsc::Sender<u32>),
}

fn main() {
    let (tx, rx) = mpsc::channel::<Command>();

    // One thread owns the total. Nobody else can touch it, so no lock.
    let owner = thread::spawn(move || {
        let mut total = 0;
        for cmd in rx {
            match cmd {
                Command::Add(n) => total += n,
                Command::Get(reply) => reply.send(total).unwrap(),
            }
        }
        total // the loop ends when every Sender is dropped
    });

    let workers: Vec<_> = (1..=3)
        .map(|i| {
            let tx = tx.clone();
            thread::spawn(move || tx.send(Command::Add(i * 10)).unwrap())
        })
        .collect();
    for w in workers {
        w.join().unwrap();
    }

    let (reply_tx, reply_rx) = mpsc::channel();
    tx.send(Command::Get(reply_tx)).unwrap();
    println!("total so far: {}", reply_rx.recv().unwrap());

    drop(tx); // the last Sender: the owner's loop can end
    println!("owner finished with {}", owner.join().unwrap());
}
