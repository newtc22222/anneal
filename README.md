# Anneal

Twenty short lessons on what happens under Rust code: threads and locks, what a future is, where memory goes, and how to measure. The third course, after [Patina](https://patina-rust.netlify.app) (the language) and [Temper](https://temper-axum.netlify.app) (Axum). It ends by putting Temper's notes service under load and making it faster.

The home page is a map of the lessons and how they connect. Progress stays in the browser. There is no account.

## Layout

- `src/` — lesson content (`lessons1.js`, `lessons2.js`), glossary, sheet and errors (`refs.js`), the app (`app.js`, `app.css`).
- `examples/` — one Cargo project holding every example, one binary per lesson (`a01` … `d19`), the capstone servers (`z20_before`, `z20_after`) and the load generator (`zload`). The lessons read their code from here.
- `build.py` — inlines everything into `site/index.html`. No dependencies beyond Python 3.

```bash
python3 build.py                                  # rebuild site/index.html
cd examples && cargo run --release --bin a05      # run one lesson's example
```

Outputs and timings in the lessons come from real runs with Rust 1.97 (edition 2024), Tokio 1.54 and Axum 0.8 on a 2-core machine.

Netlify runs `python3 build.py` and publishes `site/` (`netlify.toml`). The live page is [anneal-rust.netlify.app](https://anneal-rust.netlify.app).
