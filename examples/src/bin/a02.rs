use std::cell::RefCell;
use std::sync::{Arc, Mutex};

fn is_send<T: Send>() {}
fn is_sync<T: Sync>() {}

fn main() {
    is_send::<Arc<String>>();
    is_sync::<Arc<String>>();
    is_send::<RefCell<u32>>();       // may move to another thread
    // is_sync::<RefCell<u32>>();    // may not be shared: error[E0277]
    is_sync::<Mutex<Vec<u32>>>();    // Mutex makes shared access safe
    // is_send::<std::rc::Rc<u32>>(); // error[E0277]
    println!("every check passed, at compile time");
}
