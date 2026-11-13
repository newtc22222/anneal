use std::thread;

fn main() {
    let handle = thread::spawn(|| {
        let sum: u64 = (1..=1_000_000).sum();
        sum // the thread's return value
    });
    let sum = handle.join().unwrap(); // wait for it, and take the value
    println!("sum = {sum}");

    let words = vec!["patina", "temper", "anneal", "forge"];
    let total = thread::scope(|s| {
        let a = s.spawn(|| words[..2].iter().map(|w| w.len()).sum::<usize>());
        let b = s.spawn(|| words[2..].iter().map(|w| w.len()).sum::<usize>());
        a.join().unwrap() + b.join().unwrap()
    }); // every scoped thread has finished here
    println!("{} letters in {:?}", total, words);
}
