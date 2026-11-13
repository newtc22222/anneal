const GLOSSARY = [
  { name: "Arc", body: "Atomically reference-counted pointer: shared ownership across threads. The last owner frees the value. Gives read access only.", lesson: "locks" },
  { name: "Atomic", body: "A type such as `AtomicU64` whose operations the CPU performs as one indivisible step, shared without a lock.", lesson: "atomics" },
  { name: "Backpressure", body: "Making a fast producer wait when a consumer falls behind, usually with a bounded channel, instead of letting a queue grow without limit.", lesson: "backpressure" },
  { name: "Cache line", body: "The block of memory (commonly 64 bytes) the CPU fetches at once. Data side by side shares lines; scattered data does not.", lesson: "locality" },
  { name: "CancellationToken", body: "From tokio-util. A shared signal: `cancel()` once, and every `cancelled()` future completes.", lesson: "shutdown" },
  { name: "Cancellation", body: "Stopping async work by dropping its future. It stops at the `.await` it was parked on, and destructors run.", lesson: "cancellation" },
  { name: "Contention", body: "Many threads wanting the same lock at once, so most of them wait. Correct, but slow.", lesson: "contention" },
  { name: "Copy-on-write", body: "Share one value until someone changes it; then copy it first. `Arc::make_mut` does this.", lesson: "under-load" },
  { name: "Data race", body: "Two threads accessing the same memory at once, at least one writing, with no synchronisation. Impossible in safe Rust.", lesson: "send-sync" },
  { name: "Deadlock", body: "Threads waiting for each other's locks forever. Not prevented by the compiler; avoided by a consistent lock order.", lesson: "contention" },
  { name: "Executor", body: "The part of an async runtime that polls futures, parks them on `Pending`, and polls them again when woken.", lesson: "futures" },
  { name: "FFI", body: "Foreign function interface: calling code written in another language, usually C, through `extern` declarations.", lesson: "ffi" },
  { name: "Future", body: "A value implementing `Future`: a state machine that is polled until it returns `Ready`. Does nothing until polled.", lesson: "futures" },
  { name: "JoinHandle", body: "Returned by `thread::spawn` or `tokio::spawn`. Waiting on it gives the result of the thread or task.", lesson: "threads" },
  { name: "JoinSet", body: "A Tokio collection of spawned tasks. `join_next()` waits for them one at a time.", lesson: "shutdown" },
  { name: "Monomorphisation", body: "Compiling a separate copy of generic code for each concrete type, so calls are direct.", lesson: "dispatch" },
  { name: "Mutex", body: "Lets one holder at a time reach the data inside. `lock()` returns a guard; dropping the guard unlocks.", lesson: "locks" },
  { name: "Niche", body: "An impossible value of a type (such as a null Box) that Rust reuses to store an enum's tag, so `Option<Box<T>>` costs nothing extra.", lesson: "layout" },
  { name: "Padding", body: "Unused bytes the compiler inserts so each field starts at an address its alignment allows.", lesson: "layout" },
  { name: "Pin", body: "A type promising that a value will not move in memory. Futures need it because they may point into themselves.", lesson: "futures" },
  { name: "Poisoning", body: "A std lock is marked poisoned when a thread panics while holding it; later `lock()` calls return `Err`.", lesson: "locks" },
  { name: "Race condition", body: "Logic whose result depends on timing, such as a separate load and store. Safe Rust allows these.", lesson: "atomics" },
  { name: "RwLock", body: "A lock that allows many readers or one writer at a time.", lesson: "locks" },
  { name: "Scoped thread", body: "A thread started in `thread::scope`. It is guaranteed to finish before the scope ends, so it may borrow local data.", lesson: "threads" },
  { name: "select!", body: "Tokio macro that waits on several futures and runs the branch of the first to finish. The others are dropped.", lesson: "cancellation" },
  { name: "Send", body: "Marker trait: a value of this type may move to another thread.", lesson: "send-sync" },
  { name: "spawn_blocking", body: "Runs a blocking closure on Tokio's separate pool, so async worker threads stay free.", lesson: "blocking" },
  { name: "Sync", body: "Marker trait: `&T` may be shared between threads. `T: Sync` exactly when `&T: Send`.", lesson: "send-sync" },
  { name: "Task", body: "A future handed to the runtime with `tokio::spawn`, driven independently. Must be `Send + 'static` on the multi-thread runtime.", lesson: "tasks" },
  { name: "Undefined behaviour", body: "An operation the language gives no meaning to, such as a dangling read or a data race. Only possible through `unsafe`.", lesson: "unsafe" },
  { name: "unsafe", body: "Marks code where you uphold rules the compiler cannot check, such as dereferencing raw pointers or calling C.", lesson: "unsafe" },
  { name: "vtable", body: "A table of method pointers carried by a trait object, used to find the right method at runtime.", lesson: "dispatch" },
  { name: "Waker", body: "The handle a pending future gives to whatever it waits on, which calls `wake()` when the future can continue.", lesson: "futures" }
];

