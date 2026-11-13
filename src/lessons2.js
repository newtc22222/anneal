// Anneal — lessons 13–20
LESSONS.push(
{
  slug: "layout", track: "memory", minutes: 8, needs: ["patina"],
  title: "Size and layout",
  summary: "Every type has a size and an alignment. The compiler arranges fields to waste less.",
  blocks: [
    { type: "p", text: "Speed starts with knowing how big things are. `std::mem::size_of` tells you, and the answers explain a lot." },
    { type: "code", code: CODE.c13, out: `Loose:   size  8, align 4
InOrder: size 12, align 4
u64:                8
Option<u64>:       16
Box<u64>:           8
Option<Box<u64>>:   8
&str:              16
String / Vec<u8>:  24`, caption: "64-bit machine." },
    { type: "ul", items: [
      "**Alignment**: a `u32` must start at an address divisible by 4. Gaps between fields to satisfy that are **padding**.",
      "Rust's default layout may reorder fields, so `Loose` packs its two bytes together: 8 bytes. `#[repr(C)]` keeps the written order (needed for C interop), and pays 12.",
      "`Option<u64>` needs room for \"is it there?\", so 16. `Option<Box<u64>>` stays 8: a Box is never null, so `None` is stored as the null pointer. This is the **niche** optimisation.",
      "`&str` is a pointer plus a length (16). `String` and `Vec` add a capacity (24). The text itself is elsewhere, on the heap."
    ] },
    { type: "callout", title: "Why size matters", text: "Small values fit more per cache line, copy faster, and make collections smaller. Large values make every move a big `memcpy`, and a large local held across an `.await` makes the whole future large (lesson 7). Clippy's `large_enum_variant` lint flags one common case." }
  ],
  why: {
    without: "In Java every object has a header and lives on the heap, and the JVM decides the layout. You cannot see or shape what a value costs in memory.",
    answer: "Rust stores values inline and tells you their exact size. Its default layout is free to reorder fields to save space, and `repr(C)` gives a fixed order when you need one.",
    cost: "The default layout is not guaranteed stable, so you cannot assume a field order without `repr(C)`. Sizes are something you now reason about."
  },
  quiz: [
    { kind: "what", prompt: "Why is `Option<Box<u64>>` the same size as `Box<u64>`?", choices: ["A Box is never null, so None is stored as the null pointer", "Option is free for every type", "Box is zero-sized"], answer: 0, why: "The unused value (null) is the niche that encodes `None`." },
    { kind: "what", prompt: "What does `#[repr(C)]` change?", choices: ["Fields stay in the written order, with C's padding rules", "The struct moves to the heap", "Nothing at runtime"], answer: 0, why: "The default `repr(Rust)` may reorder fields. `repr(C)` may not." },
    { kind: "why", prompt: "Why is Rust's default layout allowed to reorder fields?", choices: ["So the compiler can reduce padding and waste less memory", "To confuse C code", "To make debugging harder"], answer: 0, why: "Leaving the order unspecified lets the compiler optimise. You opt into a fixed order when you need it." }
  ]
},
{
  slug: "allocation", track: "memory", minutes: 9, needs: ["layout"],
  title: "What allocation costs",
  summary: "Count the allocations, then reduce them: reserve capacity, and reuse buffers.",
  blocks: [
    { type: "p", text: "Each heap allocation is a call into the allocator, and often a later free. Hot code that allocates in a loop pays that on every iteration. Rust lets you count them, by wrapping the allocator itself." },
    { type: "code", code: CODE.c14, out: `Vec::new + 1000 pushes:      9 allocations
Vec::with_capacity(1000):    1
format! 1000 times:          1000
one String, cleared, reused: 1`, caption: "The unsafe blocks implement the allocator interface. Lesson 18 explains what unsafe promises." },
    { type: "ul", items: [
      "A growing `Vec` doubles its buffer and copies everything each time: 9 allocations for 1000 pushes. `with_capacity` asks for the right size once.",
      "`format!` makes a new `String` every time. `clear()` keeps the buffer's capacity, so `write!` into the same `String` reuses it.",
      "The same habits: `String::with_capacity`, `Vec::reserve`, `extend` instead of repeated push, borrowing (`&str`) instead of `.to_string()`, and `.clone()` only when you need a second owner."
    ] },
    { type: "callout", tone: "warn", title: "Measure first", text: "Most allocations are cheap and fine. Optimise the ones in hot loops, after a profiler shows them. A heap profiler (`heaptrack`, the `dhat` crate) counts them for a real program, like this example does for a small one." }
  ],
  why: {
    without: "In a garbage-collected language, allocation is hidden and cheap at the call site. Its cost appears later as collection work and pauses, far from the code that caused it.",
    answer: "In Rust every allocation is visible in the code (`Box::new`, `Vec`, `String`, `format!`, `clone`) and paid where it happens, so you can see it, count it, and remove it.",
    cost: "Reuse makes code a little less tidy. `clear()` and preallocated buffers are a manual optimisation you have to maintain."
  },
  quiz: [
    { kind: "what", prompt: "Why did 1000 pushes cost 9 allocations?", choices: ["The Vec grew by doubling, reallocating each time it filled up", "Each push allocates", "Vec allocates 9 times on creation"], answer: 0, why: "Capacity 4, 8, 16, … up to 1024: about nine steps." },
    { kind: "what", prompt: "What does `String::clear()` keep?", choices: ["The allocated capacity", "The text", "Nothing"], answer: 0, why: "Length goes to zero, the buffer stays, so the next write reuses it." },
    { kind: "why", prompt: "Why is allocation easier to control in Rust than in Java?", choices: ["Every allocation is visible in the code and paid at that point", "Rust never allocates", "Rust's allocator is always faster"], answer: 0, why: "Visibility is what lets you count and remove them." }
  ]
},
{
  slug: "locality", track: "memory", minutes: 9, needs: ["layout", "allocation"], figure: "locality",
  title: "Cache locality",
  summary: "Data next to data is fast. A pointer to somewhere else is a trip.",
  blocks: [
    { type: "p", text: "The CPU does not read memory one value at a time. It fetches 64-byte **cache lines**, and guesses which line you need next. Reading data in order is what it is best at. Following pointers to scattered places is what it is worst at." },
    { type: "figure", id: "locality" },
    { type: "code", code: CODE.c15, out: `Vec<Point>:        3.7 ms (sum 2000001000000)
Vec<Box<Point>>:  11.9 ms (sum 2000001000000)`, caption: "Release build, 2-core machine, second of two rounds. Three runs gave 3.7–4.8 ms against 11.9–13.9 ms." },
    { type: "ul", items: [
      "`Vec<Point>`: two million points side by side. Each cache line holds four of them, and the next line is already on its way.",
      "`Vec<Box<Point>>`: two million pointers to two million separate allocations, in shuffled order. Almost every point is a fresh cache miss.",
      "Same answer, about 3× slower. With a linked list, where each load depends on the previous one, the gap is much larger."
    ] },
    { type: "callout", title: "If you know Java", text: "`ArrayList<Point>` is the `Vec<Box<Point>>` case: an array of references to separate objects. Rust gives you the flat version by default, because `Vec<T>` stores the values themselves." }
  ],
  why: {
    without: "When every object is a separate allocation behind a reference, the layout of your data is decided by the allocator, and loops spend their time waiting for memory.",
    answer: "Rust stores values inline, in the collection itself, unless you ask for indirection. The simple choice, `Vec<T>`, is the cache-friendly one.",
    cost: "Big elements make moves and growth more expensive. Heterogeneous collections (`Vec<Box<dyn Trait>>`) still need pointers."
  },
  quiz: [
    { kind: "what", prompt: "What does the CPU fetch from memory at a time?", choices: ["A cache line, commonly 64 bytes", "One byte", "One whole page of the program"], answer: 0, why: "Neighbouring data comes along for free, which is why order matters." },
    { kind: "what", prompt: "Which layout did the slow loop use?", choices: ["A Vec of pointers to separate, shuffled allocations", "A Vec of values side by side", "A HashMap"], answer: 0, why: "Each element meant following a pointer to a new place in memory." },
    { kind: "why", prompt: "Why is `Vec<T>` cache-friendly by default in Rust?", choices: ["It stores the values themselves contiguously, not references to them", "Rust disables the cache", "Vec uses a special allocator"], answer: 0, why: "No hidden boxing: the elements are the data." }
  ]
},
{
  slug: "dispatch", track: "memory", minutes: 8, needs: ["layout"],
  title: "Generics or dyn",
  summary: "One copy per type and a direct call, or one copy and a lookup.",
  blocks: [
    { type: "p", text: "Patina showed traits and generics. There are two ways to call a trait method, with different costs." },
    { type: "code", code: CODE.c16, out: `generic, squares only: 5
dyn, mixed:            4.14
&Square:     8 bytes
&dyn Shape:  16 bytes (data pointer + vtable pointer)` },
    { type: "ul", items: [
      "**Generics** (`T: Shape`): the compiler makes a copy of the function for each type used. Calls are direct and can be inlined. The cost is compile time and binary size.",
      "**Trait objects** (`dyn Shape`): one copy of the function. Each value carries a pointer to a **vtable**, a table of its methods, and each call looks the method up there. That is why `&dyn Shape` is 16 bytes.",
      "Only `dyn` can hold **different** types in one collection, like the `mixed` list."
    ] },
    { type: "callout", title: "Choosing", text: "Default to generics. Use `dyn` for collections of different types, plugins chosen at runtime, or to cut compile time where a generic is instantiated many times. The lookup itself costs little; what you lose is inlining in tight loops. If it matters, measure it." }
  ],
  why: {
    without: "In Java, interface calls are dynamic by default and the JIT tries to make them direct at runtime. You cannot choose, and you cannot see which calls were optimised.",
    answer: "Rust makes the choice explicit at each use: generics for zero-overhead static calls, `dyn` when you truly need runtime flexibility.",
    cost: "Generics multiply code. `dyn` loses inlining and needs a pointer. Some traits cannot be used as `dyn` at all (for example, those with generic methods)."
  },
  quiz: [
    { kind: "what", prompt: "Why is `&dyn Shape` twice the size of `&Square`?", choices: ["It carries a pointer to the data and a pointer to the vtable", "dyn copies the value", "It stores the type name"], answer: 0, why: "The vtable pointer is how the call finds the right method at runtime." },
    { kind: "what", prompt: "Which can store a Square and a Circle in the same Vec?", choices: ["Vec<Box<dyn Shape>>", "Vec<T> where T: Shape", "Neither"], answer: 0, why: "A generic `Vec<T>` holds one concrete type." },
    { kind: "why", prompt: "What do generics trade for their speed?", choices: ["Compile time and binary size, from one copy per type", "Memory safety", "Nothing"], answer: 0, why: "Monomorphisation makes direct calls possible by generating code for each type." }
  ]
},
{
  slug: "measuring", track: "memory", minutes: 8, needs: ["locality", "dispatch"],
  title: "Measuring honestly",
  summary: "Release builds, `black_box`, repeated runs, then a profiler.",
  blocks: [
    { type: "p", text: "Performance intuitions are often wrong, especially with an optimising compiler. Every claim in this course came from a measurement. These are the rules those measurements followed." },
    { type: "code", code: CODE.c17, out: `cargo run            →  result 99999998 in 821 ms
cargo run --release  →  result 99999998 in 56 ms` },
    { type: "ul", items: [
      "**Always use `--release`.** The debug build here is 15× slower. Never compare a debug Rust build with anything.",
      "**`black_box`** hides a value from the optimizer. Without it, the compiler may compute a constant result at compile time, or delete unused work, and you measure nothing.",
      "**Repeat and warm up.** Run more than once; the first run pays for cold caches. Report a range, not your best number.",
      "**Benchmark crates** do this properly: `criterion` or `divan` run the code many times and report statistics."
    ] },
    { type: "code", lang: "plain", file: "terminal", code: `cargo bench                         # criterion / divan benchmarks in benches/
cargo install flamegraph
cargo flamegraph --bin server       # where time goes, as a picture (needs perf on Linux)
[profile.release]
debug = 1                           # keep symbols so profiles show function names` },
    { type: "callout", title: "A flamegraph in one sentence", text: "Each bar is a function, its width is how much time was spent in it and everything it called, and the wide bars at the top are where to look first." }
  ],
  why: {
    without: "Without measuring, optimisation is guessing. You speed up code that was not slow, and make it harder to read.",
    answer: "Rust's tooling makes measuring routine: release profiles, `black_box` in std, benchmark crates, and native profilers that understand Rust symbols.",
    cost: "Measuring takes time, and good benchmarks take care to write. That is cheaper than optimising the wrong thing."
  },
  quiz: [
    { kind: "what", prompt: "What does `std::hint::black_box` prevent?", choices: ["The optimizer precomputing or deleting the work you meant to time", "Panics", "Allocations"], answer: 0, why: "It makes a value opaque to the optimizer, so the work must really happen." },
    { kind: "what", prompt: "In a flamegraph, what does a bar's width show?", choices: ["How much time was spent in that function and what it called", "When it ran", "How many lines it has"], answer: 0, why: "Width is time. The x-axis is not a timeline." },
    { kind: "why", prompt: "Why must timings use release builds?", choices: ["Debug builds skip optimisations and can be many times slower", "Release builds are easier to read", "Debug builds cannot be timed"], answer: 0, why: "A debug timing tells you about the debug build, not about the program you ship." }
  ]
},
{
  slug: "unsafe", track: "edges", minutes: 9, needs: ["layout"],
  title: "unsafe and its promises",
  summary: "`unsafe` does not turn checks off. It marks code where you prove what the compiler cannot.",
  blocks: [
    { type: "p", text: "Some correct code cannot be checked by the compiler: talking to C, writing an allocator, building a data structure from raw pointers. An `unsafe` block allows five extra operations there, the main ones being dereferencing raw pointers and calling `unsafe` functions. Everything else, including the borrow checker, still applies." },
    { type: "code", code: CODE.d18, out: `[10, 2, 3, 40, 5, 6]
[10, 7, 3, 40, 5, 6]` },
    { type: "ul", items: [
      "The borrow checker cannot see that the two halves do not overlap, so it would refuse two `&mut` borrows of `v`. Raw pointers let us say it ourselves.",
      "The `// SAFETY:` comment states the promise: the ranges do not overlap, and both stay inside `v`. Reviewers check that promise, not the whole program.",
      "The function itself is **safe** to call. No caller can misuse it. That is the goal of `unsafe`: small blocks wrapped in safe APIs. `split_at_mut` in std is exactly this."
    ] },
    { type: "callout", tone: "warn", title: "Undefined behaviour", text: "If an unsafe promise is false, the result is **undefined behaviour**: the compiler's assumptions break, and the program may do anything, including appear to work. Run tests under **Miri** (`cargo +nightly miri test`) to catch many of these mistakes." },
    { type: "callout", title: "Not unsafe", text: "Leaks, panics, deadlocks, and integer overflow are not undefined behaviour. Safe Rust can do all of them. `unsafe` is only about the rules that keep memory valid." }
  ],
  why: {
    without: "A language with no escape hatch cannot write its own collections, allocators, or bindings to C, so those parts would live in another language entirely.",
    answer: "Rust keeps those parts in Rust, but fenced: `unsafe` marks exactly where a human must prove correctness, and safe wrappers keep the rest of the program checked.",
    cost: "Safety now depends on those promises being true for every possible caller. Writing and reviewing unsafe code takes real care."
  },
  quiz: [
    { kind: "what", prompt: "Does an unsafe block turn off the borrow checker?", choices: ["No; it only allows a few extra operations, like dereferencing raw pointers", "Yes, completely", "Only for references"], answer: 0, why: "References inside unsafe code are still checked. Raw pointers are what is unchecked." },
    { kind: "what", prompt: "What is a `// SAFETY:` comment for?", choices: ["To state the promise that makes the unsafe code correct", "The compiler reads it", "To silence warnings"], answer: 0, why: "It turns a review of the whole program into a review of one stated claim." },
    { kind: "why", prompt: "Why wrap unsafe code in a safe function?", choices: ["So no caller can break the promise, and the rest of the program stays checked", "Safe functions run faster", "unsafe cannot be called from main"], answer: 0, why: "The proof is done once, inside. Callers get an ordinary safe API." }
  ]
},
{
  slug: "ffi", track: "edges", minutes: 7, needs: ["unsafe"],
  title: "Calling C",
  summary: "Declare the function, say whether calling it is safe, and wrap the pointers.",
  blocks: [
    { type: "p", text: "Rust has no runtime to embed, so calling C is a direct function call. Python and Node extensions written in Rust, and Rust inside existing C or C++ programs, all use this." },
    { type: "code", code: CODE.d19, out: `abs(-42) = 42
strlen("anneal") = 6`, caption: "Edition 2024 syntax: extern blocks are written unsafe extern, and items inside may be marked safe." },
    { type: "ul", items: [
      "The compiler cannot check C code, so the whole `extern` block is `unsafe`: you promise these declarations match the real C functions.",
      "`safe fn abs` says calling it is always fine (it takes a plain number). `strlen` stays unsafe because it reads through a raw pointer.",
      "`CString` adds the NUL byte C expects. The safe `c_len` wrapper means callers only ever pass a Rust `&str`."
    ] },
    { type: "callout", title: "Tools", text: "`bindgen` generates Rust declarations from C headers. `cbindgen` goes the other way. `PyO3` and `napi-rs` build Python and Node modules in Rust. All of them follow this pattern: unsafe declarations at the edge, safe wrappers inside." }
  ],
  why: {
    without: "Rewriting a whole system in a new language at once is rarely possible. A language that cannot call, and be called by, existing C code has to be adopted all or nothing.",
    answer: "Rust uses C's calling convention directly, so it can replace one piece of a system at a time. The `unsafe` boundary marks exactly where its guarantees end.",
    cost: "Everything across the boundary is your responsibility: types, pointer validity, string formats, who frees what, and threading rules."
  },
  quiz: [
    { kind: "what", prompt: "Why is calling `strlen` unsafe but `abs` marked safe?", choices: ["strlen reads through a raw pointer; abs takes a plain number", "abs is written in Rust", "strlen is slower"], answer: 0, why: "A bad pointer makes strlen read invalid memory. No input can make abs do that." },
    { kind: "what", prompt: "What does `CString::new` add?", choices: ["The NUL byte that ends a C string", "A length prefix", "UTF-16 encoding"], answer: 0, why: "C finds the end of a string by its NUL byte; Rust strings store a length instead." },
    { kind: "why", prompt: "Why does it matter that Rust can call C with no runtime in between?", choices: ["Rust can replace one part of an existing system at a time", "C is faster than Rust", "It removes the need for unsafe"], answer: 0, why: "Incremental adoption is how Rust gets into existing codebases." }
  ]
},
{
  slug: "under-load", track: "load", minutes: 14, needs: ["temper", "contention", "tasks", "measuring"],
  title: "Temper's notes, under load",
  summary: "Measure the service, find the lock, change one idea, measure again.",
  blocks: [
    { type: "p", text: "The capstone takes Temper's notes service as it is, seeded with 2,000 notes, and puts it under load. Same routes, same JSON. The only question is what happens when many clients list the notes at once." },
    { type: "h", text: "1. Measure the original" },
    { type: "code", file: "src/main.rs (before)", code: CODE.before_list, caption: "From Temper: the list is Arc<Mutex<Vec<Note>>>, and listing clones it under the lock." },
    { type: "p", text: "A small load generator (32 keep-alive connections, 100 `GET /notes` each, in the same Cargo project) produced:" },
    { type: "code", lang: "plain", file: "load test, before", code: `2716 req/s, p50 11.5 ms, p99 19.2 ms
2636 req/s, p50 12.3 ms, p99 19.1 ms
2623 req/s, p50 12.0 ms, p99 20.1 ms` },
    { type: "h", text: "2. Find where the time goes" },
    { type: "p", text: "Every request clones 2,000 notes (2,000 `String` pairs) **while holding the lock**, and only one request can hold it. Timing that clone on its own:" },
    { type: "code", lang: "plain", file: "micro-benchmark, release", code: `Vec clone: 131.4 µs    ← per request, with the lock held
Arc clone:   0.019 µs` },
    { type: "p", text: "At about 2,650 requests a second, that is around 350 ms of every second spent inside the lock, plus all the allocation work. Lessons 6 and 14 in one place: contention, and allocations in a hot path." },
    { type: "h", text: "3. Change one idea" },
    { type: "p", text: "Readers do not need their own copy. They need a list that will not change under them. So keep the list as an immutable **snapshot** behind an `Arc`, and replace the snapshot when a note is added." },
    { type: "code", file: "src/main.rs (after)", code: CODE.after_list },
    { type: "ul", items: [
      "`list_notes` clones the `Arc`, a counter bump, and releases the read lock at once. Serialising 2,000 notes happens outside any lock, and many readers do it in parallel.",
      "`Arc::make_mut` is **copy-on-write**: if no reader holds the old snapshot, it changes the Vec in place; if one does, it copies the Vec first, and the reader keeps its unchanged copy.",
      "`Json(Arc<Vec<Note>>)` works because serde's `rc` feature implements `Serialize` for `Arc`."
    ] },
    { type: "h", text: "4. Measure again" },
    { type: "code", lang: "plain", file: "load test, after", code: `3981 req/s, p50 7.9 ms, p99 14.5 ms
3999 req/s, p50 7.8 ms, p99 15.2 ms
4140 req/s, p50 7.5 ms, p99 13.5 ms`, caption: "Release builds; server and load generator shared the same 2-core machine, which caps both numbers." },
    { type: "p", text: "About 1.5× the throughput and a third less latency, from removing a copy and shortening a critical section. Every response is the same JSON as before." },
    { type: "callout", tone: "warn", title: "The trade-off", text: "Writes got more expensive. While readers hold the old snapshot, adding a note copies all 2,000. For a read-mostly list, that is the right trade. For a write-heavy one it is not, and a database is the real next step. Measure your own mix." },
    { type: "callout", title: "What you used", text: "Shared ownership and locks (3), contention (6), tasks and Send (8), allocation (14), measuring (17), and Temper's handlers, unchanged in shape. That is the course: the same program, understood one layer further down." },
    { type: "links", items: [
      { label: "Temper", href: "https://temper-axum.netlify.app", note: "Where this notes service comes from." },
      { label: "Tokio tutorial", href: "https://tokio.rs/tokio/tutorial", note: "Tasks, channels, select, and shared state, from the source." },
      { label: "Rust Atomics and Locks", href: "https://marabos.nl/atomics/", note: "Mara Bos's book, free online. Threads and atomics in depth." },
      { label: "The Rust Performance Book", href: "https://nnethercote.github.io/perf-book/", note: "Measuring, allocation, layout, and build settings." }
    ] }
  ],
  why: {
    without: "Without measuring, the instinct is to add threads, switch frameworks, or rewrite. None of those touch the real cost here: a big copy inside a lock.",
    answer: "Rust shows you the costs in the code: the `.clone()`, the lock guard's scope, the `Arc`. So a profile can lead to a small, local, safe change, and the compiler checks that the new sharing is still thread-safe.",
    cost: "Copy-on-write snapshots make writes pricier and add a type layer. The right design depends on your read/write mix, which only measurement tells you."
  },
  quiz: [
    { kind: "what", prompt: "What was the main cost in the original list handler?", choices: ["Cloning 2,000 notes while holding the only lock", "Serialising JSON", "Opening connections"], answer: 0, why: "About 130 µs per request inside a lock that only one request can hold." },
    { kind: "what", prompt: "What does `Arc::make_mut` do when a reader still holds the old snapshot?", choices: ["Copies the Vec, so the reader keeps an unchanged one", "Waits for the reader", "Panics"], answer: 0, why: "That is copy-on-write: writers pay, readers never see a change mid-read." },
    { kind: "why", prompt: "Why is the snapshot design right for this service but not for every one?", choices: ["Reads got cheap and writes got pricier; it suits a read-mostly workload", "It is always faster", "It removes the need for locks entirely"], answer: 0, why: "Every design trades something. Measurement of the real read/write mix decides." }
  ]
}
);

LESSONS.forEach((l, i) => { l.number = i + 1; });
