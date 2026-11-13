use std::ffi::{CString, c_char, c_int};

// Functions from the C standard library, which every Rust program on Linux links.
unsafe extern "C" {
    safe fn abs(x: c_int) -> c_int;              // takes a number: nothing can go wrong
    fn strlen(s: *const c_char) -> usize;        // takes a raw pointer: unsafe to call
}

/// A safe wrapper: the only way in is a Rust &str.
fn c_len(text: &str) -> usize {
    let c = CString::new(text).expect("no NUL bytes inside");
    // SAFETY: `c` is a valid, NUL-terminated string that lives until the call returns.
    unsafe { strlen(c.as_ptr()) }
}

fn main() {
    println!("abs(-42) = {}", abs(-42));
    println!("strlen(\"anneal\") = {}", c_len("anneal"));
}
