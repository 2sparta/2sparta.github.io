# Lesson self-assessment and border editing

Teachers enable **Settings → Allow students to assess their own lessons**.
The switch applies to the school and defaults to off. A linked student can
submit or change a mark 1–12 for their own published lesson, up to the current
lesson date, in **Grades → Lesson self-assessment**. Homework and final marks
remain teacher-only. Pending submissions are separate from official grades and
never affect averages. An existing official lesson mark or reviewed submission
locks student editing.

Teachers filter pending submissions by lesson date, optionally correct the mark,
and confirm it. Confirmation writes the official lesson mark and review audit
in one Firestore transaction; concurrent student changes require a fresh review.
Turning the switch off prevents new submissions/changes but retains the review queue.

## Firebase rollout

The website build does not publish Firebase rules. Apply the repository's updated
`firestore.rules` to the existing **schooleballs** Firebase project before enabling
self-assessment. `firebase.json` points at those rules. With an authenticated
Firebase CLI: `firebase deploy --only firestore:rules --project schooleballs`.
The new collections are `gradingSettings/{schoolId}` and
`selfAssessments/{lessonId}_{rosterId}`; documents are created on demand.
No migration of existing grades is required. Grade writes are teacher-only;
roster identity/class and lesson edits are protected from student modification.

## Borders

The school owner selects a country on the map and chooses **Fix border** (or
selects its existing contour in the editor). All existing ring vertices become
numbered blue handles; pan/zoom for dense sections. Parts/islands and holes retain
their own rings. Orange points belong to other visible countries. Snapping is on
by default and joins a dragged/drawn vertex to a neighbour within 12 screen pixels.
To share an entire border, match every intermediate vertex on that border.
Coordinates shared by rings act as linked nodes: moving one updates neighbouring
rings on save. All affected shapes save atomically in the existing atlas revision;
undo/redo restores both the geometry and its pending neighbour movements.
Neighbours outside the edited date range retain their original geometries.
Unrelated countries and legacy name-based replacements retain their behavior.
France stores same-named source records as one multipart country, preserving enclaves.

France adds 30 source snapshots (843–1994) and chronology to the common timeline.
See `public/atlas/france/NOTICE.md` for provenance and scope. Source dates are
shown explicitly; annual boundaries are not interpolated. 1940–1944 occupation
zones are not reconstructed and the prewar France layer is hidden in those years.
