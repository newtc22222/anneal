// Same API. The list is an immutable snapshot behind an Arc.
// Readers clone the Arc (a counter bump) and serialize outside any lock.
// Writers build the next version with copy-on-write.
use std::sync::{Arc, RwLock};

use axum::{Json, Router, extract::State, http::StatusCode, routing::get};
use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize)]
struct Note {
    id: u64,
    title: String,
    body: String,
}

#[derive(Deserialize)]
struct NewNote {
    title: String,
    body: String,
}

#[derive(Clone)]
struct AppState {
    notes: Arc<RwLock<Arc<Vec<Note>>>>,
}

async fn list_notes(State(state): State<AppState>) -> Json<Arc<Vec<Note>>> {
    let snapshot = state.notes.read().expect("notes lock").clone(); // clones the Arc, not the notes
    Json(snapshot) // the lock is already released here
}

async fn create_note(
    State(state): State<AppState>,
    Json(new_note): Json<NewNote>,
) -> (StatusCode, Json<Note>) {
    let mut notes = state.notes.write().expect("notes lock");
    let note = Note { id: notes.len() as u64 + 1, title: new_note.title, body: new_note.body };
    Arc::make_mut(&mut notes).push(note.clone()); // copies the Vec only if a reader still holds the old snapshot
    (StatusCode::CREATED, Json(note))
}

#[tokio::main]
async fn main() {
    let seed: Vec<Note> = (1..=2000)
        .map(|id| Note { id, title: format!("note {id}"), body: "x".repeat(120) })
        .collect();
    let state = AppState { notes: Arc::new(RwLock::new(Arc::new(seed))) };
    let app = Router::new()
        .route("/notes", get(list_notes).post(create_note))
        .with_state(state);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