const SHEET = [
  { title: "Threads", rows: [
    ["thread::spawn(move || ...)", "A new OS thread. Owns what it uses."],
    ["handle.join().unwrap()", "Wait; get the return value."],
    ["thread::scope(|s| s.spawn(...))", "Threads that may borrow; all finish before the scope ends."],
    ["T: Send / T: Sync", "May move to / be shared between threads."]
  ] },
  { title: "Locks and atomics", rows: [
    ["Arc::new(Mutex::new(v))", "Shared, one holder at a time."],
    ["Arc<RwLock<T>>", "Many readers or one writer."],
    ["let g = m.lock().unwrap();", "Guard; unlocks on drop."],
    ["AtomicU64::fetch_add(1, Relaxed)", "Lock-free counter. One indivisible step."],
    ["load(); store(n + 1)", "Two steps: loses updates."]
  ] },
  { title: "Channels", rows: [
    ["mpsc::channel()", "std, unbounded. tx.clone() for more senders."],
    ["tokio::sync::mpsc::channel(n)", "Bounded. send().await waits when full."],
    ["for msg in rx", "Ends when every sender is dropped."],
    ["Semaphore::new(n)", "At most n at once. Permit returned on drop."]
  ] },
  { title: "Tasks", rows: [
    ["tokio::spawn(async move { ... })", "A task. Needs Send + 'static."],
    ["tokio::join!(a, b)", "Both concurrently, in this task."],
    ["spawn_blocking(|| ...)", "Blocking work, off the async workers."],
    ["guard across .await", "Makes the future non-Send. Drop it first."]
  ] },
  { title: "Stopping work", rows: [
    ["timeout(d, fut).await", "Err after d; the future is dropped."],
    ["select! { a = f => .., _ = g => .. }", "First to finish wins; the rest are dropped."],
    ["CancellationToken", "cancel() once; every cancelled() completes."],
    ["JoinSet::join_next()", "Wait for spawned tasks one by one."],
    ["serve(..).with_graceful_shutdown(sig)", "Axum: stop accepting, finish in-flight."]
  ] },
  { title: "Memory", rows: [
    ["size_of::<T>()", "Bytes, inline. Heap data not included."],
    ["#[repr(C)]", "Fixed field order, C padding."],
    ["Vec::with_capacity(n)", "One allocation instead of many."],
    ["s.clear()", "Keep the buffer; reuse it."],
    ["Vec<T> vs Vec<Box<T>>", "Side by side vs scattered."],
    ["T: Trait vs dyn Trait", "Direct call vs vtable lookup."]
  ] },
  { title: "Measuring", rows: [
    ["cargo run --release", "The only build worth timing."],
    ["std::hint::black_box(x)", "Hide x from the optimizer."],
    ["cargo bench", "criterion / divan benchmarks."],
    ["cargo flamegraph", "Where the time goes."]
  ] },
  { title: "The edges", rows: [
    ["unsafe { ... }", "Raw pointers, unsafe fns. Borrow checker still on."],
    ["// SAFETY: ...", "The promise that makes it correct."],
    ["unsafe extern \"C\" { safe fn abs(..); }", "Edition 2024 C declarations."],
    ["CString::new(s)", "Adds the NUL byte C expects."]
  ] }
];

const ERRORS = [
  { code: "E0373", title: "A thread borrows a local", message: "error[E0373]: closure may outlive the current function, but it borrows `v`, which is owned by the current function", meaning: "A plain spawned thread may keep running after the function returns and drops its locals.", fix: "Add `move` so the thread owns what it uses, or use `thread::scope` if you need to borrow.", broken: "let v = vec![1];\nthread::spawn(|| println!(\"{v:?}\"));", fixed: "let v = vec![1];\nthread::spawn(move || println!(\"{v:?}\"));", lesson: "threads", pre: "use std::thread;" },
  { code: "E0277", title: "A type that cannot cross threads", message: "error[E0277]: `Rc<i32>` cannot be sent between threads safely", meaning: "Something moved into a thread or task is not `Send`. The error lists which field is the problem.", fix: "Use the thread-safe version: `Arc` for `Rc`, `Mutex` or `RwLock` for `RefCell`.", broken: "let n = Rc::new(5);\nthread::spawn(move || println!(\"{n}\"));", fixed: "let n = Arc::new(5);\nthread::spawn(move || println!(\"{n}\"));", lesson: "send-sync", pre: "use std::rc::Rc; use std::sync::Arc; use std::thread;" },
  { code: "Send", title: "A future that is not Send", message: "error: future cannot be sent between threads safely\nnote: future is not `Send` as this value is used across an await", meaning: "A non-`Send` value, very often a std `MutexGuard`, is still alive at an `.await` inside a spawned task.", fix: "End the guard's scope (a block, or `drop(guard)`) before the `.await`. If you truly must hold a lock across an await, use `tokio::sync::Mutex`.", broken: "let mut list = notes.lock().unwrap();\ntokio::task::yield_now().await;\nlist.push(1);", fixed: "{\n    let mut list = notes.lock().unwrap();\n    list.push(1);\n}\ntokio::task::yield_now().await;", lesson: "tasks", tokio: true },
  { code: "E0373", title: "A task borrows a local", message: "error[E0373]: async block may outlive the current function, but it borrows `name`, which is owned by the current function", meaning: "`tokio::spawn` requires `'static`: the task may outlive the function that started it.", fix: "`async move`, so the task owns its data. Clone an `Arc` first if several tasks need it.", broken: "let name = String::from(\"ada\");\ntokio::spawn(async { println!(\"{name}\") });", fixed: "let name = String::from(\"ada\");\ntokio::spawn(async move { println!(\"{name}\") });", lesson: "tasks", tokio: true },
  { code: "E0499", title: "Two mutable views of one slice", message: "error[E0499]: cannot borrow `v` as mutable more than once at a time", meaning: "The compiler cannot see that two `&mut` ranges of the same slice do not overlap.", fix: "Use `split_at_mut`, which proves it once, with unsafe code inside a safe function.", broken: "let a = &mut v[..3];\nlet b = &mut v[3..];\na[0] += b[0];", fixed: "let (a, b) = v.split_at_mut(3);\na[0] += b[0];", lesson: "unsafe", pre: "let mut v = [1, 2, 3, 4, 5, 6];" }
];
