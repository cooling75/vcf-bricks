# Placement and assignment

The main workflow is placing components and assigning them to logical frames. Communication relationships are secondary; existing JSON edges remain intact. Dark mode, additional NSX/VNA objects and individually adjustable font sizes are separate follow-up tasks.

## Add a component

- Choose a frame or the free canvas under **Insert into**. Full paths distinguish nested destinations.
- Click a catalog entry to add the component in a free slot in the chosen target and focus it.
- Alternatively, drag the entry from the catalog onto the canvas. The highlighted frame shows the actual drop target. For nested frames, the innermost frame under the pointer wins.
- Dropping onto free canvas creates an unassigned component, regardless of the current insertion target.
- Selecting a frame makes it the insertion target; selecting a component uses its parent frame. You can change the target independently at any time.
- Catalog badges contain their short labels; full names wrap alongside them. Narrow screens use a single-column catalog. Hover or focus a catalog entry to see its description.

## Reassign an existing component

- Drag a component into another frame. The target frame is highlighted during the move. Dropping outside all frames moves it to the free canvas.
- Alternatively, choose a destination under **Parent frame**. The component is placed in a free slot there and focused.
- A group cannot be placed inside itself or its descendants. Moving a frame preserves the relative positions of its children.
- **Undo** and **Redo** treat movement and reassignment as a single change.
- New frames are compact and grow to accommodate their contents. Existing/imported frames are not indiscriminately resized.

## Navigate

- **Structure** shows an expandable tree. Selecting a tree entry focuses that element on the canvas.
- **Fit all**, **Focus selection** and **100%** switch between overview and editing.
- Frames have larger labels and a wider drag handle. Their font size is not yet individually configurable.
- Relationship editing is collapsed under **Communication relationships (optional)**. Existing lines remain visible and are exported unchanged.

Logical assignment does not assert physical hosting or official architecture validation. Touch users can use the insertion target, catalog buttons and properties panel; catalog drag-and-drop uses the native desktop HTML drag API.

## Language and existing drafts

The interface uses English, including help, examples and validation messages. Changing interface text does not translate or rewrite saved project titles, component labels, notes or versions. New components and newly loaded examples use English defaults; old drafts keep their original text. JSON schema keys, component kinds and relationship kinds remain unchanged.
