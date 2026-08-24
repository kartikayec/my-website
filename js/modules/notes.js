// Shared Notice Board Module
import { state } from './state.js';

export function initNotes() {
    const notesGrid = document.getElementById('notes-grid');
    const noteModal = document.getElementById('note-modal');
    const noteForm = document.getElementById('note-form');
    const noteText = document.getElementById('note-text');
    const addNoteBtn = document.getElementById('add-note-btn');
    const closeNoteBtn = document.getElementById('close-modal-btn');
    const cancelNoteBtn = document.getElementById('cancel-note-btn');

    function renderNotes() {
        if (!notesGrid) return;
        notesGrid.innerHTML = '';

        const notes = state.notes || [];

        if (notes.length === 0) {
            notesGrid.innerHTML = '<div style="font-size: 0.85rem; color: var(--text-secondary); text-align: center; padding: 1.5rem; width: 100%;">No active notices. Click "+ Add Note" to post on the board.</div>';
            return;
        }

        notes.forEach(note => {
            const div = document.createElement('div');
            div.className = 'note';
            div.setAttribute('data-id', note.id);

            const btn = document.createElement('button');
            btn.className = 'note-close';
            btn.setAttribute('aria-label', 'Delete note');
            btn.innerHTML = '&times;';
            btn.onclick = () => deleteNote(note.id);

            const p = document.createElement('p');
            p.textContent = note.text;

            div.appendChild(btn);
            div.appendChild(p);
            notesGrid.appendChild(div);
        });
    }

    function deleteNote(id) {
        const element = document.querySelector(`[data-id="${id}"]`);
        if (element) {
            element.classList.remove('note-added');
            element.classList.add('note-removing');
            element.addEventListener('animationend', () => {
                const updated = (state.notes || []).filter(n => n.id !== id);
                state.saveNotes(updated);
                renderNotes();
            });
        } else {
            const updated = (state.notes || []).filter(n => n.id !== id);
            state.saveNotes(updated);
            renderNotes();
        }
    }

    const showNoteModal = () => {
        if (!noteModal) return;
        noteModal.classList.add('active');
        noteModal.setAttribute('aria-hidden', 'false');
        if (noteText) noteText.focus();
    };

    const hideNoteModal = () => {
        if (!noteModal) return;
        noteModal.classList.remove('active');
        noteModal.setAttribute('aria-hidden', 'true');
        if (noteForm) noteForm.reset();
    };

    if (addNoteBtn) addNoteBtn.addEventListener('click', showNoteModal);
    if (cancelNoteBtn) cancelNoteBtn.addEventListener('click', hideNoteModal);
    if (closeNoteBtn) closeNoteBtn.addEventListener('click', hideNoteModal);

    if (noteForm) {
        noteForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = noteText ? noteText.value.trim() : '';
            if (text) {
                const newId = Date.now();
                const updated = [...(state.notes || []), { id: newId, text }];
                state.saveNotes(updated);
                renderNotes();

                const element = document.querySelector(`[data-id="${newId}"]`);
                if (element) element.classList.add('note-added');
                hideNoteModal();
            }
        });
    }

    // Initial render
    renderNotes();

    return { renderNotes, deleteNote };
}
