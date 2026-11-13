// Temper's notes service, unchanged in shape: the list lives behind one Mutex,
// and listing clones the whole Vec while holding the lock.
use std::sync::{Arc, Mutex};

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
    notes: Arc<Mutex<Vec<Note>>>,
}

async fn list_notes(State(state): State<AppState>) -> Json<Vec<Note>> {
    let notes = state.notes.lock().expect("notes lock");
    Json(notes.clone()) // 2,000 notes copied, lock held the whole time
}

async fn create_note(
    State(state): State<AppState>,
    Json(new_note): Json<NewNote>,
) -> (StatusCode, Json<Note>) {
    let mut notes = state.notes.lock().expect("notes lock");
    let note = Note { id: notes.len() as u64 + 1, title: new_note.title, body: new_note.body };
    notes.push(note.clone());
    (StatusCode::CREATED, Json(note))
}

#[tokio::main]
async fn main() {
    let seed: Vec<Note> = (1..=2000)
        .map(|id| Note { id, title: format!("note {id}"), body: "x".repeat(120) })
        .collect();
    let state = AppState { notes: Arc::new(Mutex::new(seed)) };
    let app = Router::new()
        .route("/notes", get(list_notes).post(create_note))
        .with_state(state);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
