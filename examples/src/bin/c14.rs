use std::alloc::{GlobalAlloc, Layout, System};
use std::fmt::Write;
use std::sync::atomic::{AtomicUsize, Ordering::Relaxed};

// Wraps the system allocator and counts every allocation.
struct Counting;
static ALLOCS: AtomicUsize = AtomicUsize::new(0);

unsafe impl GlobalAlloc for Counting {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        ALLOCS.fetch_add(1, Relaxed);
        unsafe { System.alloc(layout) }
    }
    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        unsafe { System.dealloc(ptr, layout) }
    }
}

#[global_allocator]
static GLOBAL: Counting = Counting;

fn allocations(f: impl FnOnce()) -> usize {
    let before = ALLOCS.load(Relaxed);
    f();
    ALLOCS.load(Relaxed) - before
}

fn main() {
    let grow = allocations(|| {
        let mut v = Vec::new();
        for i in 0..1000 {
            v.push(i); // the buffer grows by doubling, copying each time
        }
    });
    let sized = allocations(|| {
        let mut v = Vec::with_capacity(1000);
        for i in 0..1000 {
            v.push(i);
        }
    });
    let fresh = allocations(|| {
        for i in 0..1000 {
            let line = format!("GET /notes/{i}"); // a new String every time
            std::hint::black_box(&line);
        }
    });
    let reused = allocations(|| {
        let mut line = String::with_capacity(32);
        for i in 0..1000 {
            line.clear(); // keeps the capacity
            write!(line, "GET /notes/{i}").unwrap();
            std::hint::black_box(&line);
        }
    });
    println!("Vec::new + 1000 pushes:      {grow} allocations");
    println!("Vec::with_capacity(1000):    {sized}");
    println!("format! 1000 times:          {fresh}");
    println!("one String, cleared, reused: {reused}");
}
