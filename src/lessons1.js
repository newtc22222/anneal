// Anneal — lessons 1–12. Inline code in `backticks`, **bold** for emphasis.
// needs: lessons (or the outside courses "patina" / "temper") this one builds on. The map draws these.
const OUTSIDE = {
  patina: { title: "Patina", summary: "The core language: ownership, borrows, traits, iterators.", href: "https://patina-rust.netlify.app" },
  temper: { title: "Temper", summary: "A web service with Axum: handlers, JSON, shared state.", href: "https://temper-axum.netlify.app" }
};

const TRACKS = [
  { id: "threads", title: "Sharing between threads", short: "Threads", summary: "Who may touch what, and the cost of waiting for a lock." },
  { id: "async", title: "Async underneath", short: "Async", summary: "What a future is, what a task is, and how work stops." },
  { id: "memory", title: "Memory and speed", short: "Memory", summary: "Layout, allocation, locality, and measuring honestly." },
  { id: "edges", title: "The edges", short: "Edges", summary: "Where the compiler stops checking, and you take over." },
  { id: "load", title: "Under load", short: "Load", summary: "Temper's notes service, measured, fixed, measured again." }
];

const LESSONS = [
{
  slug: "threads", track: "threads", minutes: 8, needs: ["patina"],
  title: "Threads and join",
  summary: "`spawn` starts an OS thread. `join` waits for it. Scoped threads may borrow.",
  blocks: [
    { type: "p", text: "Patina and Temper ran on threads you never saw. This course opens the hood. It starts with the plainest tool: an operating-system thread." },
    { type: "code", code: CODE.a01, out: `sum = 500000500000
23 letters in ["patina", "temper", "anneal", "forge"]` },
    { type: "ul", items: [
      "`thread::spawn` runs a closure on a new thread and returns a `JoinHandle`.",
      "`join()` waits for the thread to finish and hands back what the closure returned. If the thread panicked, `join` returns `Err`.",
      "`thread::scope` starts threads that are **guaranteed** to finish before the scope ends. Because of that guarantee, they may borrow `words` from the stack."
    ] },
    { type: "pick", prompt: "A plain `spawn` wants to print a local Vec. Which compiles?", a: `let v = vec![1];
thread::spawn(|| println!("{v:?}"));`, b: `let v = vec![1];
thread::spawn(move || println!("{v:?}"));`, answer: "b", error: "error[E0373]: closure may outlive the current function, but it borrows `v`", why: "A plain spawned thread may still be running after the function returns and `v` is dropped. `move` gives the thread its own `v`. Scoped threads are the other fix: they cannot outlive the scope, so borrowing is fine there." },
    { type: "callout", title: "Concurrency is not parallelism", text: "Two threads are **concurrent**: both are in progress. They run **in parallel** only if there are free CPU cores. Every timing in this course was measured on a 2-core cloud machine, so treat the numbers as directions, not promises." }
  ],
  why: {
    without: "Without threads, a program uses one core and does one thing at a time. A slow computation or a blocking call stops everything else.",
    answer: "Rust's threads are real OS threads with no runtime in between. The type system decides what may cross into them: owned data moved in, or borrows when a scope guarantees the thread ends first.",
    cost: "OS threads are heavy (each has its own stack, and switching between them goes through the kernel). Thousands of mostly-waiting tasks need async instead."
  },
  quiz: [
    { kind: "what", prompt: "What does `handle.join()` return?", choices: ["The closure's return value, or Err if the thread panicked", "Nothing; it only waits", "The thread's ID"], answer: 0, why: "`join` waits and returns `Result<T, _>` with whatever the closure returned." },
    { kind: "what", prompt: "Why may threads in `thread::scope` borrow local variables?", choices: ["Scoped threads always finish before the scope ends", "They run on the same core", "They copy everything automatically"], answer: 0, why: "The borrow checker needs to know the borrow ends before the data is dropped. The scope guarantees it." },
    { kind: "why", prompt: "Why does a plain `thread::spawn` closure need `move` to use a local?", choices: ["The thread might outlive the function that owns the local", "move makes it faster", "Closures cannot read variables"], answer: 0, why: "The local would be dropped when the function returns, while the thread could still be reading it." }
  ]
},
{
  slug: "send-sync", track: "threads", minutes: 9, needs: ["threads"],
  title: "Send and Sync",
  summary: "Two labels the compiler puts on every type. Thread boundaries check them.",
  blocks: [
    { type: "p", text: "When you call `spawn`, the compiler checks that everything moving into the new thread is safe to move there. It decides that from two **marker traits**. They have no methods. They only label a type." },
    { type: "ul", items: [
      "`Send`: a value of this type may be **moved** to another thread.",
      "`Sync`: a **shared reference** `&T` to this type may be used from several threads at once."
    ] },
    { type: "code", code: CODE.a02, out: "every check passed, at compile time" },
    { type: "p", text: "You almost never write these traits. The compiler derives them: a struct is `Send` if all its fields are, and `Sync` if all its fields are. One non-thread-safe field makes the whole struct non-thread-safe." },
    { type: "ul", items: [
      "`Rc<T>`: neither. Its reference count is a plain integer, so two threads updating it could lose a change.",
      "`Arc<T>`: both, if `T` is. Its count is updated atomically.",
      "`RefCell<T>`: `Send` but not `Sync`. Its borrow tracking is not thread-safe.",
      "`Mutex<T>`: `Sync` whenever `T` is `Send`. The lock is what makes sharing safe."
    ] },
    { type: "pick", prompt: "Which one compiles?", a: `let n = Rc::new(5);
thread::spawn(move || println!("{n}"));`, b: `let n = Arc::new(5);
thread::spawn(move || println!("{n}"));`, answer: "b", error: "error[E0277]: `Rc<i32>` cannot be sent between threads safely", why: "`spawn` requires its closure to be `Send`, so everything the closure owns must be `Send`. `Rc` is not." },
    { type: "callout", tone: "warn", title: "unsafe impl Send is a promise", text: "You can write `unsafe impl Send for MyType {}`. That tells the compiler to trust you. If the type is not actually safe to send, the result is undefined behaviour. Lesson 18 is about promises like that." }
  ],
  why: {
    without: "In Java, a `HashMap` can be handed to two threads, and nothing stops it. It works in tests and corrupts itself under load. Thread safety lives in documentation.",
    answer: "Rust records thread safety in the type itself. A library marks `Rc` as not `Send` once, and every program using it is protected. Data races become compile errors, at no runtime cost.",
    cost: "Errors about `Send` can point far from the real cause (the error lists the chain of fields). And these labels say nothing about deadlocks or logic mistakes."
  },
  quiz: [
    { kind: "what", prompt: "`T: Sync` means…", choices: ["&T can be used from several threads at once", "T is immutable", "T has no heap data"], answer: 0, why: "Formally, `T` is `Sync` exactly when `&T` is `Send`." },
    { kind: "what", prompt: "How does your own struct become Send?", choices: ["Automatically, if every field is Send", "You must always write impl Send", "By wrapping it in Box"], answer: 0, why: "`Send` and `Sync` are auto traits, derived from the fields." },
    { kind: "why", prompt: "Why is Rc not Send, while Arc is?", choices: ["Rc's reference count is not atomic, so two threads could corrupt it", "Rc is slower", "Rc cannot hold strings"], answer: 0, why: "Two threads incrementing a plain counter can lose an update, and then the value is freed too early or never." }
  ]
},
{
  slug: "locks", track: "threads", minutes: 9, needs: ["send-sync"], figure: "mutex",
  title: "Arc, Mutex, RwLock",
  summary: "`Arc` shares ownership. A lock decides who may touch the data right now.",
  blocks: [
    { type: "p", text: "`Arc` answers \"who frees this?\": the last owner. It gives only shared, read-only access. To change shared data you also need a lock." },
    { type: "figure", id: "mutex" },
    { type: "code", code: CODE.a03, out: `worker 0 saw v1
worker 1 saw v1
worker 2 saw v1
worker 3 saw v1
hits = 4, config = v2` },
    { type: "ul", items: [
      "`Mutex<T>`: one holder at a time. `lock()` waits its turn and returns a **guard**. The guard unlocks when it is dropped.",
      "`RwLock<T>`: many readers **or** one writer. Good for data read often and changed rarely, like configuration.",
      "The data is **inside** the lock. There is no way to reach it without locking, and no way to forget to unlock."
    ] },
    { type: "callout", title: "Poisoning", text: "If a thread panics while holding a std lock, the lock is marked **poisoned**, and later `lock()` calls return `Err`. That is why the examples call `.unwrap()` or `.expect()`: it says \"if another thread crashed mid-update, crash too\". Tokio's locks do not poison." },
    { type: "callout", title: "From Temper", text: "Temper's notes service is `Arc<Mutex<Vec<Note>>>`. `State` clones the `Arc` (a counter bump), and each handler locks the `Vec` for one short critical section. In the last lesson you will measure what that costs." }
  ],
  why: {
    without: "Shared data needs two answers: who frees it when the last user is done, and who may change it right now. In Java, the lock and the data are separate objects, so nothing stops code from touching the data without the lock.",
    answer: "`Arc` gives shared ownership with a thread-safe count. The lock owns the data, so access without the lock does not compile, and the guard's drop makes unlocking automatic.",
    cost: "Waiting for a lock is time lost. The borrow checker no longer protects you from deadlocks, only from data races."
  },
  quiz: [
    { kind: "what", prompt: "When is a Mutex unlocked?", choices: ["When the guard returned by lock() is dropped", "When you call unlock()", "When the thread ends"], answer: 0, why: "The guard is the borrow. Its drop releases the lock, on every path out of the scope." },
    { kind: "what", prompt: "Which lock lets many readers in at once?", choices: ["RwLock", "Mutex", "Arc"], answer: 0, why: "`RwLock` allows many readers or one writer. A `Mutex` allows one holder, whatever it is doing." },
    { kind: "why", prompt: "Why does the Mutex own the data instead of sitting beside it?", choices: ["So the data cannot be reached without taking the lock", "It saves memory", "So it can be cloned"], answer: 0, why: "Putting the data inside the lock turns \"remember to lock\" into a type rule." }
  ]
},
{
  slug: "channels", track: "threads", minutes: 9, needs: ["send-sync"], figure: "owner",
  title: "Channels and one owner",
  summary: "Instead of sharing data, give it one owner and send it messages.",
  blocks: [
    { type: "p", text: "A channel has a sending end and a receiving end. Sending **moves** the value: the sender no longer has it. That gives a design with no locks at all. One thread owns the state, and everyone else sends it requests." },
    { type: "figure", id: "owner" },
    { type: "code", code: CODE.a04, out: `total so far: 60
owner finished with 60` },
    { type: "ul", items: [
      "`mpsc` means multiple producers, single consumer. `tx.clone()` makes another sender. There is only one receiver.",
      "`for cmd in rx` runs until **every** sender is dropped. That is the shutdown signal, and it is just ownership.",
      "A request that needs an answer carries its own reply channel (`Get(Sender<u32>)`)."
    ] },
    { type: "callout", title: "The actor pattern", text: "A task or thread that owns some state and processes messages one at a time is often called an **actor**. Nothing is shared, so there is nothing to lock and no deadlock between locks. Updates are processed in the order they arrive." },
    { type: "callout", title: "If you know Java or TypeScript", text: "Like a `BlockingQueue` feeding one worker thread in Java, or `postMessage` to a Web Worker in JavaScript. In Rust, the moved value is gone from the sender, so it cannot be changed after it was sent." }
  ],
  why: {
    without: "With shared state, every user must take a lock, and the more users there are, the more they wait for each other. Invariants spread across many critical sections are easy to break.",
    answer: "Moving data through a channel keeps one owner for the state. The compiler's ownership rules already guarantee no one else touches it.",
    cost: "Every operation is a message plus a wait for the reply. One owner is one thread's worth of throughput."
  },
  quiz: [
    { kind: "what", prompt: "When does `for cmd in rx` stop?", choices: ["When every Sender has been dropped", "After a timeout", "Never"], answer: 0, why: "Receiving ends when no sender is left. Dropping the last sender is the shutdown." },
    { kind: "what", prompt: "What happens to a value after `tx.send(value)`?", choices: ["It is moved; the sender can no longer use it", "It is copied", "It is shared by reference"], answer: 0, why: "Sending transfers ownership to the receiver." },
    { kind: "why", prompt: "Why does the single-owner design need no Mutex?", choices: ["Only one thread ever touches the state; others send messages", "Channels contain a hidden Mutex for the state", "The state is immutable"], answer: 0, why: "Exclusive ownership already rules out concurrent access. The channel only carries requests." }
  ]
},
{
  slug: "atomics", track: "threads", minutes: 8, needs: ["locks"],
  title: "Atomics",
  summary: "A single number shared without a lock, and the bug that compiles anyway.",
  blocks: [
    { type: "p", text: "For one counter or flag, a whole lock is more than you need. Atomic types (`AtomicU64`, `AtomicBool`, …) offer operations the CPU performs as one indivisible step." },
    { type: "code", code: CODE.a05, out: `fetch_add:    800000
load + store: 677241`, caption: "The second number changes on every run. Measured on a 2-core machine." },
    { type: "p", text: "Both versions compile. Both are free of data races, because every access is atomic. Only the first is correct. `load` followed by `store` is two steps, and another thread can increment in between. That update is then overwritten." },
    { type: "callout", tone: "warn", title: "Compiles, still wrong", text: "Rust prevents **data races**: unsynchronised access to the same memory. It does not prevent **race conditions**: logic that depends on timing. Read-modify-write needs one operation (`fetch_add`, `compare_exchange`), or a lock around the whole step." },
    { type: "h", text: "Ordering, briefly" },
    { type: "p", text: "Every atomic operation takes an `Ordering`. `Relaxed` makes the operation itself atomic and nothing more, which is enough for a counter you read at the end. When an atomic flag announces that **other** data is ready, you need `Release` on the store and `Acquire` on the load. `SeqCst` is the strictest and the safest default when unsure." }
  ],
  why: {
    without: "A Mutex around a single counter makes every increment wait in line, and holds a lock for one machine instruction's worth of work.",
    answer: "Atomics use the CPU's own indivisible instructions. There is no waiting queue and no guard, and Rust still checks that they are shared safely (`AtomicU64` is `Sync`).",
    cost: "Only single values. Combining two atomics is not atomic. Orderings beyond `Relaxed` and `SeqCst` are subtle, and getting them wrong compiles."
  },
  quiz: [
    { kind: "what", prompt: "Why did `load` then `store` lose updates?", choices: ["Another thread could increment between the two steps", "Relaxed ordering drops writes", "Atomics are not thread-safe"], answer: 0, why: "Each step is atomic on its own. The pair is not." },
    { kind: "what", prompt: "Which ordering is enough for a counter read once at the end?", choices: ["Relaxed", "Acquire", "None; counters need a Mutex"], answer: 0, why: "`Relaxed` makes each operation atomic, which is all a counter needs." },
    { kind: "why", prompt: "What does Rust guarantee about the buggy version?", choices: ["No data race, but the logic can still be wrong", "It cannot compile", "It is always correct"], answer: 0, why: "Memory safety and correct logic are different things. Rust guarantees the first." }
  ]
},
{
  slug: "contention", track: "threads", minutes: 9, needs: ["locks", "atomics", "channels"],
  title: "Deadlocks and contention",
  summary: "Waiting forever, and waiting a lot. Neither is a compile error.",
  blocks: [
    { type: "h", text: "Deadlock: waiting forever" },
    { type: "p", text: "Thread A holds lock 1 and waits for lock 2. Thread B holds lock 2 and waits for lock 1. Neither ever continues. Rust compiles this happily." },
    { type: "code", code: `// Thread A
let _a = accounts.lock().unwrap();
let _b = audit_log.lock().unwrap();

// Thread B: same locks, opposite order. They can block each other forever.
let _b = audit_log.lock().unwrap();
let _a = accounts.lock().unwrap();`, file: "fragment" },
    { type: "ul", items: [
      "Always take several locks in the **same order** everywhere.",
      "Keep critical sections short, and never call unknown code (or `.await`) while holding a lock.",
      "A std `Mutex` is not re-entrant: locking it twice on the same thread deadlocks or panics."
    ] },
    { type: "h", text: "Contention: waiting a lot" },
    { type: "p", text: "A lock is correct and still slow when many threads want it at once. Each one waits while another holds it." },
    { type: "code", code: CODE.a06, out: `one lock:      8000000 in 643 ms
local + merge: 8000000 in 1 ms`, caption: "Release build, 2-core machine. Your numbers will differ; the gap will not disappear." },
    { type: "p", text: "Same answer, about 600 times slower. The first version spends its time handing one lock back and forth. The second gives each thread its own counter and merges once at the end." },
    { type: "callout", title: "Ways out", text: "Per-thread state merged at the end. Atomics for single numbers. `RwLock` for read-mostly data. Splitting one big lock into several (sharding). Or one owner and a channel (lesson 4). Choose by measuring." }
  ],
  why: {
    without: "It is tempting to believe that compiling means the concurrency is right. It means there is no data race. It does not mean threads make progress, or that they do so quickly.",
    answer: "Deadlocks and contention are design problems: lock order, critical-section size, and who shares what. You handle them with conventions and with measurement, because no type system can see them.",
    cost: "You have to reason about how locks are used at runtime, and test under realistic load, which the compiler cannot do for you."
  },
  quiz: [
    { kind: "what", prompt: "What is the classic cause of a two-lock deadlock?", choices: ["Two threads take the same two locks in opposite orders", "Using RwLock", "Too many threads"], answer: 0, why: "A consistent lock order makes that cycle impossible." },
    { kind: "what", prompt: "Why was \"one lock\" so much slower than \"local + merge\"?", choices: ["Threads spent their time waiting for and passing the single lock", "Mutex arithmetic is slow", "The local version skipped work"], answer: 0, why: "Both did the same additions. One version waited in line for every one of them." },
    { kind: "why", prompt: "Why doesn't Rust's type system prevent deadlocks?", choices: ["Deadlocks depend on the order things happen at runtime, not on types", "It does prevent them", "Deadlocks are undefined behaviour"], answer: 0, why: "Types describe what may be accessed. Deadlocks are about when, and in what order." }
  ]
},
{
  slug: "futures", track: "async", minutes: 10, needs: ["temper"], figure: "poll",
  title: "What a future is",
  summary: "A state machine that someone polls. `Pending` means \"wake me later\".",
  blocks: [
    { type: "p", text: "In Temper, `async fn` and `.await` just worked. Underneath, every `async fn` becomes a value that implements one trait, `Future`, with one method: `poll`." },
    { type: "figure", id: "poll" },
    { type: "ul", items: [
      "`poll` returns `Poll::Ready(value)` when the work is done, or `Poll::Pending` when it must wait.",
      "Before returning `Pending`, a future arranges to be woken: it hands the `Waker` from the context to whatever it is waiting on (a socket, a timer).",
      "The **executor** (Tokio) polls a future, parks it on `Pending`, and polls it again once its waker fires."
    ] },
    { type: "code", code: CODE.b07, out: `poll: 3 left, returning Pending
poll: 2 left, returning Pending
poll: 1 left, returning Pending
liftoff
small(): 24 bytes
big():   4120 bytes` },
    { type: "p", text: "`Countdown` is a hand-written future that wakes itself right away, so it is polled four times. Real futures wake when the network or a timer is ready." },
    { type: "p", text: "The sizes show the other half of the story. The compiler turns an `async fn` into a state machine, a struct holding whatever must survive across each `.await`. `big()` keeps a 4 KB buffer across its await, so the future itself is about 4 KB." },
    { type: "callout", title: "About Pin", text: "`poll` takes `Pin<&mut Self>`. A state machine may hold references into itself, so once it has been polled it must not move in memory. `Pin` is the type that promises that. You see it when writing futures by hand, which is rare." }
  ],
  why: {
    without: "Waiting for many sockets at once otherwise means a thread per socket, or callbacks that tear the code into pieces.",
    answer: "Rust turns sequential-looking `async` code into a state machine whose size is known at compile time, and leaves the scheduling to a library. That is why async Rust needs no garbage collector and runs on embedded devices as well as servers.",
    cost: "A future does nothing until something polls it. Large locals held across `.await` make every task that large. `Pin` appears in advanced code."
  },
  quiz: [
    { kind: "what", prompt: "What does `Poll::Pending` tell the executor?", choices: ["Not done yet; I arranged to be woken when I can continue", "An error happened", "Poll me again immediately, forever"], answer: 0, why: "Returning `Pending` without registering the waker would mean the future is never polled again." },
    { kind: "what", prompt: "Why is `big()` about 4 KB?", choices: ["Its buffer lives across an .await, so it is stored inside the future", "Async functions always allocate 4 KB", "Tokio pads futures"], answer: 0, why: "Anything held across an await is part of the state machine." },
    { kind: "why", prompt: "Why does Rust compile async functions into state machines instead of giving each a stack?", choices: ["The size is known at compile time, so no runtime is needed to manage growing stacks", "Stacks are not allowed in Rust", "It makes code shorter"], answer: 0, why: "Green threads (as in Go) need a runtime to manage stacks. A state machine is just a value." }
  ]
},
{
  slug: "tasks", track: "async", minutes: 9, needs: ["futures", "send-sync"],
  title: "The runtime and tasks",
  summary: "`tokio::spawn` hands a future to the runtime. It must be `Send` and `'static`.",
  blocks: [
    { type: "p", text: "A **task** is a future given to the runtime to drive on its own. Tokio's default runtime spreads tasks over a few worker threads, one per core. A task waiting on I/O costs a small heap allocation, not a thread." },
    { type: "code", code: CODE.b08, out: "10,000 tasks, sum = 99990000, in 56 ms" },
    { type: "p", text: "Ten thousand tasks, each waiting 50 ms, finish in about 56 ms on two cores. They all wait at the same time. Ten thousand OS threads would also work, but each would need its own stack." },
    { type: "h", text: "Why spawn has two requirements" },
    { type: "ul", items: [
      "`'static`: the task may outlive the function that spawned it, so it cannot borrow that function's locals. Move owned data in with `async move`.",
      "`Send`: a task may move between worker threads at any `.await`, so everything it holds across an await must be `Send`."
    ] },
    { type: "pick", prompt: "A task updates shared notes and then awaits. Which compiles?", a: `tokio::spawn(async move {
    let mut list = notes.lock().unwrap();
    tokio::task::yield_now().await;
    list.push(note);
});`, b: `tokio::spawn(async move {
    {
        let mut list = notes.lock().unwrap();
        list.push(note);
    } // guard dropped here
    tokio::task::yield_now().await;
});`, answer: "b", error: "error: future cannot be sent between threads safely\nnote: future is not `Send` as this value is used across an await", why: "A std `MutexGuard` is not `Send`. Held across the await, it becomes part of the task's state, so the task is not `Send`. Ending the guard's scope before the await fixes it, and also stops you from holding a lock while the task sleeps." },
    { type: "pick", prompt: "Which compiles?", a: `let name = String::from("ada");
tokio::spawn(async { println!("{name}") });`, b: `let name = String::from("ada");
tokio::spawn(async move { println!("{name}") });`, answer: "b", error: "error[E0373]: async block may outlive the current function, but it borrows `name`", why: "The same rule as threads in lesson 1: a spawned task may outlive the function that created it. `async move` gives it its own copy." }
  ],
  why: {
    without: "Servers spend most of their time waiting. A thread per connection makes every waiting connection cost a whole thread.",
    answer: "Tasks are cheap futures that the runtime multiplexes over a few threads. The `Send + 'static` bounds are how the compiler keeps that sharing safe.",
    cost: "The bounds are strict. Error messages about non-`Send` futures point at the `.await`, not at the value that caused it."
  },
  quiz: [
    { kind: "what", prompt: "Why must a spawned task be `'static`?", choices: ["It may outlive the function that spawned it", "It runs forever", "It is stored in a static variable"], answer: 0, why: "The runtime owns the task. The spawning function may return first." },
    { kind: "what", prompt: "What makes a task non-`Send`?", choices: ["Holding a non-Send value across an .await", "Using async move", "Returning a value"], answer: 0, why: "Values held across an await are stored in the future, and the future may move to another thread there." },
    { kind: "why", prompt: "Why can 10,000 tasks wait at once on two threads?", choices: ["A waiting task is a parked state machine, not a blocked thread", "Tokio creates 10,000 threads", "They actually run one after another"], answer: 0, why: "While a task waits, it uses no thread. The runtime polls it again when its timer fires." }
  ]
},
{
  slug: "blocking", track: "async", minutes: 8, needs: ["tasks"], figure: "blocking",
  title: "Blocking is the enemy",
  summary: "A task that does not reach an `.await` holds its thread, and everyone on it waits.",
  blocks: [
    { type: "p", text: "Async works only if tasks give the thread back at each `.await`. A task that calls `std::thread::sleep`, reads a file with `std::fs`, uses a blocking database driver, or computes for a long time never does. Every other task on that worker thread waits." },
    { type: "figure", id: "blocking" },
    { type: "code", code: CODE.b09, out: `blocking in a task:  worst gap 211 ms
spawn_blocking:      worst gap 51 ms`, caption: "Single-threaded runtime, to make the effect easy to see. On a multi-thread runtime the same thing happens to one worker at a time." },
    { type: "p", text: "The ticker wants to run every 50 ms. When a task blocks the only thread for 200 ms, the ticker waits 211 ms. With `spawn_blocking`, the blocking work runs on Tokio's separate pool for blocking jobs, and the ticker keeps its rhythm." },
    { type: "ul", items: [
      "Waiting on time or I/O: use the async version (`tokio::time::sleep`, `tokio::fs`, async drivers).",
      "Blocking library call or heavy computation: `tokio::task::spawn_blocking(|| ...)`.",
      "Lots of CPU-bound work: a dedicated thread pool such as `rayon`, and send results back over a channel."
    ] },
    { type: "callout", tone: "warn", title: "How it shows up in production", text: "Not as an error. As latency: a few requests are slow, then unrelated requests on the same worker are slow too, and CPU use looks low. The compiler cannot see blocking calls." }
  ],
  why: {
    without: "With one thread per request, a blocking call only hurts its own request. Async gives up that isolation to serve many requests per thread.",
    answer: "Rust's async model is cooperative: tasks yield at `.await`. That keeps tasks cheap, and makes \"never block\" the rule you must follow. `spawn_blocking` is the escape hatch for work that cannot avoid blocking.",
    cost: "You must know which calls block. Nothing in a function's type says \"this blocks\"."
  },
  quiz: [
    { kind: "what", prompt: "What happened to the ticker when a task called std::thread::sleep(200 ms)?", choices: ["It was delayed about 200 ms", "Nothing", "It crashed"], answer: 0, why: "The only thread was blocked, so the ticker could not be polled." },
    { kind: "what", prompt: "Where does `spawn_blocking` run its closure?", choices: ["On a separate pool of threads meant for blocking work", "On the same worker, but faster", "On the GPU"], answer: 0, why: "The async workers stay free to poll other tasks." },
    { kind: "why", prompt: "Why is blocking harmful in async code specifically?", choices: ["Tasks share threads and only switch at .await, so a blocked thread stalls all its tasks", "Async code is slower", "Blocking calls are unsafe"], answer: 0, why: "Cooperative scheduling depends on every task cooperating." }
  ]
},
{
  slug: "cancellation", track: "async", minutes: 9, needs: ["tasks"],
  title: "Timeouts and cancellation",
  summary: "Cancelling a future is dropping it. Destructors run, and work stops at an `.await`.",
  blocks: [
    { type: "p", text: "In Rust, a future stops when nobody polls it any more. Dropping a future cancels it at whatever `.await` it was parked on, and its destructors run like any other drop." },
    { type: "code", code: CODE.b10, out: `  drop: query state released
timeout: gave up after 100 ms
  drop: query state released
select: the timer won` },
    { type: "ul", items: [
      "`timeout(duration, future)` returns `Err` if the future is not done in time, and drops it.",
      "`select!` polls several futures and runs the branch of the first one to finish. The others are dropped.",
      "In both cases `Cleanup` printed its drop message: the half-finished query released what it held."
    ] },
    { type: "callout", tone: "warn", title: "Cancellation safety", text: "A future can be dropped at any `.await`. If it had done half of a two-step update, the second half never happens. Tokio's docs mark each method as cancellation-safe or not. For example, `mpsc::Receiver::recv` is safe in `select!` (a message is never lost), while reading into a buffer may not be." },
    { type: "callout", title: "If you know Java or TypeScript", text: "Java interrupts a thread and hopes the code checks for it. JavaScript cannot cancel a Promise at all, only ignore its result (fetch uses an `AbortController`). In Rust, cancellation is built into the model: stop polling, and drop." }
  ],
  why: {
    without: "Slow dependencies make requests pile up. Without a uniform way to stop work, each library invents its own (flags, tokens, interrupts), and many simply cannot be stopped.",
    answer: "Because a future only runs when polled, stopping is always possible and always the same: drop it. Timeouts and races compose around any async operation, and RAII cleans up what it held.",
    cost: "Code can stop at any `.await`, so multi-step updates need care, and `Drop` cannot run async cleanup."
  },
  quiz: [
    { kind: "what", prompt: "What does `timeout` do to the inner future when time runs out?", choices: ["Drops it, which cancels it", "Lets it keep running in the background", "Panics"], answer: 0, why: "Dropping the future is the cancellation. Its destructors run." },
    { kind: "what", prompt: "In `select!`, what happens to the branches that did not finish first?", choices: ["They are dropped", "They keep running", "They run after the winner"], answer: 0, why: "Only the winning branch's future completes. The others are cancelled by being dropped." },
    { kind: "why", prompt: "Why does a half-done update need care in async code?", choices: ["The future can be dropped at any .await, between the two steps", "Async code reorders statements", "Drop is never called for futures"], answer: 0, why: "Cancellation happens at await points. Keep updates that must stay together free of awaits, or make them safe to repeat." }
  ]
},
{
  slug: "backpressure", track: "async", minutes: 9, needs: ["channels", "tasks"], figure: "channel",
  title: "Bounded channels and backpressure",
  summary: "A full queue makes the producer wait. That is the feature.",
  blocks: [
    { type: "p", text: "When producers are faster than consumers, something has to give. An unbounded queue gives memory: it grows until the process runs out. A **bounded** channel makes the producer wait instead. That waiting is called **backpressure**." },
    { type: "figure", id: "channel" },
    { type: "code", code: CODE.b11, out: `   0 ms  sent 1
   0 ms  sent 2
   0 ms  sent 3
 100 ms    handled 1
 100 ms  sent 4
 200 ms    handled 2
 200 ms  sent 5
 300 ms    handled 3
 400 ms    handled 4
 500 ms    handled 5` },
    { type: "ul", items: [
      "The channel holds 2 jobs. Job 1 goes straight to the consumer, so jobs 2 and 3 fit in the queue at once.",
      "Job 4 waits: `send(...).await` does not finish until the consumer takes job 2 at 100 ms. The producer is slowed to the consumer's pace.",
      "Nothing piles up. Memory stays bounded however fast the producer is."
    ] },
    { type: "callout", title: "Limiting concurrency", text: "A `tokio::sync::Semaphore` with N permits caps how many tasks do something at once, such as calls to a slow API or database. Acquire a permit before the call; it is returned when dropped." },
    { type: "callout", title: "For servers", text: "An HTTP server faces the same choice. Accept everything and let queues grow, or cap concurrency and answer `503` early. A fast, honest refusal is usually better than slow timeouts for everyone." }
  ],
  why: {
    without: "With unbounded queues, overload does not fail quickly. Memory and latency grow until the process is killed, and every queued request is late.",
    answer: "Bounded channels and semaphores turn \"too much work\" into waiting at the source. Because waiting is just an `.await`, it costs no threads.",
    cost: "You must choose capacities and decide what happens when they are full: wait, drop, or reject."
  },
  quiz: [
    { kind: "what", prompt: "What does `send(job).await` do on a full bounded channel?", choices: ["Waits until there is room", "Drops the job", "Grows the channel"], answer: 0, why: "That waiting is the backpressure." },
    { kind: "what", prompt: "Why did jobs 2 and 3 both send at 0 ms with capacity 2?", choices: ["The consumer had already taken job 1 off the queue", "Capacity is a hint", "Sends never wait in the first 100 ms"], answer: 0, why: "The consumer received job 1 immediately, so two slots were free." },
    { kind: "why", prompt: "Why prefer a bounded queue over an unbounded one?", choices: ["Overload slows the producer instead of growing memory without limit", "Bounded queues are faster", "Unbounded queues lose messages"], answer: 0, why: "A queue that cannot fill only moves the problem until memory runs out." }
  ]
},
{
  slug: "shutdown", track: "async", minutes: 8, needs: ["cancellation", "backpressure"],
  title: "Graceful shutdown",
  summary: "Tell everyone to stop, let them finish the current job, then exit.",
  blocks: [
    { type: "p", text: "Deploys stop processes. A container platform sends a signal (SIGTERM), waits a few seconds, then kills. In those seconds a service should stop taking new work, finish what it started, and release its resources." },
    { type: "code", code: CODE.b12, out: `shutdown signal
worker 1 stopped after 3 jobs
worker 2 stopped after 3 jobs
worker 3 stopped after 3 jobs
all workers finished, exiting`, caption: "Needs tokio-util for CancellationToken: tokio-util = \"0.7\"." },
    { type: "ul", items: [
      "A `CancellationToken` is shared by everyone. `cancel()` once, and every `cancelled()` future completes.",
      "Each worker `select!`s between its next job and the token, so it stops **between** jobs, never in the middle of one.",
      "A `JoinSet` holds the spawned tasks. `join_next()` waits for each to finish, so `main` exits only after all of them have."
    ] },
    { type: "callout", title: "In Axum", text: "`axum::serve(listener, app).with_graceful_shutdown(signal)` stops accepting connections when `signal` completes and lets in-flight requests finish. Use the same token to stop background workers, and add an overall deadline so one stuck task cannot hold the exit forever." }
  ],
  why: {
    without: "Killing a process mid-work drops in-flight requests and leaves jobs half done, on every deploy.",
    answer: "Cancellation is dropping a future (lesson 10), so a shared token plus `select!` gives every task a clean stopping point, and `JoinSet` waits for them.",
    cost: "Every long-running loop needs a stopping point, and you need a deadline for tasks that do not stop in time."
  },
  quiz: [
    { kind: "what", prompt: "What does `token.cancel()` do?", choices: ["Completes every token.cancelled() future, in every task that holds a clone", "Kills all tasks immediately", "Drops the runtime"], answer: 0, why: "It is a signal. Each task decides where to stop." },
    { kind: "what", prompt: "Why do the workers stop between jobs, not mid-job?", choices: ["They only check the token in the select! that picks the next job", "Jobs cannot be cancelled", "JoinSet waits for jobs"], answer: 0, why: "The `select!` is the stopping point you chose." },
    { kind: "why", prompt: "Why is a graceful shutdown worth the extra code?", choices: ["In-flight work finishes on every deploy instead of failing", "It makes startup faster", "The compiler requires it"], answer: 0, why: "Deploys happen often. Without it, each one breaks some requests." }
  ]
}
];
