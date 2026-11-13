/// Split one mutable slice into two that do not overlap.
fn split_halves(v: &mut [u32]) -> (&mut [u32], &mut [u32]) {
    let mid = v.len() / 2;
    let ptr = v.as_mut_ptr();
    // SAFETY: `ptr` is valid for `v.len()` elements. The two ranges
    // [0, mid) and [mid, len) do not overlap, so the two &mut never alias,
    // and both borrow from `v`, so they cannot outlive it.
    unsafe {
        (
            std::slice::from_raw_parts_mut(ptr, mid),
            std::slice::from_raw_parts_mut(ptr.add(mid), v.len() - mid),
        )
    }
}

fn main() {
    let mut data = [1, 2, 3, 4, 5, 6];
    let (left, right) = split_halves(&mut data);
    left[0] = 10;
    right[0] = 40;
    println!("{data:?}");

    // The standard library already provides this, safely wrapped:
    let (a, b) = data.split_at_mut(3);
    a[1] += b[1];
    println!("{data:?}");
}
